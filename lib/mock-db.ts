import type { DbIncident, DbResource, IncidentType, IncidentSeverity, IncidentSource } from "./types"

// In-memory stores
let incidents: DbIncident[] = []
let resources: DbResource[] = []
let auditLogs: Array<{ id: string; action: string; timestamp: string; details: unknown }> = []

// Seed data
function seedData() {
  const now = () => new Date().toISOString()
  const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
  const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

  const INCIDENT_TYPES: IncidentType[] = ["flood", "fire", "storm", "looting", "violence", "accident", "general"]
  const SEVERIDADES: IncidentSeverity[] = ["low", "medium", "high", "critical"]
  const FUENTES: IncidentSource[] = ["social", "sensor", "camera"]

  const RESPAWN_ZONES = [
    { nombre: "Centro", lat: -26.8241, lng: -65.2226 },
    { nombre: "Zona Norte", lat: -26.8100, lng: -65.2100 },
    { nombre: "Zona Sur", lat: -26.8400, lng: -65.2300 },
    { nombre: "Zona Este", lat: -26.8200, lng: -65.2000 },
    { nombre: "Zona Oeste", lat: -26.8300, lng: -65.2400 },
  ]

  // Seed incidents
  incidents = Array.from({ length: 5 }, (_, i) => {
    const zona = RESPAWN_ZONES[i % RESPAWN_ZONES.length]
    return {
      id: `inc-${i + 1}-${Date.now()}`,
      tipo: randomFrom(INCIDENT_TYPES),
      severidad: randomFrom(SEVERIDADES),
      ubicacion: zona.nombre,
      latitud: zona.lat + (Math.random() - 0.5) * 0.01,
      longitud: zona.lng + (Math.random() - 0.5) * 0.01,
      personas_afectadas: randomInt(5, 100),
      fuente: randomFrom(FUENTES),
      fuente_detalles: { platform: "Mock", content: `Mock incident ${i + 1}` },
      estado: "activo",
      created_at: new Date(Date.now() - randomInt(60000, 600000)).toISOString(),
      updated_at: now(),
    }
  })

  // Seed resources - 5 types, 11 total units
  const resourceTypes: Array<{ tipo: string; nombre: string; cantidad: number; ubicacion: string }> = [
    { tipo: "ambulance", nombre: "Ambulancia", cantidad: 3, ubicacion: "Centro" },
    { tipo: "firefighter", nombre: "Bomberos", cantidad: 2, ubicacion: "Zona Norte" },
    { tipo: "police", nombre: "Policía", cantidad: 2, ubicacion: "Comisaría Central" },
    { tipo: "helicopter", nombre: "Helicóptero", cantidad: 2, ubicacion: "Aeropuerto" },
    { tipo: "boat", nombre: "Lancha", cantidad: 2, ubicacion: "Río Salí" },
  ]

  resources = resourceTypes.flatMap((rt, typeIdx) =>
    Array.from({ length: rt.cantidad }, (_, i) => ({
      id: `res-${typeIdx}-${i}-${Date.now()}`,
      tipo: rt.tipo,
      nombre: `${rt.nombre} ${String(i + 1).padStart(2, "0")}`,
      cantidad: 1,
      cantidad_disponible: 1,
      estado: "available",
      ubicacion: rt.ubicacion,
      incidente_id: null,
      updated_at: now(),
    }))
  )
}

// Initialize seed data
seedData()

// Incident operations
export function getIncidents(): DbIncident[] {
  return incidents.filter(i => i.estado === "activo")
}

export function insertIncident(incident: Omit<DbIncident, "id">): DbIncident {
  const newIncident = { ...incident, id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }
  incidents.push(newIncident)
  auditLogs.push({ id: `audit-${Date.now()}`, action: "insert_incident", timestamp: new Date().toISOString(), details: newIncident })
  return newIncident
}

export function updateIncident(id: string, updates: Partial<DbIncident>): DbIncident | null {
  const idx = incidents.findIndex(i => i.id === id)
  if (idx === -1) return null
  incidents[idx] = { ...incidents[idx], ...updates, updated_at: new Date().toISOString() }
  auditLogs.push({ id: `audit-${Date.now()}`, action: "update_incident", timestamp: new Date().toISOString(), details: { id, updates } })
  return incidents[idx]
}

// Resource operations
export function getResources(): DbResource[] {
  return resources
}

export function updateResource(id: string, updates: Partial<DbResource>): DbResource | null {
  const idx = resources.findIndex(r => r.id === id)
  if (idx === -1) return null
  resources[idx] = { ...resources[idx], ...updates, updated_at: new Date().toISOString() }
  auditLogs.push({ id: `audit-${Date.now()}`, action: "update_resource", timestamp: new Date().toISOString(), details: { id, updates } })
  return resources[idx]
}

// Analytics operations
export function getAnalytics() {
  const activeIncidents = incidents.filter(i => i.estado === "activo")
  const availableResources = resources.filter(r => r.estado === "available")
  const busyResources = resources.filter(r => r.estado === "busy" || r.estado === "dispatched")

  return {
    totalIncidents: activeIncidents.length,
    totalResources: resources.length,
    availableResources: availableResources.length,
    busyResources: busyResources.length,
    incidentsByType: INCIDENT_TYPE_COUNTS(activeIncidents),
    incidentsBySeverity: SEVERITY_COUNTS(activeIncidents),
  }
}

function INCIDENT_TYPE_COUNTS(incidents: DbIncident[]): Record<string, number> {
  return incidents.reduce((acc, inc) => {
    acc[inc.tipo] = (acc[inc.tipo] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

function SEVERITY_COUNTS(incidents: DbIncident[]): Record<string, number> {
  return incidents.reduce((acc, inc) => {
    acc[inc.severidad] = (acc[inc.severidad] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

// Agent operations
export function getAgentStatus() {
  return { status: "active", mode: "auto", lastUpdate: new Date().toISOString() }
}

export function getAgentLogs() {
  return auditLogs.slice(-50).reverse()
}
