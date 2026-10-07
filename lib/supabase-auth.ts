import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createAuthClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase Auth no está configurado")

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => {
        try {
          entries.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          return
        }
      },
    },
  })
}

export type StaffRole = "admin" | "operador" | "agente_ia" | "visualizador"

export async function requireStaff(role?: StaffRole) {
  const client = await createAuthClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error("No autorizado")
  const { data: profile, error: profileError } = await client.from("perfiles")
    .select("id, nombre, rol, status").eq("id", user.id).single()
  if (profileError || !profile || profile.status !== "activo") throw new Error("Acceso denegado")
  if (role && profile.rol !== role) throw new Error("Acceso denegado")
  return { client, user, profile }
}

export async function auditAdmin(
  client: Awaited<ReturnType<typeof createAuthClient>>,
  accion: string,
  detalle: Record<string, unknown>,
) {
  const { error } = await client.rpc("registrar_auditoria", { p_accion: accion, p_detalle: detalle })
  if (error) throw new Error("No se pudo registrar la acción administrativa")
}
