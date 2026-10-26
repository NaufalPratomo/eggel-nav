// Geographic calculations & Haversine formula

/**
 * Calculates great-circle distance between two points in meters using Haversine formula
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
};

export const formatDistance = (meters) => {
  if (meters == null || isNaN(meters)) return "0 m";
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

export const formatDuration = (seconds, lang = "id") => {
  if (seconds == null || isNaN(seconds)) return lang === "en" ? "0 min" : "0 mnt";
  const minutes = Math.round(seconds / 60);
  const isEn = lang === "en";
  if (minutes < 60) {
    return `${minutes} ${isEn ? "min" : "mnt"}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours} ${isEn ? "hr" : "jam"} ${remainingMins} ${isEn ? "min" : "mnt"}`;
};

export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

/**
 * Calculates perpendicular distance in meters from point P(lat, lng) to segment A-B
 */
export const calculateDistanceToSegment = (pLat, pLng, aLat, aLng, bLat, bLng) => {
  const cosLat = Math.cos((pLat * Math.PI) / 180);
  const x = (pLng - aLng) * cosLat * 111320;
  const y = (pLat - aLat) * 111320;
  const dx = (bLng - aLng) * cosLat * 111320;
  const dy = (bLat - aLat) * 111320;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return Math.hypot(x, y);

  const t = Math.max(0, Math.min(1, (x * dx + y * dy) / lenSq));
  return Math.hypot(x - t * dx, y - t * dy);
};

/**
 * Calculates perpendicular minimum distance in meters from point to a polyline [lng, lat][]
 */
export const calculateDistanceToPolyline = (pLat, pLng, coordinates) => {
  if (!coordinates || coordinates.length === 0) return Infinity;
  if (coordinates.length === 1) {
    return calculateHaversineDistance(pLat, pLng, coordinates[0][1], coordinates[0][0]);
  }

  let min = Infinity;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [aLng, aLat] = coordinates[i];
    const [bLng, bLat] = coordinates[i + 1];
    const d = calculateDistanceToSegment(pLat, pLng, aLat, aLng, bLat, bLng);
    if (d < min) {
      min = d;
      // Early exit if essentially right on top of the road
      if (min < 3) return min;
    }
  }
  return min;
};

