import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Auto-resolve any active incident older than 5 minutes in Supabase.
// Called periodically from the client (ai-activity-log useEffect) every 60 seconds.
export async function POST() {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    // Find active incidents whose updated_at is older than 5 minutes
    const { data: stale, error: selectError } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")
      .lt("updated_at", cutoff)

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    if (!stale || stale.length === 0) {
      return NextResponse.json({ resolved: 0 })
    }

    // Mark them as "atendido" (resolved)
    const ids = stale.map(i => i.id)
    const { data: updated, error: updateError } = await supabase
      .from("incidentes")
      .update({
        estado: "atendido",
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .select()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      resolved: updated ? updated.length : 0,
      locations: (updated || []).map(i => i.ubicacion),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

