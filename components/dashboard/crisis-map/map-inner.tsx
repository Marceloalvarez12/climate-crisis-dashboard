"use client"

import { MapContainer, TileLayer, Marker } from "react-leaflet"
import type { Incident } from "@/lib/types"
import { createLeafletIcon, LEAFLET_DARK_STYLES } from "./leaflet-icon"

const MAP_CENTER: [number, number] = [-26.8241, -65.2226]

interface MapInnerProps {
  incidents: Incident[]
  onMarkerClick: (incident: Incident) => void
}

export function MapInner({ incidents, onMarkerClick }: MapInnerProps) {
  return (
    <>
      <style>{LEAFLET_DARK_STYLES}</style>
      <MapContainer center={MAP_CENTER} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {incidents.map((incident) => {
          const icon = createLeafletIcon(incident.severity, incident.type, incident.source)
          if (!icon) return null
          return (
            <Marker
              key={incident.id}
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
