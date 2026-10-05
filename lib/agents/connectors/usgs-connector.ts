/**
 * lib/agents/connectors/usgs-connector.ts
 *
 * Conector REAL al feed público de terremotos del USGS (United States
 * Geological Survey). No requiere API key.
 *
 * Feed: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson
 * (sismos M4.5+ de los últimos 30 días; el feed diario casi nunca cubre
 * el interior argentino — Cafayate/San Antonio de los Cobres sí aparecen aquí)
 *
 * Filtra eventos dentro de CONFIG.EXTERNAL.USGS_RADIUS_KM del centro de
 * Tucumán y con magnitud ≥ CONFIG.EXTERNAL.USGS_MIN_MAGNITUDE. Cada evento
 * se normaliza como SocialPost `trusted` con análisis determinístico:
 * los IDs del USGS son estables, así el dedup por post_id evita recrear
 * el mismo sismo en scans sucesivos.
 */

import { CONFIG } from "@/lib/config"
import { distanceFromTucuman } from "../geo"
import type { ConnectorOptions } from "./base"
import { SocialConnector } from "./base"
import type { GeminiAnalysis, SocialPlatform, SocialPost } from "../types"

interface UsgsFeature {
  id: string
  properties: {
    mag:     number | null
    place:   string | null
    time:    number
    url:     string
    tsunami: number
    sig:     number | null
  }
  geometry: { coordinates: [number, number, number] } // [lng, lat, depth]
}

/** "45 km WSW of San Antonio de los Cobres" → "San Antonio de los Cobres" */
function cityFromPlace(place: string): string {
  const m = place.match(/of (.+)$/i)
  return (m?.[1] ?? place).trim()
}

function severityFromMagnitude(mag: number, tsunami: boolean): GeminiAnalysis["severity"] {
  if (tsunami || mag >= 7) return "critical"
  if (mag >= 6)          return "high"
  if (mag >= 5)          return "medium"
  return "low"
}

const ACTIONS = [
  "Monitorear réplicas y reportes de daños estructurales",
  "Alertar a Defensa Civil municipal",
  "Verificar infraestructura crítica (hospitales, escuelas, puentes)",
]

export class UsgsConnector extends SocialConnector {
  readonly platform: SocialPlatform = "usgs"

  isConfigured(): boolean {
    return true // feed público, sin API key
  }

  async fetchPosts(options: ConnectorOptions): Promise<SocialPost[]> {
    const url = `${CONFIG.EXTERNAL.USGS.FEED_URL}?_=${Date.now()}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CONFIG.EXTERNAL.TIMEOUT_MS)
    let json: { features?: UsgsFeature[] }
    try {
      const res = await fetch(url, { signal: controller.signal, next: { revalidate: 0 } })
      if (!res.ok) throw new Error(`USGS HTTP ${res.status}`)
      json = await res.json()
    } finally {
      clearTimeout(timeout)
    }

    const { MIN_MAGNITUDE, RADIUS_KM } = CONFIG.EXTERNAL.USGS
    const limit = options.maxResults ?? 10

    // Sin filtro `since`: el feed ya contiene sólo el último día y el
    // dedup por post_id evita recrear el mismo sismo en scans sucesivos.
    return (json.features ?? [])
      .filter((f) => {
        const mag = f.properties?.mag ?? 0
        const [lng, lat] = f.geometry?.coordinates ?? [NaN, NaN]
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
        if (mag < MIN_MAGNITUDE) return false
        return distanceFromTucuman(lat, lng) <= RADIUS_KM
      })
      .map((f): SocialPost => {
        const mag   = f.properties.mag ?? 0
        const place = f.properties.place ?? "zona desconocida"
        const city  = cityFromPlace(place)
        const [lng, lat, depth] = f.geometry.coordinates
        const tsunami = f.properties.tsunami === 1
        const severity = severityFromMagnitude(mag, tsunami)

        const analysis: GeminiAnalysis = {
          isIncident:        true,
          type:              "earthquake",
          severity,
          confidence:        95, // fuente autoritativa
          locationName:      city,
          coordinatesInferred: { lat, lng },
          affectedPeopleEst: 0,
          summary:           `Sismo M${mag.toFixed(1)} registrado por USGS ${place} (profundidad ${Math.round(depth)} km).${tsunami ? " Con alerta de tsunami." : ""}`,
          reasoning:         "Evento detectado por el feed oficial del USGS (autoridad geofísica)",
          relatedPostIds:    [f.id],
          suggestedActions:  ACTIONS,
        }

        return {
          id:         f.id,
          platform:   this.platform,
          text:       f.properties.mag != null ? `M ${mag.toFixed(1)} - ${place}` : place,
          author:     "USGS Earthquake Feed",
          authorUrl:  f.properties.url,
          location:   place,
          geoLat:     lat,
          geoLng:     lng,
          postedAt:   new Date(f.properties.time),
          rawData:    f,
          trusted:    true,
          preAnalysis: analysis,
        }
      })
      .sort((a, b) => (b.preAnalysis?.confidence ?? 0) - (a.preAnalysis?.confidence ?? 0))
      .slice(0, limit)
  }
}
