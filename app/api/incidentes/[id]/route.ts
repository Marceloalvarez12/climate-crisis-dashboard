import { NextRequest } from "next/server"
import { IncidentService } from "@/lib/services/incident-service"
import { apiSuccess, apiError, apiNotFound } from "@/lib/services/api-response"
import { publicStellarAudit } from "@/lib/public-audit"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const incident = await IncidentService.findById(id)
    if (!incident) {
      return apiNotFound("Incident")
    }
    const audit = publicStellarAudit(incident.fuente_detalles?.stellar_audit)
    const dispatchKey = incident.fuente_detalles?.arkiv_entity_key
    return apiSuccess({
      id: incident.id,
      tipo: incident.tipo,
      severidad: incident.severidad,
      estado: incident.estado,
      fuente: incident.fuente,
      created_at: incident.created_at,
      updated_at: incident.updated_at,
      personas_afectadas: incident.personas_afectadas,
      arkiv_entity_key: incident.fuente_detalles?.arkiv_audit_status === "confirmed" && typeof dispatchKey === "string" && /^0x[0-9a-f]{64}$/i.test(dispatchKey) ? dispatchKey : undefined,
      ubicacion: incident.fuente === "citizen" ? "Reporte ciudadano · zona aproximada" : incident.ubicacion,
      latitud: incident.fuente === "citizen" ? Math.round(incident.latitud * 100) / 100 : incident.latitud,
      longitud: incident.fuente === "citizen" ? Math.round(incident.longitud * 100) / 100 : incident.longitud,
      fuente_detalles: audit ? { stellar_audit: audit } : {},
    })
  } catch (err) {
    console.error("[incidentes/[id]] GET error:", err)
    return apiError("No se pudo consultar el reporte", 500)
  }
}
