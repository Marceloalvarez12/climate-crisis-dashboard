"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSWRConfig } from "swr"
import {
  CITIZEN_REPORTS,
  RESOURCE_DISPATCHED_TO_BUSY_MS,
  RESOURCE_BUSY_TO_AVAILABLE_MS,
  SIMULATION_SPAWN_INTERVAL_MS,
} from "@/lib/mock-data"
import { fetchRecursos, patchRecurso, patchIncidente, createZkCitizenReport, postSocialMention } from "@/lib/api"
import { buildSimulatedPost, type SimulatedPostPayload } from "@/lib/social-feed-simulator"
import type { MentionOutcome } from "@/lib/agents/types"

const MAX_ACTIVE_SIMULATED_INCIDENTS = 5
const AUTO_RESOLVE_UNATTENDED_MS = 120_000

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface SimulationEvent {
  type:
    | "incident_created" | "resource_dispatched" | "resource_arrived" | "incident_resolved"
    | "incident_respawned" | "citizen_zk_report"
    | "post_ignored" | "post_rejected" | "hashtag_corroborated"
  message: string
  timestamp: Date
  incidentId?: string
  resourceId?: string
  location?:   string
  platform?:   string
}

/** Sin `text` se genera un post aleatorio del feed simulado */
export type SocialPostInput = Partial<Pick<SimulatedPostPayload, "platform" | "text" | "author">>

export interface ActiveDispatch {
  incidentId:       string
  resourceId:       string
  resourceName:     string
  incidentLocation: string
  dispatchedAt:     Date
  status:           "en_camino" | "ocupado"
  etaSeconds:       number
}

const CITIZEN_REPORT_CHANCE = 0.2

const PLATFORM_NAME: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", twitter: "X" }

