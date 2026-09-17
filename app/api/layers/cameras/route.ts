import { NextRequest, NextResponse } from "next/server"

// Overpass API proxy. Llama server-side porque:
// 1. Browser CORS / CSP no molesta
// 2. Cache en server (10min) compartido entre usuarios
// 3. Logs server-side para diagnosticar problemas
//
// Endpoint: POST /api/layers/cameras
// Body: { lat: number, lng: number, radius?: number }
//
// Devuelve: { count: number, cameras: CameraSource[] }

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const

const DEFAULT_RADIUS_M = 1500
const MAX_RADIUS_M = 5000

interface CameraHit {
  id: string
  kind: "surveillance" | "speed_camera"
  name: string
  operator: string | null
  url: string | null
  lat: number
  lng: number
}

interface CameraHitOut extends CameraHit {
  distanceM: number
}

interface CacheEntry {
  at: number
  cameras: CameraHitOut[]
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000

async function queryOverpass(query: string): Promise<unknown> {
  let lastError: Error | null = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[cameras] ${endpoint} failed:`, lastError.message)
    }
  }
  throw lastError ?? new Error("All Overpass endpoints failed")
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const lat = Number(body?.lat)
    const lng = Number(body?.lng)
    const radius = Math.min(MAX_RADIUS_M, Math.max(50, Number(body?.radius ?? DEFAULT_RADIUS_M)))

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ count: 0, cameras: [], error: "Invalid coordinates" }, { status: 400 })
    }

    const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json({ count: cached.cameras.length, cameras: cached.cameras })
    }

    const query = `[out:json][timeout:10];(
      node["man_made"="surveillance"](around:${radius},${lat},${lng});
      way["man_made"="surveillance"](around:${radius},${lat},${lng});
      node["highway"="speed_camera"](around:${radius},${lat},${lng});
    );out tags;`

    const json = (await queryOverpass(query)) as {
      elements?: Array<{
        id: number
        type: string
        lat?: number
        lon?: number
        center?: { lat: number; lon: number }
        tags?: Record<string, string>
      }>
    }

    const hits: CameraHitOut[] = (json.elements || [])
      .map((el): CameraHitOut | null => {
        const elat = el.lat ?? el.center?.lat
        const elng = el.lon ?? el.center?.lon
        if (elat == null || elng == null) return null
        const kind: CameraHit["kind"] = el.tags?.highway === "speed_camera" ? "speed_camera" : "surveillance"
        return {
          id: `${el.type}/${el.id}`,
          kind,
          name: el.tags?.name || (kind === "speed_camera" ? "Speed camera" : "Surveillance camera"),
          operator: el.tags?.operator || el.tags?.surveillance || null,
          url: el.tags?.url || el.tags?.contact_camera || null,
          lat: elat,
          lng: elng,
          distanceM: haversine(elat, elng, lat, lng),
        }
      })
      .filter((c): c is CameraHitOut => c !== null)
      .sort((a, b) => a.distanceM - b.distanceM)

    cache.set(cacheKey, { at: Date.now(), cameras: hits })

    return NextResponse.json({ count: hits.length, cameras: hits })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[api/layers/cameras]", message)
    return NextResponse.json({ count: 0, cameras: [], error: message }, { status: 200 })
  }
}

// Allow GET for easy testing (?lat=&lng=&radius=)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const body = {
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
    radius: searchParams.get("radius"),
  }
  // Build a fake NextRequest-like for POST handler
  return POST(new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }))
}
