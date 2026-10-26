// OSRM Routing & Geocoding Service

/**
 * Search locations using OpenStreetMap Nominatim or Photon
 */
export const searchPlaces = async (query) => {
  if (!query || query.trim().length < 2) return [];

  try {
    // Photon is fast and has generous CORS policies
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=id`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!response.ok) throw new Error("Search failed");
    const data = await response.json();

    return (data.features || []).map((f) => {
      const p = f.properties || {};
      const name = p.name || p.street || "Lokasi";
      const details = [p.district, p.city, p.state, p.country].filter(Boolean).join(", ");
      const [lon, lat] = f.geometry.coordinates;
      return {
        id: `${lat}-${lon}-${name}`,
        name: name,
        description: details || name,
        lat: lat,
        lng: lon,
      };
    });
  } catch (error) {
    console.warn("Photon search failed, falling back to Nominatim:", error);
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=5&countrycodes=id`,
        { signal: AbortSignal.timeout(6000) }
      );
      const nomData = await nomRes.json();
      return nomData.map((item) => ({
        id: item.place_id,
        name: item.display_name.split(",")[0],
        description: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
    } catch (e) {
      console.error("All geocoding services failed:", e);
      return [];
    }
  }
};

/**
 * Fetch Driving / Motorcycle Route from OSRM
 */
export const fetchRoute = async (startCoord, destCoord) => {
  // startCoord: { lat, lng }
  // destCoord: { lat, lng }
  const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.lng},${startCoord.lat};${destCoord.lng},${destCoord.lat}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`OSRM error: ${res.statusText}`);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error("Rute tidak ditemukan");
    }

    const route = data.routes[0];
    const legs = route.legs[0];
    const steps = legs.steps || [];

    // Parse each step into easy-to-use maneuver objects
    const parsedSteps = steps.map((step, idx) => ({
      index: idx,
      name: step.name || (idx === steps.length - 1 ? "Tujuan Anda" : "Jalan"),
      distance: step.distance,
      duration: step.duration,
      maneuver: step.maneuver,
      geometry: step.geometry,
      // Maneuver location is [lon, lat]
      location: {
        lng: step.maneuver.location[0],
        lat: step.maneuver.location[1],
      },
      type: step.maneuver.type,
      modifier: step.maneuver.modifier,
    }));

    return {
      distance: route.distance, // total meters
      duration: route.duration, // total seconds
      geometry: route.geometry, // GeoJSON LineString
      steps: parsedSteps,
    };
  } catch (error) {
    console.error("Failed to fetch route:", error);
    throw error;
  }
};
