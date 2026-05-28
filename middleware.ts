import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"

const PUBLIC_PATHS = ["/_next", "/favicon.ico", "/api/analytics"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown"
    const rateLimit = checkRateLimit(ip)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few seconds." },
        { status: 429 }
      )
    }

    const apiSecret = process.env.API_SECRET

    if (apiSecret) {
      const authHeader = request.headers.get("x-api-secret")
      const urlSecret = request.nextUrl.searchParams.get("secret")

      if (authHeader !== apiSecret && urlSecret !== apiSecret) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        )
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
