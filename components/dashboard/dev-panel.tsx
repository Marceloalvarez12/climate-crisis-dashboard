"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
  Play, Square, Zap, X, Terminal, Cpu, Database,
  Ambulance, Truck, CheckCircle2, AlertTriangle,
  MapPin, Clock, Users, Trash2, Hash, Send, Facebook, Instagram, Twitter,
  Shuffle, EyeOff, Ban, Repeat2, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useSimulationLoop, ActiveDispatch, SimulationEvent } from "@/hooks/use-simulation-loop"
import { TRIGGER_HASHTAG, containsTriggerHashtag } from "@/lib/agents/hashtag"
import { SIMULATED_PLATFORMS, type SimulatedPlatform } from "@/lib/social-feed-simulator"
import { SIMULATION_SPAWN_INTERVAL_MS, RESOURCE_DISPATCHED_TO_BUSY_MS, RESOURCE_BUSY_TO_AVAILABLE_MS } from "@/lib/mock-data"

const PLATFORM_META: Record<SimulatedPlatform, { label: string; icon: typeof Facebook; color: string }> = {
  facebook:  { label: "Facebook",  icon: Facebook,  color: "text-blue-500 border-blue-500/50 bg-blue-500/10" },
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-400 border-pink-500/50 bg-pink-500/10" },
  twitter:   { label: "X",         icon: Twitter,   color: "text-sky-300 border-sky-400/50 bg-sky-400/10" },
}

const COMPOSER_PLACEHOLDER = `Ej: Se desbordó el canal en Barrio San Pablo, hay familias atrapadas ${TRIGGER_HASHTAG}`

const eventIcon = (type: SimulationEvent["type"]) => {
switch (type) {
  case "incident_created":     return <AlertTriangle className="h-3 w-3 text-accent" />
  case "citizen_zk_report":    return <Users className="h-3 w-3 text-indigo-400" />
  case "resource_dispatched":  return <Truck className="h-3 w-3 text-blue-400" />
  case "resource_arrived":     return <MapPin className="h-3 w-3 text-yellow-400" />
  case "incident_resolved":    return <CheckCircle2 className="h-3 w-3 text-green-400" />
  case "incident_respawned":   return <Zap className="h-3 w-3 text-primary" />
  case "hashtag_corroborated": return <Repeat2 className="h-3 w-3 text-sky-300" />
  case "post_rejected":        return <Ban className="h-3 w-3 text-orange-400" />
  case "post_ignored":         return <EyeOff className="h-3 w-3 text-muted-foreground" />
}
}

const eventColor = (type: SimulationEvent["type"]) => {
switch (type) {
  case "incident_created":     return "text-accent"
  case "citizen_zk_report":    return "text-indigo-400"
  case "resource_dispatched":  return "text-blue-400"
  case "resource_arrived":     return "text-yellow-400"
  case "incident_resolved":    return "text-green-400"
  case "incident_respawned":   return "text-primary"
  case "hashtag_corroborated": return "text-sky-300"
  case "post_rejected":        return "text-orange-400"
  case "post_ignored":         return "text-muted-foreground"
}
}

