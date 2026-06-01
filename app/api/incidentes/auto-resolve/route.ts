import { supabase } from "@/lib/supabase"
import { apiSuccess, apiError } from "@/lib/services/api-response"

export async function POST() {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: stale, error: selectError } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")
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
