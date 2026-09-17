"use client"

import { Camera, ExternalLink, Video, MapPin, Loader2, Compass, ChevronDown, ChevronUp, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCamerasNear } from "@/hooks/use-live-layers"
import type { Incident } from "@/lib/types"

interface IncidentVerifyPanelProps {
  incident: Incident
  defaultRadius?: number
}

/**
 * Panel de verificación del incidente:
 *  - Coords exactas (copy-on-click)
 *  - Cámaras públicas OSM cercanas (auto-fetch)
 *  - Links a Google Maps + Street View
 *  - Mensaje claro cuando el país tiene 0 cámaras (Argentina)
 */
export function IncidentVerifyPanel({ incident, defaultRadius = 1500 }: IncidentVerifyPanelProps) {
  const { cameras, count: camerasCount, isLoading } = useCamerasNear(
    true,
    incident.coordinates.lat,
    incident.coordinates.lng,
    defaultRadius,
  )
  const camerasNear = cameras

  const expanded = true // siempre expandido en el modal

  const osmLink = `https://www.openstreetmap.org/?mlat=${incident.coordinates.lat}&mlon=${incident.coordinates.lng}#map=18/${incident.coordinates.lat}/${incident.coordinates.lng}`
  const gmapsLink = `https://www.google.com/maps?q=${incident.coordinates.lat},${incident.coordinates.lng}`
  const streetViewLink = `https://www.google.com/maps/@${incident.coordinates.lat},${incident.coordinates.lng},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s`

  return (
    <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-secondary/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Compass className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Verificación visual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-muted-foreground">{incident.coordinates.lat.toFixed(5)}, {incident.coordinates.lng.toFixed(5)}</span>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-1.5">
          <a
            href={gmapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-2 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <Navigation className="h-3 w-3" />
            Google Maps
          </a>
          <a
            href={streetViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-2 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <Compass className="h-3 w-3" />
            Street View
          </a>
          <a
            href={osmLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-2 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <MapPin className="h-3 w-3" />
            OSM
          </a>
        </div>

        {/* Cameras */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Cámaras públicas (radio {defaultRadius}m)
            </p>
            <span className="text-[9px] text-muted-foreground font-mono">
              {isLoading ? "..." : `${camerasCount} resultados`}
            </span>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando cámaras cercanas en OSM...
            </div>
          )}

          {!isLoading && camerasCount === 0 && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-[10px]">
              <p className="font-semibold text-amber-400">Sin cámaras OSM en este radio.</p>
              <p className="mt-1 text-muted-foreground">
                Argentina/Latinoamérica tienen poca cobertura de{" "}
                <code className="text-[9px]">man_made=surveillance</code> en OpenStreetMap.
              </p>
              <p className="mt-1 text-muted-foreground">
                En <strong>USA/Europa/Canadá</strong> esta sección muestra cámaras municipales
                con feed en vivo. Confirmá el incidente abriendo Street View o un mapa local.
              </p>
            </div>
          )}

          {!isLoading && camerasNear.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-0.5">
              {camerasNear.map((cam: import("@/lib/data/layers").CameraSource) => (
                <a
                  key={cam.id}
                  href={cam.url || osmLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-start gap-2 rounded-md border border-border bg-secondary/30 px-2.5 py-2 transition-colors hover:bg-secondary/60",
                  )}
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                    {cam.kind === "speed_camera" ? (
                      <Video className="h-2.5 w-2.5" />
                    ) : (
                      <Camera className="h-2.5 w-2.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[11px] font-medium text-foreground">{cam.name}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {cam.operator ?? (cam.kind === "speed_camera" ? "Speed camera" : "Surveillance")} ·{" "}
                      <span className="font-mono">
                        {cam.coordinates.lat.toFixed(4)}, {cam.coordinates.lng.toFixed(4)}
                      </span>
                    </p>
                  </div>
                  {cam.url && (
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                </a>
              ))}
            </div>
          )}

          <p className="mt-2 text-[9px] text-muted-foreground">
            Datos: OpenStreetMap · ODbL 1.0 · Overpass API
          </p>
        </div>
      </div>
    </div>
  )
}
