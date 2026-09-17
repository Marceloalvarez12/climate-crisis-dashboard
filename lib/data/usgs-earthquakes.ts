/**
 * USGS GeoJSON feed — últimos 7 días, M≥2.5 (ajustable).
 * API keyless, dominio público US. Cacheado en memoria 5 min.
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/documentation/
 */
import type { Earthquake } from "./layers"

const FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson"

interface UsgsFeature {
  id: string
  properties: {
    mag: number
    place: string
    time: number
    url: string
  }
  geometry: { coordinates: [number, number, number] } // [lng, lat, depth]
}

interface UsgsGeoJson {
  features: UsgsFeature[]
}

let cache: { at: number; data: Earthquake[] } | null = null
const TTL_MS = 5 * 60 * 1000

export async function fetchRecentEarthquakes(): Promise<Earthquake[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data
  try {
    const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) throw new Error(`USGS ${res.status}`)
    const json = (await res.json()) as UsgsGeoJson
    const data: Earthquake[] = json.features
      .filter((f) => Number.isFinite(f.properties.mag))
      .map((f) => ({
        id: f.id,
        magnitude: f.properties.mag,
        place: f.properties.place || "Unknown",
        coordinates: {
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          depthKm: f.geometry.coordinates[2] ?? 0,
        },
        occurredAt: new Date(f.properties.time),
        url: f.properties.url,
      }))
    cache = { at: Date.now(), data }
    return data
  } catch (err) {
    console.warn("[usgs] fetch failed:", err instanceof Error ? err.message : String(err))
    return cache?.data ?? []
  }
}

export function clearEarthquakeCache() {
  cache = null
}
