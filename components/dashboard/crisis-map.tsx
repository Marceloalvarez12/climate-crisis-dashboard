"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { MapPin, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { mutate } from "swr"
import { dispatchResourceWithLifecycle, restoreResourceTimersOnMount } from "@/hooks/use-resource-lifecycle"
import { buildRespawnIncident } from "@/lib/mock-data"
import { patchIncidente, createIncidente } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import type { Incident, IncidentSource, DbIncident } from "@/lib/types"
import { useIncidents, useResources } from "./crisis-map/use-map-data"
import { IncidentIcon, SourceIcon, severityColorClass, sourceLabel, incidentTypeLabel } from "./crisis-map/incident-helpers"
import { createLeafletIcon, LEAFLET_DARK_STYLES } from "./crisis-map/leaflet-icon"
import { IncidentDetailModal, DeployModal } from "./crisis-map/map-modals"
import { IncidentDispatchCard } from "./incident-dispatch-card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

// ---------------------------------------------------------------------------
// Lazy-load de componentes Leaflet (sólo cliente)
// ---------------------------------------------------------------------------

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false })
const TileLayer    = dynamic(() => import("react-leaflet").then((m) => m.TileLayer),    { ssr: false })
const Marker       = dynamic(() => import("react-leaflet").then((m) => m.Marker),       { ssr: false })

const MAP_CENTER: [number, number] = [-26.8241, -65.2226]
const SOURCE_TYPES: IncidentSource[] = ["social", "sensor", "camera"]

