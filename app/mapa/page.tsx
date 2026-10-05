"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import useSWR from "swr"
import { Megaphone, RefreshCw, ShieldCheck, Loader2, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Incident } from "@/lib/types"
import { TRIGGER_HASHTAG } from "@/lib/agents/hashtag"

const MapInner = dynamic(
  () => import("@/components/dashboard/crisis-map/map-inner").then((m) => m.MapInner),
  { ssr: false },
)

interface PublicIncident {
  id:                 string
  tipo:               Incident["type"]
  severidad:          Incident["severity"]
  ubicacion:          string
  latitud:            number
  longitud:           number
  personas_afectadas: number
  fuente:             Incident["source"]
  pendiente_validacion: boolean
  created_at:         string
}

const SEVERITY_LEGENDS = [
  { label: "Crítico", color: "#dc2626" },
  { label: "Alto",    color: "#f97316" },
  { label: "Medio",   color: "#eab308" },
  { label: "Bajo",    color: "#22c55e" },
]

const TYPE_LABELS: Record<string, string> = {
  flood: "Inundación", fire: "Incendio", storm: "Tormenta", looting: "Saqueo",
  violence: "Violencia", accident: "Accidente", general: "General",
}

const publicFetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))

export default function PublicMapPage() {
  const [leafletCssReady, setLeafletCssReady] = useState(false)

  const { data, error, isValidating } = useSWR<{ updatedAt: string; incidents: PublicIncident[] }>(
    "/api/public/incidentes",
    publicFetcher,
    { refreshInterval: 5000, revalidateOnFocus: true },
  )

  // Leaflet CSS vía fetch + <style> (mismo mecanismo que el dashboard por CSP)
  useEffect(() => {
    let cancelled = false
    fetch("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((css) => {
        if (cancelled) return
        const style = document.createElement("style")
        style.dataset.leaflet = "true"
        style.textContent = css
        document.head.appendChild(style)
        setLeafletCssReady(true)
      })
      .catch(() => setLeafletCssReady(true))
    return () => {
      cancelled = true
      document.querySelector("style[data-leaflet]")?.remove()
    }
  }, [])

  const incidents: Incident[] = useMemo(
    () =>
      (data?.incidents ?? []).map((i) => ({
        id:             i.id,
        type:           i.tipo,
        severity:       i.severidad,
        location:       i.pendiente_validacion ? `${i.ubicacion} (en verificación)` : i.ubicacion,
        coordinates:    { lat: i.latitud, lng: i.longitud },
        affectedPeople: i.personas_afectadas,
        timestamp:      new Date(i.created_at),
        source:         i.fuente,
        sourceDetails:  {},
        estado:         "activo",
      })),
    [data],
  )

  const pendingCount = incidents.filter((i) => i.location.endsWith("(en verificación)")).length
  const byType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const i of incidents) counts[i.type] = (counts[i.type] ?? 0) + 1
    return counts
  }, [incidents])

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0a0c10] text-foreground">
      {/* Header público */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800 bg-[#0d1014]/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-400" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-zinc-100">Zntinel · Emergencias en Tucumán</h1>
            <p className="truncate text-[10px] text-zinc-500">Mapa público en tiempo real — datos del centro de crisis</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-red-500/40 bg-red-500/10 font-mono text-[10px] text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            {incidents.length} activos
          </Badge>
          <span className="hidden items-center gap-1 text-[10px] text-zinc-500 sm:flex">
            {isValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {data ? `Actualizado ${new Date(data.updatedAt).toLocaleTimeString("es-AR")}` : "Sincronizando…"}
          </span>
          <Button asChild size="sm" className="h-8 gap-1.5 bg-red-600 text-xs font-semibold text-white hover:bg-red-700">
            <Link href="/reportar">
              <Megaphone className="h-3.5 w-3.5" />
              Reportar emergencia
            </Link>
          </Button>
        </div>
      </header>

      {/* Aviso de verificación */}
      {pendingCount > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-400" />
          <p className="text-[10px] text-yellow-300/90">
            {pendingCount} reporte(s) de redes sociales ({TRIGGER_HASHTAG}) están siendo verificados por operadores.
          </p>
        </div>
      )}

      {/* Mapa */}
      <div className="relative min-h-0 flex-1">
        {leafletCssReady ? (
          <MapInner
            incidents={incidents}
            onMarkerClick={() => {}}
            tileStyle="street"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        )}

        {/* Error de carga */}
        {error && (
          <div className="absolute inset-x-4 top-4 z-[1000] rounded-md border border-red-500/30 bg-red-950/80 p-3 text-center text-xs text-red-300 backdrop-blur-sm">
            No se pudo cargar el mapa de emergencias. Reintentando…
          </div>
        )}

        {/* Leyenda */}
        <div className="absolute bottom-4 left-4 z-[1000] rounded-md border border-zinc-700/60 bg-black/85 p-2.5 backdrop-blur-sm">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Severidad</p>
          <div className="space-y-1">
            {SEVERITY_LEGENDS.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-zinc-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Conteo por tipo */}
        {incidents.length > 0 && (
          <div className="absolute right-4 top-4 z-[1000] flex flex-wrap justify-end gap-1.5">
            {Object.entries(byType).map(([tipo, count]) => (
              <Badge key={tipo} variant="outline" className={cn("border-zinc-600/60 bg-black/80 text-[10px] text-zinc-300 backdrop-blur-sm")}>
                {TYPE_LABELS[tipo] ?? tipo}: {count}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-between border-t border-zinc-800 px-4 py-2">
        <p className="text-[10px] text-zinc-500">
          Actualización automática cada 5 s · Solo lectura · ¿Ves una emergencia?{" "}
          <Link href="/reportar" className="text-cyan-400 hover:underline">Reportala</Link>
        </p>
        <p className="hidden text-[10px] text-zinc-600 sm:block">Auditoría pública en <Link href="/auditoria" className="text-cyan-400 hover:underline">/auditoria</Link></p>
      </footer>
    </div>
  )
}
