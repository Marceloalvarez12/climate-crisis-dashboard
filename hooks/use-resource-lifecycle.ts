import {
  RESOURCE_DISPATCHED_TO_BUSY_MS,
  RESOURCE_BUSY_TO_AVAILABLE_MS,
} from "@/lib/mock-data"
import { fetchRecursos, patchRecurso } from "@/lib/api"

interface ResourceTimers {
  busyTimer: ReturnType<typeof setTimeout>
  availableTimer: ReturnType<typeof setTimeout> | null
}

interface PersistedResourceState {
  resourceId: string
  estado: "dispatched" | "busy"
  timestamp: number
  incidenteId: string | null
}

const PERSISTENCE_KEY = "crisis-dashboard-resource-timers"
const activeTimers = new Map<string, ResourceTimers>()

function loadPersistedStates(): PersistedResourceState[] {
  try {
    const raw = localStorage.getItem(PERSISTENCE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersistedResourceState[]
    const now = Date.now()
    return parsed.filter((s) => now - s.timestamp < RESOURCE_DISPATCHED_TO_BUSY_MS + RESOURCE_BUSY_TO_AVAILABLE_MS + 20000)
  } catch {
    return []
  }
}

function savePersistedStates(states: PersistedResourceState[]) {
  try {
    localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(states))
  } catch {
    // ignore storage errors
  }
}

function addPersistedState(state: PersistedResourceState) {
  const existing = loadPersistedStates()
  const filtered = existing.filter((s) => s.resourceId !== state.resourceId)
  savePersistedStates([...filtered, state])
}

function removePersistedState(resourceId: string) {
  const existing = loadPersistedStates()
  savePersistedStates(existing.filter((s) => s.resourceId !== resourceId))
}

export async function dispatchResourceWithLifecycle(
  incidenteId?: string,
  resourceId?: string,
  onStateChange?: () => void,
): Promise<{ recursoId: string | null; cleanup: () => void }> {
  let recursoId = resourceId

  if (!recursoId) {
    const recursos = await fetchRecursos()
    const disponible = recursos.find((r) => r.estado === "available")
    if (!disponible) return { recursoId: null, cleanup: () => {} }
    recursoId = disponible.id
  }

  await patchRecurso(recursoId, {
    estado: "dispatched",
    incidente_id: incidenteId ?? null,
  })
  onStateChange?.()

  addPersistedState({
    resourceId: recursoId,
    estado: "dispatched",
    timestamp: Date.now(),
    incidenteId: incidenteId ?? null,
  })

  const busyTimer = setTimeout(async () => {
    await patchRecurso(recursoId!, { estado: "busy" })
    onStateChange?.()

    addPersistedState({
      resourceId: recursoId!,
      estado: "busy",
      timestamp: Date.now(),
      incidenteId: incidenteId ?? null,
    })

    const availableTimer = setTimeout(async () => {
      await patchRecurso(recursoId!, { estado: "available", incidente_id: null })
      onStateChange?.()
      activeTimers.delete(recursoId!)
      removePersistedState(recursoId!)
    }, RESOURCE_BUSY_TO_AVAILABLE_MS)

    const existing = activeTimers.get(recursoId!)
    if (existing) {
      existing.availableTimer = availableTimer
    }
  }, RESOURCE_DISPATCHED_TO_BUSY_MS)

  activeTimers.set(recursoId!, { busyTimer, availableTimer: null })

  const cleanup = () => {
    const timers = activeTimers.get(recursoId!)
    if (timers) {
      clearTimeout(timers.busyTimer)
      if (timers.availableTimer) clearTimeout(timers.availableTimer)
      activeTimers.delete(recursoId!)
    }
    removePersistedState(recursoId!)
  }

  return { recursoId, cleanup }
}

export async function restoreResourceTimersOnMount() {
  const persisted = loadPersistedStates()
  const now = Date.now()

  for (const state of persisted) {
    if (activeTimers.has(state.resourceId)) continue

    try {
      const recursos = await fetchRecursos()
      const currentResource = recursos.find((r) => r.id === state.resourceId)

      if (!currentResource) {
        removePersistedState(state.resourceId)
        continue
      }

      if (currentResource.estado === "available") {
        removePersistedState(state.resourceId)
        continue
      }

      const elapsed = now - state.timestamp

      if (state.estado === "dispatched") {
        const remainingToBusy = RESOURCE_DISPATCHED_TO_BUSY_MS - elapsed

        if (remainingToBusy <= 0) {
          if (currentResource.estado !== "busy" && currentResource.estado !== "available") {
            await patchRecurso(state.resourceId, { estado: "busy" })
          }

          const remainingToAvailable = RESOURCE_BUSY_TO_AVAILABLE_MS - Math.max(0, elapsed - RESOURCE_DISPATCHED_TO_BUSY_MS)

          if (remainingToAvailable <= 0) {
            if (currentResource.estado !== "available") {
              await patchRecurso(state.resourceId, { estado: "available", incidente_id: null })
            }
            removePersistedState(state.resourceId)
            continue
          }

          const availableTimer = setTimeout(async () => {
            await patchRecurso(state.resourceId, { estado: "available", incidente_id: null })
            activeTimers.delete(state.resourceId)
            removePersistedState(state.resourceId)
          }, remainingToAvailable)

          activeTimers.set(state.resourceId, { busyTimer: setTimeout(() => {}, 0), availableTimer })
        } else {
          const busyTimer = setTimeout(async () => {
            await patchRecurso(state.resourceId, { estado: "busy" })

            const availableTimer = setTimeout(async () => {
              await patchRecurso(state.resourceId, { estado: "available", incidente_id: null })
              activeTimers.delete(state.resourceId)
              removePersistedState(state.resourceId)
            }, RESOURCE_BUSY_TO_AVAILABLE_MS)

            const existing = activeTimers.get(state.resourceId)
            if (existing) {
              existing.availableTimer = availableTimer
            }
          }, remainingToBusy)

          activeTimers.set(state.resourceId, { busyTimer, availableTimer: null })
        }
      } else if (state.estado === "busy") {
        const remainingToAvailable = RESOURCE_BUSY_TO_AVAILABLE_MS - elapsed

        if (remainingToAvailable <= 0) {
          if (currentResource.estado !== "available") {
            await patchRecurso(state.resourceId, { estado: "available", incidente_id: null })
          }
          removePersistedState(state.resourceId)
          continue
        }

        const availableTimer = setTimeout(async () => {
          await patchRecurso(state.resourceId, { estado: "available", incidente_id: null })
          activeTimers.delete(state.resourceId)
          removePersistedState(state.resourceId)
        }, remainingToAvailable)

        activeTimers.set(state.resourceId, { busyTimer: setTimeout(() => {}, 0), availableTimer })
      }
    } catch (err) {
      console.error(`[restoreResourceTimersOnMount] Error restoring timers for ${state.resourceId}:`, err)
      removePersistedState(state.resourceId)
    }
  }
}

export function cleanupResourceLifecycle(recursoId: string) {
  const timers = activeTimers.get(recursoId)
  if (timers) {
    clearTimeout(timers.busyTimer)
    if (timers.availableTimer) clearTimeout(timers.availableTimer)
    activeTimers.delete(recursoId)
  }
  removePersistedState(recursoId)
}
