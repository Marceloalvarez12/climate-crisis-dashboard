import { NextResponse } from "next/server"
import { fetchRecentEarthquakes } from "@/lib/data/usgs-earthquakes"

export const revalidate = 300

export async function GET() {
  const data = await fetchRecentEarthquakes()
  return NextResponse.json(
    { count: data.length, earthquakes: data },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  )
}
