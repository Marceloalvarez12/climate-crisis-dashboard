interface DispatchDependencies {
  dispatch: (incidentId: string, resourceId: string) => Promise<unknown>
  markAttended: (incidentId: string) => Promise<unknown>
}

export async function dispatchSelectedResources(incidentId: string | undefined, resourceIds: string[], dependencies: DispatchDependencies): Promise<void> {
  if (!incidentId) throw new Error("Seleccioná un incidente válido")
  if (resourceIds.length === 0 || new Set(resourceIds).size !== resourceIds.length) throw new Error("Seleccioná recursos disponibles sin duplicados")
  const results = await Promise.allSettled(resourceIds.map(id => dependencies.dispatch(incidentId, id)))
  const failed = results.filter(result => result.status === "rejected")
  if (failed.length) {
    const sent = results.length - failed.length
    throw new Error(sent > 0
      ? `${sent} recursos despachados; ${failed.length} fallaron. Revisá la disponibilidad antes de reintentar.`
      : "No se pudo despachar ningún recurso. Revisá la disponibilidad e intentá nuevamente.")
  }
  try {
    await dependencies.markAttended(incidentId)
  } catch {
    throw new Error("Los recursos fueron despachados, pero no se pudo actualizar el incidente. Revisá su estado.")
  }
}
