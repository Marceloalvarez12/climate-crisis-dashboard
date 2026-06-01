import { supabase } from "@/lib/supabase"
import { apiSuccess, apiError } from "@/lib/services/api-response"

const STALE_THRESHOLD_MINUTES = 60 / 60

export async function POST() {
  try {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString()

    const { data: staleResources, error: selectError } = await supabase
      .from("recursos")
      .select("*")
      .in("estado", ["dispatched", "busy"])
      .lt("updated_at", staleThreshold)

    if (selectError) return apiError(selectError.message)

    if (!staleResources || staleResources.length === 0) {
      return apiSuccess({ reset: 0, recursos: [] })
    }

    const ids = staleResources.map(r => r.id)
    const { data: updated, error: updateError } = await supabase
      .from("recursos")
      .update({
        estado: "available",
        incidente_id: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .select()

    if (updateError) return apiError(updateError.message)

    console.log(`[auto-reset/recursos] ${updated ? updated.length : 0} resources released:`, ids)

    return apiSuccess({
      reset: updated ? updated.length : 0,
      recursos: updated || [],
    })
  } catch (err) {
    console.error("[auto-reset/recursos] Error:", err)
    const message = err instanceof Error ? err.message : String(err)
    return apiError(message)
  }
}
