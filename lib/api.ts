/**
 * lib/api.ts
 *
 * Helpers para llamadas a la API interna.
 * Centralizar aquí evita repetir `fetch + headers + JSON.stringify` en cada componente.
 */

import type { DbIncident, DbResource } from "@/lib/types"

const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET ?? ""

const authHeaders = () => ({
  "Content-Type": "application/json",
  ...(API_SECRET ? { "x-api-secret": API_SECRET } : {}),
})

// SWR fetcher genérico
export const fetcher = (url: string) =>
  fetch(url, {
    headers: API_SECRET ? { "x-api-secret": API_SECRET } : {},
  }).then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
    return res.json()
  })

// ---------------------------------------------------------------------------
// Incidentes
// ---------------------------------------------------------------------------

export async function patchIncidente(id: string, updates: Record<string, unknown>) {
  const res = await fetch("/api/incidentes", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ id, ...updates }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<DbIncident>
}

export async function createIncidente(body: Record<string, unknown>) {
  const res = await fetch("/api/incidentes", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<DbIncident & { skipped?: boolean }>
}

// ---------------------------------------------------------------------------
// ZK Citizen Reports
// ---------------------------------------------------------------------------

export async function createZkCitizenReport(payload: {
  lat: number
  lng: number
  tipo: string
  severidad: string
  ubicacion: string
  personasAfectadas: number
  descripcion?: string
}) {
  const res = await fetch("/api/incidentes/zk-report", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      ...payload,
      zoneHash: 12345,
      minLat: -27,
      maxLat: -26.5,
      minLng: -65.5,
      maxLng: -65,
    }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<{ incident: DbIncident; verified: boolean; contractId?: string; explorerUrl?: string }>
}

// ---------------------------------------------------------------------------
// Recursos
// ---------------------------------------------------------------------------

export async function fetchRecursos(): Promise<DbResource[]> {
  const res = await fetch("/api/recursos", {
    headers: API_SECRET ? { "x-api-secret": API_SECRET } : {},
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export async function patchRecurso(
  id: string,
  updates: { estado?: string; incidente_id?: string | null },
) {
  const res = await fetch("/api/recursos", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ id, ...updates }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<DbResource>
}
