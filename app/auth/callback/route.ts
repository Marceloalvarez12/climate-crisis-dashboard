import { NextResponse, type NextRequest } from "next/server"
import { createAuthClient } from "@/lib/supabase-auth"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") === "/restablecer" ? "/restablecer" : "/"
  if (code) {
    try {
      const supabase = await createAuthClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(new URL(next, origin))
    } catch {
      return NextResponse.redirect(new URL("/login?error=unavailable", origin))
    }
  }
  return NextResponse.redirect(new URL("/login?error=invalid_credentials", origin))
}
