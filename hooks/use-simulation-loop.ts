"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSWRConfig } from "swr"
import {
  buildRespawnIncident,
  SOCIAL_REPORTS,
  CAMERA_REPORTS,
  SENSOR_REPORTS,
  RESOURCE_DISPATCHED_TO_BUSY_MS,
  RESOURCE_BUSY_TO_AVAILABLE_MS,
  SIMULATION_SPAWN_INTERVAL_MS,
} from "@/lib/mock-data"
import { createIncidente, fetchRecursos, patchRecurso, patchIncidente } from "@/lib/api"

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface SimulationEvent {
  type: "incident_created" | "resource_dispatched" | "resource_arrived" | "incident_resolved" | "incident_respawned"
  message: string
  timestamp: Date
  incidentId?: string
  resourceId?: string
}

export interface ActiveDispatch {
  incidentId:       string
  resourceId:       string
  resourceName:     string
  incidentLocation: string
  dispatchedAt:     Date
  status:           "en_camino" | "ocupado"
  etaSeconds:       number
}

// ---------------------------------------------------------------------------
// Plantillas de incidentes (sin valores aleatorios; se generan en spawn time)
// ---------------------------------------------------------------------------

const INCIDENT_TEMPLATES = [
  ...SOCIAL_REPORTS.map((r) => ({
    tipo:   r.tipo,
    fuente: "social" as const,
    ubicacion: r.zona.nombre,
    fuente_detalles: { platform: "X (Twitter)", username: r.fuente, content: r.texto, imageUrl: r.imageUrl },
  })),
  ...CAMERA_REPORTS.map((r) => ({
    tipo:   r.tipo,
    fuente: "camera" as const,
    ubicacion: r.zona.nombre,
    fuente_detalles: { cameraId: r.cameraId, cameraLocation: r.zona.nombre, imageUrl: r.imageUrl },
  })),
  ...SENSOR_REPORTS.map((r) => ({
    tipo:   r.tipo,
    fuente: "sensor" as const,
    ubicacion: r.zona.nombre,
    fuente_detalles: { sensorId: r.sensorId, temperature: r.temperature, humidity: r.humidity, windSpeed: r.windSpeed, pressure: r.pressure },
  })),
]

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSimulationLoop() {
  const { mutate } = useSWRConfig()
  const [isRunning,       setIsRunning]       = useState(false)
  const [events,          setEvents]          = useState<SimulationEvent[]>([])
  const [activeDispatches, setActiveDispatches] = useState<ActiveDispatch[]>([])

  const spawnTimerRef    = useRef<NodeJS.Timeout | null>(null)
  const dispatchTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const addEvent = useCallback((event: Omit<SimulationEvent, "timestamp">) => {
    setEvents((prev) => [{ ...event, timestamp: new Date() }, ...prev].slice(0, 20))
  }, [])

  // Crea un nuevo incidente en Supabase
  const spawnIncident = useCallback(async () => {
    const template = INCIDENT_TEMPLATES[Math.floor(Math.random() * INCIDENT_TEMPLATES.length)]
    const respawn  = buildRespawnIncident({ tipo: template.tipo, fuente: template.fuente })

    try {
      const data = await createIncidente({
        ...respawn,
        fuente_detalles: {
          ...template.fuente_detalles,
          ...respawn.fuente_detalles,
        },
        estado: "activo",
      })
      mutate("/api/incidentes")
      addEvent({ type: "incident_created", message: `Nuevo incidente en ${data.ubicacion}`, incidentId: data.id })
      return data
    } catch {
      return null
    }
  }, [mutate, addEvent])

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
              headers: { "Content-Type": "application/json" },
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
        mutate("/api/incidentes")
        mutate("/api/analytics")
        addEvent({ type: "incident_resolved", message: `Incidente en ${incidentLocation} resuelto`, incidentId })

        // 3. Recurso → available después de BUSY_TO_AVAILABLE_MS
        const availableTimer = setTimeout(async () => {
          await patchRecurso(available.id, { estado: "available", incidente_id: null })
          mutate("/api/recursos")
          setActiveDispatches((prev) => prev.filter((d) => d.resourceId !== available.id))
        }, RESOURCE_BUSY_TO_AVAILABLE_MS)

        dispatchTimersRef.current.set(`${available.id}-available`, availableTimer)
        dispatchTimersRef.current.delete(available.id)
      }, RESOURCE_DISPATCHED_TO_BUSY_MS)

      dispatchTimersRef.current.set(available.id, timer)
    },
    [mutate, addEvent, spawnIncident], // spawnIncident kept in deps to satisfy exhaustive-deps
  )

  // Inicia el loop: primer incidente inmediato, luego cada SIMULATION_SPAWN_INTERVAL_MS
  const startSimulation = useCallback(async () => {
    setIsRunning(true)
    setEvents([])
    await spawnIncident()
    spawnTimerRef.current = setInterval(spawnIncident, SIMULATION_SPAWN_INTERVAL_MS)
  }, [spawnIncident])

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

  return { isRunning, events, activeDispatches, startSimulation, stopSimulation, dispatchResource }
}
