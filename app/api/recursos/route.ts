import { NextResponse } from "next/server"
import { ResourcePatchSchema } from "@/lib/validation"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("recursos")
      .select("*")
      .order("nombre", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()

    const parsed = ResourcePatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { id, estado, incidente_id } = parsed.data

    const updatePayload: Record<string, unknown> = {}
    if (estado !== undefined) updatePayload.estado = estado
    if (incidente_id !== undefined) updatePayload.incidente_id = incidente_id

    const { data, error } = await supabase
      .from("recursos")
      .update({
        ...updatePayload,
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

