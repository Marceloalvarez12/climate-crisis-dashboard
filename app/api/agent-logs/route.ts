import { NextResponse } from "next/server"
import { getAgentLogs } from "@/lib/mock-db"
import { AgentLogSchema } from "@/lib/validation"

export async function GET() {
  try {
    const data = getAgentLogs()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = AgentLogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Mock insert - just return success
    return NextResponse.json({
      id: `log-${Date.now()}`,
      ...parsed.data,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
