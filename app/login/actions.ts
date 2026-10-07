"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createAuthClient } from "@/lib/supabase-auth"

const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
})

export async function login(form: FormData) {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") })
  if (!parsed.success) redirect("/login?error=invalid_credentials")
  let client
  try {
    client = await createAuthClient()
  } catch {
    redirect("/login?error=unavailable")
  }
  const { data, error } = await client.auth.signInWithPassword(parsed.data)
  if (error || !data.user) redirect("/login?error=invalid_credentials")
  const { data: profile } = await client.from("perfiles")
    .select("rol, status").eq("id", data.user.id).single()
  if (!profile || profile.status !== "activo") {
    await client.auth.signOut()
    redirect("/login?error=suspended")
  }
  redirect(profile.rol === "admin" ? "/admin" : "/")
}

export async function logout() {
  const client = await createAuthClient()
  await client.auth.signOut()
  redirect("/login")
}

export async function requestPasswordReset(form: FormData) {
  const parsed = z.string().trim().email().max(254).safeParse(form.get("email"))
  if (parsed.success) {
    try {
      const client = await createAuthClient()
      const origin = (await headers()).get("origin")
      await client.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${origin}/auth/callback?next=/restablecer`,
      })
    } catch {
      redirect("/recuperar?error=unavailable")
    }
  }
  redirect("/recuperar?sent=1")
}

export async function updatePassword(form: FormData) {
  const parsed = z.object({
    password: z.string().min(12).max(128),
    confirm: z.string().min(1).max(128),
  }).safeParse({ password: form.get("password"), confirm: form.get("confirm") })
  if (!parsed.success) redirect("/restablecer?error=invalid")
  if (parsed.data.password !== parsed.data.confirm) redirect("/restablecer?error=invalid")
  const client = await createAuthClient()
  const { error } = await client.auth.updateUser({ password: parsed.data.password })
  if (error) redirect("/restablecer?error=expired")
  await client.auth.signOut()
  redirect("/login?reset=1")
}
