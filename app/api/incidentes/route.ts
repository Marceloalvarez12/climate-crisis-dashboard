import { NextRequest } from "next/server"
import { IncidentService } from "@/lib/services/incident-service"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import { IncidentCreateSchema, IncidentPatchSchema } from "@/lib/validation"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get("estado") || "activo"

    const data = estado === "atendido"
      ? await IncidentService.getAttendedIncidents()
      : await IncidentService.getActiveIncidents()

    return apiSuccess(data)
  } catch (err) {
    return apiError(String(err))
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = IncidentCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const validatedBody = parsed.data

    const existing = await IncidentService.findByLocation(validatedBody.ubicacion)

    if (existing) {
      if (existing.estado === "activo") {
        return apiSuccess(existing)
      }

      if (!(await IncidentService.canCreateMore())) {
        return apiSuccess({ skipped: true, reason: "max_active_reached" })
      }

      const updated = await IncidentService.update(existing.id, {
        ...validatedBody,
        estado: "activo",
      })
      return apiSuccess(updated)
    }

    if (!(await IncidentService.canCreateMore())) {
      return apiSuccess({ skipped: true, reason: "max_active_reached" })
    }

    const created = await IncidentService.create(validatedBody)
    return apiSuccess(created)
  } catch (err) {
    return apiError(String(err))
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = IncidentPatchSchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error.flatten())
    }

    const { id, ...updates } = parsed.data
    const updated = await IncidentService.update(id, updates)
    return apiSuccess(updated)
  } catch (err) {
    return apiError(String(err))
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, estado, simulated } = body

    if (id) {
      await IncidentService.deleteById(id)
      return apiSuccess({ deleted: id })
    }

    if (simulated) {
      await IncidentService.deleteSimulated(estado)
      return apiSuccess({ cleaned: true })
    }

    return apiValidationError({ formErrors: ["Se requiere id o simulated=true"], fieldErrors: {} })
  } catch (err) {
    return apiError(String(err))
  }
}