function SocialComposer({ onPublish }: { onPublish: (platform: SimulatedPlatform, text?: string) => Promise<unknown> }) {
  const [platform, setPlatform] = useState<SimulatedPlatform>("facebook")
  const [text, setText]         = useState("")
  const [sending, setSending]   = useState(false)
  const hasTag = containsTriggerHashtag(text)

  const publish = async (random: boolean) => {
    setSending(true)
    await onPublish(platform, random ? undefined : text.trim())
    if (!random) setText("")
    setSending(false)
  }

  return (
    <div className="space-y-2 rounded-md border border-sky-500/25 bg-sky-500/5 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-sky-300">Social post</span>
        <Badge variant="outline" className="h-4 gap-0.5 border-sky-500/40 px-1.5 text-[9px] font-mono text-sky-300">
          <Hash className="h-2.5 w-2.5" />
          {TRIGGER_HASHTAG.replace(/^#/, "")}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Platform">
        {SIMULATED_PLATFORMS.map((p) => {
          const { label, icon: Icon, color } = PLATFORM_META[p]
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={platform === p}
              onClick={() => setPlatform(p)}
              className={cn(
                "flex items-center justify-center gap-1 rounded border px-1.5 py-1 text-[10px] font-mono transition-colors",
                platform === p ? color : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          )
        })}
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={COMPOSER_PLACEHOLDER}
        maxLength={2200}
        className="min-h-16 resize-none bg-black/40 text-[11px] font-mono"
      />

      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[9px] font-mono", hasTag ? "text-green-400" : "text-muted-foreground")}>
          {text ? (hasTag ? "Hashtag detected → triggers analysis" : "No hashtag → will be ignored") : "\u00A0"}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={sending}
            onClick={() => publish(true)}
            title="Publish a random post from the simulated feed"
            className="h-6 border-border px-2 text-[10px]"
          >
            <Shuffle className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={sending || !text.trim()}
            onClick={() => publish(false)}
            className="h-6 gap-1 border-sky-500/50 bg-sky-500/10 px-2 text-[10px] text-sky-300 hover:bg-sky-500/20"
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Publish
          </Button>
        </div>
      </div>
    </div>
  )
}

function DispatchCard({ dispatch, onDispatch }: {
  dispatch: ActiveDispatch
  onDispatch: () => void
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (dispatch.status !== "en_camino") return
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [dispatch.status])

  const elapsed = Math.floor((Date.now() - dispatch.dispatchedAt.getTime()) / 1000)
  const remaining = Math.max(0, dispatch.etaSeconds - elapsed)
  void tick // consume tick for re-render

  return (
    <div className={cn(
      "rounded-md border p-2.5 space-y-1.5 transition-all",
      dispatch.status === "en_camino"
        ? "border-blue-500/40 bg-blue-500/5"
        : "border-green-500/40 bg-green-500/5"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[11px] font-mono font-semibold text-foreground truncate max-w-[130px]">
            {dispatch.resourceName}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] h-4 px-1.5",
            dispatch.status === "en_camino"
              ? "border-blue-500/50 text-blue-400"
              : "border-green-500/50 text-green-400"
          )}
        >
          {dispatch.status === "en_camino" ? "On the way" : "Busy"}
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground font-mono truncate">
        → {dispatch.incidentLocation}
      </p>
      {dispatch.status === "en_camino" && (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-yellow-400" />
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all duration-1000"
              style={{ width: `${Math.max(0, (1 - remaining / dispatch.etaSeconds) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-yellow-400 tabular-nums w-8">
            {remaining}s
          </span>
        </div>
      )}
    </div>
  )
}

export function DevPanel() {
  const searchParams = useSearchParams()
  const isDev = searchParams.get("dev") === "true"
  const [isOpen, setIsOpen] = useState(true)

  const {
    isRunning,
    events,
    activeDispatches,
    startSimulation,
    stopSimulation,
    dispatchResource,
    spawnCitizenZkReport,
    cleanupSimulatedIncidents,
    publishSocialPost,
  } = useSimulationLoop()

  const [isInjecting, setIsInjecting] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)

  const handleInjectCitizenZk = async () => {
    setIsInjecting(true)
    await spawnCitizenZkReport()
    setIsInjecting(false)
  }

  const handleCleanup = async () => {
    setIsCleaning(true)
    await cleanupSimulatedIncidents()
    setIsCleaning(false)
  }

  if (!isDev) return null

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[9000] flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/50 bg-black/90 text-cyan-400 shadow-lg shadow-cyan-500/20 backdrop-blur-sm transition-all hover:border-cyan-400"
      >
        <Terminal className="h-5 w-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9000] flex max-h-[calc(100dvh-2rem)] w-80 flex-col rounded-lg border border-cyan-500/30 bg-black/95 shadow-xl shadow-cyan-500/10 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Cpu className="h-4 w-4 text-cyan-400" />
            {isRunning && (
              <div className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </div>
          <span className="text-sm font-mono font-semibold text-cyan-400">SIMULATION</span>
          {isRunning && (
            <Badge variant="outline" className="h-4 border-green-500/40 bg-green-500/10 px-1.5 text-[9px] font-mono text-green-400">
              ACTIVE
            </Badge>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar">
        {/* Supabase status */}
        <div className="flex items-center justify-between rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-mono text-cyan-300">Supabase</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400">CONNECTED</span>
          </div>
        </div>

        <SocialComposer onPublish={(platform, text) => publishSocialPost({ platform, text })} />

        <Button
          onClick={handleInjectCitizenZk}
          disabled={isInjecting}
          className="w-full border-indigo-500/50 bg-indigo-500/10 font-mono text-indigo-400 hover:bg-indigo-500/20 text-xs"
          variant="outline"
        >
          <Users className="mr-2 h-3.5 w-3.5" />
          {isInjecting ? "Generating proof..." : "Inject citizen ZK report"}
        </Button>

        <Button
          onClick={handleCleanup}
          disabled={isCleaning}
          className="w-full border-red-500/50 bg-red-500/10 font-mono text-red-400 hover:bg-red-500/20 text-xs"
          variant="outline"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          {isCleaning ? "Cleaning..." : "Clean simulated"}
        </Button>

        {/* Start / Stop button */}
        {!isRunning ? (
          <Button
            onClick={startSimulation}
            className="w-full border-green-500/50 bg-green-500/10 font-mono text-green-400 hover:bg-green-500/20 hover:border-green-400"
            variant="outline"
          >
            <Play className="mr-2 h-4 w-4" />
            Start Social Feed Simulation
          </Button>
        ) : (
          <Button
            onClick={stopSimulation}
            className="w-full border-red-500/50 bg-red-500/10 font-mono text-red-400 hover:bg-red-500/20"
            variant="outline"
          >
            <Square className="mr-2 h-4 w-4" />
            Stop Simulation
          </Button>
        )}

        {/* Active dispatches */}
        {activeDispatches.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Active dispatches ({activeDispatches.length})
            </p>
            {activeDispatches.map(d => (
              <DispatchCard
                key={d.resourceId}
                dispatch={d}
                onDispatch={() => dispatchResource(d.incidentId, d.incidentLocation)}
              />
            ))}
          </div>
        )}

        {/* Dispatch button - shows last incident */}
        {events.length > 0 && (
          (() => {
            const lastIncident = events.find(e =>
              (e.type === "incident_created" || e.type === "incident_respawned" || e.type === "citizen_zk_report") && e.incidentId
            )
            const alreadyDispatched = lastIncident
              ? activeDispatches.some(d => d.incidentId === lastIncident.incidentId)
              : true

            if (!lastIncident || alreadyDispatched) return null

            return (
              <Button
                onClick={() => dispatchResource(lastIncident.incidentId!, lastIncident.location ?? "incident")}
                className="w-full border-blue-500/50 bg-blue-500/10 font-mono text-blue-400 hover:bg-blue-500/20 text-xs"
                variant="outline"
              >
                <Ambulance className="mr-2 h-3.5 w-3.5" />
                Send resource to incident
              </Button>
            )
          })()
        )}

        {/* Event log */}
        {events.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Event log
            </p>
            <ScrollArea className="h-36">
              <div className="space-y-1 pr-2">
                {events.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 rounded px-2 py-1 bg-white/3">
                    <div className="mt-0.5 shrink-0">{eventIcon(e.type)}</div>
                    <div className="min-w-0">
                      <p className={cn("text-[10px] font-mono leading-tight", eventColor(e.type))}>
                        {e.message}
                      </p>
                      <p className="text-[9px] font-mono text-muted-foreground">
                        {e.timestamp.toLocaleTimeString("en-US")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="border-t border-cyan-500/10 pt-2 flex justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">
            Cycle: <span className="text-cyan-400">{SIMULATION_SPAWN_INTERVAL_MS / 1000}s post / {RESOURCE_DISPATCHED_TO_BUSY_MS / 60_000}m travel / {RESOURCE_BUSY_TO_AVAILABLE_MS / 60_000}m busy</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">?dev=true</span>
        </div>
      </div>
    </div>
  )
}
