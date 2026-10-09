import { NextRequest } from "next/server"
import * as crypto from "crypto"
import { requireStaff } from "@/lib/supabase-auth"
import { ZkService } from "@/lib/services/zk-service"
import { StellarService } from "@/lib/services/stellar-service"
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
  contacto: z.string().email().optional(),

})

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const parsed = ZkReportSchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.errors.map((e) => e.message).join("; "))
    }

    const dryRun = new URL(request.url).searchParams.get("dryRun") === "true"
    if (dryRun && process.env.NODE_ENV !== "development") return apiError("No disponible", 403)
    if (dryRun && !(await hasOperatorAccess(request))) return apiError("No autorizado", 401)

    const params = parsed.data
    if (params.lat < -27 || params.lat > -26.5 || params.lng < -65.5 || params.lng > -65) {
      return apiValidationError("La ubicación está fuera de la zona habilitada")
    }
    const incidentId = crypto.randomUUID()

    const { proof, publicSignals } = await ZkService.generateProof({
      lat: params.lat,
      lng: params.lng,
      zoneHash: 12345,
      minLat: -27,
      maxLat: -26.5,
      minLng: -65.5,
      maxLng: -65,
    })

    const { proofArg } = ZkService.proofToContractArgs(proof, publicSignals)
    const contractProof = JSON.parse(proofArg)

    // Submit the verification on-chain to the deployed Soroban contract.
    // If the contract is not configured OR the on-chain call fails for any
    // reason (RPC outage, contract error, network timeout, etc.) we silently
    // fall back to a local ZK verification so the citizen experience never
    // breaks because of upstream infra issues.
    const locallyVerified = await ZkService.verifyProofLocal(proof, publicSignals)
    if (!locallyVerified) return apiError("La prueba de ubicación no es válida", 400)

    let stellarAudit: ReturnType<typeof StellarService.buildAuditFromIncident>["entry"] | null = null
    if (!dryRun && !StellarService.isSimulatedMode()) {
      try {
        stellarAudit = await StellarService.verifyAndStore(incidentId, {
          proof: contractProof,
          pubSignals: publicSignals,
        })
        if (!stellarAudit.verified) return apiError("La verificación en cadena fue rechazada", 400)
      } catch (err) {
        // On-chain call failed — log server-side and fall back to local
        // verification rather than surfacing the error to the citizen.
        console.error("[ZK Report] No se pudo confirmar en Stellar:", err)
      }
    }

    const audit = stellarAudit ?? (() => {
      const { entry, journalDigest } = StellarService.buildAuditFromIncident(incidentId, contractProof, publicSignals)
      return { ...entry, verified: true, isSimulated: false, journalDigest, explorerUrl: "" }
    })()

    // El fallback local construye su propio audit sin txHash — preservar el
    // hash determinístico de verifyResult para que el ciudadano siempre
    // tenga un comprobante auditable, incluso sin contrato configurado.
    const auditWithDispatch = { ...audit, verified: true, onChain: Boolean(stellarAudit?.txHash) }
    const publicAudit = {
      verified: true,
      onChain: auditWithDispatch.onChain,
      journalDigest: auditWithDispatch.journalDigest,
      txHash: auditWithDispatch.txHash,
      explorerUrl: auditWithDispatch.onChain ? auditWithDispatch.explorerUrl : undefined,
      contractId: auditWithDispatch.onChain ? auditWithDispatch.contractId : undefined,
    }

    if (dryRun) {
      return apiSuccess({
        incidentId,
        audit: publicAudit,
        verified: true,
        contractId: publicAudit.contractId,
        explorerUrl: publicAudit.explorerUrl,
        txHash: publicAudit.txHash,
        dryRun: true,
      })
    }

    // Import perezoso: lib/supabase.ts lanza si faltan credenciales, y no
    // queremos que eso rompa la validación ni el modo dryRun del reporte.
    const { IncidentService } = await import("@/lib/services/incident-service")
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
        contacto: params.contacto,
        zk_proof: contractProof,
        zk_public_signals: publicSignals,
        stellar_audit: auditWithDispatch,
      },
    })

    // ── Enviar hash + link de auditoría por email ──
    // El mail es conveniencia: si falla, el reporte ya existe y el front
    // muestra el hash de todas formas. Esperamos hasta 5s para poder
    // informar el status al usuario; después de eso seguimos sin el mail.
    let mailStatus: "sent" | "failed" | undefined
    if (params.contacto) {
      try {
        const origin = new URL(request.url).origin
        const { buildReportConfirmationEmail, sendMail } = await import("@/lib/services/resend-service")
        const mail = buildReportConfirmationEmail({
          incidentId: incident.id,
          txHash: auditWithDispatch.txHash,
          onChain: auditWithDispatch.onChain,
          auditUrl: auditWithDispatch.txHash ? `${origin}/auditoria?key=${auditWithDispatch.txHash}` : undefined,
          trackingUrl: `${origin}/seguimiento/${incident.id}`,
          tipo: params.tipo,
          severidad: params.severidad,
          ubicacion: params.ubicacion,
        })
        const result = await Promise.race([
          sendMail(params.contacto, mail.subject, mail.html),
          new Promise<{ sent: false; reason: string }>((resolve) =>
            setTimeout(() => resolve({ sent: false, reason: "timeout_5s" }), 5000),
          ),
        ])
        mailStatus = result.sent ? "sent" : "failed"
        if (!result.sent) console.warn(`[ZK Report] Confirmación por correo falló: ${result.reason}`)
      } catch (mailErr) {
        console.warn("[ZK Report] Mail error:", mailErr)
        mailStatus = "failed"
      }
    }

    return apiSuccess({
      incident: { id: incident.id },
      audit: publicAudit,
      verified: true,
      contractId: publicAudit.contractId,
      explorerUrl: publicAudit.explorerUrl,
      txHash: publicAudit.txHash,
      mail: mailStatus,
      mailTo: mailStatus ? params.contacto : undefined,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ZK report failed"
    console.error("[ZK Report] Error:", message)
    return apiError(message === "ZK_ARTIFACTS_UNAVAILABLE" ? "Verificación de ubicación no disponible" : "No se pudo procesar el reporte", 503)
  }
}

async function hasOperatorAccess(request: NextRequest): Promise<boolean> {
  const supplied = request.headers.get("x-api-secret")
  const configured = process.env.API_SECRET
  if (supplied && configured) {
    const left = Buffer.from(supplied)
    const right = Buffer.from(configured)
    if (left.length === right.length && crypto.timingSafeEqual(left, right)) return true
  }
  try {
    await requireStaff()
    return true
  } catch {
    return false
  }
}
