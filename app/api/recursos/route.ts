import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
import { ResourcePatchSchema, ResourceCreateSchema } from "@/lib/validation"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import { calculateEstado } from "@/lib/resource-helpers"
import { requireStaff } from "@/lib/supabase-auth"
import type { DbResource } from "@/lib/types"

const RESOURCE_COLS = "id, tipo, nombre, cantidad, cantidad_disponible, estado, ubicacion, incidente_id, updated_at"

export async function GET() {
  try {
    // Tolerante: si la migración de cantidades no se corrió todavía,
    // cae al shape viejo sin romper el dashboard.
    const result = await supabase
      .from("recursos")
      .select(RESOURCE_COLS)
      .neq("estado", "retired")
      .order("tipo", { ascending: true })

    let data = result.data
    if (result.error) {
      const fallback = await supabase
        .from("recursos")
        .select("id, tipo, nombre, estado, ubicacion, incidente_id, updated_at")
        .neq("estado", "retired")
        .order("tipo", { ascending: true })
      if (fallback.error) return apiError(fallback.error.message)
      data = (fallback.data ?? []).map(r => ({ ...r, cantidad: 1, cantidad_disponible: r.estado === "available" ? 1 : 0 }))
    }

    const resources = (data ?? []).map(r => ({
      ...r,
      cantidad: r.cantidad ?? 1,
      cantidad_disponible: r.cantidad_disponible ?? (r.cantidad ?? 1),
    }))
    return apiSuccess(resources)
  } catch (err) {
    return apiError(String(err))
  }
}

export async function POST(request: NextRequest) {
  try {
    try { await requireStaff("admin") } catch { return apiError("Acceso denegado", 403) }
    const parsed = ResourceCreateSchema.safeParse(await request.json())
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { nombre, tipo, cantidad, ubicacion } = parsed.data
    const { data, error } = await supabase
      .from("recursos")
      .insert({ nombre, tipo, cantidad, cantidad_disponible: cantidad, ubicacion, estado: "available" })
      .select(RESOURCE_COLS)
      .single()

    if (error) return apiError(error.message)
    return apiSuccess({ ...data, cantidad: data.cantidad ?? 1, cantidad_disponible: data.cantidad_disponible ?? 1 })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Error interno")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ResourcePatchSchema.safeParse(body)
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const { id, estado, incidente_id, nombre, tipo, cantidad, cantidad_disponible, ubicacion } = parsed.data

    // Edición de ficha (nombre/tipo/cantidad/base) es admin-only; el despacho
    // operativo (estado, incidente_id, cantidad_disponible) lo hace cualquier staff.
    const isEdit = nombre !== undefined || tipo !== undefined || cantidad !== undefined || ubicacion !== undefined || estado === "retired"
    try {
      const { profile } = await requireStaff(isEdit ? "admin" : undefined)
      if (!isEdit && !["admin", "operador"].includes(profile.rol)) return apiError("Acceso denegado", 403)
    } catch { return apiError("Acceso denegado", 403) }

    if (estado === "dispatched") {
      if (cantidad !== undefined || cantidad_disponible !== undefined) return apiValidationError("El despacho y la edición de cantidades requieren acciones separadas")
      if (!incidente_id) return apiValidationError("Se requiere un incidente para despachar el recurso")
      const { data: incident, error } = await supabase.from("incidentes").select("id").eq("id", incidente_id).maybeSingle()
      if (error) return apiError("No se pudo consultar el incidente", 503)
      if (!incident) return apiValidationError("El incidente no existe")
    }

    const updatePayload: Partial<DbResource> = { updated_at: new Date().toISOString() }
    if (estado !== undefined) updatePayload.estado = estado
    if (incidente_id !== undefined) updatePayload.incidente_id = incidente_id
    if (nombre !== undefined) updatePayload.nombre = nombre
    if (tipo !== undefined) updatePayload.tipo = tipo
    if (ubicacion !== undefined) updatePayload.ubicacion = ubicacion
    if (cantidad !== undefined) updatePayload.cantidad = cantidad

    if (cantidad_disponible !== undefined || cantidad !== undefined) {
      const { data: current } = await supabase
        .from("recursos").select("cantidad, cantidad_disponible").eq("id", id).single()
      const total = cantidad ?? current?.cantidad ?? 1
      const disp = cantidad_disponible !== undefined
        ? cantidad_disponible
        : Math.min(current?.cantidad_disponible ?? total, total)
      updatePayload.cantidad_disponible = Math.max(0, Math.min(total, disp))
      updatePayload.estado = calculateEstado(total, updatePayload.cantidad_disponible)
    }

    let updateQuery = supabase
      .from("recursos")
      .update(updatePayload)
      .eq("id", id)
    // Compare-and-set prevents two operators from claiming the same row.
    if (estado === "dispatched") updateQuery = updateQuery.eq("estado", "available")
    const { data, error } = await updateQuery
      .select()
      .maybeSingle()

    if (error) return apiError(error.message)
    if (!data) return apiError("El recurso ya no está disponible o no existe. Actualizá la selección.", 409)
    return apiSuccess(data)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Error interno")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    try { await requireStaff("admin") } catch { return apiError("Acceso denegado", 403) }
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return apiValidationError("ID de recurso requerido")

    const { data, error } = await supabase
      .from("recursos")
      .update({ estado: "retired", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(RESOURCE_COLS)
      .single()

    if (error) return apiError(error.message)
    return apiSuccess(data)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Error interno")
  }
}
