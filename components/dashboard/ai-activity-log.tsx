"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSWRConfig } from "swr"
import { CheckCircle2, Hash } from "lucide-react"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import { dispatchResourceWithLifecycle } from "@/hooks/use-resource-lifecycle"
import { useAutoResolve } from "@/hooks/use-auto-resolve"
import { patchIncidente, fetcher } from "@/lib/api"
import { TRIGGER_HASHTAG } from "@/lib/agents/hashtag"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

import type { ActivityItem } from "./ai-activity-log/types"
import type { DbIncident } from "@/lib/types"
import { ActivityIcon, activityIconColor, SeverityBadge } from "./ai-activity-log/activity-helpers"
import { ReasoningPanel, ConfidenceBadge } from "./ai-activity-log/reasoning-panel"
import { AlertActions, ConfirmActionDialog } from "./ai-activity-log/alert-actions"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Crea una ActivityItem con id y timestamp auto-generados */
function makeActivity(
  template: Omit<ActivityItem, "id" | "timestamp">,
  extra?: Partial<ActivityItem>,
): ActivityItem {
  return { ...template, id: `${Date.now()}-${Math.random()}`, timestamp: new Date(), isNew: true, ...extra }
}

function incidentToActivity(incident: DbIncident): ActivityItem {
  const details = incident.fuente_detalles ?? {}
  const analysis = details.ai_analysis as Record<string, unknown> | undefined
  const social = incident.fuente === "social"
  return {
    id: incident.id,
    timestamp: new Date(incident.created_at),
    type: "alert",
    message: social
      ? `${incident.ubicacion}: ${String(analysis?.summary || details.content || "Reporte de redes sociales recibido")}`
      : `${incident.ubicacion}: ${incident.fuente === "citizen" ? "reporte ciudadano recibido" : "evento recibido desde una fuente conectada"}`,
    actionable: true,
    location: incident.ubicacion,
    severity: incident.severidad as ActivityItem["severity"],
    incidentId: incident.id,
    confidence: typeof analysis?.confidence === "number" ? analysis.confidence : undefined,
    sourcePost: social ? {
      platform: String(details.platform || "Red social"),
      author: String(details.username || "Usuario"),
      hashtag: String(details.hashtag || TRIGGER_HASHTAG),
    } : undefined,
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function AIActivityLog() {
  const [activities,          setActivities]         = useState<ActivityItem[]>([])
  const { data: activeIncidents } = useSWR<DbIncident[]>("/api/incidentes?estado=activo", fetcher, { refreshInterval: 5000 })
  const [confirmDialog,       setConfirmDialog]       = useState<{ open: boolean; type: "deploy" | "notify"; activity: ActivityItem | null }>({ open: false, type: "deploy", activity: null })
  const [processedAlerts,     setProcessedAlerts]     = useState<Set<string>>(new Set())
  const [expandedReasoning,   setExpandedReasoning]   = useState<Set<string>>(new Set())
  const validatingSatellite: string | null = null

  const scrollRef          = useRef<HTMLDivElement>(null)
  const seenIncidentsRef   = useRef<Set<string>>(new Set())

  const addActivity = useCallback((template: Omit<ActivityItem, "id" | "timestamp">) => {
    setActivities((prev) => [...prev.slice(-20), makeActivity(template)])
  }, [])

  // ── Auto-resolve incidentes viejos + auto-reset recursos atascados ───────
  useAutoResolve({
    onResolved: (locations) => {
      locations.forEach((loc) => {
        addActivity({ type: "complete", message: `Incident at ${loc} automatically closed (5 min without attention)` })
      })
    },
  })

  const { mutate } = useSWRConfig()

  // ── Actividad de reportes reales ──────────────────────────────────────────
  useEffect(() => {
    if (!activeIncidents) return
    const incoming = activeIncidents.filter(incident => !seenIncidentsRef.current.has(incident.id))
    for (const incident of incoming) seenIncidentsRef.current.add(incident.id)
    if (incoming.length) setActivities(prev => [...prev, ...incoming.map(incidentToActivity)].slice(-20))
  }, [activeIncidents])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]")
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [activities])

  // ── Handlers de interacción ───────────────────────────────────────────────

  const toggleReasoning = (id: string) => {
    setExpandedReasoning((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleValidateSatellite = () => {
    toast.info("No hay un proveedor de verificación satelital conectado. Consultá las cámaras y fuentes del incidente.")
  }

  const confirmAction = async () => {
    if (!confirmDialog.activity) return
    const { id: activityId, location = "", incidentId } = confirmDialog.activity
    setConfirmDialog(prev => ({ ...prev, open: false, activity: null }))
    if (confirmDialog.type !== "deploy") {
      toast.info("La notificación automática no está configurada. Usá el canal operativo de comunicación.")
      return
    }
    try {
      if (!incidentId) throw new Error("La alerta no tiene un incidente asociado")
      const incidentes: DbIncident[] = await fetcher("/api/incidentes?estado=activo")
      const incidente = incidentes.find(inc => inc.id === incidentId)
      if (!incidente) throw new Error("El incidente ya no está activo. Actualizá la vista.")
      await dispatchResourceWithLifecycle(incidente.id)
      await patchIncidente(incidente.id, { estado: "atendido" })
      setProcessedAlerts(prev => new Set(prev).add(activityId))
      toast.success("Recursos despachados", { description: location })
      addActivity({ type: "complete", message: "Despacho confirmado para " + location })
      const response = await fetch("/api/incidentes/arkiv-dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: incidente.id }),
      })
      const data = await response.json()
      if (!response.ok || data.onChain !== true) toast.info("Despacho registrado; auditoría en cadena no confirmada")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo confirmar el despacho")
    } finally {
      await Promise.allSettled([mutate("/api/recursos"), mutate("/api/incidentes?estado=activo"), mutate("/api/incidentes?estado=atendido"), mutate("/api/analytics")])
    }
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
        <div className="relative">
          <div className="h-2 w-2 rounded-full bg-success" />
          <div className="absolute inset-0 h-2 w-2 rounded-full bg-success animate-pulse-ring" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Reportes recibidos</h2>

        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant="outline" title="Trigger hashtag being monitored" className="text-[9px] h-5 px-1.5 border-sky-500/40 text-sky-300 gap-0.5 font-mono">
            <Hash className="h-2.5 w-2.5" />
            {TRIGGER_HASHTAG.replace(/^#/, "")}
          </Badge>
          <Badge variant="outline" className="text-[10px] border-success/50 text-success">
            En vivo
          </Badge>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-2 py-2 custom-scrollbar" ref={scrollRef}>
          <div className="space-y-2">
            {activities.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">A la espera de reportes ciudadanos o menciones recibidas.</p>
            )}
            {activities.map((activity) => {
              const isProcessed      = processedAlerts.has(activity.id)
              const showActions      = activity.actionable && activity.type === "alert" && !isProcessed
              const isReasoningOpen  = expandedReasoning.has(activity.id)

              return (
                <div
                  key={activity.id}
                  className={cn(
                    "rounded-md p-2.5 transition-all duration-300",
                    activity.isNew ? "bg-secondary/50 animate-in fade-in slide-in-from-top-2 duration-300" : "bg-transparent",
                    showActions && "border border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("mt-0.5 shrink-0", activityIconColor(activity.type))}>
                      <ActivityIcon type={activity.type} />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Message + severity */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs text-foreground leading-relaxed">{activity.message}</p>
                        {activity.severity && <SeverityBadge severity={activity.severity} />}
                      </div>

                      {/* Post social que disparó la alerta */}
                      {activity.sourcePost && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="h-4 gap-0.5 border-sky-500/40 bg-sky-500/10 px-1.5 text-[9px] font-mono text-sky-300">
                            <Hash className="h-2.5 w-2.5" />
                            {activity.sourcePost.hashtag.replace(/^#/, "")}
                          </Badge>
                          <span className="truncate text-[10px] text-muted-foreground">
                            {activity.sourcePost.author} · {activity.sourcePost.platform}
                          </span>
                        </div>
                      )}

                      {/* Time + confidence */}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] font-mono text-muted-foreground" suppressHydrationWarning>
                          {formatTime(activity.timestamp)}
                        </p>
                        {activity.confidence && <ConfidenceBadge value={activity.confidence} />}
                      </div>

                      {/* Reasoning */}
                      <ReasoningPanel
                        activity={activity}
                        isExpanded={isReasoningOpen}
                        validatingSatellite={validatingSatellite}
                        onToggle={() => toggleReasoning(activity.id)}
                        onValidateSatellite={handleValidateSatellite}
                      />

                      {/* Alert actions */}
                      {showActions && (
                        <AlertActions
                          activity={activity}
                          onDeploy={(a) => setConfirmDialog({ open: true, type: "deploy", activity: a })}
                          onNotify={(a) => setConfirmDialog({ open: true, type: "notify", activity: a })}
                          onDismiss={(id) => setProcessedAlerts((prev) => new Set(prev).add(id))}
                        />
                      )}

                      {/* Acción tomada */}
                      {isProcessed && activity.actionable && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          <span className="text-[10px] text-success">Action taken</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Confirm dialog */}
      <ConfirmActionDialog
        state={confirmDialog}
        onChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        onConfirm={confirmAction}
      />

    </div>
  )
}
