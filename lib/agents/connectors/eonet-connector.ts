/**
 * lib/agents/connectors/eonet-connector.ts
 *
 * Conector REAL a NASA EONET (Earth Observatory Natural Event Tracker).
 * Feed público de eventos naturales abiertos: incendios, inundaciones,
 * tormentas severas, sismos, volcanes… No requiere API key.
 *
 * API: https://eonet.gsfc.nasa.gov/api/v3/events?status=open
 *
 * Se filtra al bounding box de Argentina y se mapea la categoría del
 * evento a tipo/severidad determinísticos (fuente autoritativa → trusted).
 * Cada evento EONET tiene ID estable (EONET_xxxxx) → el dedup por
 * post_id evita recreaciones en scans sucesivos. La geometría usada es
 * el punto más reciente del track del evento.
 */

import { CONFIG } from "@/lib/config"
import { insideBox } from "../geo"
import type { ConnectorOptions } from "./base"
import { SocialConnector } from "./base"
import type { AnalyzedIncidentType, GeminiAnalysis, SocialPlatform, SocialPost } from "../types"

interface EonetGeometry {
  type: string
  date: string
  coordinates: [number, number] | [number, number][]
  magnitudeValue?: number | null
  magnitudeUnit?: string | null
}

interface EonetEvent {
  id:         string
  title:      string
  description: string | null
  link:       string
  closed:     string | null
  categories: { id: string; title: string }[]
  sources:    { id: string; url: string }[]
  geometry:   EonetGeometry[]
}

/** Categoría EONET → tipo de incidente + severidad base */
const CATEGORY_MAP: Record<string, { type: AnalyzedIncidentType; severity: GeminiAnalysis["severity"] }> = {
  wildfires:    { type: "fire",       severity: "high" },
  floods:       { type: "flood",      severity: "high" },
  severeStorms: { type: "storm",      severity: "high" },
  earthquakes:  { type: "earthquake", severity: "medium" },
  volcanoes:    { type: "general",    severity: "high" },
  landslides:   { type: "accident",   severity: "medium" },
  drought:      { type: "general",    severity: "low" },
  dustHaze:     { type: "general",    severity: "low" },
  seaLakeIce:   { type: "general",    severity: "low" },
  snow:         { type: "storm",      severity: "medium" },
  tempExtremes: { type: "general",    severity: "medium" },
  manmade:      { type: "accident",   severity: "medium" },
}

const ACTIONS = [
  "Verificar el evento con fuentes provinciales (Defensa Civil)",
  "Evaluar despacho de recursos según proximidad a zonas pobladas",
  "Monitorear evolución del evento en la próxima pasada",
]

/** Punto más reciente del track del evento (EONET ordena geometry por fecha). */
function latestPoint(geometry: EonetGeometry[]): { lat: number; lng: number; at: Date; magnitude: number | null } | null {
  const sorted = [...geometry].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  for (const g of sorted) {
    const coords = g.coordinates
    const [lng, lat] = Array.isArray(coords[0]) ? (coords as [number, number][]).at(-1)! : (coords as [number, number])
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, at: new Date(g.date), magnitude: g.magnitudeValue ?? null }
    }
  }
  return null
}

export class EonetConnector extends SocialConnector {
  readonly platform: SocialPlatform = "eonet"

  isConfigured(): boolean {
    return true // API pública de NASA, sin key
  }

  async fetchPosts(options: ConnectorOptions): Promise<SocialPost[]> {
    const url = `${CONFIG.EXTERNAL.EONET.FEED_URL}?status=open&limit=200&_=${Date.now()}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CONFIG.EXTERNAL.TIMEOUT_MS)
    let json: { events?: EonetEvent[] }
    try {
      const res = await fetch(url, { signal: controller.signal, next: { revalidate: 0 } })
      if (!res.ok) throw new Error(`EONET HTTP ${res.status}`)
      json = await res.json()
    } finally {
      clearTimeout(timeout)
    }

    const limit = options.maxResults ?? 10

    // Sin filtro `since`: los eventos abiertos de EONET duran días/semanas
    // y el dedup por post_id (EONET_xxxxx) evita recrearlos.
    return (json.events ?? [])
      .map((event): SocialPost | null => {
        const category = event.categories?.[0]?.id ?? ""
        const mapping = CATEGORY_MAP[category]
        if (!mapping) return null

        const point = latestPoint(event.geometry ?? [])
        if (!point || !insideBox(point.lat, point.lng, CONFIG.EXTERNAL.EONET.BBOX)) return null

        const catTitle = event.categories[0]?.title ?? "Natural event"
        const source = event.sources?.[0]
        const magnitude = point.magnitude != null ? ` (${point.magnitude}${event.geometry.at(-1)?.magnitudeUnit ? ` ${event.geometry.at(-1)!.magnitudeUnit}` : ""})` : ""

        const analysis: GeminiAnalysis = {
          isIncident:          true,
          type:                mapping.type,
          severity:            mapping.severity,
          confidence:          92, // fuente autoritativa
          locationName:        event.title,
          coordinatesInferred: { lat: point.lat, lng: point.lng },
          affectedPeopleEst:   0,
          summary:             `${catTitle} reportado por NASA EONET: ${event.title}${magnitude}.${event.description ? ` ${event.description}` : ""}`,
          reasoning:           "Evento detectado por el feed oficial NASA EONET (monitoreo satelital autoritativo)",
          relatedPostIds:      [event.id],
          suggestedActions:    ACTIONS,
        }

        return {
          id:         event.id,
          platform:   this.platform,
          text:       `${event.title} — ${catTitle} reportado por NASA EONET${source ? ` (fuente: ${source.id})` : ""}`,
          author:     "NASA EONET",
          authorUrl:  source?.url ?? event.link,
          location:   event.title,
          geoLat:     point.lat,
          geoLng:     point.lng,
          postedAt:   point.at,
          rawData:    event,
          trusted:    true,
          preAnalysis: analysis,
        }
      })
      .filter((p): p is SocialPost => p !== null)
      .slice(0, limit)
  }
}
