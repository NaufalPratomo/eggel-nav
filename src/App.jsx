import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Map from "./components/Map";
import NavigationHUD from "./components/NavigationHUD";
import SearchModal from "./components/SearchModal";
import SettingsModal from "./components/SettingsModal";
import { fetchRoute } from "./utils/osrm";
import {
  calculateHaversineDistance,
  calculateBearing,
  calculateDistanceToPolyline,
  formatDistance,
  formatDuration,
} from "./utils/geo";
import { sendTelegramAlert, formatManeuverMessage } from "./utils/telegram";
import { keepAlive } from "./utils/audioKeepAlive";
import { t } from "./utils/i18n";
import {
  Search,
  Settings as SettingsIcon,
  Crosshair,
  Navigation,
  X,
  Loader2,
  AlertTriangle,
  Compass,
  Sun,
  Moon,
  MapPin,
} from "lucide-react";

const DEFAULT_SETTINGS = {
  botToken: "8863619482:AAH_lEWklKmguELcK3ZJ_LoEdbMrOYwmkWk",
  chatId: "5694188432",
  alert1Dist: 150,
  alert2Dist: 40,
  language: "id",
};

function getSavedSettings() {
  try {
    const raw = localStorage.getItem("eggel_nav_settings");
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error("Failed to read settings:", e);
  }
  return DEFAULT_SETTINGS;
}

