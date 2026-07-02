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
export type IncidentSource   = "social" | "sensor" | "camera" | "citizen"

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
  // Blockchain / AI Analysis
  arkiv_entity_key?: string
  ai_analysis?: {
    reasoning?: string
    suggestedActions?: string[]
    confidence?: number
    relatedPostIds?: string[]
    arkiv_entity_key?: string
  }
  // ZK Citizen Report
  zk_proof?: Record<string, unknown>
  zk_public_signals?: string[]
  zk_input?: Record<string, string>
  stellar_audit?: Record<string, unknown>
  descripcion?: string
}

export interface ZkCitizenReport {
  lat: number
  lng: number
  tipo: IncidentType
  severidad: IncidentSeverity
  ubicacion: string
  personasAfectadas: number
  descripcion?: string
  zoneHash?: number
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
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
  estado?:        string
  arkiv_key?:     string
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
  arkiv_key?:       string
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
  stellarAudit?: Record<string, unknown>
  error?: string
}
