import { NextRequest } from "next/server"
import { ArkivService, type ArkivEntity } from "@/lib/services/arkiv-service"
import { apiSuccess, apiError, apiNotFound } from "@/lib/services/api-response"
import { supabase } from "@/lib/supabase"
import type { DbIncident } from "@/lib/types"

type RelationType = "detection_to_dispatch" | "dispatch_to_detection" | null

interface VerifyResponse {
  success: boolean
  key: string
  creator: string
  expiresAtBlock: string | null
  payload: Record<string, unknown>
  linkedEntity: LinkedEntityData | null
  relation: RelationType
  isSimulated: boolean
}

interface LinkedEntityData {
  key: string
  creator: string
  expiresAtBlock: string | null
  payload: Record<string, unknown>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
): Promise<Response> {
  try {
    const { key } = await params

    const validationError = validateKey(key)
    if (validationError) return validationError

    const entity = await ArkivService.getEntity(key)

    if (entity) {
      return apiSuccess(await resolveOnChainEntity(entity, key))
    }

    const dbIncident = await findIncidentByKey(key)
    if (dbIncident) {
      return apiSuccess(buildSimulatedResponse(dbIncident, key))
    }

    return apiNotFound("Entity not found on-chain or in local database")
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Arkiv Verify] Error:", message)
    return apiError(message)
  }
}

function validateKey(key: string): Response | null {
  if (!key || !key.startsWith("0x")) {
    return apiError("Invalid entity key", 400)
  }
  if (key.length === 42) {
    return apiError("Wallet address provided (42 chars). Entity key required (66 chars).", 400)
  }
  if (key.length !== 66) {
    return apiError(`Invalid key length: ${key.length}. Must be 66 characters.`, 400)
  }
  return null
}

async function resolveOnChainEntity(entity: ArkivEntity, key: string): Promise<VerifyResponse> {
  const payload = entity.payload
  let linkedEntity: LinkedEntityData | null = null
  let relation: RelationType = null

  if (payload.action === "dispatch" && payload.detectionKey) {
    relation = "dispatch_to_detection"
    linkedEntity = await resolveLinkedEntity(payload.detectionKey as string, true)
  } else {
    const dbIncident = await findIncidentByKey(key)
    if (dbIncident?.fuente_detalles?.arkiv_entity_key && dbIncident.fuente_detalles.arkiv_entity_key !== key) {
      relation = "detection_to_dispatch"
      linkedEntity = await resolveLinkedEntity(dbIncident.fuente_detalles.arkiv_entity_key as string, false)
    }
  }

  return {
    success: true,
    key,
    creator: entity.creator,
    expiresAtBlock: entity.expiresAtBlock,
    payload,
    linkedEntity,
    relation,
    isSimulated: false,
  }
}

async function resolveLinkedEntity(linkedKey: string, isLinkedDetection: boolean): Promise<LinkedEntityData | null> {
  if (!ArkivService.isValidEntityKey(linkedKey)) return null

  const entity = await ArkivService.getEntity(linkedKey)
  if (entity) {
    return {
      key: linkedKey,
      creator: entity.creator,
      expiresAtBlock: entity.expiresAtBlock,
      payload: entity.payload,
    }
  }

  const dbIncident = await findIncidentByKey(linkedKey)
  if (!dbIncident) return null

  return {
    key: linkedKey,
    creator: isLinkedDetection
      ? "0xSimulatedAIAgent0000000000000000000000"
      : "0xSimulatedOperatorAccount0000000000000000",
    expiresAtBlock: "999999 (Simulación)",
    payload: isLinkedDetection
      ? buildSimulatedDetectionPayload(dbIncident)
      : buildSimulatedDispatchPayload(dbIncident, linkedKey),
  }
}

async function findIncidentByKey(key: string): Promise<DbIncident | null> {
  const { data } = await supabase
    .from("incidentes")
    .select("*")
    .or(`fuente_detalles->>arkiv_entity_key.eq.${key},fuente_detalles->ai_analysis->>arkiv_entity_key.eq.${key},fuente_detalles->>detection_arkiv_key.eq.${key}`)
    .maybeSingle()

  return data
}

function buildSimulatedResponse(incident: DbIncident, key: string): VerifyResponse {
  const detectionKey = (incident.fuente_detalles?.ai_analysis as Record<string, unknown>)?.arkiv_entity_key as string
    || incident.fuente_detalles?.detection_arkiv_key as string
    || `0xSimulatedDetectionKey-${incident.id}`

  const dispatchKey = incident.fuente_detalles?.arkiv_entity_key as string
    || `0xSimulatedDispatchKey-${incident.id}`

  const isQueryingDetection = key === detectionKey ||
    (incident.fuente_detalles?.ai_analysis as Record<string, unknown>)?.arkiv_entity_key === key

  let linkedEntity: LinkedEntityData | null = null
  let relation: RelationType = null

  if (incident.estado === "atendido") {
    relation = isQueryingDetection ? "detection_to_dispatch" : "dispatch_to_detection"
    const linkedKey = isQueryingDetection ? dispatchKey : detectionKey

    linkedEntity = {
      key: linkedKey,
      creator: isQueryingDetection
        ? "0xSimulatedOperatorAccount0000000000000000"
        : "0xSimulatedAIAgent0000000000000000000000",
      expiresAtBlock: "999999 (Simulación)",
      payload: isQueryingDetection
        ? buildSimulatedDispatchPayload(incident, detectionKey)
        : buildSimulatedDetectionPayload(incident),
    }
  }

  return {
    success: true,
    key,
    creator: isQueryingDetection
      ? "0xSimulatedAIAgent0000000000000000000000"
      : "0xSimulatedOperatorAccount0000000000000000",
    expiresAtBlock: "999999 (Simulación)",
    payload: isQueryingDetection
      ? buildSimulatedDetectionPayload(incident)
      : buildSimulatedDispatchPayload(incident, detectionKey),
    linkedEntity,
    relation,
    isSimulated: true,
  }
}

function buildSimulatedDetectionPayload(incident: DbIncident): Record<string, unknown> {
  const aiAnalysis = incident.fuente_detalles?.ai_analysis as Record<string, unknown> | undefined
  return {
    agent: "Gemini 2.0 Flash (Simulado)",
    task: "Real-time Climate Crisis Monitoring",
    location: incident.ubicacion,
    type: incident.tipo,
    severity: incident.severidad,
    summary: incident.fuente_detalles?.content || "Detección automática de la IA",
    confidence: aiAnalysis?.confidence || 90,
    scannedAt: incident.created_at,
    simulated: true,
  }
}

function buildSimulatedDispatchPayload(incident: DbIncident, detectionKey: string): Record<string, unknown> {
  return {
    action: "dispatch",
    incidentId: incident.id,
    detectionKey,
    tipo: incident.tipo,
    severidad: incident.severidad,
    ubicacion: incident.ubicacion,
    afectados: incident.personas_afectadas,
    operator: "0xSimulatedOperatorAccount0000000000000000",
    dispatchedAt: incident.fuente_detalles?.dispatched_at || incident.updated_at,
    simulated: true,
  }
}
