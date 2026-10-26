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
  const alertTrackerRef = useRef({
    stepIndex: 0,
    alert1Sent: false,
    alert2Sent: false,
    lastAlertTime: 0,
    minDist: Infinity,
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
    const stopMsg = isEn ? "⏹️ NAVIGATION ENDED" : "⏹️ NAVIGASI DIAKHIRI";
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

      // Final destination reached
      if (idx >= steps.length) {
        const arriveMsg = isEn
          ? `🏁 ARRIVED AT DESTINATION\nYou have reached ${activeDest?.name || "Destination"}!`
          : `🏁 TIBA DI TUJUAN\nAnda telah sampai di ${activeDest?.name || "Tujuan"}!`;
        sendTelegramAlert(activeSettings.botToken, activeSettings.chatId, arriveMsg);
        setLastAlertSent(t("arrived", activeSettings.language));
        handleStopNavigation();
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
        };
      } else {
        tracker.minDist = Math.min(tracker.minDist, distToManeuver);
      }

      // Check step advancement criteria
      const hasNext = idx < steps.length - 1;
      let distToNext = Infinity;
      if (hasNext) {
        distToNext = calculateHaversineDistance(
          currentPos.lat,
          currentPos.lng,
          steps[idx + 1].location.lat,
          steps[idx + 1].location.lng
        );
      }

      // 1. Reached maneuver point (< 18m)
      const reachedManeuver = distToManeuver < 18;

      // 2. Moving away from maneuver towards next step:
      // Approached the intersection (minDist <= 45m), now moving away (dist > minDist + 10m),
      // and within the next step's expected range
      const movingAwayTowardsNext =
        hasNext &&
        tracker.minDist <= 45 &&
        distToManeuver > tracker.minDist + 10 &&
        (distToNext < (currentStep.distance || 500) + 30 || distToNext < distToManeuver);

      // 3. Already within close proximity of next maneuver (< 20m)
      const alreadyAtNext = hasNext && distToNext < 20;

      if (reachedManeuver || movingAwayTowardsNext || alreadyAtNext) {
        const nextIdx = idx + 1;
        if (nextIdx >= steps.length) {
          const arriveMsg = isEn
            ? `🏁 ARRIVED AT DESTINATION\nYou have reached ${activeDest?.name || "Destination"}!`
            : `🏁 TIBA DI TUJUAN\nAnda telah sampai di ${activeDest?.name || "Tujuan"}!`;
          sendTelegramAlert(activeSettings.botToken, activeSettings.chatId, arriveMsg);
          setLastAlertSent(t("arrived", activeSettings.language));
          handleStopNavigation();
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
        };
        return;
      }

      // Proximity Alert Triggers
      const now = Date.now();
      const throttleMs = 1500;

      // Alert 2: Imminent maneuver (<= alert2Dist, default 40m)
      if (distToManeuver <= activeSettings.alert2Dist && !tracker.alert2Sent) {
        if (now - tracker.lastAlertTime >= throttleMs) {
          const alertMsg = formatManeuverMessage(
            distToManeuver,
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
      // Alert 1: Advance warning (<= alert1Dist, default 150m)
      else if (distToManeuver <= activeSettings.alert1Dist && !tracker.alert1Sent) {
        if (now - tracker.lastAlertTime >= throttleMs) {
          const alertMsg = formatManeuverMessage(
            distToManeuver,
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

      // Check for off-route deviation (>75m away from polyline using segment projection)
      if (
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
              };
              const rerouteMsg = isEn
                ? "🔄 ROUTE RECALCULATED\nFollowing new route..."
                : "🔄 RUTE DIHITUNG ULANG\nMengikuti rute baru...";
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

  // Geolocation watcher
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    let hasFixedLocation = false;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
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

        const newPos = {
          lat: latitude,
          lng: longitude,
          heading: computedHeading || 0,
          speed: computedSpeed || 0,
          accuracy: accuracy,
          timestamp: pos.timestamp,
        };

        prevPosRef.current = newPos;
        setUserPosition(newPos);
        setGpsStatus("ready");
        setGpsErrorMsg(null);

        // Auto-fetch route if destination was already selected before GPS fixed
        if (!hasFixedLocation) {
          hasFixedLocation = true;
          if (destinationRef.current && !routeRef.current) {
            calculateRouteTo(newPos, destinationRef.current);
          }
        }

        // Live turn-by-turn processing if navigating
        if (isNavigatingRef.current) {
          processTurnByTurn(newPos);
        }
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

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [calculateRouteTo, processTurnByTurn]);

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
    if (!route || !route.steps || route.steps.length === 0) return;

    setIsNavigating(true);
    isNavigatingRef.current = true;
    let startStep = route.steps.length > 1 ? 1 : 0;
    if (userPosition && route.steps.length > 2) {
      for (let i = 1; i < route.steps.length; i++) {
        const d = calculateHaversineDistance(
          userPosition.lat,
          userPosition.lng,
          route.steps[i].location.lat,
          route.steps[i].location.lng
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
    };

    // Activate Silent Audio Loop & WakeLock for iOS background execution
    await keepAlive.start();

    // Send initial Telegram notification to confirm connection with smartwatch
    const isEn = lang === "en";
    const startMsg = isEn
      ? `🚀 NAVIGATION STARTED\nDestination: ${destination?.name || "Destination"}\nDistance: ${formatDistance(route.distance)} (${formatDuration(route.duration, "en")})`
      : `🚀 NAVIGASI DIMULAI\nTujuan: ${destination?.name || "Tujuan"}\nJarak: ${formatDistance(route.distance)} (${formatDuration(route.duration, "id")})`;
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
    for (let i = currentStepIndex; i < route.steps.length; i++) {
      dist += route.steps[i].distance;
    }
    return Math.round(dist);
  }, [route, currentStepIndex, distToNextStep]);

  const totalRemainingDuration = useMemo(() => {
    if (!route || !route.steps || currentStepIndex >= route.steps.length) return 0;
    if (userPosition && userPosition.speed > 2) {
      return Math.max(0, Math.round(totalRemainingDistance / userPosition.speed));
    }
    let dur = 0;
    for (let i = currentStepIndex; i < route.steps.length; i++) {
      dur += route.steps[i].duration;
    }
    const prevStep = currentStepIndex > 0 ? route.steps[currentStepIndex - 1] : null;
    if (prevStep && prevStep.distance > 0) {
      dur += (distToNextStep / prevStep.distance) * prevStep.duration;
    } else {
      dur += distToNextStep / 7;
    }
    return Math.max(0, Math.round(dur));
  }, [route, currentStepIndex, distToNextStep, totalRemainingDistance, userPosition]);

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden select-none transition-colors duration-300 ${
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
        <div className="absolute top-0 inset-x-0 p-3 pt-safe z-[1000] pointer-events-none">
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
          className={`absolute right-4 bottom-24 z-[1000] p-3 rounded-xl shadow-md active:scale-95 transition border ${
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
        <div className="absolute top-20 inset-x-4 z-[1000] max-w-md mx-auto bg-amber-500 text-white p-3 rounded-xl text-xs flex items-center gap-2.5 shadow-md border border-amber-600">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="flex-1 font-medium">{gpsErrorMsg}</span>
        </div>
      )}

      {/* Bottom Route Preview Card (when destination selected & not navigating) */}
      {!isNavigating && destination && (
        <div className="absolute bottom-4 inset-x-4 z-[1000] max-w-lg mx-auto">
          <div
            className={`rounded-2xl p-4 shadow-xl border transition-colors ${
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
        <div className="absolute bottom-6 inset-x-4 z-[1000] max-w-sm mx-auto pointer-events-none">
          <div
            className={`border text-xs py-2 px-3 rounded-xl text-center shadow-md transition-colors ${
              theme === "dark"
                ? "bg-[#18181c] border-[#27272e] text-zinc-300"
                : "bg-white border-slate-200 text-slate-600"
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
