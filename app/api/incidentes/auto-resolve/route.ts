import { supabase } from "@/lib/supabase"
import { apiSuccess, apiError } from "@/lib/services/api-response"
import { getConfigNumber } from "@/lib/services/config-service"

export async function POST() {
  try {
    const minutes = await getConfigNumber("auto_resolve_minutes", 5)
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString()

    const { data: stale, error: selectError } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")
      .contains("fuente_detalles", { simulated: true })
      .lt("updated_at", cutoff)

    if (selectError) return apiError(selectError.message)

    if (!stale || stale.length === 0) {
      return apiSuccess({ resolved: 0 })
    }

    const ids = stale.map(i => i.id)
    const { data: updated, error: updateError } = await supabase
      .from("incidentes")
      .update({
        estado: "atendido",
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .select()

    if (updateError) return apiError(updateError.message)

    return apiSuccess({
      resolved: updated ? updated.length : 0,
      locations: (updated || []).map(i => i.ubicacion),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return apiError(message)
  }
}
