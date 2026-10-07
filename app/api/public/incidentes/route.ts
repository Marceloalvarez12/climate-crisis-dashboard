import { apiSuccess, apiError } from "@/lib/services/api-response"
import { isNonReportIncident } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * GET /api/public/incidentes
 *
 * Endpoint público y de solo lectura para el mapa ciudadano (/mapa).
 * Devuelve únicamente los campos necesarios para dibujar marcadores:
 * NO expone fuente_detalles (datos de autores, razonamiento de IA,
 * corroboraciones ni claves on-chain internas).
 *
 * Es público por diseño: está listado en PUBLIC_PATHS del middleware y
 * sólo pasa por el rate limit global.
 */
export async function GET() {
  try {
    const { supabase } = await import("@/lib/supabase")

    const { data, error } = await supabase
      .from("incidentes")
      .select("id, tipo, severidad, ubicacion, latitud, longitud, personas_afectadas, fuente, fuente_detalles, estado, created_at")
      .eq("estado", "activo")
      .order("created_at", { ascending: false })
      .limit(1000)

    if (error) {
      console.error("[Public incidents] Query failed:", error)
      return apiError("No se pudieron cargar los incidentes", 503)
    }

    const incidents = (data ?? []).filter(i => !isNonReportIncident(i)).slice(0, 50).map((i) => ({
      id:                 i.id,
      tipo:               i.tipo,
      severidad:          i.severidad,
      ubicacion:          i.fuente === "citizen" ? "Reporte ciudadano · zona aproximada" : i.ubicacion,
      latitud:            i.fuente === "citizen" ? Math.round(i.latitud * 100) / 100 : i.latitud,
      longitud:           i.fuente === "citizen" ? Math.round(i.longitud * 100) / 100 : i.longitud,
      personas_afectadas: i.personas_afectadas,
      fuente:             i.fuente,
      // Las detecciones sociales aún no validadas se señalan al público
      pendiente_validacion: i.fuente === "social",
      created_at:         i.created_at,
    }))

    return apiSuccess(
      { updatedAt: new Date().toISOString(), incidents },
      200,
    )
  } catch (err) {
    console.error("[Public incidents] Unavailable:", err)
    return apiError("No se pudieron cargar los incidentes", 503)
  }
}
