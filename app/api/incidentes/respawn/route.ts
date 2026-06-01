import { supabase } from "@/lib/supabase"
import { buildRespawnIncident } from "@/lib/mock-data"
import { apiSuccess, apiError } from "@/lib/services/api-response"

const MAX_ACTIVE_INCIDENTS = 6

export async function POST() {
  try {
    const { data: activeIncidents, error: selectError } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")

    if (selectError) return apiError(selectError.message)

    const activeCount = activeIncidents ? activeIncidents.length : 0

    if (activeCount >= MAX_ACTIVE_INCIDENTS) {
      return apiSuccess({ respawned: false, reason: "max_active_reached" })
    }

    const newIncidentData = buildRespawnIncident()

    const activeLocations = new Set((activeIncidents || []).map(inc => inc.ubicacion))
    if (activeLocations.has(newIncidentData.ubicacion)) {
      return apiSuccess({ respawned: false, reason: "no_locations_available" })
    }

    const { data: inserted, error: insertError } = await supabase
      .from("incidentes")
      .insert({
        ...newIncidentData,
        estado: "activo",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) return apiError(insertError.message)

    return apiSuccess({ respawned: true, incident: inserted })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return apiError(message)
  }
}