export default function App() {
  // Settings & Modals
  const [settings, setSettings] = useState(getSavedSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const lang = settings.language || "id";

  // Theme state ('light' | 'dark')
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("eggel_nav_theme") || "light";
    } catch {
      return "light";
    }
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("eggel_nav_theme", next);
      } catch (e) {
        console.warn("Failed to save theme:", e);
      }
      return next;
    });
  };

  // Geolocation state
  const [userPosition, setUserPosition] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator ? "locating" : "error"
  );
  const [gpsErrorMsg, setGpsErrorMsg] = useState(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator
      ? null
      : "Browser ini tidak mendukung Geolocation."
  );

  // Route & Navigation state
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [lastAlertSent, setLastAlertSent] = useState(null);

  // Map control
  const [centerTrigger, setCenterTrigger] = useState(0);

  // Synchronization refs for geolocation callback
  const prevPosRef = useRef(null);
  const routeRef = useRef(null);
  const destinationRef = useRef(null);
  const settingsRef = useRef(settings);
  const isNavigatingRef = useRef(false);
  const currentStepIndexRef = useRef(0);
  const lastRerouteTimeRef = useRef(0);
  const lastPreviewRouteCalcTimeRef = useRef(0);
  const lastGpsTimestampRef = useRef(0);
  const hasFixedLocationRef = useRef(false);
  const watchIdRef = useRef(null);
  const alertTrackerRef = useRef({
    stepIndex: 0,
    alert1Sent: false,
    alert2Sent: false,
    lastAlertTime: 0,
    minDist: Infinity,
    minDistToDest: Infinity,
  });

  // Keep refs synchronized with React state
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  // Persist settings
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem("eggel_nav_settings", JSON.stringify(newSettings));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  };

  // Fetch route helper
  const calculateRouteTo = useCallback(async (startPos, dest) => {
    if (!startPos || !dest) return;
    setIsRouting(true);
    setRouteError(null);
    try {
      const routeData = await fetchRoute(
        { lat: startPos.lat, lng: startPos.lng },
        { lat: dest.lat, lng: dest.lng }
      );
      setRoute(routeData);
    } catch (err) {
      console.error("Fetch route failed:", err);
      const isEn = settingsRef.current?.language === "en";
      setRouteError(err.message || (isEn ? "Failed to get OSRM route. Try another destination." : "Gagal mendapatkan rute OSRM. Coba tujuan lain."));
      setRoute(null);
    } finally {
      setIsRouting(false);
    }
  }, []);

  // Stop navigation
  const handleStopNavigation = useCallback(() => {
    setIsNavigating(false);
    isNavigatingRef.current = false;
    keepAlive.stop();
    const isEn = settingsRef.current?.language === "en";
    const stopMsg = isEn ? "[STOP]  * * *\nNavigation Ended" : "[SELESAI]  * * *\nNavigasi Selesai";
    sendTelegramAlert(settingsRef.current.botToken, settingsRef.current.chatId, stopMsg);
    setLastAlertSent(null);
  }, []);

  // Turn-by-Turn tracking logic executed on each GPS update
  const processTurnByTurn = useCallback(
    (currentPos) => {
      const activeRoute = routeRef.current;
      const activeDest = destinationRef.current;
      const activeSettings = settingsRef.current;
      if (!activeRoute || !activeRoute.steps || activeRoute.steps.length === 0) return;

      const steps = activeRoute.steps;
      const idx = currentStepIndexRef.current;
      const isEn = activeSettings.language === "en";

      // Direct straight-line distance to destination
      const distToDest = activeDest
        ? calculateHaversineDistance(
            currentPos.lat,
            currentPos.lng,
            activeDest.lat,
            activeDest.lng
          )
        : Infinity;

      // Check if on final step leading to destination
      const isFinalStep = idx >= steps.length - 1;

      const triggerArrival = () => {
        const cleanDestName = (activeDest?.name || "Tujuan").slice(0, 28);
        const arriveMsg = isEn
          ? `[ARRIVED]  *FINISH*\n${cleanDestName}`
          : `[TIBA]  *FINISH*\n${cleanDestName}`;
        sendTelegramAlert(activeSettings.botToken, activeSettings.chatId, arriveMsg);
        setLastAlertSent(t("arrived", activeSettings.language));
        handleStopNavigation();
      };

      // 1. Final destination reached (index exceeded)
      if (idx >= steps.length) {
        triggerArrival();
        return;
      }

      const currentStep = steps[idx];
      const distToManeuver = calculateHaversineDistance(
        currentPos.lat,
        currentPos.lng,
        currentStep.location.lat,
        currentStep.location.lng
      );

      const tracker = alertTrackerRef.current;
      if (tracker.stepIndex !== idx) {
        alertTrackerRef.current = {
          stepIndex: idx,
          alert1Sent: false,
          alert2Sent: false,
          lastAlertTime: tracker.lastAlertTime || 0,
          minDist: distToManeuver,
          minDistToDest: distToDest,
        };
      } else {
        tracker.minDist = Math.min(tracker.minDist, distToManeuver);
        tracker.minDistToDest = Math.min(tracker.minDistToDest || Infinity, distToDest);
      }

      // 2. ROBUST FINAL DESTINATION ARRIVAL CHECK
      // Solves: "saat saya sudah sampai tujuan / mendekati tujuan bukannya finish malah melebihi tujuan"
      if (isFinalStep || distToDest <= 50) {
        // A. Direct arrival within 30m of destination pin or 25m of final maneuver point
        const withinArrivalRadius = distToDest <= 30 || distToManeuver <= 25;

        // B. Closest approach passing: approached within 45m, and now distance is increasing
        // (handles when building is set back from road or parking across the street)
        const passedClosestApproach =
          (tracker.minDistToDest <= 45 || tracker.minDist <= 45) &&
          (distToDest > tracker.minDistToDest + 10 || distToManeuver > tracker.minDist + 10);

        // C. Stopped near destination (< 1.5 m/s or < 5 km/h within 45m)
        const stoppedNearDestination =
          (distToDest <= 45 || distToManeuver <= 45) &&
          currentPos.speed != null &&
          currentPos.speed < 1.5;

        if (withinArrivalRadius || passedClosestApproach || stoppedNearDestination) {
          triggerArrival();
          return;
        }
      }

      // 3. INTERMEDIATE STEP ADVANCEMENT CRITERIA (when not final step)
      if (!isFinalStep) {
        const distToNext = calculateHaversineDistance(
          currentPos.lat,
          currentPos.lng,
          steps[idx + 1].location.lat,
          steps[idx + 1].location.lng
        );

        // 1. Reached maneuver point (< 20m)
        const reachedManeuver = distToManeuver < 20;

        // 2. Moving away from maneuver towards next step:
        // Approached intersection (minDist <= 50m), now moving away, and within next step range
        const movingAwayTowardsNext =
          tracker.minDist <= 50 &&
          distToManeuver > tracker.minDist + 10 &&
          (distToNext < (currentStep.distance || 500) + 35 || distToNext < distToManeuver);

        // 3. Already within close proximity of next maneuver (< 25m)
        const alreadyAtNext = distToNext < 25;

        if (reachedManeuver || movingAwayTowardsNext || alreadyAtNext) {
          const nextIdx = idx + 1;
          if (nextIdx >= steps.length) {
            triggerArrival();
            return;
          }

          currentStepIndexRef.current = nextIdx;
          setCurrentStepIndex(nextIdx);
          alertTrackerRef.current = {
            stepIndex: nextIdx,
            alert1Sent: false,
            alert2Sent: false,
            lastAlertTime: Date.now(),
            minDist: distToNext,
            minDistToDest: distToDest,
          };
          return;
        }
      }

      // 4. SPEED-COMPENSATED PROXIMITY ALERT TRIGGERS
      // When riding a motorbike at 40-50 km/h (11-14 m/s), reaction + network latency
      // takes 2-3 seconds (~25-35m travel). We dynamically expand the alert distance
      // so notifications arrive on time without delay in the pocket!
      const now = Date.now();
      const throttleMs = 1200;
      const speed = currentPos.speed || 0; // m/s
      const speedBuffer = Math.round(speed * 3.0);
      const alert2Threshold = Math.max(activeSettings.alert2Dist || 40, 40 + speedBuffer);
      const alert1Threshold = Math.max(activeSettings.alert1Dist || 150, 150 + speedBuffer * 2);

      const targetDist = isFinalStep ? Math.min(distToManeuver, distToDest) : distToManeuver;

      // Alert 2: Imminent maneuver execution
      if (targetDist <= alert2Threshold && !tracker.alert2Sent) {
        if (now - tracker.lastAlertTime >= throttleMs) {
          const alertMsg = formatManeuverMessage(
            targetDist,
            currentStep.type,
            currentStep.modifier,
            currentStep.name,
            true,
            activeSettings.language || "id"
          );
          sendTelegramAlert(activeSettings.botToken, activeSettings.chatId, alertMsg);
          tracker.alert2Sent = true;
          tracker.alert1Sent = true;
          tracker.lastAlertTime = now;
          setLastAlertSent(alertMsg.split("\n")[0]);
        }
      }
      // Alert 1: Advance warning
      else if (targetDist <= alert1Threshold && !tracker.alert1Sent) {
        if (now - tracker.lastAlertTime >= throttleMs) {
          const alertMsg = formatManeuverMessage(
            targetDist,
            currentStep.type,
            currentStep.modifier,
            currentStep.name,
            false,
            activeSettings.language || "id"
          );
          sendTelegramAlert(activeSettings.botToken, activeSettings.chatId, alertMsg);
          tracker.alert1Sent = true;
          tracker.lastAlertTime = now;
          setLastAlertSent(alertMsg.split("\n")[0]);
        }
      }

      // 5. Off-route deviation check (>75m away from polyline, NEVER when near destination!)
      if (
        !isFinalStep &&
        distToDest > 75 &&
        activeRoute.geometry &&
        activeRoute.geometry.coordinates &&
        now - lastRerouteTimeRef.current >= 10000
      ) {
        const minDistance = calculateDistanceToPolyline(
          currentPos.lat,
          currentPos.lng,
          activeRoute.geometry.coordinates
        );

        if (minDistance > 75 && activeDest) {
          console.log("Off-route detected:", minDistance.toFixed(1), "meters. Recalculating...");
          lastRerouteTimeRef.current = now;
          fetchRoute(
            { lat: currentPos.lat, lng: currentPos.lng },
            { lat: activeDest.lat, lng: activeDest.lng }
          )
            .then((newRoute) => {
              setRoute(newRoute);
              routeRef.current = newRoute;
              const newStep = newRoute.steps.length > 1 ? 1 : 0;
              currentStepIndexRef.current = newStep;
              setCurrentStepIndex(newStep);
              alertTrackerRef.current = {
                stepIndex: newStep,
                alert1Sent: false,
                alert2Sent: false,
                lastAlertTime: Date.now(),
                minDist: Infinity,
                minDistToDest: distToDest,
              };
              const rerouteMsg = isEn
                ? "[REROUTE]  ^^^^^\nRecalculating..."
                : "[RUTE BARU]  ^^^^^\nMenghitung rute...";
              sendTelegramAlert(
                activeSettings.botToken,
                activeSettings.chatId,
                rerouteMsg
              );
              setLastAlertSent(t("rerouted", activeSettings.language));
            })
            .catch((e) => {
              console.warn("Reroute failed:", e);
            });
        }
      }
    },
    [handleStopNavigation]
  );

  // Central GPS position processor (used by both watchPosition and forced background polling)
  const handleGpsPosition = useCallback(
    (pos) => {
      lastGpsTimestampRef.current = Date.now();
      const { latitude, longitude, heading, speed, accuracy } = pos.coords;
      const prev = prevPosRef.current;

      let computedHeading = heading;
      let computedSpeed = speed;

      if (computedHeading == null || isNaN(computedHeading)) {
        if (prev) {
          const dist = calculateHaversineDistance(prev.lat, prev.lng, latitude, longitude);
          if (dist > 3) {
            computedHeading = calculateBearing(prev.lat, prev.lng, latitude, longitude);
          } else {
            computedHeading = prev.heading || 0;
          }
        } else {
          computedHeading = 0;
        }
      }

      if (computedSpeed == null || isNaN(computedSpeed)) {
        if (prev && prev.timestamp) {
          const dt = (pos.timestamp - prev.timestamp) / 1000;
          if (dt > 0.5) {
            const dist = calculateHaversineDistance(prev.lat, prev.lng, latitude, longitude);
            computedSpeed = dist / dt;
          }
        }
      }

      let finalSpeed = computedSpeed || 0;
      // Suppress stationary GPS drift (< 2 meters) and apply smoothing filter
      if (prev) {
        const moveDist = calculateHaversineDistance(prev.lat, prev.lng, latitude, longitude);
        if (moveDist < 2.0 && (!speed || speed < 0.5)) {
          finalSpeed = 0;
        } else if (prev.speed != null && prev.speed > 0) {
          finalSpeed = 0.4 * finalSpeed + 0.6 * prev.speed;
        }
      }

      const newPos = {
        lat: latitude,
        lng: longitude,
        heading: computedHeading || 0,
        speed: Math.max(0, finalSpeed),
        accuracy: accuracy,
        timestamp: pos.timestamp,
      };

      prevPosRef.current = newPos;
      setUserPosition(newPos);
      setGpsStatus("ready");
      setGpsErrorMsg(null);

      // Auto-fetch route if destination was already selected before GPS fixed
      if (!hasFixedLocationRef.current) {
        hasFixedLocationRef.current = true;
        if (destinationRef.current && !routeRef.current) {
          calculateRouteTo(newPos, destinationRef.current);
        }
      } else if (!isNavigatingRef.current && destinationRef.current && routeRef.current) {
        // If user moves in preview mode (> 20m from route starting coordinate),
        // auto-recalculate route from current real-time user location
        const startCoords = routeRef.current.geometry?.coordinates?.[0];
        if (startCoords) {
          const distFromRouteStart = calculateHaversineDistance(
            newPos.lat,
            newPos.lng,
            startCoords[1], // lat
            startCoords[0]  // lng
          );
          const now = Date.now();
          if (distFromRouteStart > 20 && now - lastPreviewRouteCalcTimeRef.current >= 3000) {
            lastPreviewRouteCalcTimeRef.current = now;
            calculateRouteTo(newPos, destinationRef.current);
          }
        }
      }

      // Live turn-by-turn processing if navigating
      if (isNavigatingRef.current) {
        processTurnByTurn(newPos);
      }
    },
    [calculateRouteTo, processTurnByTurn]
  );

  // Background Web Worker Heartbeat callback
  // When phone is in pocket with screen off, active polling prevents iOS GPS sleep
  const handleHeartbeat = useCallback(() => {
    if (!isNavigatingRef.current) return;
    const now = Date.now();
    const elapsed = now - lastGpsTimestampRef.current;

    // If no GPS update received in 3.5s while navigating, force-poll location
    if (elapsed > 3500 && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleGpsPosition(pos);
        },
        (err) => {
          console.warn("Background forced GPS poll:", err);
        },
        {
          enableHighAccuracy: true,
          timeout: 3000,
          maximumAge: 0,
        }
      );
    }
  }, [handleGpsPosition]);

  // Geolocation watcher
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const startWatching = () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          handleGpsPosition(pos);
        },
        (err) => {
          console.warn("GPS error:", err);
          setGpsStatus("error");
          if (err.code === 1) {
            setGpsErrorMsg("Izin lokasi ditolak. Aktifkan lokasi di pengaturan browser.");
          } else if (err.code === 2) {
            setGpsErrorMsg("Sinyal GPS tidak ditemukan.");
          } else {
            setGpsErrorMsg("Waktu tunggu GPS habis.");
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000,
        }
      );
    };

    startWatching();

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [handleGpsPosition]);

  // Destination pick handlers
  const handleSelectDestination = (place) => {
    if (isNavigating) {
      if (!window.confirm(t("confirmChangeDest", lang))) {
        return;
      }
      handleStopNavigation();
    }
    setDestination(place);
    destinationRef.current = place;
    if (userPosition) {
      calculateRouteTo(userPosition, place);
    }
  };

  const handleMapClick = (latlng) => {
    if (isNavigating) return;
    const place = {
      name: `${t("selectedPoint", lang)} (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`,
      lat: latlng.lat,
      lng: latlng.lng,
    };
    setDestination(place);
    destinationRef.current = place;
    if (userPosition) {
      calculateRouteTo(userPosition, place);
    }
  };

  const handleClearDestination = () => {
    if (isNavigating) {
      handleStopNavigation();
    }
    setDestination(null);
    destinationRef.current = null;
    setRoute(null);
    routeRef.current = null;
    setRouteError(null);
  };

  // Start Navigation
  const handleStartNavigation = async () => {
    let activeRoute = route;
    if (!activeRoute || !activeRoute.steps || activeRoute.steps.length === 0) return;

    // If user moved > 20m from initial preview route start, refresh route immediately
    if (userPosition && destination && activeRoute.geometry?.coordinates?.[0]) {
      const startCoords = activeRoute.geometry.coordinates[0];
      const distFromStart = calculateHaversineDistance(
        userPosition.lat,
        userPosition.lng,
        startCoords[1],
        startCoords[0]
      );
      if (distFromStart > 20) {
        try {
          const freshRoute = await fetchRoute(
            { lat: userPosition.lat, lng: userPosition.lng },
            { lat: destination.lat, lng: destination.lng }
          );
          setRoute(freshRoute);
          routeRef.current = freshRoute;
          activeRoute = freshRoute;
        } catch (e) {
          console.warn("Using existing route as fallback:", e);
        }
      }
    }

    setIsNavigating(true);
    isNavigatingRef.current = true;
    let startStep = activeRoute.steps.length > 1 ? 1 : 0;
    if (userPosition && activeRoute.steps.length > 2) {
      for (let i = 1; i < activeRoute.steps.length; i++) {
        const d = calculateHaversineDistance(
          userPosition.lat,
          userPosition.lng,
          activeRoute.steps[i].location.lat,
          activeRoute.steps[i].location.lng
        );
        if (d > 18) {
          startStep = i;
          break;
        }
      }
    }
    currentStepIndexRef.current = startStep;
    setCurrentStepIndex(startStep);

    alertTrackerRef.current = {
      stepIndex: startStep,
      alert1Sent: false,
      alert2Sent: false,
      lastAlertTime: 0,
      minDist: Infinity,
      minDistToDest: Infinity,
    };

    // Activate Silent Audio Loop, WebWorker heartbeat, & WakeLock for iOS background execution
    await keepAlive.start(handleHeartbeat);

    // Send initial Telegram notification to confirm connection with smartwatch
    const isEn = lang === "en";
    const cleanStartDest = (destination?.name || "Tujuan").slice(0, 24);
    const startMsg = isEn
      ? `[START]  ^^^^^\n${cleanStartDest}\n${formatDistance(activeRoute.distance)}`
      : `[MULAI]  ^^^^^\n${cleanStartDest}\n${formatDistance(activeRoute.distance)}`;
    sendTelegramAlert(settings.botToken, settings.chatId, startMsg);
    setLastAlertSent(t("navStarted", lang));
  };

  // Re-center map on user
  const handleCenterUser = () => {
    setCenterTrigger((c) => c + 1);
  };

  // Calculations for NavigationHUD
  const currentStep = route?.steps?.[currentStepIndex];

  const distToNextStep = useMemo(() => {
    if (!userPosition || !currentStep) return 0;
    return calculateHaversineDistance(
      userPosition.lat,
      userPosition.lng,
      currentStep.location.lat,
      currentStep.location.lng
    );
  }, [userPosition, currentStep]);

  const totalRemainingDistance = useMemo(() => {
    if (!route || !route.steps || currentStepIndex >= route.steps.length) return 0;
    let dist = distToNextStep;
    for (let i = currentStepIndex + 1; i < route.steps.length; i++) {
      dist += route.steps[i].distance;
    }
    return Math.round(dist);
  }, [route, currentStepIndex, distToNextStep]);

  const totalRemainingDuration = useMemo(() => {
    if (!route || !route.steps || currentStepIndex >= route.steps.length) return 0;

    let remainingDur = 0;
    // Sum duration of upcoming steps
    for (let i = currentStepIndex + 1; i < route.steps.length; i++) {
      remainingDur += route.steps[i].duration;
    }

    // Add remaining duration for the active step
    const activeStep = route.steps[currentStepIndex];
    if (activeStep && activeStep.distance > 0) {
      const stepRatio = Math.min(1, Math.max(0, distToNextStep / activeStep.distance));
      remainingDur += activeStep.duration * stepRatio;
    } else {
      remainingDur += distToNextStep / 8.3; // fallback ~30 km/h
    }

    return Math.max(0, Math.round(remainingDur));
  }, [route, currentStepIndex, distToNextStep]);

  return (
    <div
      className={`fixed inset-0 w-full h-full h-[100dvh] overflow-hidden select-none transition-colors duration-300 ${
        theme === "dark" ? "bg-[#0f0f12] text-white" : "bg-slate-100 text-slate-800"
      }`}
    >
      {/* Map Component */}
      <Map
        userPosition={userPosition}
        destination={destination}
        routeGeometry={route?.geometry}
        isNavigating={isNavigating}
        onMapClick={handleMapClick}
        centerTrigger={centerTrigger}
        theme={theme}
      />

      {/* Top Header Controls (Eggel Active athletic branding: matte carbon + electric lime) */}
      {!isNavigating && (
        <div className="absolute top-0 inset-x-0 px-3 pb-3 pt-safe z-[1000] pointer-events-none">
          <div
            className={`pointer-events-auto max-w-lg mx-auto px-4 py-3 rounded-2xl shadow-md flex items-center justify-between gap-3 border transition-colors ${
              theme === "dark"
                ? "bg-[#18181c] border-[#27272e] text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Logo / GPS status */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${
                  theme === "dark"
                    ? "bg-[#222228] border-[#2e2e38] text-[#d2fc15]"
                    : "bg-slate-100 border-slate-200 text-slate-800"
                }`}
              >
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight leading-none">{t("appName", lang)}</h1>
                <div className="flex items-center gap-1.5 text-[11px] mt-1">
                  {gpsStatus === "ready" ? (
                    <>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${theme === "dark" ? "bg-[#d2fc15]" : "bg-emerald-500"}`} />
                      <span className="font-medium text-slate-600 dark:text-zinc-300">{t("gpsReady", lang)}</span>
                    </>
                  ) : gpsStatus === "locating" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-medium text-slate-600 dark:text-zinc-300">{t("gpsLocating", lang)}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="font-medium text-rose-600 dark:text-rose-400 truncate max-w-[90px]">
                        {t("gpsError", lang)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: Search, Mode Toggle (Light/Dark), Settings */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsSearchOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 shadow-sm ${
                  theme === "dark"
                    ? "bg-[#d2fc15] hover:bg-[#c2eb0a] text-[#0f0f12]"
                    : "bg-[#0f0f12] hover:bg-[#27272e] text-white"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t("searchBtn", lang)}</span>
              </button>

              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl border transition active:scale-95 ${
                  theme === "dark"
                    ? "bg-[#222228] hover:bg-[#2a2a32] border-[#2e2e38] text-zinc-300"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                }`}
                aria-label="Toggle Theme"
                title={theme === "dark" ? t("lightMode", lang) : t("darkMode", lang)}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-[#d2fc15]" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className={`p-2 rounded-xl border transition active:scale-95 ${
                  theme === "dark"
                    ? "bg-[#222228] hover:bg-[#2a2a32] border-[#2e2e38] text-zinc-300"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                }`}
                aria-label={t("settingsTitle", lang)}
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Re-center button (Bottom right, when not navigating) */}
      {!isNavigating && (
        <button
          onClick={handleCenterUser}
          className={`absolute right-4 ${
            destination
              ? "bottom-[calc(env(safe-area-inset-bottom,0px)+17.5rem)]"
              : "bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)]"
          } z-[1000] p-3 rounded-xl shadow-md active:scale-95 transition border ${
            theme === "dark"
              ? "bg-[#18181c] border-[#27272e] text-[#d2fc15] hover:bg-[#222228]"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
          aria-label={t("recenterMap", lang)}
        >
          <Crosshair className="w-5 h-5" />
        </button>
      )}

      {/* GPS Error Notification Banner */}
      {gpsErrorMsg && !isNavigating && (
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+4.75rem)] inset-x-4 z-[1000] max-w-md mx-auto bg-amber-500 text-white p-3 rounded-xl text-xs flex items-center gap-2.5 shadow-md border border-amber-600">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="flex-1 font-medium">{gpsErrorMsg}</span>
        </div>
      )}

      {/* Bottom Route Preview Card (when destination selected & not navigating) */}
      {!isNavigating && destination && (
        <div className="absolute bottom-0 inset-x-0 px-4 pb-safe z-[1000] max-w-lg mx-auto">
          <div
            className={`rounded-2xl p-4 shadow-xl border transition-colors max-h-[75dvh] overflow-y-auto ${
              theme === "dark"
                ? "bg-[#18181c] text-white border-[#27272e]"
                : "bg-white text-slate-900 border-slate-200"
            }`}
          >
            {/* Header info */}
            <div
              className={`flex items-center justify-between pb-2.5 border-b ${
                theme === "dark" ? "border-[#27272e]" : "border-slate-200"
              }`}
            >
              <span className={`text-xs font-bold uppercase tracking-wider ${
                theme === "dark" ? "text-zinc-400" : "text-slate-500"
              }`}>
                {t("routeTrip", lang)}
              </span>
              <button
                onClick={handleClearDestination}
                className={`p-1.5 rounded-lg transition ${
                  theme === "dark"
                    ? "text-zinc-400 hover:text-white hover:bg-[#222228]"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
                aria-label="Hapus Tujuan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* From - To cards */}
            <div className="space-y-2 py-2.5">
              {/* Origin card */}
              <div
                className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                  theme === "dark"
                    ? "bg-[#1f1f25] border-[#2c2c36]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  theme === "dark" ? "bg-[#2c2c36]" : "bg-slate-200"
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    theme === "dark" ? "bg-[#d2fc15]" : "bg-slate-800"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] uppercase font-bold block ${
                    theme === "dark" ? "text-zinc-400" : "text-slate-500"
                  }`}>
                    {t("fromLabel", lang)}
                  </span>
                  <p className={`text-xs font-semibold truncate ${
                    theme === "dark" ? "text-zinc-200" : "text-slate-800"
                  }`}>
                    {t("myLocation", lang)}
                  </p>
                </div>
              </div>

              {/* Destination card */}
              <div
                className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                  theme === "dark"
                    ? "bg-[#1f1f25] border-[#2c2c36]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  theme === "dark" ? "bg-[#0284c7]/20 text-[#38bdf8]" : "bg-sky-100 text-sky-600"
                }`}>
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] uppercase font-bold block ${
                    theme === "dark" ? "text-[#38bdf8]" : "text-sky-600"
                  }`}>
                    {t("toLabel", lang)}
                  </span>
                  <p className={`text-xs font-semibold truncate ${
                    theme === "dark" ? "text-white" : "text-slate-900"
                  }`}>
                    {destination.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Route Stats (Distance & Duration) */}
            {isRouting ? (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-zinc-400 font-medium">
                <Loader2 className={`w-4 h-4 animate-spin ${
                  theme === "dark" ? "text-[#d2fc15]" : "text-slate-800"
                }`} />
                <span>{t("calculatingRoute", lang)}</span>
              </div>
            ) : routeError ? (
              <div className={`p-2.5 rounded-xl text-xs font-medium border ${
                theme === "dark"
                  ? "bg-rose-950/40 border-rose-900/60 text-rose-300"
                  : "bg-rose-50 border-rose-200 text-rose-600"
              }`}>
                {routeError}
              </div>
            ) : route ? (
              <div className="grid grid-cols-2 gap-2.5 py-1">
                {/* Distance stat - cyan accent matching Eggel's Km card */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    theme === "dark"
                      ? "bg-[#1f1f25] border-[#2c2c36]"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <span className={`text-[10px] uppercase font-bold ${
                    theme === "dark" ? "text-zinc-400" : "text-slate-500"
                  }`}>
                    {t("totalDistance", lang)}
                  </span>
                  <p className={`text-base font-extrabold mt-0.5 ${
                    theme === "dark" ? "text-[#38bdf8]" : "text-slate-900"
                  }`}>
                    {formatDistance(route.distance)}
                  </p>
                </div>

                {/* Duration stat - electric lime accent matching Eggel's timer */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    theme === "dark"
                      ? "bg-[#1f1f25] border-[#2c2c36]"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <span className={`text-[10px] uppercase font-bold ${
                    theme === "dark" ? "text-zinc-400" : "text-slate-500"
                  }`}>
                    {t("estimatedTime", lang)}
                  </span>
                  <p className={`text-base font-extrabold mt-0.5 ${
                    theme === "dark" ? "text-[#d2fc15]" : "text-slate-900"
                  }`}>
                    {formatDuration(route.duration, lang)}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={handleClearDestination}
                className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition active:scale-95 border ${
                  theme === "dark"
                    ? "bg-[#222228] hover:bg-[#2a2a32] text-zinc-300 border-[#2e2e38]"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                }`}
              >
                {t("cancelBtn", lang)}
              </button>

              <button
                disabled={isRouting || !route}
                onClick={handleStartNavigation}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 ${
                  theme === "dark"
                    ? "bg-[#d2fc15] hover:bg-[#c2eb0a] text-[#0f0f12]"
                    : "bg-[#0f0f12] hover:bg-[#27272e] text-white"
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{t("startNavBtn", lang)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map click hint when no destination is chosen */}
      {!isNavigating && !destination && (
        <div className="absolute bottom-0 inset-x-0 px-4 pb-safe z-[1000] max-w-sm mx-auto pointer-events-none">
          <div
            className={`border text-xs py-2.5 px-3 rounded-xl text-center shadow-md transition-colors ${
              theme === "dark"
                ? "bg-[#18181c]/95 border-[#27272e] text-zinc-300"
                : "bg-white/95 border-slate-200 text-slate-600"
            }`}
          >
            {t("mapTapHint", lang)}
          </div>
        </div>
      )}

      {/* Live Turn-by-Turn HUD (during active navigation) */}
      {isNavigating && (
        <NavigationHUD
          currentStep={currentStep}
          distanceToNextStep={distToNextStep}
          totalRemainingDistance={totalRemainingDistance}
          totalRemainingDuration={totalRemainingDuration}
          currentSpeed={userPosition?.speed}
          lastAlertSent={lastAlertSent}
          onStopNavigation={handleStopNavigation}
          theme={theme}
          lang={lang}
        />
      )}

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectDestination={handleSelectDestination}
        userPosition={userPosition}
        lang={lang}
        theme={theme}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        theme={theme}
      />
    </div>
  );
}
