/**
 * lib/services/resend-service.ts
 *
 * Envío de emails transaccionales vía Resend.
 * Documentación: https://resend.com/docs
 *
 * Variables de entorno requeridas:
 *   RESEND_API_KEY  — API key de resend.com (re env_...)
 *   MAIL_FROM       — remitente verificado (ej: "Zntinel <onboarding@resend.dev>")
 *                     En producción usar un dominio verificado en Resend.
 *
 * Comportamiento si falta configuración: sendMail() retorna { sent: false, reason }
 * — nunca lanza. El envío de email es "nice to have": el reporte ZK debe
 * funcionar aunque el mail falle.
 */

interface SendMailResult {
  sent: boolean
  id?: string
  reason?: string
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM)
}

/**
 * Envía un email HTML+texto. Fire-and-forget friendly: nunca lanza.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM

  if (!apiKey || !from) {
    console.warn("[Resend] MAIL no configurado — envío omitido. Setear RESEND_API_KEY y MAIL_FROM.")
    return { sent: false, reason: "not_configured" }
  }

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({ from, to, subject, html })

    if (error) {
      console.warn("[Resend] API error:", error)
      return { sent: false, reason: error.message ?? "api_error" }
    }
    return { sent: true, id: data?.id }
  } catch (err) {
    console.warn("[Resend] send failed:", err)
    return { sent: false, reason: err instanceof Error ? err.message : "unknown" }
  }
}

/**
 * Template del mail de confirmación de reporte ZK.
 */
export function buildReportConfirmationEmail(opts: {
  incidentId: string
  txHash: string
  auditUrl: string
  trackingUrl: string
  tipo: string
  severidad: string
  ubicacion: string
}): { subject: string; html: string } {
  const subject = `Zntinel — Reporte ZK registrado (${opts.incidentId.slice(0, 8)})`

  const html = `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#0a0c10;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;color:#e5e7eb;">
    <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #1f2937;">
      <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Zntinel · Climate Crisis Center</p>
      <h1 style="margin:8px 0 0;font-size:22px;color:#f9fafb;">Reporte ZK registrado</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#34d399;">Tu proof fue verificado y sellado</p>
    </div>

    <div style="padding:24px 0;">
      <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#818cf8;">Tracking ID</p>
      <p style="margin:0 0 20px;font-family:monospace;font-size:13px;color:#e5e7eb;word-break:break-all;background:#111827;border:1px solid #374151;border-radius:8px;padding:12px;">${opts.incidentId}</p>

      <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#818cf8;">Proof hash (Stellar)</p>
      <p style="margin:0 0 20px;font-family:monospace;font-size:12px;color:#a5b4fc;word-break:break-all;background:#111827;border:1px solid #374151;border-radius:8px;padding:12px;">${opts.txHash}</p>

      <table style="width:100%;font-size:12px;color:#9ca3af;margin-bottom:20px;">
        <tr><td style="padding:4px 0;">Tipo</td><td style="text-align:right;color:#e5e7eb;text-transform:capitalize;">${opts.tipo}</td></tr>
        <tr><td style="padding:4px 0;">Severidad</td><td style="text-align:right;color:#e5e7eb;text-transform:capitalize;">${opts.severidad}</td></tr>
        <tr><td style="padding:4px 0;">Ubicación</td><td style="text-align:right;color:#e5e7eb;">${opts.ubicacion}</td></tr>
      </table>

      <a href="${opts.auditUrl}" style="display:block;background:#059669;color:#ffffff;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:10px;">Verificar estado en portal Braga</a>
      <a href="${opts.trackingUrl}" style="display:block;background:#1f2937;color:#e5e7eb;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">Seguimiento en vivo</a>
    </div>

    <div style="border-top:1px solid #1f2937;padding-top:16px;">
      <p style="margin:0;font-size:10px;color:#6b7280;line-height:1.6;">
        Guardá este mail. Con el Tracking ID o el Proof hash podés auditar tu reporte
        en cualquier momento en el portal de auditoría de Zntinel — sin necesidad de
        cuenta ni login. La ubicación exacta nunca fue revelada: solo se demostró
        criptográficamente (Groth16) que estás dentro de la zona de riesgo oficial.
      </p>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}
