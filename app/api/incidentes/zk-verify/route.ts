import { NextRequest } from "next/server"
import { ZkService } from "@/lib/services/zk-service"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import { z } from "zod"

const ZkVerifySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),

})

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const parsed = ZkVerifySchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.errors.map((e) => e.message).join("; "))
    }

    const params = parsed.data
    if (params.lat < -27 || params.lat > -26.5 || params.lng < -65.5 || params.lng > -65) {
      return apiValidationError("La ubicación está fuera de la zona habilitada")
    }

    const { proof, publicSignals } = await ZkService.generateProof({
      lat: params.lat,
      lng: params.lng,
      zoneHash: 12345,
      minLat: -27,
      maxLat: -26.5,
      minLng: -65.5,
      maxLng: -65,
    })

    const valid = await ZkService.verifyProofLocal(proof, publicSignals)
    const { proofArg, pubSignalsArg } = ZkService.proofToContractArgs(proof, publicSignals)

    return apiSuccess({
      valid,
      proof,
      publicSignals,
      contractArgs: {
        proof: JSON.parse(proofArg),
        pubSignals: JSON.parse(pubSignalsArg),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ZK verify failed"
    console.error("[ZK Verify] Error:", message)
    return apiError(message === "ZK_ARTIFACTS_UNAVAILABLE" ? "Verificación de ubicación no disponible" : "No se pudo verificar la ubicación", 503)
  }
}
