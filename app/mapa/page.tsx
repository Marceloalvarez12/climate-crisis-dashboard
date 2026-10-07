"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import Image from "next/image"
import useSWR from "swr"
import { Megaphone, RefreshCw, Loader2, AlertTriangle, MapPin, ArrowUpRight, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Incident } from "@/lib/types"

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

const TYPE_LABELS: Record<Incident["type"], string> = {
  flood: "Inundación", fire: "Incendio", storm: "Tormenta", accident: "Accidente",
  looting: "Saqueo", violence: "Violencia", general: "Otra emergencia",
}

const SEVERITY_LABELS: Record<Incident["severity"], string> = {
  critical: "Crítica", high: "Alta", medium: "Media", low: "Baja",
}

const SOURCE_LABELS: Record<Incident["source"], string> = {
  citizen: "Reporte ciudadano", social: "Reporte en verificación", sensor: "Fuente oficial", camera: "Cámara",
}

const publicFetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))

export default function PublicMapPage() {
  const [leafletCssReady, setLeafletCssReady] = useState(false)
  const [reportId, setReportId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<Incident["type"] | "all">("all")
  const [sourceFilter, setSourceFilter] = useState<Incident["source"] | "all">("all")

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("reporte")
    if (id && /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)) setReportId(id)
  }, [])

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

  const pendingCount = data?.incidents.filter((i) => i.pendiente_validacion).length ?? 0
  const visibleIncidents = useMemo(() => incidents.filter((incident) =>
    (typeFilter === "all" || incident.type === typeFilter) &&
    (sourceFilter === "all" || incident.source === sourceFilter) &&
    incident.location.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR"))
  ), [incidents, typeFilter, sourceFilter, query])
  const selected = visibleIncidents.find((i) => i.id === selectedId) ??
    visibleIncidents.find((i) => i.id === reportId && i.source === "citizen")
  const isMyReport = !!selected && selected.id === reportId && selected.source === "citizen"

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0a0c10] text-foreground">
      {/* Header público */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-[#0d1014] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/zntinel-logo-optimized.png" alt="Zntinel" width={105} height={64} className="h-11 w-auto shrink-0 object-contain" priority />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-white sm:text-base">Mapa ciudadano · Tucumán</h1>
            <p className="hidden text-xs text-zinc-400 sm:block">Emergencias reportadas en tiempo real</p>
          </div>
        </div>
        <Button asChild size="sm" className="h-9 shrink-0 gap-2 bg-red-600 font-semibold text-white hover:bg-red-700">
          <Link href="/reportar">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Hacer un reporte</span>
            <span className="sm:hidden">Reportar</span>
          </Link>
        </Button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800 bg-[#0d1014] px-4 py-2.5 sm:px-6">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-400 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0" />
          <span className="sr-only">Buscar zona</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar zona..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" />
        </label>
        <select aria-label="Filtrar por tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as Incident["type"] | "all")}
          className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none focus:border-cyan-400">
          <option value="all">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filtrar por origen" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as Incident["source"] | "all")}
          className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none focus:border-cyan-400">
          <option value="all">Todos los orígenes</option>
          <option value="citizen">Ciudadanos</option>
          <option value="social">Redes sociales</option>
          <option value="sensor">Fuentes oficiales</option>
          <option value="camera">Cámaras</option>
        </select>
      </div>

      {/* Aviso de verificación */}
      {pendingCount > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
          <p className="text-xs text-yellow-300/90">Algunos reportes de redes están en verificación.</p>
        </div>
      )}

      {/* Mapa */}
      <div className="relative min-h-0 flex-1">
        {leafletCssReady ? (
          <MapInner
            incidents={visibleIncidents}
            onMarkerClick={(incident) => setSelectedId(incident.id)}
            tileStyle="street"
            focusedIncidentId={selected?.id}
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

        {selected && !error && (
          <div role="status" className="absolute inset-x-3 top-3 z-[1000] mx-auto max-w-sm rounded-xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-xl shadow-black/40 backdrop-blur-sm sm:inset-x-auto sm:left-4">
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-cyan-500/15 p-2 text-cyan-400"><MapPin className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-400">{isMyReport ? "Tu reporte está en el mapa" : SOURCE_LABELS[selected.source]}</p>
                <p className="mt-1 text-sm font-semibold text-white">{TYPE_LABELS[selected.type]} · {selected.location}</p>
                <p className="mt-1 text-xs text-zinc-400">Gravedad {SEVERITY_LABELS[selected.severity]} · {selected.affectedPeople} personas afectadas</p>
                <p className="mt-1 text-xs text-zinc-500">{selected.timestamp.toLocaleString("es-AR")} {selected.source === "citizen" ? "· Ubicación aproximada" : ""}</p>
                {isMyReport && <Link href={`/seguimiento/${selected.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:underline">
                  Ver seguimiento y comprobante <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>}
              </div>
              <button type="button" aria-label="Cerrar detalle" onClick={() => { setSelectedId(null); setReportId(null) }} className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}
        {data && !error && visibleIncidents.length === 0 && (
          <div className="absolute inset-x-4 top-4 z-[1000] mx-auto max-w-xs rounded-lg border border-zinc-700 bg-zinc-950/95 p-3 text-center text-xs text-zinc-300">
            {incidents.length === 0 ? "Todavía no hay incidentes activos." : "No hay incidentes con estos filtros."}
          </div>
        )}

        {/* Leyenda */}
        <div className="absolute bottom-4 left-4 z-[1000] hidden rounded-md border border-zinc-700/60 bg-black/85 p-2.5 backdrop-blur-sm sm:block">
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
        <div className="absolute bottom-4 right-4 z-[1000] rounded-lg border border-zinc-700/60 bg-zinc-950/90 px-3 py-2 text-xs text-zinc-300 backdrop-blur-sm">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
          {data ? `${visibleIncidents.length} de ${incidents.length}` : "—"} incidentes activos
        </div>
      </div>

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-400 sm:px-6">
        <span className="flex items-center gap-1.5">
          {isValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Actualiza cada 5 segundos
        </span>
        <span className="hidden sm:inline">Los reportes ciudadanos se muestran por zona aproximada.</span>
      </footer>
    </div>
  )
}
