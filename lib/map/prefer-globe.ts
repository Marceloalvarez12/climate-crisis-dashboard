/**
 * Cesium es WebGL pesado. En mobile / hardware flojo nos quedamos en Leaflet.
 * Desktop lg+ con 4+ cores → globo 3D.
 */
export function preferGlobe3D(): boolean {
  // Desktop lg+ con 4+ cores y 4+ GB RAM es elegible para 3D,
  // pero el 3D es on-demand: el usuario lo activa explícitamente.
  // Esta función ahora solo reporta capacidad, NO preferencia.
  if (typeof window === "undefined") return false
  const desktop = window.matchMedia("(min-width: 1024px)").matches
  if (!desktop) return false
  const cores = navigator.hardwareConcurrency || 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (cores < 4) return false
  if (memory !== undefined && memory < 4) return false
  return true
}
