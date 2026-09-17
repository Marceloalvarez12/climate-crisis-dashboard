"use client"

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
    label: "Calles",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors · ODbL 1.0",
    maxZoom: 19,
  },
  topo: {
    id: "topo",
    label: "Topográfico",
    url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap (CC BY-SA 3.0) · OpenStreetMap",
    maxZoom: 17,
  },
}

interface MapInnerProps {
  incidents: Incident[]
  onMarkerClick: (incident: Incident) => void
  tileStyle?: TileStyle
}

export function MapInner({ incidents, onMarkerClick, tileStyle = "satellite" }: MapInnerProps) {
  const config = TILE_CONFIGS[tileStyle]
  // Combinar estilos: base dark Leaflet + filtro específico del tile
  const containerStyle = config.filter ? `${LEAFLET_DARK_STYLES}\n.leaflet-container { filter: ${config.filter}; }` : LEAFLET_DARK_STYLES

  return (
    <>
      <style>{containerStyle}</style>
      <MapContainer
        key={`tucuman-${tileStyle}`}
        center={MAP_CENTER}
        zoom={13}
        scrollWheelZoom
        preferCanvas={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          key={tileStyle}
          attribution={config.attribution}
          url={config.url}
          maxZoom={config.maxZoom ?? 19}
          eventHandlers={{
            tileerror: (e) => console.warn("[Map] tile load error:", e),
          }}
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
