// OSRM Routing & Geocoding Service
import { calculateHaversineDistance } from "./geo";

/**
 * Generate intelligent query candidates for Indonesian places,
 * housing clusters, and compound street/village names
 */
const generateQueryCandidates = (query) => {
  const raw = query.trim();
  const clean = raw.replace(/^(perumahan|komplek|kompleks|cluster|residence|apartemen)\s+/i, "");
  const list = [raw];
  if (clean && clean !== raw) list.push(clean);

  // If single word ending in 'land' (e.g. patraland -> patra land)
  if (!raw.includes(" ") && raw.toLowerCase().endsWith("land") && raw.length > 5) {
    list.push(raw.slice(0, -4) + " " + raw.slice(-4));
  }

  // Handle multi-word queries: progressive token stripping and merging
  const words = clean.split(/\s+/);
  if (words.length > 1) {
    // Drop first word (usually developer/housing cluster name like 'patraland')
    const withoutFirst = words.slice(1).join(" ");
    if (withoutFirst.length >= 3) list.push(withoutFirst);

    // If 3+ words (e.g. patraland tasik madu malang)
    if (words.length >= 3) {
      list.push(words.slice(-2).join(" "));
      list.push(words.slice(0, -1).join(" "));
    }

    // Merged words (e.g. tasik madu -> tasikmadu)
    const merged = clean.replace(/(\w{3,8})\s+(\w{3,8})/g, "$1$2");
    if (merged !== clean && !list.includes(merged)) {
      list.push(merged);
      const mWords = merged.split(/\s+/);
      if (mWords.length > 1) {
        list.push(mWords.slice(1).join(" "));
      }
    }
  }

  return [...new Set(list)];
};

/**
 * Search locations using OpenStreetMap Nominatim and Photon with Indonesian fallback
 */
export const searchPlaces = async (query, userPosition = null) => {
  if (!query || query.trim().length < 2) return [];

  const rawQuery = query.trim();
  const cleanQuery = rawQuery.replace(/^(perumahan|komplek|kompleks|cluster|residence|apartemen)\s+/i, "");
  const firstWord = cleanQuery.split(/\s+/)[0];

  const candidates = generateQueryCandidates(query);
  const collectedPlaces = [];
  const seenIds = new Set();

  for (const q of candidates) {
    // 1. Try Nominatim via local Vite proxy (passes User-Agent and avoids CORS)
    try {
      const proxyRes = await fetch(
        `/api/nominatim/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=6&countrycodes=id&addressdetails=1`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            const placeId = `nom-${item.place_id}`;
            if (!seenIds.has(placeId)) {
              seenIds.add(placeId);
              let name = item.display_name.split(",")[0];

              // If user searched for a specific housing/place name (e.g. patraland)
              // that matched via an administrative area (e.g. Tasikmadu),
              // enrich the label so the user clearly sees their searched destination:
              if (
                firstWord &&
                firstWord.length >= 4 &&
                !item.display_name.toLowerCase().includes(firstWord.toLowerCase())
              ) {
                const capitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
                name = `${capitalized} - ${name}`;
              }

              collectedPlaces.push({
                id: placeId,
                name: name,
                description: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              });
            }
          }
        }
      }
    } catch {
      // Continue next candidate
    }

    // If we have >= 3 results, stop early for snappy response
    if (collectedPlaces.length >= 3) break;
  }

  // 2. Photon Komoot fallback if proxy / Nominatim had 0 results
  if (collectedPlaces.length === 0) {
    for (const q of candidates.slice(0, 2)) {
      try {
        let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          q
        )}&limit=6&bbox=95.0,-11.0,141.0,6.0`;
        if (userPosition && userPosition.lat && userPosition.lng) {
          photonUrl += `&lat=${userPosition.lat}&lon=${userPosition.lng}`;
        }

        const photonRes = await fetch(photonUrl, { signal: AbortSignal.timeout(4000) });
        if (photonRes.ok) {
          const pData = await photonRes.json();
          if (pData.features && pData.features.length > 0) {
            for (const f of pData.features) {
              const p = f.properties || {};
              let name = p.name || p.street || "Lokasi";
              const details = [p.street, p.district, p.city, p.state, p.country]
                .filter(Boolean)
                .join(", ");
              const [lon, lat] = f.geometry.coordinates;
              const placeId = `pho-${lat}-${lon}-${name}`;

              if (!seenIds.has(placeId)) {
                seenIds.add(placeId);
                if (
                  firstWord &&
                  firstWord.length >= 4 &&
                  !details.toLowerCase().includes(firstWord.toLowerCase()) &&
                  !name.toLowerCase().includes(firstWord.toLowerCase())
                ) {
                  const capitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
                  name = `${capitalized} - ${name}`;
                }

                collectedPlaces.push({
                  id: placeId,
                  name: name,
                  description: details || name,
                  lat: lat,
                  lng: lon,
                });
              }
            }
          }
        }
      } catch {
        // Continue
      }
      if (collectedPlaces.length > 0) break;
    }
  }

  // If userPosition is available, sort results by proximity to user
  if (userPosition && userPosition.lat && userPosition.lng && collectedPlaces.length > 1) {
    collectedPlaces.sort((a, b) => {
      const distA = calculateHaversineDistance(userPosition.lat, userPosition.lng, a.lat, a.lng);
      const distB = calculateHaversineDistance(userPosition.lat, userPosition.lng, b.lat, b.lng);
      return distA - distB;
    });
  }

  return collectedPlaces.slice(0, 8);
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
