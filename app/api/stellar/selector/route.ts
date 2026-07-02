import { StellarService } from "@/lib/services/stellar-service"
import { CONFIG } from "@/lib/config"
import { apiSuccess, apiError } from "@/lib/services/api-response"

export async function GET(): Promise<Response> {
  try {
    return apiSuccess({
      selector: "verify_proof",
      contractId: CONFIG.STELLAR.VERIFIER_CONTRACT_ID,
      explorerUrl: StellarService.explorerUrlForContract(),
      network: CONFIG.STELLAR.NETWORK,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch selector"
    console.error("[Stellar Selector] Error:", message)
    return apiError(message, 500)
  }
}
