/**
 * Fuentes de cámaras públicas cercanas a un incidente.
 *
 * Por ahora Argentina no tiene un feed abierto tipo Austin/Tallinn.
 * Usamos OpenStreetMap (Overpass API) para encontrar nodos con
 * man_made=surveillance en el radio del incidente — son cámaras
 * marcadas por voluntarios (incluye cámaras municipales, peajes,
 * autopistas, ONGs).
 *
 * El frame real (si existe) se carga cuando el operador clickea.
 * Si el nodo OSM no tiene URL pública, mostramos el placeholder
 * y un link "ver en street view / maps".
 */
import type { CameraSource } from "./layers"

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

const cache = new Map<string, { at: number; sources: CameraSource[] }>()
const TTL_MS = 10 * 60 * 1000

interface OverpassElement {
  type: "node" | "way" | "relation"
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

function buildQuery(lat: number, lng: number, radiusM: number): string {
  const around = `(around:${radiusM},${lat},${lng})`
  return `[out:json][timeout:15];(${around}[man_made=surveillance];${around}[highway=speed_camera];);out body 50;`
}

async function queryOverpass(query: string): Promise<OverpassElement[]> {
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) continue
      const json = (await res.json()) as OverpassResponse
      return json.elements ?? []
    } catch {
      // try next mirror
    }
  }
  return []
}

export async function fetchCamerasNear(
  lat: number,
  lng: number,
  radiusM = 1500,
): Promise<CameraSource[]> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${radiusM}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.sources

  const query = buildQuery(lat, lng, radiusM)
  const elements = await queryOverpass(query)

  const sources: CameraSource[] = elements
    .map((el): CameraSource | null => {
      const elLat = el.lat ?? el.center?.lat
      const elLng = el.lon ?? el.center?.lon
      if (elLat == null || elLng == null) return null
      const tags = el.tags ?? {}
      const kind = tags.man_made === "surveillance" ? "surveillance" : "speed_camera"
      const url =
        tags["contact:website"] ??
        tags.website ??
        tags.url ??
        tags["surveillance:url"] ??
        tags["camera:url"] ??
        null
      const operator = tags.operator ?? tags["surveillance:operator"] ?? null
      const direction = tags["surveillance:direction"] ?? tags.direction ?? null
      return {
        id: `${el.type}/${el.id}`,
        kind,
        coordinates: { lat: elLat, lng: elLng },
        name: tags.name ?? (kind === "speed_camera" ? "Speed camera" : "Surveillance camera"),
        operator,
        direction,
        url,
      }
    })
    .filter((c): c is CameraSource => c !== null)

  cache.set(key, { at: Date.now(), sources })
  return sources
}

export function clearCamerasCache(): void {
  cache.clear()
}
