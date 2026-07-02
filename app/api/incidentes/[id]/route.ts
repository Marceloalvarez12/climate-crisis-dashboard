import { NextRequest } from "next/server"
import { IncidentService } from "@/lib/services/incident-service"
import { apiSuccess, apiError, apiNotFound } from "@/lib/services/api-response"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const incident = await IncidentService.findById(id)
    if (!incident) {
      return apiNotFound("Incident")
    }
    return apiSuccess(incident)
  } catch (err) {
    return apiError(String(err))
  }
}
