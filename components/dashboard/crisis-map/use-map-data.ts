"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { fetcher } from "@/lib/api"
import type { Incident, DbIncident } from "@/lib/types"

const SWR_CONFIG = {
  refreshInterval: 0,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  keepPreviousData: true,
}

/** Transforma una fila de Supabase al tipo local `Incident` */
export function dbToIncident(inc: DbIncident): Incident {
  return {
    id:             inc.id,
    type:           inc.tipo as Incident["type"],
    severity:       inc.severidad as Incident["severity"],
    location:       inc.ubicacion,
    coordinates:    { lat: inc.latitud, lng: inc.longitud },
    affectedPeople: inc.personas_afectadas,
    timestamp:      new Date(inc.created_at),
    source:         inc.fuente as Incident["source"],
    sourceDetails:  inc.fuente_detalles || {},
    estado:         inc.estado,
    arkiv_key:      inc.arkiv_key,
  }
}

/** Hook de incidentes activos/atendidos con polling cada 3 s */
export function useIncidents(estado: "activo" | "atendido" = "activo") {
  const { data, error, mutate } = useSWR<DbIncident[]>(`/api/incidentes?estado=${estado}`, fetcher, {
    ...SWR_CONFIG,
    refreshInterval: 0,
  })

  const incidents: Incident[] = useMemo(() => {
    if (!data || error) return []
    return data.map(dbToIncident)
  }, [data, error])

  return { incidents, mutate }
}

/** Hook de recursos con polling cada 3 s - hook compartido para CrisisMap y ResourcesPanel */
export function useResources() {
  return useSWR("/api/recursos", fetcher, SWR_CONFIG)
}
