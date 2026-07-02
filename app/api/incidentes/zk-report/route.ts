import { NextRequest } from "next/server"
import * as crypto from "crypto"
import { ZkService } from "@/lib/services/zk-service"
import { StellarService } from "@/lib/services/stellar-service"
import { IncidentService } from "@/lib/services/incident-service"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import { z } from "zod"

const ZkReportSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  tipo: z.enum(["flood", "fire", "storm", "looting", "violence", "accident", "general"]),
  severidad: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  ubicacion: z.string().min(2).max(200),
  personasAfectadas: z.number().int().min(0).default(0),
  descripcion: z.string().max(500).optional(),
  zoneHash: z.number().int().default(12345),
  minLat: z.number().default(-27.0),
  maxLat: z.number().default(-26.5),
  minLng: z.number().default(-65.5),
  maxLng: z.number().default(-65.0),
})

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const secret = request.headers.get("x-api-secret") || new URL(request.url).searchParams.get("secret")
    if (secret !== process.env.API_SECRET) {
      return apiError("Unauthorized", 401)
    }

    const body = await request.json()
    const parsed = ZkReportSchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.errors.map((e) => e.message).join("; "))
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "true"

    const params = parsed.data
    const incidentId = crypto.randomUUID()

    const { proof, publicSignals, input } = await ZkService.generateProof({
      lat: params.lat,
      lng: params.lng,
      zoneHash: params.zoneHash,
      minLat: params.minLat,
      maxLat: params.maxLat,
      minLng: params.minLng,
      maxLng: params.maxLng,
    })

    const { proofArg } = ZkService.proofToContractArgs(proof, publicSignals)
    const contractProof = JSON.parse(proofArg)

    // Submit the verification on-chain to the deployed Soroban contract.
    // This creates a real Stellar transaction with a hash that proves the
    // audit happened on-chain. If the contract is not configured we fall
    // back to a local ZK verification so the demo still works offline.
    const verifyOnChain = !StellarService.isSimulatedMode()
    let verifyResult: { valid: boolean; txHash?: string; error?: string; isSimulated: boolean }
    let stellarAudit: ReturnType<typeof StellarService.buildAuditFromIncident>["entry"] | null = null

    if (verifyOnChain) {
      try {
        const audit = await StellarService.verifyAndStore(incidentId, {
          proof: contractProof,
          pubSignals: publicSignals,
        })
        verifyResult = { valid: audit.verified, txHash: audit.txHash, isSimulated: false }
        stellarAudit = audit
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return apiError(`Stellar on-chain verification failed: ${message}`, 502)
      }
    } else {
      const localResult = await StellarService.verifyProof({
        proof: contractProof,
        pubSignals: publicSignals,
      })
      verifyResult = { valid: localResult.valid, isSimulated: true, error: localResult.error }
    }

    if (!verifyResult.valid) {
      return apiError(`ZK proof verification failed: ${verifyResult.error || "invalid proof"}`, 400)
    }

    const audit = stellarAudit
      ?? (() => {
          const { entry, journalDigest } = StellarService.buildAuditFromIncident(
            incidentId,
            contractProof,
            publicSignals
          )
          return { ...entry, verified: true, journalDigest }
        })()

    const auditWithDispatch = {
      ...audit,
      verified: true,
      dispatchedAt: new Date().toISOString(),
    }

    if (dryRun) {
      return apiSuccess({
        incidentId,
        audit: auditWithDispatch,
        verified: true,
        contractId: auditWithDispatch.contractId,
        explorerUrl: auditWithDispatch.explorerUrl,
        txHash: auditWithDispatch.txHash,
        dryRun: true,
      })
    }

    const incident = await IncidentService.create({
      tipo: params.tipo,
      severidad: params.severidad,
      ubicacion: params.ubicacion,
      latitud: params.lat,
      longitud: params.lng,
      personas_afectadas: params.personasAfectadas,
      fuente: "citizen",
      estado: "activo",
      fuente_detalles: {
        descripcion: params.descripcion,
        zk_proof: contractProof,
        zk_public_signals: publicSignals,
        zk_input: input,
        stellar_audit: auditWithDispatch,
      },
    })

    return apiSuccess({
      incident,
      audit: auditWithDispatch,
      verified: true,
      contractId: auditWithDispatch.contractId,
      explorerUrl: auditWithDispatch.explorerUrl,
      txHash: auditWithDispatch.txHash,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ZK report failed"
    console.error("[ZK Report] Error:", message)
    return apiError(message, 500)
  }
}
