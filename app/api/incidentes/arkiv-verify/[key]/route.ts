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

    return apiNotFound("Entidad no confirmada en Arkiv (puede haber expirado)")
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
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return apiError("Invalid hex format. Key must be 0x followed by 64 hexadecimal characters.", 400)
  }
  return null
}

async function resolveOnChainEntity(entity: ArkivEntity, key: string): Promise<VerifyResponse> {
  const payload = entity.payload
  let linkedEntity: LinkedEntityData | null = null
  let relation: RelationType = null

  if (payload.action === "dispatch" && payload.detectionKey) {
    relation = "dispatch_to_detection"
    linkedEntity = await resolveLinkedEntity(payload.detectionKey as string)
  } else {
    const dbIncident = await findIncidentByKey(key)
    if (dbIncident?.fuente_detalles?.arkiv_entity_key && dbIncident.fuente_detalles.arkiv_entity_key !== key) {
      relation = "detection_to_dispatch"
      linkedEntity = await resolveLinkedEntity(dbIncident.fuente_detalles.arkiv_entity_key as string)
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

async function resolveLinkedEntity(linkedKey: string): Promise<LinkedEntityData | null> {
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

  return null
}

async function findIncidentByKey(key: string): Promise<DbIncident | null> {
  const { data } = await supabase
    .from("incidentes")
    .select("*")
    .or(`fuente_detalles->>arkiv_entity_key.eq.${key},fuente_detalles->ai_analysis->>arkiv_entity_key.eq.${key},fuente_detalles->>detection_arkiv_key.eq.${key}`)
    .maybeSingle()

  return data
}
