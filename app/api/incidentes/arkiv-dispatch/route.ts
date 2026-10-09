import { NextRequest } from "next/server"
import { IncidentService } from "@/lib/services/incident-service"
import { ArkivService } from "@/lib/services/arkiv-service"
import { StellarService, type Groth16Proof } from "@/lib/services/stellar-service"
import { apiSuccess, apiError, apiNotFound, apiValidationError } from "@/lib/services/api-response"
import { withTimeout } from "@/lib/services/with-timeout"
import { buildDispatchPayload } from "@/lib/dispatch-payload"
import { IncidentDispatchSchema } from "@/lib/validation"
import { CONFIG } from "@/lib/config"
import { isNonReportIncident, type DbIncident, type ArkivDispatchResponse } from "@/lib/types"

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const parsed = IncidentDispatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiValidationError(parsed.error.flatten())
    const incident = await IncidentService.findById(parsed.data.id)
    if (!incident || isNonReportIncident(incident)) return apiNotFound("Incident")

    const dispatchedAt = new Date().toISOString()
    const priorKey = incident.fuente_detalles.arkiv_entity_key
    let entityKey: string | undefined
    if (incident.fuente_detalles.arkiv_audit_status === "confirmed" && typeof priorKey === "string" && ArkivService.isValidEntityKey(priorKey)) {
      entityKey = priorKey
    } else if (ArkivService.isConfigured()) {
      try {
        const { privateKeyToAccount } = await import("@arkiv-network/sdk/accounts")
        const operator = privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY as `0x${string}`).address
        const payload = buildDispatchPayload(incident, operator, dispatchedAt)
        const result = await withTimeout(ArkivService.createDispatchEntity(payload, [
          { key: "project", value: "climate-crisis-dashboard" },
          { key: "tipo", value: payload.tipo }, { key: "severidad", value: payload.severidad },
          { key: "ubicacion", value: payload.ubicacion }, { key: "status", value: "dispatched" },
          ...(payload.detectionKey ? [{ key: "detectionKey", value: payload.detectionKey }] : []),
        ]), CONFIG.INCIDENTS.BLOCKCHAIN_TIMEOUT_MS, "Arkiv")
        if (!result.isSimulated && result.entityKey && ArkivService.isValidEntityKey(result.entityKey)) entityKey = result.entityKey
      } catch (error) {
        // Resource dispatch stays valid, but no fabricated blockchain receipt.
        console.warn("[Arkiv Dispatch] Blockchain not confirmed:", error)
      }
    }
    const payload = buildDispatchPayload(incident, "", dispatchedAt)
    const [lease, stellarAudit] = await Promise.all([
      payload.detectionKey
        ? withTimeout(ArkivService.extendLease(payload.detectionKey, CONFIG.INCIDENTS.DISPATCH_LEASE_SECONDS), CONFIG.INCIDENTS.BLOCKCHAIN_TIMEOUT_MS, "Arkiv lease").catch(() => false)
        : Promise.resolve(false),
      getStellarAudit(incident),
    ])
    const details = {
      ...incident.fuente_detalles,
      ...(entityKey ? { arkiv_entity_key: entityKey, arkiv_is_simulated: false } : {}),
      detection_arkiv_key: payload.detectionKey,
      dispatched_at: dispatchedAt, lease_extended: lease,
      arkiv_audit_status: entityKey ? "confirmed" : "unavailable",
      ...(stellarAudit ? { stellar_audit: stellarAudit } : {}),
    }
    await IncidentService.update(incident.id, { estado: "atendido", fuente_detalles: details })
    const response: ArkivDispatchResponse = { success: true, onChain: Boolean(entityKey), entityKey, isSimulated: !entityKey, stellarAudit: stellarAudit ?? undefined }
    return apiSuccess(response)
  } catch (error) {
    console.error("[Arkiv Dispatch] Could not record dispatch:", error)
    return apiError("No se pudo registrar la auditoría del despacho", 503)
  }
}

async function getStellarAudit(incident: DbIncident): Promise<Record<string, unknown> | null> {
  const previous = incident.fuente_detalles.stellar_audit
  // Preserve the citizen report receipt, including its confirmed transaction.
  if (previous && typeof previous === "object" && !Array.isArray(previous)) return previous as Record<string, unknown>
  const proof = incident.fuente_detalles.zk_proof as Groth16Proof | undefined
  const signals = incident.fuente_detalles.zk_public_signals
  if (!proof?.a || !proof.b || !proof.c || !Array.isArray(signals) || !signals.every(s => typeof s === "string")) return null
  try {
    const result = await withTimeout(StellarService.verifyProof({ proof, pubSignals: signals }), CONFIG.INCIDENTS.BLOCKCHAIN_TIMEOUT_MS, "Stellar")
    const { entry, journalDigest } = StellarService.buildAuditFromIncident(incident.id, proof, signals)
    // A read-only verification does not create a blockchain transaction.
    return { ...entry, verified: result.valid, onChain: false, explorerUrl: "", journalDigest }
  } catch (error) {
    console.warn("[Arkiv Dispatch] ZK verification unavailable:", error)
    return null
  }
}
