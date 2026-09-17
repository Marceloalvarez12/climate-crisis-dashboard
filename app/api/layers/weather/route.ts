import { NextResponse } from "next/server"
import { fetchWeather } from "@/lib/data/open-meteo"

export const revalidate = 600

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get("lat"))
  const lng = Number(url.searchParams.get("lng"))
  const label = url.searchParams.get("label") ?? undefined

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat y lng requeridos" }, { status: 400 })
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordenadas fuera de rango" }, { status: 400 })
  }

  const snapshot = await fetchWeather(lat, lng, label)
  if (!snapshot) {
    return NextResponse.json({ error: "Upstream sin respuesta" }, { status: 502 })
  }
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
  })
}
