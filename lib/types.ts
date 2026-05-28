/**
 * lib/types.ts
 *
 * Tipos de dominio compartidos por toda la aplicación.
 * Centralizar aquí evita redefiniciones dispersas entre componentes y API routes.
 */

// ---------------------------------------------------------------------------
// Incidentes
// ---------------------------------------------------------------------------

export type IncidentType     = "flood" | "fire" | "storm" | "looting" | "violence" | "accident" | "general"
export type IncidentSeverity = "critical" | "high" | "medium" | "low"
export type IncidentSource   = "social" | "sensor" | "camera"

export interface IncidentSourceDetails {
  // Social
  platform?:       string
  username?:       string
  content?:        string
  imageUrl?:       string
  // Sensor
  sensorId?:       string
  temperature?:    number
  humidity?:       number
  windSpeed?:      number
  pressure?:       number
  // Camera
  cameraId?:       string
  cameraLocation?: string
}

export interface Incident {
  id:             string
  type:           IncidentType
  severity:       IncidentSeverity
  location:       string
  coordinates:    { lat: number; lng: number }
  affectedPeople: number
  timestamp:      Date
  source:         IncidentSource
  sourceDetails:  IncidentSourceDetails
}

// ---------------------------------------------------------------------------
// Recursos
// ---------------------------------------------------------------------------

export type ResourceType   = "ambulance" | "firefighter" | "helicopter" | "boat" | "police"
export type ResourceStatus = "available" | "dispatched" | "busy"

export interface Resource {
  id:       string
  name:     string
  type:     ResourceType
  status:   ResourceStatus
  location: string
  eta?:     string
}

// DB row shapes (what comes from the database before transforming)
export interface DbIncident {
  id:               string
  tipo:             string
  severidad:        string
  ubicacion:        string
  latitud:          number
  longitud:         number
  personas_afectadas: number
  fuente:           string
  fuente_detalles:  Record<string, unknown>
  estado:           string
  created_at:       string
  updated_at:       string
}

export interface DbResource {
  id:        string
  tipo:      string
  nombre:    string
  estado:    string
  ubicacion: string
  incidente_id: string | null
  updated_at: string
}

// ---------------------------------------------------------------------------
// Arkiv Blockchain Types
// ---------------------------------------------------------------------------

export interface EmergencyIncident {
  id: string
  tipo: 'flood' | 'fire' | 'medical' | 'general'
  severidad: 'critical' | 'high' | 'medium' | 'low'
  ubicacion: string
  afectados: number
  timestamp: string
}

export interface ArkivDispatchResponse {
  success: boolean
  entityKey?: string
  error?: string
}
