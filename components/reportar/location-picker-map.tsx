"use client"

import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import L from "leaflet"
import { Crosshair, Loader2 } from "lucide-react"

// Estilos Leaflet: mismo look oscuro táctico que el mapa principal
const PICKER_STYLES = `
  .picker-map .leaflet-container { height: 100%; width: 100%; background: #0a0c10; border-radius: 8px; position: relative; overflow: hidden; }
  .picker-map .leaflet-pane,
  .picker-map .leaflet-tile-pane,
  .picker-map .leaflet-overlay-pane,
  .picker-map .leaflet-shadow-pane,
  .picker-map .leaflet-marker-pane,
  .picker-map .leaflet-tooltip-pane,
  .picker-map .leaflet-popup-pane { position: absolute; left: 0; top: 0; }
  .picker-map .leaflet-tile-container { position: absolute; left: 0; top: 0; }
  .picker-map .leaflet-tile { position: absolute; width: 256px !important; height: 256px !important; max-width: none !important; border: 0; filter: brightness(0.48) contrast(1.18) saturate(0.2); }
  .picker-map .leaflet-marker-icon,
  .picker-map .leaflet-marker-shadow { display: block; position: absolute; }
  .picker-map .leaflet-control-attribution { background: rgba(23,23,23,0.8) !important; color: #737373 !important; }
  .picker-map .leaflet-control-zoom a { background: #171717 !important; color: #fafafa !important; border-color: #2a2a2a !important; }
  .picker-pin { background: transparent; border: none; }
`

// Centro Tucumán
const CENTER: [number, number] = [-26.8241, -65.2226]

export interface LocationPickerValue {
  lat: number
  lng: number
  nombre: string
}

interface LocationPickerMapProps {
  /** Coordenada inicial (resultado de geocoding o centro de Tucumán) */
  initial?: LocationPickerValue | null
  /** Callback al mover/clickear el pin */
  onChange: (value: LocationPickerValue) => void
  height?: number
}

/** Reverse geocode: lat/lng → nombre de calle (Nominatim) */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "jsonv2",
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        "User-Agent": "Zntinel-Dashboard/1.0 (crisis reporting)",
        "Accept-Language": "es",
      },
    })
    if (!res.ok) return "Ubicación elegida en el mapa"
    const data = (await res.json()) as { display_name?: string }
    return data.display_name || "Ubicación elegida en el mapa"
  } catch {
    return "Ubicación elegida en el mapa"
  }
}

/** Marcador draggable — bridge imperative hacia leaflet */
function DraggableMarker({
  position,
  onPositionChange,
}: {
  position: [number, number]
  onPositionChange: (lat: number, lng: number) => void
}) {
  const markerRef = useRef<L.Marker | null>(null)
  const pinIcon = useRef(
    L.divIcon({
      className: "picker-pin",
      html: `<div style="width:26px;height:26px;border-radius:50%;background:#6366f1;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:grab;"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    }),
  )

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={pinIcon.current}
      draggable
      eventHandlers={{
        dragend: () => {
          const m = markerRef.current
          if (!m) return
          const { lat, lng } = m.getLatLng()
          onPositionChange(lat, lng)
        },
      }}
    />
  )
}

/** Captura clicks en el mapa para mover el pin ahí */
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function LocationPickerMap({ initial, onChange, height = 260 }: LocationPickerMapProps) {
  const [position, setPosition] = useState<[number, number]>([
    initial?.lat ?? CENTER[0],
    initial?.lng ?? CENTER[1],
  ])
  const [resolving, setResolving] = useState(false)

  // Notificar al padre el valor inicial
  useEffect(() => {
    if (initial) {
      onChange({ lat: initial.lat, lng: initial.lng, nombre: initial.nombre })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateAt(lat: number, lng: number) {
    setPosition([lat, lng])
    setResolving(true)
    const nombre = await reverseGeocode(lat, lng)
    setResolving(false)
    onChange({ lat, lng, nombre })
  }

  return (
    <div className="picker-map overflow-hidden rounded-lg border border-zinc-700" style={{ height }}>
      <style>{PICKER_STYLES}</style>
      <MapContainer center={position} zoom={15} scrollWheelZoom className="!h-full !w-full" style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClickCapture onPick={updateAt} />
        <DraggableMarker position={position} onPositionChange={updateAt} />
      </MapContainer>
      {resolving && (
        <div className="pointer-events-none relative -mt-8 flex items-center justify-center gap-1.5 rounded-b-lg bg-black/70 py-1 text-[10px] text-zinc-300 backdrop-blur-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          Resolviendo dirección...
        </div>
      )}
    </div>
  )
}
