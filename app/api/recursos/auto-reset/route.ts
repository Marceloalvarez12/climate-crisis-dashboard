/**
 * app/api/recursos/auto-reset/route.ts
 *
 * Releases resources stuck in "dispatched" or "busy" state.
 *
 * A resource is considered stuck if it has been in a non-available state for more
 * than STALE_THRESHOLD_MINUTES without being updated (old updated_at).
 * This happens when the server restarts or the browser refreshes and
 * the lifecycle setTimeouts are lost without cleaning up the database.
 *
 * POST /api/recursos/auto-reset → resets stuck resources → returns { reset: number, recursos: [] }
 */

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

/** Maximum minutes tolerated in a non-available state before forcing reset. */
const STALE_THRESHOLD_MINUTES = 60 / 60

export async function POST() {
  try {
    // Calculate cutoff timestamp
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString()

    // Find stuck resources in Supabase
    const { data: staleResources, error: selectError } = await supabase
      .from("recursos")
      .select("*")
      .in("estado", ["dispatched", "busy"])
      .lt("updated_at", staleThreshold)

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    if (!staleResources || staleResources.length === 0) {
      return NextResponse.json({ reset: 0, recursos: [] })
    }

    // Reset all to "available"
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

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[auto-reset/recursos] ${updated ? updated.length : 0} resources released:`, ids)

    return NextResponse.json({
      reset: updated ? updated.length : 0,
      recursos: updated || [],
    })
  } catch (err) {
    console.error("[auto-reset/recursos] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

