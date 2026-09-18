// Mapa de calor (heatMap) computado en React, sin librerías externas.
//
// Algoritmo:
//   1. Snap-to-grid: cada incidente cae en una celda de ~0.005° (≈550m en Tucumán)
//   2. Count de incidentes por celda
//   3. Por cada celda con count >= HEAT_MIN_COUNT se renderiza N círculos
//      concéntricos con opacidad radial-decreciente (efecto "glow" del calor)
//   4. El radio máximo escala logarítmicamente con el count (1..30 incidentes)
//      para que una zona con 20 incidentes no ocupe toda la pantalla

import { useMemo } from "react"
import { Circle } from "react-leaflet"
import type { Incident } from "@/lib/types"

interface HeatHotspot {
  lat: number
  lng: number
  count: number
  maxSeverity: "critical" | "high" | "medium" | "low"
  ids: string[]
}

const GRID_SIZE_DEG = 0.005 // ≈550m en Tucumán lat -27
const HEAT_MIN_COUNT = 2 // mostrá calor a partir de 2 incidentes en la misma celda

function severityRank(s: string): number {
  if (s === "critical") return 4
  if (s === "high") return 3
  if (s === "medium") return 2
  return 1
}

function buildHotspots(incidents: Incident[]): HeatHotspot[] {
  const cells = new Map<string, HeatHotspot>()
  for (const inc of incidents) {
    if (!Number.isFinite(inc.coordinates?.lat) || !Number.isFinite(inc.coordinates?.lng)) continue
    const col = Math.floor(inc.coordinates.lng / GRID_SIZE_DEG)
    const row = Math.floor(inc.coordinates.lat / GRID_SIZE_DEG)
    const key = `${col}:${row}`
    const existing = cells.get(key)
    if (existing) {
      existing.count += 1
      existing.ids.push(inc.id)
      if (severityRank(inc.severity) > severityRank(existing.maxSeverity)) {
        existing.maxSeverity = inc.severity as HeatHotspot["maxSeverity"]
      }
      // Re-centrar la celda en el promedio para que el heatmap no salte
      existing.lat = (existing.lat * (existing.count - 1) + inc.coordinates.lat) / existing.count
      existing.lng = (existing.lng * (existing.count - 1) + inc.coordinates.lng) / existing.count
    } else {
      cells.set(key, {
        lat: inc.coordinates.lat,
        lng: inc.coordinates.lng,
        count: 1,
        maxSeverity: inc.severity as HeatHotspot["maxSeverity"],
        ids: [inc.id],
      })
    }
  }
  return Array.from(cells.values()).filter((c) => c.count >= HEAT_MIN_COUNT)
}

// 3 anillos concéntricos: core denso + halo medio + corona suave
const RINGS_PER_HOTSPOT = 3

interface HeatMapLayerProps {
  incidents: Incident[]
  /** Cluster click callback — el operador hace click en el anillo y ve los incidentes adentro */
  onHotspotClick?: (ids: string[]) => void
}

export function HeatMapLayer({ incidents, onHotspotClick }: HeatMapLayerProps) {
  const hotspots = useMemo(() => buildHotspots(incidents), [incidents])

  return (
    <>
      {hotspots.map((spot, idx) => {
        // Radio máximo escala logarítmico: 1→12px ... 30→28px * zoom 13 → metros
        const baseRadiusMeters = 120 + 100 * Math.log2(Math.min(spot.count, 30))
        const color = heatColor(spot.maxSeverity)

        // Solo renderizar hotspots de 5+ incidentes si el usuario está en modo oscuro
        // — solar-overhead. Por ahora mantener todos los >=2.
        return (
          <CircleGroup key={`heat-${idx}-${spot.lat}-${spot.lng}`} spot={spot} baseRadiusMeters={baseRadiusMeters} color={color} onClick={onHotspotClick} />
        )
      })}
    </>
  )
}

function heatColor(severity: HeatHotspot["maxSeverity"]): string {
  if (severity === "critical") return "#ef4444"
  if (severity === "high") return "#f97316"
  if (severity === "medium") return "#eab308"
  return "#22c55e"
}

// Componente interno: cada hotspot es 3 Circle concéntricos (radial gradient simulation).
interface CircleGroupProps {
  spot: HeatHotspot
  baseRadiusMeters: number
  color: string
  onClick?: (ids: string[]) => void
}

function CircleGroup({ spot, baseRadiusMeters, color, onClick }: CircleGroupProps) {
  return (
    <>
      {Array.from({ length: RINGS_PER_HOTSPOT }).map((_, ringIdx) => {
        const r = ringIdx + 1
        const radius = baseRadiusMeters * r
        const opacity = 0.4 / r
        return (
          <Circle
            key={`ring-${r}`}
            center={[spot.lat, spot.lng]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: opacity,
              stroke: false,
              weight: 0,
            }}
            interactive={ringIdx === RINGS_PER_HOTSPOT - 1}
            eventHandlers={ringIdx === RINGS_PER_HOTSPOT - 1 ? { click: () => onClick?.(spot.ids) } : undefined}
          />
        )
      })}
    </>
  )
}

export type { HeatHotspot }
