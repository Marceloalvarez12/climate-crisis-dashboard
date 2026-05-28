/**
 * lib/agents/types.ts
 *
 * Tipos compartidos por todo el sistema de agentes de redes sociales.
 */

// ---------------------------------------------------------------------------
// Post normalizado (salida de cualquier conector)
// ---------------------------------------------------------------------------

export type SocialPlatform = "twitter" | "facebook" | "instagram" | "tiktok" | "mock"

export interface SocialPost {
  id:         string
  platform:   SocialPlatform
  text:       string
  author:     string
  authorUrl?: string
  imageUrl?:  string
  location?:  string           // texto libre del perfil/post
  geoLat?:    number           // coordenada extraída (si la plataforma la provee)
  geoLng?:    number
  postedAt:   Date
  rawData?:   unknown          // payload original de la API (para debugging)
}

// ---------------------------------------------------------------------------
// Análisis de Gemini sobre un conjunto de posts
// ---------------------------------------------------------------------------

export type AnalyzedIncidentType     = "flood" | "fire" | "storm" | "earthquake" | "accident" | "none"
export type AnalyzedIncidentSeverity = "critical" | "high" | "medium" | "low"

export interface GeminiAnalysis {
  isIncident:         boolean
  type:               AnalyzedIncidentType
  severity:           AnalyzedIncidentSeverity
  confidence:         number             // 0–100
  locationName:       string             // nombre del lugar inferido
  coordinatesInferred?: { lat: number; lng: number }
  affectedPeopleEst:  number             // estimación de afectados
  summary:            string             // resumen en español en 1-2 oraciones
  reasoning:          string             // cadena de razonamiento de Gemini
  relatedPostIds:     string[]           // ids de los posts que sustentan el análisis
  suggestedActions:   string[]           // acciones recomendadas
  arkivKey?:          string
}

// ---------------------------------------------------------------------------
// Resultado completo de una ejecución del agente
// ---------------------------------------------------------------------------

export interface AgentScanResult {
  scanId:        string
  startedAt:     Date
  completedAt:   Date
  postsCollected: number
  postsAnalyzed: number
  incidentsFound: GeminiAnalysis[]
  platform:      SocialPlatform
  error?:        string
}
