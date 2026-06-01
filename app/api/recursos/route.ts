import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
import { ResourcePatchSchema } from "@/lib/validation"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import type { DbResource } from "@/lib/types"

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("recursos")
      .select("*")
      .order("nombre", { ascending: true })

    if (error) return apiError(error.message)
    return apiSuccess(data || [])
  } catch (err) {
    return apiError(String(err))
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = ResourcePatchSchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const { id, estado, incidente_id } = parsed.data

    const updatePayload: Partial<DbResource> = { updated_at: new Date().toISOString() }
    if (estado !== undefined) updatePayload.estado = estado
    if (incidente_id !== undefined) updatePayload.incidente_id = incidente_id

    const { data, error } = await supabase
      .from("recursos")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (error) return apiError(error.message)
    return apiSuccess(data)
  } catch (err) {
    return apiError(String(err))
  }
}
