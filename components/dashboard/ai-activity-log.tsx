"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSWRConfig } from "swr"
import { CheckCircle2, Sparkles, Loader2, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { dispatchResourceWithLifecycle } from "@/hooks/use-resource-lifecycle"
import { useAutoResolve } from "@/hooks/use-auto-resolve"
import { patchIncidente, fetcher } from "@/lib/api"
import { TRIGGER_HASHTAG } from "@/lib/agents/hashtag"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

import type { ActivityItem, SatelliteValidation } from "./ai-activity-log/types"
import type { AgentScanResult, MentionOutcome } from "@/lib/agents/types"
import { initialActivities, backgroundMessages } from "./ai-activity-log/data"
import { ActivityIcon, activityIconColor, SeverityBadge } from "./ai-activity-log/activity-helpers"
import { ReasoningPanel, ConfidenceBadge } from "./ai-activity-log/reasoning-panel"
import { SatelliteModal } from "./ai-activity-log/satellite-modal"
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

const PLATFORM_NAMES: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", twitter: "X", tiktok: "TikTok", mock: "Simulated feed",
}

/** Convierte una mención que disparó (o corroboró) un incidente en una ActivityItem accionable */
function mentionToActivity(outcome: MentionOutcome): Omit<ActivityItem, "id" | "timestamp"> {
  const analysis = outcome.analysis!
  const network  = PLATFORM_NAMES[outcome.platform] ?? outcome.platform
  const isNew    = outcome.status === "created"

  return {
    type:       analysis.type === "none" ? "monitoring" : "alert",
    message:    isNew
      ? `${analysis.locationName}: ${analysis.summary}`
      : `${analysis.locationName}: new ${outcome.hashtag} report corroborates the active incident`,
    actionable: isNew && analysis.confidence >= 60 && analysis.isIncident,
    location:   analysis.locationName,
    severity:   analysis.severity as ActivityItem["severity"],
    confidence: analysis.confidence,
    arkivKey:   analysis.arkivKey,
    incidentId: outcome.incidentId,
    sourcePost: { platform: network, author: outcome.author, hashtag: outcome.hashtag },
    reasoning: [
      {
        step:    1,
        thought: `Post by ${outcome.author} on ${network} contains the trigger hashtag ${outcome.hashtag}`,
        action:  `Hashtag filter → ${outcome.analyzer === "llm" ? "LLM analysis (OpenRouter / Gemini)" : "Rule-based analysis (no LLM key configured)"}`,
      },
      {
        step:    2,
        thought: analysis.reasoning,
      },
      ...(analysis.suggestedActions.length > 0 ? [{
        step:    3,
        thought: "Actions recommended by the AI system:",
        action:  analysis.suggestedActions.join(" · "),
        result:  `AI Confidence: ${analysis.confidence}% · ~${analysis.affectedPeopleEst} people at risk`,
      }] : []),
    ],
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/** Tiempo en ms entre escaneos automáticos de Gemini */
const GEMINI_SCAN_INTERVAL_MS = 90_000  // 90 segundos
/** Delay del primer escaneo después de montar */
const GEMINI_INITIAL_DELAY_MS = 8_000   // 8 segundos

export function AIActivityLog() {
  const [activities,          setActivities]         = useState<ActivityItem[]>(initialActivities)
  const [confirmDialog,       setConfirmDialog]       = useState<{ open: boolean; type: "deploy" | "notify"; activity: ActivityItem | null }>({ open: false, type: "deploy", activity: null })
  const [processedAlerts,     setProcessedAlerts]     = useState<Set<string>>(new Set())
  const [expandedReasoning,   setExpandedReasoning]   = useState<Set<string>>(new Set())
  const [validatingSatellite, setValidatingSatellite] = useState<string | null>(null)
  const [satelliteModal,      setSatelliteModal]      = useState<SatelliteValidation | null>(null)
  const [isAgentScanning,     setIsAgentScanning]     = useState(false)

  const scrollRef          = useRef<HTMLDivElement>(null)
  const messageIndexRef    = useRef(0)
  const agentScanningRef   = useRef(false)  // evita scans simultáneos

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
    onResourcesReset: (nombres) => {
      addActivity({
        type:    "complete",
        message: `Resources automatically released: ${nombres.join(", ")}`,
      })
    },
  })

  const { mutate } = useSWRConfig()

  // ── Loop de mensajes de fondo (monitoring, extraction, etc.) ─────────────
  useEffect(() => {
    const interval = setInterval(() => {
      // No mostrar mensajes de fondo mientras escanea (para que se lean mejor los resultados)
      if (!agentScanningRef.current) {
        const template = backgroundMessages[messageIndexRef.current % backgroundMessages.length]
        addActivity(template)
        messageIndexRef.current += 1
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [addActivity])

  // ── Ciclo de escaneo Gemini ───────────────────────────────────────────────
  const runGeminiScan = useCallback(async () => {
    if (agentScanningRef.current) return  // ya hay un scan en curso
    agentScanningRef.current = true
    setIsAgentScanning(true)

    // 1. Mensaje de inicio
    addActivity({ type: "extraction", message: `Scanning social media for ${TRIGGER_HASHTAG}...` })
    await new Promise((r) => setTimeout(r, 800))
    addActivity({ type: "monitoring", message: "Collecting posts: Facebook · Instagram · X (Twitter)..." })

    try {
      const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET ?? ""
      const res    = await fetch("/api/agent", {
        method:  "POST",
        headers: API_SECRET ? { "x-api-secret": API_SECRET } : {},
      })
      const result = await res.json() as AgentScanResult & { error?: string }

      if (!res.ok || result.error) {
        addActivity({ type: "monitoring", message: `Scan error: ${result.error ?? res.statusText}` })
        return
      }

      // 2. Resumen del filtro de hashtag
      addActivity({
        type:    "database",
        message: `${result.postsCollected} posts collected · ${result.postsMatched} with ${result.hashtag} sent to AI analysis`,
      })

      // 3. Posts con hashtag que la IA descartó (no eran emergencias)
      const rejected = result.outcomes.filter((o) => o.status === "rejected").length
      if (rejected > 0) {
        addActivity({ type: "reasoning", message: `${rejected} ${result.hashtag} post(s) discarded: not an emergency` })
      }

      // 4. Incidentes creados / corroborados como alertas accionables
      const hits = result.outcomes.filter((o) => (o.status === "created" || o.status === "corroborated") && o.analysis)

      if (hits.length === 0) {
        addActivity({
          type:    "complete",
          message: `Scan complete: no new ${result.hashtag} emergencies detected.`,
        })
      } else {
        mutate("/api/incidentes?estado=activo")
        mutate("/api/analytics")
        for (const outcome of hits) {
          await new Promise((r) => setTimeout(r, 600)) // pequeño delay dramático entre alertas
          addActivity(mentionToActivity(outcome))
        }
      }
    } catch (err) {
      addActivity({ type: "monitoring", message: "Connection error with the AI agent — retrying on next cycle" })
      console.error("[AIActivityLog/Agent]", err)
    } finally {
      agentScanningRef.current = false
      setIsAgentScanning(false)
    }
  }, [addActivity, mutate])

  // Primer scan a los 8s, luego cada 90s
  useEffect(() => {
    const firstTimer = setTimeout(runGeminiScan, GEMINI_INITIAL_DELAY_MS)
    const interval   = setInterval(runGeminiScan, GEMINI_SCAN_INTERVAL_MS)
    return () => {
      clearTimeout(firstTimer)
      clearInterval(interval)
    }
  }, [runGeminiScan])

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

  const handleValidateSatellite = async (activityId: string) => {
    setValidatingSatellite(activityId)
    await new Promise((resolve) => setTimeout(resolve, 2500))

    const activity = activities.find((a) => a.id === activityId)
    if (!activity) { setValidatingSatellite(null); return }

    const msg      = activity.message.toLowerCase()
    const isFlood  = msg.includes("inundacion") || msg.includes("desborde") || msg.includes("agua")
    const isFire   = msg.includes("incendio")   || msg.includes("fuego")

    const validation: SatelliteValidation = {
      activity,
      imageUrl: isFlood
        ? "https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=800&h=500&fit=crop"
        : isFire
          ? "https://images.unsplash.com/photo-1486551937199-baf066858de7?w=800&h=500&fit=crop"
          : "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=500&fit=crop",
      analysisData: {
        waterDetected:    isFlood,
        affectedAreaKm2:  isFlood ? 2.4 : isFire ? 0.8 : 1.2,
        vegetationDamage: isFire  ? "Severo (78%)"  : isFlood ? "Moderado (34%)" : "Bajo (12%)",
        thermalAnomaly:   isFire,
        cloudCoverage:    15,
        captureTime:      new Date().toISOString(),
        satellite:        "Sentinel-2A",
        resolution:       "10m/pixel",
      },
    }

    setSatelliteModal(validation)
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, confidence: 98 } : a))
    )
    setValidatingSatellite(null)
  }

  const confirmAction = async () => {
    if (!confirmDialog.activity) return

    const { id: activityId, location = "", incidentId } = confirmDialog.activity
    setProcessedAlerts((prev) => new Set(prev).add(activityId))
    setConfirmDialog((prev) => ({ ...prev, open: false, activity: null }))

    if (confirmDialog.type === "deploy") {
      try {
        const incidentes: Array<{ id: string; ubicacion: string; tipo: string; fuente: string }> = await fetcher("/api/incidentes?estado=activo")

        const incidente = incidentes.find((inc) => inc.id === incidentId) ?? incidentes.find((inc) => {
          const incLoc = inc.ubicacion.toLowerCase()
          const actLoc = location.toLowerCase()
          return incLoc.includes(actLoc.split(",")[0].trim()) || actLoc.includes(incLoc.split("-")[0].trim())
        })

        if (incidente) {
          try {
            const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || ""
            const response = await fetch("/api/incidentes/arkiv-dispatch", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(apiSecret ? { "x-api-secret": apiSecret } : {}),
              },
              body: JSON.stringify({
                id: incidente.id,
                tipo: incidente.tipo,
                severidad: (incidente as any).severidad || "medium",
                ubicacion: incidente.ubicacion,
                afectados: (incidente as any).personas_afectadas || 0,
              }),
            })
            const data = await response.json()
            if (response.ok && data.success) {
              console.log("[ai-activity-log] Dispatch signed on-chain from AI agent panel:", data.entityKey)
            } else {
              console.warn("[ai-activity-log] On-chain signing failed from AI panel, falling back to local patch:", data.error)
              await patchIncidente(incidente.id, { estado: "atendido" })
            }
          } catch (e) {
            console.error("[ai-activity-log] On-chain dispatch error from AI panel, falling back to local patch:", e)
            await patchIncidente(incidente.id, { estado: "atendido" })
          }
        }

        await dispatchResourceWithLifecycle(incidente?.id, undefined, () => {
          mutate("/api/recursos")
        })
        mutate("/api/incidentes?estado=activo")
        mutate("/api/incidentes?estado=atendido")
        mutate("/api/analytics")
      } catch (err) {
          console.error("[ai-activity-log] Error in handleDispatch:", err)
        }

      toast.success("Resources deployed", {
        description: `Units on their way to ${location}. Incident removed from active.`,
      })
      addActivity({ type: "complete", message: `Coordinates and resources sent to teams at ${location}` })
    } else {
      toast.success("Authorities notified", {
        description: `Civil Defense and Fire Dept. alerted about ${location}`,
      })
      addActivity({ type: "complete", message: `Authorities notified about incident at ${location}` })
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
        <h2 className="text-sm font-semibold text-foreground">Live AI Agent</h2>

        <div className="ml-auto flex items-center gap-1.5">
          {isAgentScanning && (
            <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-purple-500/50 text-purple-400 bg-purple-500/10 gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Scanning
            </Badge>
          )}
          {!isAgentScanning && (
            <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-purple-500/30 text-purple-400 gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </Badge>
          )}
          <Badge variant="outline" title="Trigger hashtag being monitored" className="text-[9px] h-5 px-1.5 border-sky-500/40 text-sky-300 gap-0.5 font-mono">
            <Hash className="h-2.5 w-2.5" />
            {TRIGGER_HASHTAG.replace(/^#/, "")}
          </Badge>
          <Badge variant="outline" className="text-[10px] border-success/50 text-success">
            Active
          </Badge>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-2 py-2 custom-scrollbar" ref={scrollRef}>
          <div className="space-y-2">
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

      {/* Satellite modal */}
      <SatelliteModal
        validation={satelliteModal}
        onClose={() => setSatelliteModal(null)}
      />
    </div>
  )
}
