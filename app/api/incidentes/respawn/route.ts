import { apiError } from "@/lib/services/api-response"

export async function POST() {
  return apiError("La creación aleatoria de incidentes está deshabilitada; usá un reporte ciudadano o una fuente de reportes conectada", 410)
}
