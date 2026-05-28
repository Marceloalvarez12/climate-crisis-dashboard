"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  Play, Square, Zap, X, Terminal, Cpu, Database,
  Ambulance, Shield, Truck, CheckCircle2, AlertTriangle,
  Flame, Droplets, Wind, MapPin, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useSimulationLoop, ActiveDispatch, SimulationEvent } from "@/hooks/use-simulation-loop"

const eventIcon = (type: SimulationEvent["type"]) => {
  switch (type) {
    case "incident_created":    return <AlertTriangle className="h-3 w-3 text-accent" />
    case "resource_dispatched": return <Truck className="h-3 w-3 text-blue-400" />
    case "resource_arrived":    return <MapPin className="h-3 w-3 text-yellow-400" />
    case "incident_resolved":   return <CheckCircle2 className="h-3 w-3 text-green-400" />
    case "incident_respawned":  return <Zap className="h-3 w-3 text-primary" />
  }
}

const eventColor = (type: SimulationEvent["type"]) => {
  switch (type) {
    case "incident_created":    return "text-accent"
    case "resource_dispatched": return "text-blue-400"
    case "resource_arrived":    return "text-yellow-400"
    case "incident_resolved":   return "text-green-400"
    case "incident_respawned":  return "text-primary"
  }
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
          {dispatch.status === "en_camino" ? "En camino" : "Ocupado"}
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
  } = useSimulationLoop()

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
    <div className="fixed bottom-4 left-4 z-[9000] w-80 rounded-lg border border-cyan-500/30 bg-black/95 shadow-xl shadow-cyan-500/10 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Cpu className="h-4 w-4 text-cyan-400" />
            {isRunning && (
              <div className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </div>
          <span className="text-sm font-mono font-semibold text-cyan-400">SIMULACION</span>
          {isRunning && (
            <Badge variant="outline" className="h-4 border-green-500/40 bg-green-500/10 px-1.5 text-[9px] font-mono text-green-400">
              ACTIVA
            </Badge>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
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

        {/* Start / Stop button */}
        {!isRunning ? (
          <Button
            onClick={startSimulation}
            className="w-full border-green-500/50 bg-green-500/10 font-mono text-green-400 hover:bg-green-500/20 hover:border-green-400"
            variant="outline"
          >
            <Play className="mr-2 h-4 w-4" />
            Iniciar Simulacion Dinamica
          </Button>
        ) : (
          <Button
            onClick={stopSimulation}
            className="w-full border-red-500/50 bg-red-500/10 font-mono text-red-400 hover:bg-red-500/20"
            variant="outline"
          >
            <Square className="mr-2 h-4 w-4" />
            Detener Simulacion
          </Button>
        )}

        {/* Active dispatches */}
        {activeDispatches.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Despachos activos ({activeDispatches.length})
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
        {isRunning && events.length > 0 && (
          (() => {
            const lastIncident = events.find(e =>
              e.type === "incident_created" || e.type === "incident_respawned"
            )
            const alreadyDispatched = lastIncident
              ? activeDispatches.some(d => d.incidentId === lastIncident.incidentId)
              : true

            if (!lastIncident || alreadyDispatched) return null

            return (
              <Button
                onClick={() => dispatchResource(lastIncident.incidentId!, lastIncident.message.replace("Nuevo incidente en ", ""))}
                className="w-full border-blue-500/50 bg-blue-500/10 font-mono text-blue-400 hover:bg-blue-500/20 text-xs"
                variant="outline"
              >
                <Ambulance className="mr-2 h-3.5 w-3.5" />
                Enviar recurso al incidente
              </Button>
            )
          })()
        )}

        {/* Event log */}
        {events.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Log de eventos
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
                        {e.timestamp.toLocaleTimeString("es-AR")}
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
            Ciclo: <span className="text-cyan-400">90s spawn / 15s camino / 20s busy</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">?dev=true</span>
        </div>
      </div>
    </div>
  )
}
