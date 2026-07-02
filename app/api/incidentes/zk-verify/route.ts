import { NextRequest } from "next/server"
import { ZkService } from "@/lib/services/zk-service"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import { z } from "zod"

const ZkVerifySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  zoneHash: z.number().int().default(12345),
  minLat: z.number().default(-27.0),
  maxLat: z.number().default(-26.5),
  minLng: z.number().default(-65.5),
  maxLng: z.number().default(-65.0),
})

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const parsed = ZkVerifySchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.errors.map((e) => e.message).join("; "))
    }

    const params = parsed.data

    const { proof, publicSignals, input } = await ZkService.generateProof({
      lat: params.lat,
      lng: params.lng,
      zoneHash: params.zoneHash,
      minLat: params.minLat,
      maxLat: params.maxLat,
      minLng: params.minLng,
      maxLng: params.maxLng,
    })

    const valid = await ZkService.verifyProofLocal(proof, publicSignals)
    const { proofArg, pubSignalsArg } = ZkService.proofToContractArgs(proof, publicSignals)

    return apiSuccess({
      valid,
      proof,
      publicSignals,
      input,
      contractArgs: {
        proof: JSON.parse(proofArg),
        pubSignals: JSON.parse(pubSignalsArg),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ZK verify failed"
    console.error("[ZK Verify] Error:", message)
    return apiError(message, 500)
  }
}
