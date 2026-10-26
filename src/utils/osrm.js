// OSRM Routing & Geocoding Service
import { calculateHaversineDistance } from "./geo";

// Client-side in-memory cache to prevent redundant network requests
const searchCache = new Map();

// Rate-limiting pacer for OpenStreetMap Nominatim (OSM policy: max 1 req/sec)
let lastNominatimCallTime = 0;
const pacedNominatimFetch = async (url, options = {}) => {
  const now = Date.now();
  const elapsed = now - lastNominatimCallTime;
  if (elapsed < 1200) {
    await new Promise((r) => setTimeout(r, 1200 - elapsed));
  }
  lastNominatimCallTime = Date.now();
  return fetch(url, options);
};

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

    // Add adjacent word pairs merged (e.g. 'tasik' + 'madu' -> 'tasikmadu')
    for (let i = 0; i < words.length - 1; i++) {
      const pair = (words[i] + words[i + 1]).toLowerCase();
      if (pair.length >= 4 && !list.includes(pair)) {
        list.push(pair);
      }
    }

    // Add individual significant words (e.g. 'tasikmadu', 'malang')
    for (const w of words) {
      const lowerW = w.toLowerCase();
      if (lowerW.length >= 4 && !list.includes(lowerW)) {
        list.push(lowerW);
      }
    }
  }

  return [...new Set(list)];
};

/**
 * Search locations using Open-Meteo (ultra-fast, zero rate-limit) and OpenStreetMap Nominatim
 */
export const searchPlaces = async (query, userPosition = null) => {
  if (!query || query.trim().length < 2) return [];

  const rawQuery = query.trim();
  const cacheKey = rawQuery.toLowerCase();

  // 1. Serve immediately from memory cache if previously queried
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  const cleanQuery = rawQuery.replace(/^(perumahan|komplek|kompleks|cluster|residence|apartemen)\s+/i, "");
  const words = cleanQuery.split(/\s+/);
  const firstWord = words[0];

  const candidates = generateQueryCandidates(query);
  const collectedPlaces = [];
  const seenIds = new Set();

  // 2. Primary Fast Search: Open-Meteo Geocoding
  // Free, zero rate-limit (no 429), native CORS, covers all Indonesian villages/districts (e.g. Tasikmadu, Malang)
  for (const c of candidates) {
    try {
      const token = c.split(/\s+/)[0];
      if (token.length < 2) continue;

      const omRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          token
        )}&count=6&language=id&format=json`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (omRes.ok) {
        const omData = await omRes.json();
        if (omData.results && omData.results.length > 0) {
          const idResults = omData.results.filter((r) => r.country_code === "ID");
          for (const item of idResults) {
            const placeKey = `om-${item.latitude.toFixed(4)}-${item.longitude.toFixed(4)}`;
            if (!seenIds.has(placeKey)) {
              seenIds.add(placeKey);
              let name = item.name;

              // If user searched for a specific housing cluster (e.g. Patraland)
              // that matched via an administrative village/suburb (e.g. Tasikmadu):
              if (
                firstWord &&
                firstWord.length >= 4 &&
                !name.toLowerCase().includes(firstWord.toLowerCase())
              ) {
                const capitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
                name = `${capitalized} - ${name}`;
              }

              const details = [item.name, item.admin2, item.admin1, item.country]
                .filter(Boolean)
                .join(", ");

              collectedPlaces.push({
                id: placeKey,
                name: name,
                description: details,
                lat: item.latitude,
                lng: item.longitude,
                admin2: item.admin2 || "",
              });
            }
          }
        }
      }
    } catch {
      // Continue next candidate
    }
    if (collectedPlaces.length >= 3) break;
  }

  // 3. Secondary Search: Nominatim (Paced & Protected against 429)
  // Only queried if Open-Meteo returned < 2 results (e.g. specific building/mall/complex name)
  if (collectedPlaces.length < 2) {
    for (const q of candidates.slice(0, 2)) {
      try {
        const proxyRes = await pacedNominatimFetch(
          `/api/nominatim/search?format=json&q=${encodeURIComponent(
            q
          )}&limit=5&countrycodes=id&addressdetails=1`,
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
                  admin2: "",
                });
              }
            }
          }
        }
      } catch {
        // Ignore 429/network errors gracefully
      }
      if (collectedPlaces.length >= 3) break;
    }
  }

  // Rank matching city/regency first if query contains city keyword (e.g. "malang")
  for (const word of words) {
    if (word.length >= 4 && collectedPlaces.length > 1) {
      collectedPlaces.sort((a, b) => {
        const aMatches =
          a.description.toLowerCase().includes(word) || (a.admin2 && a.admin2.toLowerCase().includes(word));
        const bMatches =
          b.description.toLowerCase().includes(word) || (b.admin2 && b.admin2.toLowerCase().includes(word));
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return 0;
      });
    }
  }

  // If userPosition is available, sort remaining by proximity
  if (userPosition && userPosition.lat && userPosition.lng && collectedPlaces.length > 1) {
    collectedPlaces.sort((a, b) => {
      const distA = calculateHaversineDistance(userPosition.lat, userPosition.lng, a.lat, a.lng);
      const distB = calculateHaversineDistance(userPosition.lat, userPosition.lng, b.lat, b.lng);
      return distA - distB;
    });
  }

  const finalResults = collectedPlaces.slice(0, 8);

  // Cache up to 100 queries in memory
  if (searchCache.size > 100) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }
  searchCache.set(cacheKey, finalResults);

  return finalResults;
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
