"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSWRConfig } from "swr"
import {
  buildRespawnIncident,
  SOCIAL_REPORTS,
  CAMERA_REPORTS,
  SENSOR_REPORTS,
  CITIZEN_REPORTS,
  RESOURCE_DISPATCHED_TO_BUSY_MS,
  RESOURCE_BUSY_TO_AVAILABLE_MS,
  SIMULATION_SPAWN_INTERVAL_MS,
} from "@/lib/mock-data"
import { createIncidente, fetchRecursos, patchRecurso, patchIncidente, createZkCitizenReport } from "@/lib/api"

const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || ""
const MAX_ACTIVE_SIMULATED_INCIDENTS = 5
const AUTO_RESOLVE_UNATTENDED_MS = 120_000

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface SimulationEvent {
  type: "incident_created" | "resource_dispatched" | "resource_arrived" | "incident_resolved" | "incident_respawned" | "citizen_zk_report"
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

const CITIZEN_REPORT_CHANCE = 0.3

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
      mutate("/api/incidentes?estado=activo")
      mutate("/api/incidentes?estado=atendido")
      mutate("/api/analytics")
      addEvent({ type: "citizen_zk_report", message: `Reporte ciudadano ZK en ${data.incident.ubicacion}`, incidentId: data.incident.id })

      // Auto-resolución de reportes ciudadanos ZK no atendidos
      const autoResolveTimer = setTimeout(async () => {
        try {
          const current = await fetch(`/api/incidentes/${data.incident.id}`).then(r => r.ok ? r.json() : null)
          if (current?.data?.estado === "activo") {
            await patchIncidente(data.incident.id, { estado: "atendido" })
            mutate("/api/incidentes?estado=activo")
            mutate("/api/incidentes?estado=atendido")
            mutate("/api/analytics")
            addEvent({ type: "incident_resolved", message: `Auto-resuelto: reporte ciudadano en ${data.incident.ubicacion}`, incidentId: data.incident.id })
          }
        } catch (err) {
          console.error("[use-simulation-loop] Auto-resolve citizen ZK failed:", err)
        }
      }, AUTO_RESOLVE_UNATTENDED_MS)
      dispatchTimersRef.current.set(`autoresolve-${data.incident.id}`, autoResolveTimer)

      return data.incident
    } catch (err) {
      console.error("[use-simulation-loop] Failed to spawn citizen ZK report:", err)
      return null
    }
  }, [mutate, addEvent])

  const activeCount = useCallback(async () => {
    try {
      const res = await fetch("/api/incidentes?estado=activo", {
        headers: API_SECRET ? { "x-api-secret": API_SECRET } : {},
      })
      const data = await res.json()
      return Array.isArray(data) ? data.length : 0
    } catch {
      return Infinity
    }
  }, [])

  const cleanupSimulatedIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidentes?estado=activo", {
        headers: API_SECRET ? { "x-api-secret": API_SECRET } : {},
      })
      const data = await res.json()
      const simulated = (Array.isArray(data) ? data : []).filter((i: any) => i.fuente_detalles?.simulated)
      await Promise.all(
        simulated.map((i: any) =>
          fetch("/api/incidentes", {
            method: "DELETE",
            headers: API_SECRET ? { "x-api-secret": API_SECRET, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
            body: JSON.stringify({ id: i.id }),
          })
        )
      )
      mutate("/api/incidentes?estado=activo")
      mutate("/api/incidentes?estado=atendido")
      mutate("/api/analytics")
      addEvent({ type: "incident_resolved", message: `Limpieza: ${simulated.length} incidentes simulados eliminados` })
    } catch (err) {
      console.error("[use-simulation-loop] Failed to cleanup simulated incidents:", err)
    }
  }, [mutate, addEvent])

  const spawnIncident = useCallback(async () => {
    const active = await activeCount()
    if (active >= MAX_ACTIVE_SIMULATED_INCIDENTS) {
      addEvent({ type: "incident_created", message: "Límite de incidentes activos alcanzado. No se spawnea más." })
      return null
    }

    const isCitizen = Math.random() < CITIZEN_REPORT_CHANCE
    if (isCitizen) {
      return spawnCitizenZkReport()
    }

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
      mutate("/api/incidentes?estado=activo")
      mutate("/api/incidentes?estado=atendido")
      addEvent({ type: "incident_created", message: `Nuevo incidente en ${data.ubicacion}`, incidentId: data.id })

      // Auto-resolución de incidentes simulados no atendidos
      const autoResolveTimer = setTimeout(async () => {
        try {
          const current = await fetch(`/api/incidentes/${data.id}`).then(r => r.ok ? r.json() : null)
          if (current?.data?.estado === "activo") {
            await patchIncidente(data.id, { estado: "atendido" })
            mutate("/api/incidentes?estado=activo")
            mutate("/api/incidentes?estado=atendido")
            mutate("/api/analytics")
            addEvent({ type: "incident_resolved", message: `Auto-resuelto: incidente en ${data.ubicacion}`, incidentId: data.id })
          }
        } catch (err) {
          console.error("[use-simulation-loop] Auto-resolve failed:", err)
        }
      }, AUTO_RESOLVE_UNATTENDED_MS)
      dispatchTimersRef.current.set(`autoresolve-${data.id}`, autoResolveTimer)

      return data
    } catch (err) {
      console.error("[use-simulation-loop] Failed to spawn incident:", err)
      return null
    }
  }, [mutate, addEvent, spawnCitizenZkReport])

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
            const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || ""
            const incidentes = await fetch("/api/incidentes?estado=activo", {
              headers: apiSecret ? { "x-api-secret": apiSecret } : {},
            }).then((res) => res.json())
            const incident = Array.isArray(incidentes) ? incidentes.find((i: any) => i.id === incidentId) : null
            if (incident) {
              const response = await fetch("/api/incidentes/arkiv-dispatch", {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  ...(apiSecret ? { "x-api-secret": apiSecret } : {}),
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

  // Inicia el loop: primer incidente inmediato, luego cada SIMULATION_SPAWN_INTERVAL_MS
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

  return { isRunning, events, activeDispatches, startSimulation, stopSimulation, dispatchResource, spawnCitizenZkReport, cleanupSimulatedIncidents }
}