export function useSimulationLoop() {
  const { mutate } = useSWRConfig()
  const [isRunning,       setIsRunning]       = useState(false)
  const [events,          setEvents]          = useState<SimulationEvent[]>([])
  const [activeDispatches, setActiveDispatches] = useState<ActiveDispatch[]>([])

  const spawnTimerRef    = useRef<NodeJS.Timeout | null>(null)
  const dispatchTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const addEvent = useCallback((event: Omit<SimulationEvent, "timestamp">) => {
    setEvents((prev) => [{ ...event, timestamp: new Date() }, ...prev].slice(0, 30))
  }, [])

  const refreshIncidents = useCallback(() => {
    mutate("/api/incidentes?estado=activo")
    mutate("/api/incidentes?estado=atendido")
    mutate("/api/analytics")
  }, [mutate])

  // Auto-resolución de incidentes simulados no atendidos
  const scheduleAutoResolve = useCallback((incidentId: string, location: string, label = "incidente") => {
    const timer = setTimeout(async () => {
      try {
        const current = await fetch(`/api/incidentes/${incidentId}`).then(r => r.ok ? r.json() : null)
        if (current?.data?.estado === "activo") {
          await patchIncidente(incidentId, { estado: "atendido" })
          refreshIncidents()
          addEvent({ type: "incident_resolved", message: `Auto-resuelto: ${label} en ${location}`, incidentId, location })
        }
      } catch (err) {
        console.error("[use-simulation-loop] Auto-resolve failed:", err)
      }
    }, AUTO_RESOLVE_UNATTENDED_MS)
    dispatchTimersRef.current.set(`autoresolve-${incidentId}`, timer)
  }, [addEvent, refreshIncidents])

  // Publica un post (simulado o escrito a mano) en el webhook de menciones.
  // Sólo los posts con #AlertaTucuman que describen una emergencia crean incidentes.
  const publishSocialPost = useCallback(async (input?: SocialPostInput): Promise<MentionOutcome | null> => {
    const post = buildSimulatedPost(input)
    const net  = PLATFORM_NAME[post.platform] ?? post.platform
    try {
      const outcome = await postSocialMention(post)
      const where   = outcome.location ?? "ubicación desconocida"
      switch (outcome.status) {
        case "created":
          refreshIncidents()
          addEvent({ type: "incident_created", message: `${outcome.hashtag} en ${net} (${post.author}) → incidente en ${where}`, incidentId: outcome.incidentId, location: where, platform: post.platform })
          if (outcome.incidentId) scheduleAutoResolve(outcome.incidentId, where)
          break
        case "corroborated":
          refreshIncidents()
          addEvent({ type: "hashtag_corroborated", message: `${net} (${post.author}) corrobora el incidente en ${where}`, incidentId: outcome.incidentId, location: where, platform: post.platform })
          break
        case "rejected":
          addEvent({ type: "post_rejected", message: `${outcome.hashtag} en ${net} descartado por IA: no es una emergencia`, platform: post.platform })
          break
        case "skipped":
          addEvent({ type: "post_rejected", message: `Incidente en ${where} no creado: límite de activos alcanzado`, platform: post.platform })
          break
        case "duplicate":
          addEvent({ type: "post_ignored", message: `Post duplicado de ${post.author} ignorado`, platform: post.platform })
          break
        default:
          addEvent({ type: "post_ignored", message: `Post de ${post.author} en ${net} sin ${outcome.hashtag}: ignorado`, platform: post.platform })
      }
      return outcome
    } catch (err) {
      console.error("[use-simulation-loop] Failed to publish social post:", err)
      addEvent({ type: "post_rejected", message: `Error al procesar post de ${net}`, platform: post.platform })
      return null
    }
  }, [addEvent, refreshIncidents, scheduleAutoResolve])

  const spawnCitizenZkReport = useCallback(async () => {
    const report = CITIZEN_REPORTS[Math.floor(Math.random() * CITIZEN_REPORTS.length)]
    try {
      const data = await createZkCitizenReport({
        lat: report.zona.lat,
        lng: report.zona.lng,
        tipo: report.tipo,
        severidad: report.severidad,
        ubicacion: report.zona.nombre,
        personasAfectadas: 0,
        descripcion: report.descripcion,
      })
      refreshIncidents()
      addEvent({ type: "citizen_zk_report", message: `Reporte ciudadano ZK en ${data.incident.ubicacion}`, incidentId: data.incident.id, location: data.incident.ubicacion })
      scheduleAutoResolve(data.incident.id, data.incident.ubicacion, "reporte ciudadano")
      return data.incident
    } catch (err) {
      console.error("[use-simulation-loop] Failed to spawn citizen ZK report:", err)
      return null
    }
  }, [addEvent, refreshIncidents, scheduleAutoResolve])

  const activeCount = useCallback(async () => {
    try {
      const res = await fetch("/api/incidentes?estado=activo")
      const data = await res.json()
      return Array.isArray(data) ? data.length : 0
    } catch {
      return Infinity
    }
  }, [])

  const cleanupSimulatedIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidentes?estado=activo")
      const data = await res.json()
      const simulated = (Array.isArray(data) ? data : []).filter((i: any) => i.fuente_detalles?.simulated)
      await Promise.all(
        simulated.map((i: any) =>
          fetch("/api/incidentes", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: i.id }),
          })
        )
      )
      refreshIncidents()
      addEvent({ type: "incident_resolved", message: `Limpieza: ${simulated.length} incidentes simulados eliminados` })
    } catch (err) {
      console.error("[use-simulation-loop] Failed to cleanup simulated incidents:", err)
    }
  }, [addEvent, refreshIncidents])

  // Cada tick de la simulación publica un post en el feed social simulado
  // (o, con menor probabilidad, un reporte ciudadano ZK). Ya no se crean
  // incidentes aleatorios: sólo nacen de posts con el hashtag disparador.
  const spawnIncident = useCallback(async () => {
    const active = await activeCount()
    if (active >= MAX_ACTIVE_SIMULATED_INCIDENTS) {
      addEvent({ type: "post_ignored", message: "Límite de incidentes activos alcanzado. Feed en pausa." })
      return null
    }
    return Math.random() < CITIZEN_REPORT_CHANCE ? spawnCitizenZkReport() : publishSocialPost()
  }, [activeCount, addEvent, spawnCitizenZkReport, publishSocialPost])

  // Despacha un recurso al incidente y encadena el ciclo de vida
  const dispatchResource = useCallback(
    async (incidentId: string, incidentLocation: string) => {
      const recursos = await fetchRecursos()
      const available = recursos.find((r) => r.estado === "available")

      if (!available) {
        addEvent({ type: "resource_dispatched", message: "Sin recursos disponibles", incidentId })
        return
      }

      await patchRecurso(available.id, { estado: "dispatched", incidente_id: incidentId })
      mutate("/api/recursos")

      const dispatch: ActiveDispatch = {
        incidentId,
        resourceId:       available.id,
        resourceName:     available.nombre,
        incidentLocation,
        dispatchedAt:     new Date(),
        status:           "en_camino",
        etaSeconds:       RESOURCE_DISPATCHED_TO_BUSY_MS / 1000,
      }
      setActiveDispatches((prev) => [...prev, dispatch])
      addEvent({
        type:       "resource_dispatched",
        message:    `${available.nombre} en camino a ${incidentLocation}`,
        incidentId,
        resourceId: available.id,
      })

      // Recurso llega al incidente después de DISPATCHED_TO_BUSY_MS
      const timer = setTimeout(async () => {
        try {
          // 1. Recurso → busy
          await patchRecurso(available.id, { estado: "busy" })
          mutate("/api/recursos")
          setActiveDispatches((prev) =>
            prev.map((d) => (d.resourceId === available.id ? { ...d, status: "ocupado" } : d))
          )
          addEvent({ type: "resource_arrived", message: `${available.nombre} llegó a ${incidentLocation}`, incidentId, resourceId: available.id })

          // 2. Incidente → atendido (Firma on-chain)
          try {
            const incidentes = await fetch("/api/incidentes?estado=activo").then((res) => res.json())
            const incident = Array.isArray(incidentes) ? incidentes.find((i: any) => i.id === incidentId) : null
            if (incident) {
              const response = await fetch("/api/incidentes/arkiv-dispatch", {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  id: incidentId,
                  tipo: incident.tipo,
                  severidad: incident.severidad || "medium",
                  ubicacion: incident.ubicacion,
                  afectados: incident.personas_afectadas || 0,
                }),
              })
              const data = await response.json()
              if (response.ok && data.success) {
                console.log("[use-simulation-loop] Dispatch signed on-chain:", data.entityKey)
              } else {
                console.warn("[use-simulation-loop] On-chain signing failed, falling back to local patch:", data.error)
                await patchIncidente(incidentId, { estado: "atendido" })
              }
            } else {
              await patchIncidente(incidentId, { estado: "atendido" })
            }
          } catch (e) {
            console.error("[use-simulation-loop] Error signing dispatch on-chain, falling back to local:", e)
            await patchIncidente(incidentId, { estado: "atendido" })
          }
          mutate("/api/incidentes?estado=activo")
          mutate("/api/incidentes?estado=atendido")
          mutate("/api/analytics")
          addEvent({ type: "incident_resolved", message: `Incidente en ${incidentLocation} resuelto`, incidentId })

          // 3. Recurso → available después de BUSY_TO_AVAILABLE_MS
          const availableTimer = setTimeout(async () => {
            try {
              await patchRecurso(available.id, { estado: "available", incidente_id: null })
              mutate("/api/recursos")
              setActiveDispatches((prev) => prev.filter((d) => d.resourceId !== available.id))
            } catch (err) {
              console.error("[use-simulation-loop] Error releasing resource:", err)
              setActiveDispatches((prev) => prev.filter((d) => d.resourceId !== available.id))
            }
          }, RESOURCE_BUSY_TO_AVAILABLE_MS)

          dispatchTimersRef.current.set(`${available.id}-available`, availableTimer)
          dispatchTimersRef.current.delete(available.id)
        } catch (err) {
          console.error("[use-simulation-loop] Dispatch lifecycle error, recovering resource:", err)
          try { await patchRecurso(available.id, { estado: "available", incidente_id: null }) } catch { /* recovery failed */ }
          setActiveDispatches((prev) => prev.filter((d) => d.resourceId !== available.id))
          dispatchTimersRef.current.delete(available.id)
        }
      }, RESOURCE_DISPATCHED_TO_BUSY_MS)

      dispatchTimersRef.current.set(available.id, timer)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutate, addEvent],
  )

  // Inicia el loop: primer post inmediato, luego cada SIMULATION_SPAWN_INTERVAL_MS
  const startSimulation = useCallback(async () => {
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current) // prevent double-start
    setIsRunning(true)
    setEvents([])
    await cleanupSimulatedIncidents()
    await spawnIncident()
    spawnTimerRef.current = setInterval(spawnIncident, SIMULATION_SPAWN_INTERVAL_MS)
  }, [spawnIncident, cleanupSimulatedIncidents])

  // Detiene el loop y limpia timers
  const stopSimulation = useCallback(() => {
    setIsRunning(false)
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
    dispatchTimersRef.current.forEach((t) => clearTimeout(t))
    dispatchTimersRef.current.clear()
    setActiveDispatches([])
    setEvents([])
  }, [])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
      dispatchTimersRef.current.forEach((t) => clearTimeout(t))
      dispatchTimersRef.current.clear()
    }
  }, [])

  return { isRunning, events, activeDispatches, startSimulation, stopSimulation, dispatchResource, spawnCitizenZkReport, cleanupSimulatedIncidents, publishSocialPost }
}