const SEVERITY_LEGENDS = [
  { label: "Critical", color: "bg-primary" },
  { label: "High",     color: "bg-accent" },
  { label: "Medium",   color: "bg-yellow-500" },
  { label: "Low",      color: "bg-success" },
]

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CrisisMap() {
  const [isClient, setIsClient] = useState(false)
  const [leafletCssLoaded, setLeafletCssLoaded] = useState(false)
  const [selectedIncident,   setSelectedIncident]   = useState<Incident | null>(null)
  const [showDeployModal,    setShowDeployModal]     = useState(false)
  const [showBlockchainModal, setShowBlockchainModal] = useState(false)
  const [activeLayers,       setActiveLayers]       = useState<IncidentSource[]>(SOURCE_TYPES)
  const [deployingResources, setDeployingResources] = useState(false)
  const [deploySuccess,      setDeploySuccess]      = useState(false)
  const [selectedCounts,     setSelectedCounts]     = useState<Record<string, number>>({})
  const [viewMode,           setViewMode]           = useState<"activo" | "atendido">("activo")

  // ── Data ──────────────────────────────────────────────────────────────────
  const { incidents: dbIncidents, mutate: mutateIncidents } = useIncidents(viewMode)
  const { data: dbRecursos, mutate: mutateRecursos }        = useResources()

  // All incidents come from the database (real + respawned)
  const incidents: Incident[] = dbIncidents

  const resourceGroups = useMemo(() => {
    if (!dbRecursos) return []
    const groups: Record<string, { tipo: string; ids: string[]; availableIds: string[] }> = {}
    for (const r of dbRecursos) {
      if (!groups[r.tipo]) groups[r.tipo] = { tipo: r.tipo, ids: [], availableIds: [] }
      groups[r.tipo].ids.push(r.id)
      if (r.estado === "available") groups[r.tipo].availableIds.push(r.id)
    }
    return Object.values(groups)
  }, [dbRecursos])

  useEffect(() => {
    setIsClient(true)
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)
    setLeafletCssLoaded(true)

    restoreResourceTimersOnMount().catch((err) => console.error("[CrisisMap] Error restoring resource timers:", err))

    return () => {
      document.head.removeChild(link)
    }
  }, [])

  // ── Layer filter ─────────────────────────────────────────────────────────
  const toggleLayer = (layer: IncidentSource) => {
    setActiveLayers((prev) =>
      prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer]
    )
  }

  const filteredIncidents = incidents.filter((i) => activeLayers.includes(i.source))

  // ── Deploy handlers ───────────────────────────────────────────────────────
  const handleOpenDeploy = () => {
    setDeploySuccess(false)
    setSelectedCounts({})
    mutateRecursos()
    setShowDeployModal(true)
  }

  const handleCloseDeploy = () => {
    setShowDeployModal(false)
    setDeploySuccess(false)
    setSelectedCounts({})
    mutateRecursos()
  }

  const adjustCount = (tipo: string, delta: number, max: number) => {
    setSelectedCounts((prev) => {
      const next = Math.min(max, Math.max(0, (prev[tipo] ?? 0) + delta))
      return { ...prev, [tipo]: next }
    })
  }

  const handleConfirmDeploymentTransition = () => {
    const totalSelected = Object.values(selectedCounts).reduce((a, b) => a + b, 0)
    if (totalSelected === 0) {
      toast.error("Seleccione al menos un recurso para desplegar")
      return
    }
    setShowDeployModal(false)
    setShowBlockchainModal(true)
  }

  const handleCloseConfirmDispatch = () => {
    setShowBlockchainModal(false)
    setSelectedIncident(null)
    setSelectedCounts({})
    mutateRecursos()
  }

  const handleDeployResources = async () => {
    const totalSelected = Object.values(selectedCounts).reduce((a, b) => a + b, 0)
    if (totalSelected === 0) {
      toast.error("Seleccione al menos un recurso para desplegar")
      return
    }

    const incidenteId = selectedIncident?.id
    const idsToDispatch = resourceGroups.flatMap((g) =>
      g.availableIds.slice(0, selectedCounts[g.tipo] ?? 0)
    )

    // Optimistic update en cache
    if (dbRecursos) {
      mutateRecursos(
        dbRecursos.map((r: DbIncident & { estado: string }) => idsToDispatch.includes(r.id) ? { ...r, estado: "dispatched" } : r),
        false,
      )
    }

    // Dispatch resources immediately
    if (incidenteId) {
      // Patch incident to attended state
      await patchIncidente(incidenteId, { estado: "atendido" }).catch((err) => console.error("[CrisisMap] Error updating incident:", err))
      
      // Force global revalidation of both lists and analytics
      mutate("/api/incidentes?estado=activo")
      mutate("/api/incidentes?estado=atendido")
      mutate("/api/analytics")

      // Despachar recursos con ciclo de vida
      await Promise.all(
        idsToDispatch.map((id) => dispatchResourceWithLifecycle(incidenteId, id, () => mutateRecursos()).catch((err) => console.error("[CrisisMap] Error dispatching resource:", err)))
      )
      await mutateRecursos()
    }

    // Respawn 90s después
    if (incidenteId) {
      const incidenteTipo  = selectedIncident?.type
      const incidenteFuente = selectedIncident?.source
      setTimeout(async () => {
        const respawn = buildRespawnIncident({ tipo: incidenteTipo, fuente: incidenteFuente })
        await createIncidente(respawn).catch((err) => console.error("[CrisisMap] Error creating respawn incident:", err))
      }, 90_000)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card md:relative">
      {/* ── Map header ─────────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 top-0 z-[1000] flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border bg-card/95 px-3 py-2 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <h2 className="truncate text-xs font-semibold text-foreground sm:text-sm">
            San Miguel de Tucumán — Incident Map
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Layer filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 gap-1 border-border px-2 text-[10px]">
                <Layers className="h-3 w-3" />
                Layers ({activeLayers.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-3">
                <p className="text-xs font-medium text-foreground">Filter by Source</p>
                <div className="space-y-2">
                  {SOURCE_TYPES.map((layer) => (
                    <label key={layer} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={activeLayers.includes(layer)}
                        onCheckedChange={() => toggleLayer(layer)}
                      />
                      <div className="flex items-center gap-1.5">
                        <SourceIcon source={layer} />
                        <span className="text-xs">{sourceLabel(layer)}</span>
                      </div>
                      <Badge variant="outline" className="ml-auto text-[10px] h-5">
                        {incidents.filter((i) => i.source === layer).length}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Severity badges */}
          {(["critical", "high", "medium", "low"] as const).map((sev) => {
            const colorMap = {
              critical: "border-primary/50 bg-primary/10 text-primary",
              high:     "border-accent/50 bg-accent/10 text-accent",
              medium:   "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
              low:      "border-success/50 bg-success/10 text-success",
            }
            const labelMap = { critical: "Critical", high: "High", medium: "Medium", low: "Low" }
            return (
              <Badge
                key={sev}
                variant="outline"
                className={cn("hidden text-[10px] sm:inline-flex", colorMap[sev])}
              >
                {filteredIncidents.filter((i) => i.severity === sev).length} {labelMap[sev]}
              </Badge>
            )
          })}
        </div>
      </div>

      {/* ── Incident list panel ────────────────────────────────────── */}
      <div className="relative z-10 mt-0 w-full rounded-none border-b border-border bg-card/95 backdrop-blur-sm shadow-none md:absolute md:right-3 md:top-14 md:z-[1000] md:w-72 md:max-h-[420px] md:rounded-lg md:border md:shadow-xl">
        <div className="flex flex-col border-b border-border bg-card rounded-t-lg">
          <div className="flex border-b border-border/60">
            <button
              onClick={() => setViewMode("activo")}
              className={cn(
                "flex-1 py-2 text-[10px] font-semibold transition-all border-b-2 text-center cursor-pointer",
                viewMode === "activo"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20"
              )}
            >
              Activos ({viewMode === "activo" ? filteredIncidents.length : 0})
            </button>
            <button
              onClick={() => setViewMode("atendido")}
              className={cn(
                "flex-1 py-2 text-[10px] font-semibold transition-all border-b-2 text-center cursor-pointer",
                viewMode === "atendido"
                  ? "border-accent text-accent bg-accent/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20"
              )}
            >
              Historial ({viewMode === "atendido" ? filteredIncidents.length : 0})
            </button>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/10">
            <p className="text-[9px] font-medium text-muted-foreground">
              {viewMode === "activo" ? "Monitoreo en Tiempo Real" : "Auditoría On-Chain Braga"}
            </p>
            {viewMode === "activo" ? (
              <Badge variant="outline" className="text-[8px] h-4 border-primary/50 text-primary animate-pulse px-1.5">LIVE</Badge>
            ) : (
              <Badge variant="outline" className="text-[8px] h-4 border-emerald-500/50 text-emerald-400 gap-1 px-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AUDITADO
              </Badge>
            )}
          </div>
        </div>
        <div className="overflow-y-auto max-h-48 p-2 space-y-1.5 custom-scrollbar md:max-h-[350px]">
          {filteredIncidents.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-4">No hay incidentes para mostrar</p>
          ) : (
            filteredIncidents.map((incident) => (
              <button
                key={incident.id}
                onClick={() => setSelectedIncident(incident)}
                className={cn(
                  "w-full text-left rounded-lg border p-2 transition-all hover:bg-secondary/50 hover:scale-[1.01] cursor-pointer",
                  viewMode === "activo"
                    ? (incident.severity === "critical" ? "border-primary/50 bg-primary/5" :
                       incident.severity === "high"     ? "border-accent/50 bg-accent/5"   : "border-border")
                    : (incident.estado === "activo"
                        ? "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50 hover:bg-yellow-500/10"
                        : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40")
                )}
              >
                <div className="flex items-start gap-2">
                  <div className={cn("rounded-full p-1.5 flex items-center justify-center shrink-0", 
                    viewMode === "activo" ? severityColorClass(incident.severity) : (incident.estado === "activo" ? "bg-yellow-500/10 text-yellow-400" : "bg-emerald-500/10 text-emerald-400")
                  )}>
                    <IncidentIcon type={incident.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-medium text-foreground truncate">{incident.location}</p>
                      {viewMode === "atendido" && (
                        incident.estado === "activo" ? (
                          <Badge variant="outline" className="text-[7px] h-3 px-1 border-yellow-500/40 text-yellow-400 font-mono shrink-0 animate-pulse">
                            PENDIENTE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[7px] h-3 px-1 border-emerald-500/30 text-emerald-400 font-mono shrink-0">
                            ON-CHAIN
                          </Badge>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {incidentTypeLabel(incident.type)}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground">{incident.affectedPeople} afectados</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Leaflet Map ─────────────────────────────────────────────── */}
      {isClient && leafletCssLoaded ? (
        <div className="h-[400px] w-full shrink-0 pt-10 md:h-full md:flex-1">
          <style>{LEAFLET_DARK_STYLES}</style>
          <style>{LEAFLET_DARK_STYLES}</style>
          <MapContainer center={MAP_CENTER} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {filteredIncidents.map((incident) => {
              const icon = createLeafletIcon(incident.severity, incident.type, incident.source)
              if (!icon) return null
              return (
                <Marker
                  key={incident.id}
                  position={[incident.coordinates.lat, incident.coordinates.lng]}
                  icon={icon}
                  eventHandlers={{ click: () => setSelectedIncident(incident) }}
                />
              )
            })}
          </MapContainer>
        </div>
      ) : (
        <div className="flex h-[400px] w-full shrink-0 items-center justify-center bg-secondary/20 md:h-full md:flex-1">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-[1000] hidden rounded-md border border-border bg-card/95 p-2 backdrop-blur-sm md:block">
        <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">Severity</p>
        <div className="flex flex-col gap-1">
          {SEVERITY_LEGENDS.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", color)} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modales ─────────────────────────────────────────────────── */}
      <IncidentDetailModal
        isOpen={!!selectedIncident && !showDeployModal && !showBlockchainModal}
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onOpenDeploy={handleOpenDeploy}
      />

      <DeployModal
        open={showDeployModal}
        incident={selectedIncident}
        dbRecursos={dbRecursos}
        resourceGroups={resourceGroups}
        selectedCounts={selectedCounts}
        deployingResources={deployingResources}
        deploySuccess={deploySuccess}
        onClose={handleCloseDeploy}
        onDeploy={handleConfirmDeploymentTransition}
        onAdjustCount={adjustCount}
      />

      <Dialog open={showBlockchainModal} onOpenChange={handleCloseConfirmDispatch}>
        <DialogContent className="max-w-md p-0 bg-transparent border-none z-[9999]">
          <DialogTitle className="sr-only">Desplegar Recursos</DialogTitle>
          {selectedIncident && (
            <IncidentDispatchCard
              incident={{
                id: selectedIncident.id,
                tipo: selectedIncident.type === "flood" || selectedIncident.type === "fire" ? selectedIncident.type : "general",
                severidad: selectedIncident.severity as "critical" | "high" | "medium" | "low",
                ubicacion: selectedIncident.location,
                afectados: selectedIncident.affectedPeople,
                timestamp: selectedIncident.timestamp ? new Date(selectedIncident.timestamp).toISOString() : new Date().toISOString(),
                arkivKey: selectedIncident.arkiv_key,
              }}
              selectedCounts={selectedCounts}
              onConfirmDispatch={handleDeployResources}
              onDispatchSuccess={() => {
                mutate("/api/incidentes?estado=activo")
                mutate("/api/incidentes?estado=atendido")
                mutate("/api/analytics")
              }}
              onDismiss={handleCloseConfirmDispatch}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
