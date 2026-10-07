import type { DbResource } from "@/lib/types"

export const TIPO_LABELS: Record<string, string> = {
  ambulance: "Ambulancias",
  firefighter: "Bomberos",
  helicopter: "Helicópteros",
  boat: "Lanchas",
  police: "Policía",
  medical: "Equipamiento médico",
  shelter: "Albergues",
}

export const TIPO_PREFIXES: Record<string, string> = {
  ambulance: "SAME",
  firefighter: "B",
  helicopter: "H",
  boat: "L",
  police: "P",
  medical: "MED",
  shelter: "ALB",
}

export function getTipoLabel(tipo: string): string {
  return TIPO_LABELS[tipo] || tipo
}

export function getTipoPrefix(tipo: string): string {
  return TIPO_PREFIXES[tipo] || ""
}

export function generateResourceName(tipo: string, ubicacion: string): string {
  const label = getTipoLabel(tipo)
  return `${label} - ${ubicacion}`
}

export function calculateEstado(cantidad: number, cantidad_disponible: number): string {
  if (cantidad_disponible >= cantidad) return "available"
  if (cantidad_disponible <= 0) return "busy"
  return "dispatched"
}

export interface GroupedResource {
  tipo: string
  ubicacion: string
  resources: DbResource[]
  totalCantidad: number
  totalDisponible: number
}

export function groupResourcesByTypeAndBase(resources: DbResource[]): GroupedResource[] {
  const grouped: Record<string, GroupedResource> = {}

  for (const r of resources) {
    if (r.estado === "retired") continue
    const key = `${r.tipo}|${r.ubicacion}`
    if (!grouped[key]) {
      grouped[key] = {
        tipo: r.tipo,
        ubicacion: r.ubicacion,
        resources: [],
        totalCantidad: 0,
        totalDisponible: 0,
      }
    }
    grouped[key].resources.push(r)
    grouped[key].totalCantidad += r.cantidad || 1
    grouped[key].totalDisponible += r.cantidad_disponible ?? (r.cantidad || 1)
  }

  return Object.values(grouped).sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo)
    return a.ubicacion.localeCompare(b.ubicacion)
  })
}

export function getNextNumero(tipo: string, existingResources: DbResource[]): string {
  const tipoResources = existingResources.filter((r) => r.tipo === tipo && r.estado !== "retired")

  if (tipoResources.length === 0) return "01"

  const numeros = tipoResources
    .map((r) => {
      const match = r.nombre.match(/-(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter((n) => n > 0)

  if (numeros.length === 0) return "01"

  const maxNumero = Math.max(...numeros)
  return String(maxNumero + 1).padStart(2, "0")
}
