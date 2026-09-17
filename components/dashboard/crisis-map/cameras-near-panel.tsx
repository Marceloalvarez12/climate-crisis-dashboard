"use client"

import { useState } from "react"
import { Camera, ExternalLink, Video, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CameraSource } from "@/lib/data/layers"

interface CamerasNearPanelProps {
  cameras: CameraSource[]
  count: number
  loading?: boolean
  onSelect?: (camera: CameraSource) => void
}

export function CamerasNearPanel({ cameras, count, loading, onSelect }: CamerasNearPanelProps) {
  const [open, setOpen] = useState(false)
  // Mostrar el panel incluso si count=0 — el operador debe ver el resultado
  // (Overpass a veces devuelve vacío para radios chicos en zonas con poca
  // cobertura OSM). Solo ocultamos cuando loading===false && count===0
  // AND ya pasó al menos un fetch.

  return (
    <div className="pointer-events-auto absolute bottom-12 right-3 z-10 max-w-xs rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">
            {loading ? "Buscando cámaras..." : `${count} cámara${count === 1 ? "" : "s"} pública${count === 1 ? "" : "s"} cerca`}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      {open && cameras.length === 0 && !loading && (
        <div className="border-t border-border px-3 py-3 text-[10px] text-muted-foreground">
          <p className="font-medium text-foreground">No hay cámaras OSM marcadas en este radio.</p>
          <p className="mt-1">Argentina tiene poca cobertura de <code className="text-[9px]">man_made=surveillance</code> en OpenStreetMap.</p>
          <p className="mt-1.5 text-[9px]">Probá ampliar el radio o usar feeds municipales cuando estén disponibles.</p>
        </div>
      )}
      {open && cameras.length > 0 && (
        <div className="max-h-64 overflow-y-auto border-t border-border">
          {cameras.map((cam) => (
            <button
              key={cam.id}
              onClick={() => onSelect?.(cam)}
              className={cn(
                "flex w-full items-start gap-2 border-b border-border/40 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-secondary/50",
              )}
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary text-foreground">
                {cam.kind === "speed_camera" ? (
                  <Video className="h-3 w-3" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[11px] font-medium text-foreground">{cam.name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {cam.operator ?? (cam.kind === "speed_camera" ? "Speed camera" : "Surveillance")}
                </p>
              </div>
              {cam.url ? (
                <a
                  href={cam.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 text-muted-foreground hover:text-foreground"
                  title="Ver feed"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </button>
          ))}
          <div className="flex items-center justify-between border-t border-border bg-secondary/20 px-3 py-1.5 text-[9px] text-muted-foreground">
            <span>Datos: OpenStreetMap · ODbL 1.0</span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${cameras[0]?.coordinates.lat ?? ""}&mlon=${cameras[0]?.coordinates.lng ?? ""}#map=17/${cameras[0]?.coordinates.lat ?? ""}/${cameras[0]?.coordinates.lng ?? ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 hover:text-foreground"
            >
              Ver en mapa
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

interface CamerasFeedModalProps {
  camera: CameraSource | null
  onClose: () => void
}

export function CamerasFeedModal({ camera, onClose }: CamerasFeedModalProps) {
  if (!camera) return null
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${camera.coordinates.lat}&mlon=${camera.coordinates.lng}&#map=18/${camera.coordinates.lat}/${camera.coordinates.lng}`

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-zinc-950 p-5 shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Camera className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{camera.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {camera.kind === "speed_camera" ? "Cámara de velocidad" : "Cámara de vigilancia"}
              {camera.operator ? ` · ${camera.operator}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 aspect-video w-full rounded-lg border border-border bg-zinc-900 flex flex-col items-center justify-center gap-2">
          <Camera className="h-8 w-8 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground text-center max-w-xs">
            {camera.url
              ? "Este nodo OSM tiene una URL pública declarada. Click abajo para abrir el feed."
              : "No hay feed público declarado para esta cámara. La posición está confirmada en OpenStreetMap."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
            <p className="text-muted-foreground">Lat</p>
            <p className="font-mono text-foreground">{camera.coordinates.lat.toFixed(5)}</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
            <p className="text-muted-foreground">Lng</p>
            <p className="font-mono text-foreground">{camera.coordinates.lng.toFixed(5)}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {camera.url && (
            <a
              href={camera.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ver feed
            </a>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-md border border-border bg-secondary px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-secondary/70"
          >
            Ver en OSM
          </a>
        </div>
      </div>
    </div>
  )
}
