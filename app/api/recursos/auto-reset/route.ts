import { apiError } from "@/lib/services/api-response"

export async function POST() {
  return apiError("El reinicio automático de recursos está deshabilitado. Su liberación requiere una acción operativa explícita.", 410)
}
