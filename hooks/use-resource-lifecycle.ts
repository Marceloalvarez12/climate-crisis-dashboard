import { fetchRecursos, patchRecurso } from "@/lib/api"

const LEGACY_PERSISTENCE_KEY = "crisis-dashboard-resource-timers"

/** Dispatch changes only the operational state confirmed by the server.
 * Arrival and release require an explicit operator action, never a timer.
 * The development simulation panel manages its own simulated lifecycle.
 */
export async function dispatchResourceWithLifecycle(
  incidenteId?: string,
  resourceId?: string,
  onStateChange?: () => void,
): Promise<{ recursoId: string; cleanup: () => void }> {
  if (!incidenteId) throw new Error("Se requiere un incidente para despachar recursos")
  let recursoId = resourceId
  if (!recursoId) {
    const recursos = await fetchRecursos()
    recursoId = recursos.find(r => r.estado === "available")?.id
  }
  if (!recursoId) throw new Error("No hay recursos disponibles")
  await patchRecurso(recursoId, { estado: "dispatched", incidente_id: incidenteId })
  onStateChange?.()
  return { recursoId, cleanup: () => {} }
}

// Discard old browser timers without changing resources already deployed.
export async function restoreResourceTimersOnMount(): Promise<void> {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(LEGACY_PERSISTENCE_KEY) } catch { /* storage may be unavailable */ }
}
