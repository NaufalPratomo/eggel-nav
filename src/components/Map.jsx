import React, { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { findClosestSegmentOnPolyline } from "../utils/geo";

// Custom user marker styled in Eggel Active sports branding (Carbon black + Electric Lime)
const createUserIcon = (heading = 0) => {
  return L.divIcon({
    className: "custom-user-marker",
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: #121215;
        border: 3px solid #d2fc15;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading}deg);
        transition: transform 0.2s ease-out;
      ">
        <div style="
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 11px solid #d2fc15;
          margin-bottom: 2px;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Destination pin styled in Eggel Cyan (#38bdf8, matching Eggel location pin)
const destIcon = L.divIcon({
  className: "custom-dest-marker",
  html: `
    <div style="
      width: 36px;
      height: 36px;
      background: #38bdf8;
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 12px;
        height: 12px;
        background: #121215;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

export default function Map({
  userPosition,
  destination,
  routeGeometry,
  isNavigating,
  onMapClick,
  centerTrigger,
  theme = "light",
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);

  // Dynamic Route Layers
  const activeRouteLayerRef = useRef(null);
  const glowLayerRef = useRef(null);
  const traveledRouteLayerRef = useRef(null);
  const fullCoordsRef = useRef([]);
  const progressIndexRef = useRef(0);

  const initialCenteredRef = useRef(false);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  });

  // Re-center on user trigger
  useEffect(() => {
    if (centerTrigger && userPosition && mapInstanceRef.current) {
      mapInstanceRef.current.setView([userPosition.lat, userPosition.lng], 16, {
        animate: true,
      });
    }
  }, [centerTrigger, userPosition]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = -6.2088;
    const initialLng = 106.8456;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([initialLat, initialLng], 15);

    // Standard OpenStreetMap Tile Layer (100% Free, NO API Key needed, No Watermarks)
    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Add map click listener
    map.on("click", (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    mapInstanceRef.current = map;

    // Fix map size on mount
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      userMarkerRef.current = null;
      destMarkerRef.current = null;
      activeRouteLayerRef.current = null;
      glowLayerRef.current = null;
      traveledRouteLayerRef.current = null;
      initialCenteredRef.current = false;
    };
  }, []);

  // Real-time dynamic polyline update helper
  const updatePolylines = useCallback(
    (pos, forceRecalculateProgress = false) => {
      const map = mapInstanceRef.current;
      const fullCoords = fullCoordsRef.current;
      if (!map) return;

      if (!fullCoords || fullCoords.length === 0) {
        if (activeRouteLayerRef.current) activeRouteLayerRef.current.setLatLngs([]);
        if (glowLayerRef.current) glowLayerRef.current.setLatLngs([]);
        if (traveledRouteLayerRef.current) traveledRouteLayerRef.current.setLatLngs([]);
        return;
      }

      const isDark = theme === "dark";
      const activeColor = isDark ? "#d2fc15" : "#0f0f12";
      const glowColor = isDark ? "#d2fc15" : "#3b82f6";
      const traveledColor = isDark ? "#3f3f46" : "#94a3b8";

      // Ensure layers exist
      if (!traveledRouteLayerRef.current) {
        traveledRouteLayerRef.current = L.polyline([], {
          color: traveledColor,
          weight: 4.5,
          opacity: 0.45,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      } else {
        traveledRouteLayerRef.current.setStyle({ color: traveledColor });
      }

      if (!glowLayerRef.current) {
        glowLayerRef.current = L.polyline([], {
          color: glowColor,
          weight: 12,
          opacity: isDark ? 0.22 : 0.12,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      } else {
        glowLayerRef.current.setStyle({
          color: glowColor,
          opacity: isDark ? 0.22 : 0.12,
        });
      }

      if (!activeRouteLayerRef.current) {
        activeRouteLayerRef.current = L.polyline([], {
          color: activeColor,
          weight: 6.5,
          opacity: 0.98,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      } else {
        activeRouteLayerRef.current.setStyle({ color: activeColor });
      }

      if (isNavigating && pos) {
        if (forceRecalculateProgress) {
          progressIndexRef.current = 0;
        }

        // Find nearest segment ahead of current progress
        const { index, projPoint } = findClosestSegmentOnPolyline(
          pos.lat,
          pos.lng,
          fullCoords,
          progressIndexRef.current
        );

        // Advance progress smoothly (never jump backwards during active navigation)
        progressIndexRef.current = Math.max(progressIndexRef.current, index);
        const currIdx = progressIndexRef.current;

        // Active remaining path: directly starts from user position -> projection point -> destination
        const remainingCoords = [
          [pos.lat, pos.lng],
          projPoint,
          ...fullCoords.slice(currIdx + 1),
        ];

        // Traveled path: origin -> projection point -> user position
        const completedCoords = [
          ...fullCoords.slice(0, currIdx + 1),
          projPoint,
          [pos.lat, pos.lng],
        ];

        activeRouteLayerRef.current.setLatLngs(remainingCoords);
        glowLayerRef.current.setLatLngs(remainingCoords);
        traveledRouteLayerRef.current.setLatLngs(completedCoords);
      } else if (!isNavigating) {
        // Preview mode: active line connects smoothly from user position to route
        let previewCoords = fullCoords;
        if (pos) {
          const { index, projPoint } = findClosestSegmentOnPolyline(pos.lat, pos.lng, fullCoords, 0);
          // If within 150m of route, snap start to user
          previewCoords = [
            [pos.lat, pos.lng],
            projPoint,
            ...fullCoords.slice(index + 1),
          ];
        }

        activeRouteLayerRef.current.setLatLngs(previewCoords);
        glowLayerRef.current.setLatLngs(previewCoords);
        traveledRouteLayerRef.current.setLatLngs([]);
      }
    },
    [isNavigating, theme]
  );

  // Sync routeGeometry changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!routeGeometry || !routeGeometry.coordinates || routeGeometry.coordinates.length === 0) {
      fullCoordsRef.current = [];
      progressIndexRef.current = 0;
      updatePolylines(userPosition, true);
      return;
    }

    // GeoJSON coordinates are [lng, lat], Leaflet polyline expects [lat, lng]
    const latlngs = routeGeometry.coordinates.map(([lng, lat]) => [lat, lng]);
    fullCoordsRef.current = latlngs;
    progressIndexRef.current = 0;

    updatePolylines(userPosition, true);

    // Fit map bounds to show full route if not currently navigating
    if (!isNavigating && latlngs.length > 0) {
      const bounds = L.polyline(latlngs).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60] });
      }
    }
  }, [routeGeometry, isNavigating, updatePolylines, userPosition]);

  // Update user marker & sync real-time progress polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userPosition) return;

    const { lat, lng, heading } = userPosition;
    const latlng = [lat, lng];

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(latlng, {
        icon: createUserIcon(heading || 0),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(latlng);
      userMarkerRef.current.setIcon(createUserIcon(heading || 0));
    }

    if (!initialCenteredRef.current) {
      map.setView(latlng, 16);
      initialCenteredRef.current = true;
    } else if (isNavigating) {
      map.panTo(latlng, { animate: true, duration: 0.8 });
    }

    // Real-time update of route progress line following user's exact coordinates
    updatePolylines(userPosition, false);
  }, [userPosition, isNavigating, updatePolylines]);

  // Update destination marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!destination) {
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
      return;
    }

    const latlng = [destination.lat, destination.lng];
    if (!destMarkerRef.current) {
      destMarkerRef.current = L.marker(latlng, { icon: destIcon }).addTo(map);
    } else {
      destMarkerRef.current.setLatLng(latlng);
    }
  }, [destination]);

  // Synchronize Leaflet size when theme changes or window resizes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();
    updatePolylines(userPosition, false);
  }, [theme, updatePolylines, userPosition]);

  return (
    <div className={`w-full h-full ${theme === "dark" ? "dark-map" : ""}`}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
