"use client"

import { useRef, useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import type { Incident } from "@/lib/types"
import { createLeafletIcon, LEAFLET_DARK_STYLES } from "./leaflet-icon"

const MAP_CENTER: [number, number] = [-26.8241, -65.2226]

export type TileStyle = "satellite" | "street" | "topo"

interface TileConfig {
  id: TileStyle
  label: string
  url: string
  attribution: string
  /** CSS filter opcional para forzar look "dark táctico" sobre tiles claros */
  filter?: string
  maxZoom?: number
  /** Provider de fallback si este falla (watermark rate limit etc) */
  fallbackUrl?: string
  fallbackAttribution?: string
  fallbackFilter?: string
}

const TILE_CONFIGS: Record<TileStyle, TileConfig> = {
  satellite: {
    id: "satellite",
    label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Source: Esri, USGS, NOAA",
    filter: "brightness(0.55) contrast(1.15) saturate(0.7) hue-rotate(190deg)",
    maxZoom: 19,
  },
  street: {
    id: "street",
    label: "Oscuro",
    // Esri Dark Gray con filtro: mantiene calles y etiquetas visibles,
    // pero baja el gris a un negro táctico para destacar los incidentes.
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Esri, GARMIN, FAO, NOAA, USGS",
    filter: "brightness(0.48) contrast(1.2) saturate(0.8)",
    maxZoom: 16,
  },
  topo: {
    id: "topo",
    label: "Topográfico",
    url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap (CC BY-SA 3.0) · OpenStreetMap",
    maxZoom: 17,
    fallbackUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    fallbackAttribution: "Tiles © Esri",
  },
}

// Umbral de errores antes de hacer failover (Leaflet reintentará
// tiles si es un problema transitorio; N errores seguidos sí es patrón)
const TILE_ERROR_THRESHOLD = 8

interface MapInnerProps {
  incidents: Incident[]
  onMarkerClick: (incident: Incident) => void
  tileStyle?: TileStyle
}

export function MapInner({ incidents, onMarkerClick, tileStyle = "street" }: MapInnerProps) {
  const config = TILE_CONFIGS[tileStyle]
  const [activeUrl, setActiveUrl] = useState(config.url)
  const [activeAttribution, setActiveAttribution] = useState(config.attribution)
  const [activeFilter, setActiveFilter] = useState(config.filter)
  const [usesFallback, setUsesFallback] = useState(false)
  const errorCountRef = useRef(0)

  useEffect(() => {
    errorCountRef.current = 0
    setUsesFallback(false)
    setActiveUrl(config.url)
    setActiveAttribution(config.attribution)
    setActiveFilter(config.filter)
  }, [tileStyle, config.url, config.attribution, config.filter])

  const containerStyle = activeFilter
    ? `${LEAFLET_DARK_STYLES}\n.leaflet-container { filter: ${activeFilter}; }`
    : LEAFLET_DARK_STYLES

  const handleTileError = () => {
    errorCountRef.current += 1
    if (errorCountRef.current >= TILE_ERROR_THRESHOLD && !usesFallback && config.fallbackUrl) {
      console.warn("[Map] Tile provider failing — switching to fallback silently")
      setUsesFallback(true)
      setActiveUrl(config.fallbackUrl)
      setActiveAttribution(config.fallbackAttribution || config.attribution)
      setActiveFilter(config.fallbackFilter)
    }
  }

  return (
    <>
      <style>{containerStyle}</style>
      <MapContainer
        key={`tucuman-${tileStyle}-${usesFallback ? "fb" : "primary"}`}
        center={MAP_CENTER}
        zoom={13}
        scrollWheelZoom
        preferCanvas={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          key={`${tileStyle}-single`}
          attribution={activeAttribution}
          url={activeUrl}
          maxZoom={config.maxZoom ?? 19}
          eventHandlers={{ tileerror: handleTileError }}
        />
        {incidents.map((incident) => {
          const icon = createLeafletIcon(incident.severity, incident.type, incident.source)
          if (!icon) return null
          if (!Number.isFinite(incident.coordinates?.lat) || !Number.isFinite(incident.coordinates?.lng)) {
            console.warn("[Map] incident sin coords válidas:", incident.id, incident.coordinates)
            return null
          }
          return (
            <Marker
              key={`${incident.id}-${incident.coordinates.lat}-${incident.coordinates.lng}`}
              position={[incident.coordinates.lat, incident.coordinates.lng]}
              icon={icon}
              eventHandlers={{ click: () => onMarkerClick(incident) }}
            />
          )
        })}
      </MapContainer>
    </>
  )
}

export { TILE_CONFIGS }
