import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { checkRateLimit } from "@/lib/rate-limit"

const PUBLIC_PAGES = [
  "/login", "/recuperar", "/restablecer", "/auth/callback",
  "/mapa", "/reportar", "/seguimiento", "/auditoria", "/stellar-auditoria",
]
const PUBLIC_APIS = [
  "/api/analytics", "/api/incidentes/arkiv-verify", "/api/stellar",
  "/api/incidentes/zk-verify", "/api/incidentes/zk-report",
  "/api/layers", "/api/public",
]
const SERVICE_APIS = ["/api/agent", "/api/social/mention"]
const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith("/api/")
  if (isApi) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip") || "unknown"
    if (!checkRateLimit(`api:${ip}`).allowed ||
      (pathname === "/api/incidentes/zk-report" && request.method === "POST" &&
        !checkRateLimit(`report:${ip}`, 3, 10 * 60 * 1000).allowed)) {
      return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 })
    }
    if (PUBLIC_APIS.some(p => matches(pathname, p)) ||
      (request.method === "GET" && /^\/api\/incidentes\/[0-9a-fA-F-]{36}$/.test(pathname))) {
      return NextResponse.next()
    }
    if (SERVICE_APIS.some(p => matches(pathname, p)) && process.env.API_SECRET &&
      request.headers.get("x-api-secret") === process.env.API_SECRET) {
      return NextResponse.next()
    }
  } else if (PUBLIC_PAGES.some(p => matches(pathname, p))) {
    return NextResponse.next()
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    if (isApi) return NextResponse.json({ error: "Autenticación no configurada" }, { status: 503 })
    return NextResponse.redirect(new URL("/login?error=unavailable", request.url))
  }

  const response = NextResponse.next()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (entries) => entries.forEach(({ name, value, options }) => {
        request.cookies.set(name, value)
        response.cookies.set(name, value, options)
      }),
    },
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    if (isApi) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const { data: profile } = await supabase.from("perfiles")
    .select("rol, status").eq("id", user.id).single()
  if (!profile || profile.status !== "activo") {
    if (isApi) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    return NextResponse.redirect(new URL("/login?error=suspended", request.url))
  }
  if (pathname === "/admin" && profile.rol !== "admin") {
    return NextResponse.redirect(new URL("/", request.url))
  }
  if (isApi && pathname === "/api/agent" && request.method === "POST" && profile.rol !== "admin") {
    return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 })
  }
  if (isApi && request.method !== "GET" &&
      !["admin", "operador"].includes(profile.rol)) {
    return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 })
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js)$).*)"],
}
