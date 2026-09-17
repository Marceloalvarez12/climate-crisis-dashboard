/**
 * lib/data/nominatim.ts
 *
 * Geocoding seguro con Nominatim (OpenStreetMap).
 *
 * Features:
 * - Rate limiting (1 req/s por IP/cadena)
 * - Cache en memoria (5 min por query normalizada)
 * - User-Agent requerido por ToS de Nominatim
 * - Fallback a búsqueda con bounding box de Tucumán para mejorar precisión
 * - Normalización de acentos (Nominatim no siempre matchea "Mendoza" vs "Mendóza")
 *
 * Usage:
 *   const { lat, lng, display_name } = await geocodeAddress("Av. Mate de Luna 123, San Miguel de Tucumán")
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "Zntinel-Crisis-Dashboard/1.0 (contacto@zntinel.com)"

// Cache simple en memoria (no SSR — solo cliente y serverless functions con warm container)
interface CacheEntry {
  at: number
  result: GeocodeResult
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min
const REQUEST_DEBOUNCE_MS = 1100   // Nominatim pide max 1 req/s

let lastRequestAt = 0

export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
  boundingBox: [number, number, number, number] | null
  type: string
}

function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function rateLimit() {
  const now = Date.now()
  const elapsed = now - lastRequestAt
  if (elapsed < REQUEST_DEBOUNCE_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DEBOUNCE_MS - elapsed))
  }
  lastRequestAt = Date.now()
}

/**
 * Geocodifica una dirección.
 * Si `fallbackToTucuman` es true (default), agrega "Tucumán, Argentina" a la query
 * para mejorar resultados locales.
 */
export async function geocodeAddress(
  address: string,
  options?: { fallbackToTucuman?: boolean; countrycodes?: string },
): Promise<GeocodeResult> {
  const opts = { fallbackToTucuman: true, countrycodes: "ar", ...options }
  const enriched = opts.fallbackToTucuman && !address.toLowerCase().includes("tucuman")
    ? `${address}, San Miguel de Tucumán, Argentina`
    : address

  const key = normalizeQuery(enriched)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.result
  }

  await rateLimit()

  const url = new URL(NOMINATIM_URL)
  url.searchParams.set("q", enriched)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("limit", "1")
  url.searchParams.set("addressdetails", "0")
  url.searchParams.set("countrycodes", opts.countrycodes)

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  })

  if (!res.ok) {
    throw new Error(`Nominatim error: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
    boundingbox?: [string, string, string, string]
    type: string
  }>

  if (!data || data.length === 0) {
    throw new Error(`Dirección no encontrada: "${address}"`)
  }

  const first = data[0]
  const result: GeocodeResult = {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    displayName: first.display_name,
    boundingBox: first.boundingbox
      ? first.boundingbox.map((s) => parseFloat(s)) as [number, number, number, number]
      : null,
    type: first.type,
  }

  cache.set(key, { at: Date.now(), result })
  return result
}

/**
 * Geocodificación inversa (lat/lng → dirección).
 * Útil para el mini-map picker: el usuario clickea en el mapa y vemos la dirección.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{ displayName: string }> {
  const key = `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { displayName: cached.result.displayName }
  }

  await rateLimit()

  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("format", "jsonv2")

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  })

  if (!res.ok) {
    throw new Error(`Nominatim reverse error: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { display_name?: string }
  const displayName = data.display_name ?? "Ubicación desconocida"

  cache.set(key, { at: Date.now(), result: { lat, lng, displayName, boundingBox: null, type: "reverse" } })
  return { displayName }
}
