import React, { useEffect, useRef } from "react";
import L from "leaflet";

// Custom icons using standard SVG / DivIcon to avoid missing Leaflet png assets
const createUserIcon = (heading = 0) => {
  return L.divIcon({
    className: "custom-user-marker",
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: #4f46e5;
        border: 3.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading}deg);
        transition: transform 0.2s ease-out;
      ">
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 12px solid #ffffff;
          margin-bottom: 2px;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Destination pin styled like modern iOS transit app (mint green circle with flag/point)
const destIcon = L.divIcon({
  className: "custom-dest-marker",
  html: `
    <div style="
      width: 36px;
      height: 36px;
      background: #10b981;
      border: 3.5px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 12px;
        height: 12px;
        background: #ffffff;
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
  const routeLayerRef = useRef(null);
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
      routeLayerRef.current = null;
      initialCenteredRef.current = false;
    };
  }, []);

  // Update user marker
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
  }, [userPosition, isNavigating]);

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

  // Update route geometry polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (!routeGeometry || !routeGeometry.coordinates) return;

    // GeoJSON coordinates are [lng, lat], Leaflet polyline expects [lat, lng]
    const latlngs = routeGeometry.coordinates.map(([lng, lat]) => [lat, lng]);

    const routeColor = theme === "dark" ? "#38bdf8" : "#4f46e5";

    const polyline = L.polyline(latlngs, {
      color: routeColor,
      weight: 6,
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    routeLayerRef.current = polyline;

    // Fit map bounds to show full route if not currently navigating
    if (!isNavigating && latlngs.length > 0) {
      map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
    }
  }, [routeGeometry, isNavigating, theme]);

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full transition-all duration-300 ${
        theme === "dark" ? "dark-map" : ""
      }`}
    />
  );
}
