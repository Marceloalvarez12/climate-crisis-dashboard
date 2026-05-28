import { NextResponse } from "next/server"
import { IncidentCreateSchema, IncidentPatchSchema } from "@/lib/validation"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

const MAX_ACTIVE_INCIDENTS = 11

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = IncidentCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const validatedBody = parsed.data

    // Check if incident with same location already exists
    const { data: existingIncidents, error: findError } = await supabase
      .from("incidentes")
      .select("*")
      .eq("ubicacion", validatedBody.ubicacion)

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }

    const existing = existingIncidents && existingIncidents.length > 0 ? existingIncidents[0] : null

    if (existing) {
      if (existing.estado !== "activo") {
        // Count active incidents
        const { count, error: countError } = await supabase
          .from("incidentes")
          .select("*", { count: "exact", head: true })
          .eq("estado", "activo")

        if (countError) {
          return NextResponse.json({ error: countError.message }, { status: 500 })
        }

        const activeCount = count || 0
        if (activeCount >= MAX_ACTIVE_INCIDENTS) {
          return NextResponse.json({ skipped: true, reason: "max_active_reached" }, { status: 200 })
        }

        const { data: data, error: updateError } = await supabase
          .from("incidentes")
          .update({
            ...validatedBody,
            estado: "activo",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single()

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        return NextResponse.json(data)
      }
      return NextResponse.json(existing)
    }

    // Count active incidents for new insert
    const { count, error: countError } = await supabase
      .from("incidentes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo")

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    const activeCount = count || 0
    if (activeCount >= MAX_ACTIVE_INCIDENTS) {
      return NextResponse.json({ skipped: true, reason: "max_active_reached" }, { status: 200 })
    }

    const { data: data, error: insertError } = await supabase
      .from("incidentes")
      .insert({
        ...validatedBody,
        fuente_detalles: validatedBody.fuente_detalles ?? {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()

    const parsed = IncidentPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { id, ...updates } = parsed.data

    const { data, error } = await supabase
      .from("incidentes")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

