import { NextResponse } from "next/server"
import { fetchCamerasNear } from "@/lib/data/cameras-near"

export const revalidate = 600

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get("lat"))
  const lng = Number(url.searchParams.get("lng"))
  const radius = Number(url.searchParams.get("radius") ?? "1500")

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat y lng requeridos" }, { status: 400 })
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordenadas fuera de rango" }, { status: 400 })
  }
  const radiusM = Math.min(5000, Math.max(100, Number.isFinite(radius) ? radius : 1500))

  const cameras = await fetchCamerasNear(lat, lng, radiusM)
  return NextResponse.json(
    { count: cameras.length, cameras },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } },
  )
}
