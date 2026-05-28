import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { buildRespawnIncident } from "@/lib/mock-data"

const MAX_ACTIVE_INCIDENTS = 6

/**
 * POST /api/incidentes/respawn
 *
 * Picks one resolved ("atendido") incident at random and reactivates it by
 * giving it a completely new random location, type, and source from the mock-data.
 * It ensures that the chosen location doesn't already have an active incident.
 */
export async function POST() {
  try {
    // 1. Guard: don't respawn if we already have enough active incidents in Supabase
    const { data: activeIncidents, error: selectError } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    const activeCount = activeIncidents ? activeIncidents.length : 0
    
    if (activeCount >= MAX_ACTIVE_INCIDENTS) {
      return NextResponse.json({ respawned: false, reason: "max_active_reached" })
    }

    // 2. Generate a new incident data
    const newIncidentData = buildRespawnIncident()
    
    // 3. Check if location is already active
    const activeLocations = new Set((activeIncidents || []).map(inc => inc.ubicacion))
    if (activeLocations.has(newIncidentData.ubicacion)) {
      return NextResponse.json({ respawned: false, reason: "no_locations_available" })
    }

    // 4. Create new incident in Supabase
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

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ respawned: true, incident: inserted })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

