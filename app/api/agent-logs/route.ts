import { getAgentLogs } from "@/lib/mock-db"
import { AgentLogSchema } from "@/lib/validation"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"

export async function GET() {
  try {
    const data = getAgentLogs()
    return apiSuccess(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return apiError(message)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = AgentLogSchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    return apiSuccess({
      id: `log-${Date.now()}`,
      ...parsed.data,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return apiError(message)
  }
}
