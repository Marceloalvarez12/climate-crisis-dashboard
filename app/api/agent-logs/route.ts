import { NextResponse } from "next/server"
import { getAgentLogs } from "@/lib/mock-db"

export async function GET() {
  const data = getAgentLogs()
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()

  // Mock insert - just return success
  return NextResponse.json({
    id: `log-${Date.now()}`,
    ...body,
    created_at: new Date().toISOString(),
  })
}
