import { NextRequest } from "next/server"
import { StellarService, type StellarVerifyInput } from "@/lib/services/stellar-service"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import { z } from "zod"

const VerifySchema = z.object({
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
    const parsed = VerifySchema.safeParse(body)

    if (!parsed.success) {
      return apiValidationError(parsed.error.errors.map((e) => e.message).join("; "))
    }

    const input: StellarVerifyInput = {
      proof: parsed.data.proof,
      pubSignals: parsed.data.pubSignals,
    }

    const result = await StellarService.verifyProof(input)
    return apiSuccess(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Stellar verification failed"
    console.error("[Stellar Verify] Error:", message)
    return apiError(message, 500)
  }
}
