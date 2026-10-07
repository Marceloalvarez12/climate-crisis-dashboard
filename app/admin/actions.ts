"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { supabase } from "@/lib/supabase"
import { auditAdmin, requireStaff } from "@/lib/supabase-auth"

const idSchema = z.string().uuid()
const roleSchema = z.enum(["admin", "operador", "agente_ia"])
const operatorSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
})

export interface StaffUser {
  id: string
  name: string
  email: string
  role: "admin" | "operador" | "agente_ia" | "visualizador"
  status: "activo" | "suspendido"
  lastLogin: string | null
}

export async function getUsers(): Promise<StaffUser[]> {
  await requireStaff("admin")
  const { data: profiles, error } = await supabase.from("perfiles")
    .select("id, nombre, rol, status").order("nombre")
  if (error) throw new Error("No se pudieron cargar los perfiles")
  const users = []
  for (let page = 1; page <= 20; page++) {
    const { data, error: authError } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (authError) throw new Error("No se pudieron cargar los usuarios")
    users.push(...data.users)
    if (data.users.length < 100) break
  }
  const byId = new Map(users.map(user => [user.id, user]))
  return (profiles ?? []).map(profile => ({
    id: profile.id,
    name: profile.nombre,
    email: byId.get(profile.id)?.email ?? "",
    role: profile.rol as StaffUser["role"],
    status: profile.status as StaffUser["status"],
    lastLogin: byId.get(profile.id)?.last_sign_in_at ?? null,
  }))
}

export async function createOperator(input: z.infer<typeof operatorSchema>) {
  const { client } = await requireStaff("admin")
  const { nombre, email, password } = operatorSchema.parse(input)
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nombre },
  })
  if (error || !data.user) throw new Error("No se pudo crear el operador")
  const { error: profileError } = await supabase.from("perfiles")
    .update({ rol: "operador", status: "activo" }).eq("id", data.user.id)
    .select("id").single()
  if (profileError) throw new Error("Usuario creado, pero su perfil no pudo activarse. Revisá la configuración de perfiles en Supabase")
  await auditAdmin(client, "create_operator", { user_id: data.user.id, email, nombre })
  revalidatePath("/admin")
}

export async function updateUserRole(userId: string, role: z.infer<typeof roleSchema>) {
  const { client, user } = await requireStaff("admin")
  const id = idSchema.parse(userId)
  const parsedRole = roleSchema.parse(role)
  if (id === user.id) throw new Error("No podés cambiar tu propio rol")
  const { error } = await supabase.from("perfiles").update({ rol: parsedRole }).eq("id", id)
  if (error) throw new Error("No se pudo actualizar el rol")
  await auditAdmin(client, "update_user_role", { user_id: id, role: parsedRole })
  revalidatePath("/admin")
}

export async function suspendUser(userId: string, status: "activo" | "suspendido") {
  const { client, user } = await requireStaff("admin")
  const id = idSchema.parse(userId)
  const parsedStatus = z.enum(["activo", "suspendido"]).parse(status)
  if (id === user.id) throw new Error("No podés suspender tu propia cuenta")
  const { error } = await supabase.from("perfiles").update({ status: parsedStatus }).eq("id", id)
  if (error) throw new Error("No se pudo actualizar el estado")
  await auditAdmin(client, "update_user_status", { user_id: id, status: parsedStatus })
  revalidatePath("/admin")
}

export async function resetUserPassword(userId: string) {
  const { client } = await requireStaff("admin")
  const id = idSchema.parse(userId)
  const { data: target, error } = await supabase.auth.admin.getUserById(id)
  if (error || !target.user?.email) throw new Error("Usuario no encontrado")
  const origin = (await headers()).get("origin")
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(target.user.email, {
    redirectTo: `${origin}/auth/callback?next=/restablecer`,
  })
  if (resetError) throw new Error("No se pudo enviar el enlace de recuperación")
  await auditAdmin(client, "reset_user_password", { user_id: id })
}

export async function getOperatorAssignments(userId: string): Promise<string[]> {
  await requireStaff("admin")
  const { data, error } = await supabase.from("asignaciones_recursos")
    .select("recurso_id").eq("operador_id", idSchema.parse(userId))
  if (error) throw new Error("No se pudieron cargar las asignaciones")
  return (data ?? []).map(row => row.recurso_id)
}

export async function assignResourcesToOperator(userId: string, resourceIds: string[]) {
  const { client } = await requireStaff("admin")
  const id = idSchema.parse(userId)
  const resources = z.array(z.string().min(1).max(100)).max(100).parse(resourceIds)
  const { error } = await client.rpc("replace_operator_resources", {
    p_operator_id: id,
    p_resource_ids: [...new Set(resources)],
  })
  if (error) throw new Error("No se pudieron guardar las asignaciones. Aplicá la migración de seguridad en Supabase")
  revalidatePath("/admin")
}

// ============================================
// CONFIG_SISTEMA (agent control, thresholds, API keys)
// ============================================

export async function getAgentMode(): Promise<boolean> {
  await requireStaff("admin")
  const { data } = await supabase.from("config_sistema")
    .select("valor").eq("clave", "agent_mode").single()
  if (!data) return false
  return (data.valor as { autonomous?: boolean }).autonomous === true
}

export async function updateAgentMode(autonomous: boolean) {
  const { client, user } = await requireStaff("admin")
  const { error } = await supabase.from("config_sistema").upsert({
    clave: "agent_mode",
    valor: { autonomous, updated_by: user.email, updated_at: new Date().toISOString() },
  }, { onConflict: "clave" })
  if (error) throw new Error("No se pudo actualizar el modo del agente")
  await auditAdmin(client, "agent_mode_toggle", { autonomous, ejecutado_por: user.email })
}

export async function getAgentThresholds(): Promise<{ autoResolve: number; confidence: number }> {
  await requireStaff("admin")
  const { data } = await supabase.from("config_sistema")
    .select("clave, valor").in("clave", ["auto_resolve_minutes", "confidence_threshold"])
  const read = (clave: string, fallback: number) => {
    const row = data?.find(r => r.clave === clave)
    const value = (row?.valor as { value?: number } | undefined)?.value
    return typeof value === "number" ? value : fallback
  }
  return { autoResolve: read("auto_resolve_minutes", 5), confidence: read("confidence_threshold", 80) }
}

export async function updateAgentThresholds(autoResolve: number, confidence: number) {
  const { client, user } = await requireStaff("admin")
  const parsed = z.object({
    autoResolve: z.number().int().min(1).max(60),
    confidence: z.number().int().min(50).max(100),
  }).parse({ autoResolve, confidence })
  const stamp = { updated_by: user.email, updated_at: new Date().toISOString() }
  const { error } = await supabase.from("config_sistema").upsert([
    { clave: "auto_resolve_minutes", valor: { value: parsed.autoResolve, ...stamp } },
    { clave: "confidence_threshold", valor: { value: parsed.confidence, ...stamp } },
  ], { onConflict: "clave" })
  if (error) throw new Error("No se pudo guardar la calibración")
  await auditAdmin(client, "update_thresholds", { ...parsed, ejecutado_por: user.email })
}

export async function getApiCredentials(): Promise<Record<string, boolean>> {
  await requireStaff("admin")
  return {
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    gemini: Boolean(process.env.GOOGLE_AI_API_KEY),
    twitter: Boolean(process.env.X_BEARER_TOKEN),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    leaflet: true,
  }
}
