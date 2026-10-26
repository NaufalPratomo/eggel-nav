// OSRM Routing & Geocoding Service

/**
 * Search locations using OpenStreetMap Nominatim and Photon with Indonesian fallback
 */
export const searchPlaces = async (query, userPosition = null) => {
  if (!query || query.trim().length < 2) return [];

  const rawQuery = query.trim();
  const cleanQuery = rawQuery.replace(/^(perumahan|komplek|kompleks|cluster|residence)\s+/i, "").trim();

  // Try multiple variations if needed (e.g. "patraland" -> "patra land")
  const queryCandidates = [rawQuery];
  if (cleanQuery && cleanQuery !== rawQuery) {
    queryCandidates.push(cleanQuery);
  }
  // If single long word with 'land' suffix, also add space variant
  if (!rawQuery.includes(" ") && rawQuery.toLowerCase().endsWith("land")) {
    const spaced = rawQuery.slice(0, -4) + " land";
    if (!queryCandidates.includes(spaced)) queryCandidates.push(spaced);
  }

  for (const q of queryCandidates) {
    // 1. Try Nominatim via local Vite proxy (passes User-Agent and avoids CORS)
    try {
      const proxyRes = await fetch(
        `/api/nominatim/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=6&countrycodes=id&addressdetails=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item) => ({
            id: `nom-${item.place_id}`,
            name: item.display_name.split(",")[0],
            description: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          }));
        }
      }
    } catch {
      // Proxy failed or not on dev server, proceed to external endpoints
    }

    // 2. Try direct Nominatim
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=6&countrycodes=id&addressdetails=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (Array.isArray(nomData) && nomData.length > 0) {
          return nomData.map((item) => ({
            id: `nom-${item.place_id}`,
            name: item.display_name.split(",")[0],
            description: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          }));
        }
      }
    } catch {
      // Continue to Photon
    }

    // 3. Try Photon Komoot (without invalid lang parameter, bounded to Indonesia)
    try {
      let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q
      )}&limit=6&bbox=95.0,-11.0,141.0,6.0`;
      if (userPosition && userPosition.lat && userPosition.lng) {
        photonUrl += `&lat=${userPosition.lat}&lon=${userPosition.lng}`;
      }

      const photonRes = await fetch(photonUrl, { signal: AbortSignal.timeout(5000) });
      if (photonRes.ok) {
        const pData = await photonRes.json();
        if (pData.features && pData.features.length > 0) {
          return pData.features.map((f) => {
            const p = f.properties || {};
            const name = p.name || p.street || "Lokasi";
            const details = [p.street, p.district, p.city, p.state, p.country]
              .filter(Boolean)
              .join(", ");
            const [lon, lat] = f.geometry.coordinates;
            return {
              id: `pho-${lat}-${lon}-${name}`,
              name: name,
              description: details || name,
              lat: lat,
              lng: lon,
            };
          });
        }
      }
    } catch {
      // Continue next query candidate
    }
  }

  return [];
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
