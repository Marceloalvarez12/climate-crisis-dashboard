import type { DbIncident } from "@/lib/types"
import type { DispatchPayload } from "@/lib/services/arkiv-service"

export function buildDispatchPayload(incident: DbIncident, operator: string, dispatchedAt: string): DispatchPayload {
  const details = incident.fuente_detalles
  const analysis = details.ai_analysis && typeof details.ai_analysis === "object" ? details.ai_analysis as Record<string, unknown> : undefined
  const candidate = details.detection_arkiv_key ?? analysis?.arkiv_entity_key ?? details.arkiv_entity_key
  return {
    action: "dispatch", incidentId: incident.id,
    detectionKey: typeof candidate === "string" && /^0x[0-9a-fA-F]{64}$/.test(candidate) ? candidate : null,
    tipo: incident.tipo, severidad: incident.severidad,
    // Blockchain payloads are public and cannot be redacted after publication.
    ubicacion: incident.fuente === "citizen" ? "Reporte ciudadano · zona aproximada" : incident.ubicacion,
    afectados: incident.personas_afectadas, operator, dispatchedAt,
  }
}
