import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { checkRateLimit, RateLimitUnavailableError, type RateLimitResult } from "@/lib/rate-limit"
import { CONFIG } from "@/lib/config"

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith("/api/")
  if (isApi) {
    const contentLength = request.headers.get("content-length")
    if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > CONFIG.HTTP.MAX_API_BODY_BYTES) {
      return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 })
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip") || "unknown"
    const rejectQuota = (quota: RateLimitResult) => NextResponse.json({ error: "Demasiadas solicitudes" }, {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((quota.resetAt - Date.now()) / 1000))),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(quota.resetAt / 1000)),
      },
    })
    try {
      const globalQuota = await checkRateLimit(`api:${ip}`)
      if (!globalQuota.allowed) return rejectQuota(globalQuota)
      if (request.method === "POST" && pathname === "/api/incidentes/zk-report") {
        const quota = await checkRateLimit(`report:${ip}`, CONFIG.RATE_LIMIT.MAX_REPORTS, CONFIG.RATE_LIMIT.REPORT_WINDOW_MS)
        if (!quota.allowed) return rejectQuota(quota)
      }
      if (request.method === "POST" && pathname === "/api/incidentes/zk-verify") {
        const quota = await checkRateLimit(`zk-verify:${ip}`, CONFIG.RATE_LIMIT.MAX_ZK_VERIFICATIONS)
        if (!quota.allowed) return rejectQuota(quota)
      }
    } catch (error) {
      if (!(error instanceof RateLimitUnavailableError)) throw error
      return NextResponse.json({ error: "Protección de solicitudes temporalmente no disponible" }, { status: 503, headers: { "Retry-After": "5" } })
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
