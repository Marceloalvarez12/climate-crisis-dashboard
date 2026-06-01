import { NextRequest } from "next/server"
import { IncidentService } from "@/lib/services/incident-service"
import { ArkivService, type DispatchPayload } from "@/lib/services/arkiv-service"
import { apiSuccess, apiError } from "@/lib/services/api-response"
import { CONFIG } from "@/lib/config"
import type { EmergencyIncident, ArkivDispatchResponse } from "@/lib/types"

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const incidente: EmergencyIncident & { arkivKey?: string } = await request.json()

    const isLeaseExtended = await tryExtendLease(incidente.arkivKey)

    const { entityKey, isSimulated } = await createDispatchEntity(incidente)

    await updateIncidentInDb(incidente, entityKey, isSimulated, isLeaseExtended)

    const response: ArkivDispatchResponse = { success: true, entityKey }
    return apiSuccess(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to dispatch"
    console.error("[Arkiv Dispatch] Error:", message)
    return apiError(message, 500)
  }
}

async function tryExtendLease(arkivKey?: string): Promise<boolean> {
  if (!arkivKey || !ArkivService.isValidEntityKey(arkivKey) || ArkivService.isSimulatedKey(arkivKey)) {
    return false
  }
  return ArkivService.extendLease(arkivKey, CONFIG.INCIDENTS.DISPATCH_LEASE_SECONDS)
}

async function createDispatchEntity(
  incidente: EmergencyIncident & { arkivKey?: string }
): Promise<{ entityKey: string; isSimulated: boolean }> {
  const account = process.env.ARKIV_PRIVATE_KEY && process.env.ARKIV_PRIVATE_KEY !== "0xREEMPLAZAR_CON_TU_PRIVATE_KEY_AQUI"
    ? (await import("@arkiv-network/sdk/accounts")).privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY as `0x${string}`).address
    : "0xSimulatedOperator"

  const payload: DispatchPayload = {
    action: "dispatch",
    incidentId: incidente.id,
    detectionKey: incidente.arkivKey || null,
    tipo: incidente.tipo,
    severidad: incidente.severidad,
    ubicacion: incidente.ubicacion,
    afectados: incidente.afectados,
    operator: account,
    dispatchedAt: new Date().toISOString(),
  }

  const attributes = [
    { key: "project", value: "climate-crisis-dashboard" },
    { key: "tipo", value: incidente.tipo || "general" },
    { key: "severidad", value: incidente.severidad || "medium" },
    { key: "ubicacion", value: incidente.ubicacion || "unknown" },
    { key: "status", value: "dispatched" },
    { key: "track", value: "arkiv" },
  ]

  if (incidente.arkivKey) {
    attributes.push({ key: "detectionKey", value: incidente.arkivKey })
  }

  return ArkivService.createDispatchEntity(payload, attributes)
}

async function updateIncidentInDb(
  incidente: EmergencyIncident & { arkivKey?: string },
  entityKey: string,
  isSimulated: boolean,
  isLeaseExtended: boolean
): Promise<void> {
  const existing = await IncidentService.findById(incidente.id)

  const updatedDetails = {
    ...(existing?.fuente_detalles || {}),
    arkiv_entity_key: entityKey,
    detection_arkiv_key: incidente.arkivKey || existing?.fuente_detalles?.arkiv_entity_key || null,
    dispatched_at: new Date().toISOString(),
    lease_extended: isLeaseExtended,
    platform: isSimulated ? "Climate Crisis Dashboard Operator (Simulado)" : "Climate Crisis Dashboard Operator",
  }

  await IncidentService.update(incidente.id, {
    tipo: incidente.tipo || existing?.tipo || "general",
    severidad: incidente.severidad || existing?.severidad || "medium",
    ubicacion: incidente.ubicacion || existing?.ubicacion || "unknown",
    latitud: existing?.latitud ?? CONFIG.INCIDENTS.DEFAULT_COORDS.lat,
    longitud: existing?.longitud ?? CONFIG.INCIDENTS.DEFAULT_COORDS.lng,
    personas_afectadas: incidente.afectados || existing?.personas_afectadas || 0,
    fuente: existing?.fuente || "social",
    fuente_detalles: updatedDetails,
    estado: "atendido",
  })
}
