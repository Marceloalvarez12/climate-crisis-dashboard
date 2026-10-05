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
  simulated?: boolean          // true si proviene del feed simulado (demo)
}

// ---------------------------------------------------------------------------
// Análisis de Gemini sobre un conjunto de posts
// ---------------------------------------------------------------------------

export type AnalyzedIncidentType     = "flood" | "fire" | "storm" | "earthquake" | "accident" | "looting" | "violence" | "none"
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
  hashtag:       string
  postsMatched:  number             // posts que contenían el hashtag disparador
  outcomes:      MentionOutcome[]
  error?:        string
}

// ---------------------------------------------------------------------------
// Resultado de procesar una mención individual (webhook o scan)
// ---------------------------------------------------------------------------

export type MentionStatus =
  | "ignored"       // no contiene el hashtag disparador
  | "rejected"      // contiene el hashtag pero la IA determinó que no es una emergencia
  | "created"       // se creó un incidente nuevo
  | "corroborated"  // reforzó un incidente activo existente en la misma ubicación
  | "duplicate"     // el post ya había sido procesado
  | "skipped"       // límite de incidentes activos alcanzado

export interface MentionOutcome {
  status:      MentionStatus
  postId:      string
  platform:    SocialPlatform
  author:      string
  hashtag:     string
  analyzer?:   "llm" | "heuristic"
  analysis?:   GeminiAnalysis
  incidentId?: string
  location?:   string
  reason?:     string
}
