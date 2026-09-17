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
      <MapContainer
        key="tucuman-main"
        center={MAP_CENTER}
        zoom={13}
        scrollWheelZoom
        preferCanvas={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
