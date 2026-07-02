import { NextRequest } from "next/server"
import { StellarService, type StellarAuditEntry } from "@/lib/services/stellar-service"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import { CONFIG } from "@/lib/config"
import { z } from "zod"
import * as crypto from "crypto"

const AuditSchema = z.object({
  incidentId: z.string().min(1),
  proof: z.object({
    a: z.string().length(128),
    b: z.string().length(256),
    c: z.string().length(128),
  }),
  pubSignals: z.array(z.string().min(1)).min(1),
})

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const parsed = AuditSchema.safeParse(body)

    if (!parsed.success) {
      return apiValidationError(parsed.error.errors.map((e) => e.message).join("; "))
    }

    const { incidentId, proof, pubSignals } = parsed.data

    const verifyResult = await StellarService.verifyProof({ proof, pubSignals })

    const journalDigest = crypto.createHash("sha256").update(pubSignals.join(":")).digest("hex")
    const auditHash = crypto
      .createHash("sha256")
      .update(`${incidentId}:${journalDigest}:${Date.now()}`)
      .digest("hex")

    const entry: StellarAuditEntry = {
      hash: auditHash,
      incidentId,
      contractId: CONFIG.STELLAR.VERIFIER_CONTRACT_ID,
      proof,
      pubSignals,
      verified: verifyResult.valid,
      network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
      explorerUrl: StellarService.explorerUrlForContract(),
      isSimulated: verifyResult.isSimulated,
    }

    return apiSuccess(entry)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Stellar audit failed"
    console.error("[Stellar Audit] Error:", message)
    return apiError(message, 500)
  }
}
