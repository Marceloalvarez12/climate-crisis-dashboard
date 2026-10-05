/**
 * lib/agents/heuristic-analyzer.ts
 *
 * Analizador basado en reglas (sin IA externa). Se usa cuando no hay
 * OPENROUTER_API_KEY / GOOGLE_AI_API_KEY configuradas o cuando el LLM falla
 * (cuota agotada, timeout…). Garantiza que un post con #AlertaTucuman siempre
 * pueda clasificarse y georreferenciarse, aunque con menor precisión.
 */

import { normalizeText } from "./hashtag"
import { findPlaceInText } from "./tucuman-gazetteer"
import type { AnalyzedIncidentSeverity, AnalyzedIncidentType, GeminiAnalysis, SocialPost } from "./types"

const TYPE_KEYWORDS: Array<{ type: Exclude<AnalyzedIncidentType, "none">; words: string[] }> = [
  { type: "flood",      words: ["inund", "desbord", "anegad", "crecida", "bajo el agua", "agua llega", "agua entra", "canal", "arroyo", "lluvia torrencial"] },
  { type: "fire",       words: ["incendi", "fuego", "llamas", "humo", "quema", "bomberos"] },
  { type: "storm",      words: ["tormenta", "granizo", "tornado", "tromba", "viento", "arbol caido", "arboles caidos", "poste", "sin luz", "rafaga"] },
  { type: "earthquake", words: ["sismo", "temblor", "terremoto"] },
  { type: "accident",   words: ["accidente", "choque", "vuelco", "colision", "atropell"] },
  { type: "looting",    words: ["saqueo", "saquea", "asalto", "robo masivo"] },
  { type: "violence",   words: ["tiroteo", "disturbio", "enfrentamiento", "pelea", "balacera"] },
]

const CRITICAL_WORDS = ["urgente", "atrapad", "evacu", "riesgo de vida", "victima", "muert", "sos", "emergencia maxima", "ayuda urgente", "tornado"]
const HIGH_WORDS     = ["herid", "familias", "rescate", "corte total", "intransitable", "ambulancia", "danos", "hospital"]

const SUGGESTED_ACTIONS: Record<string, string[]> = {
  flood:      ["Enviar bote de rescate y equipo de Defensa Civil", "Cortar tránsito en la zona anegada", "Habilitar centro de evacuados cercano"],
  fire:       ["Despachar dotación de Bomberos", "Evaluar evacuación preventiva por humo", "Coordinar ambulancia en espera"],
  storm:      ["Enviar cuadrilla para remoción de árboles y postes", "Notificar a la distribuidora eléctrica", "Verificar techos dañados y heridos"],
  earthquake: ["Inspeccionar estructuras dañadas", "Activar protocolo sísmico de Defensa Civil"],
  accident:   ["Despachar ambulancia y policía vial", "Desviar el tránsito"],
  looting:    ["Despachar patrullas policiales", "Resguardar comercios de la zona"],
  violence:   ["Despachar patrullas policiales", "Solicitar ambulancia preventiva"],
}

function countHits(text: string, words: string[]): number {
  return words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0)
}

function estimateAffected(text: string, severity: AnalyzedIncidentSeverity): number {
  const people   = text.match(/(\d{1,5})\s*(personas|vecinos|afectados|evacuados|heridos)/)
  const families = text.match(/(\d{1,5})\s*familias/)
  if (people)   return Number(people[1])
  if (families) return Number(families[1]) * 4
  return { critical: 120, high: 40, medium: 12, low: 3 }[severity]
}

export function analyzePostHeuristically(post: SocialPost): GeminiAnalysis {
  const text = normalizeText(post.text)

  const scored = TYPE_KEYWORDS
    .map(({ type, words }) => ({ type, hits: countHits(text, words) }))
    .sort((a, b) => b.hits - a.hits)
  const best = scored[0]

  if (!best || best.hits === 0) {
    return {
      isIncident:        false,
      type:              "none",
      severity:          "low",
      confidence:        20,
      locationName:      "",
      affectedPeopleEst: 0,
      summary:           "El post usa el hashtag pero no describe una emergencia",
      reasoning:         "Análisis por reglas: no se encontraron términos de emergencia (inundación, incendio, tormenta, accidente…) en el texto.",
      relatedPostIds:    [post.id],
      suggestedActions:  [],
    }
  }

  const critical = countHits(text, CRITICAL_WORDS)
  const high     = countHits(text, HIGH_WORDS)
  const severity: AnalyzedIncidentSeverity =
    critical >= 2 || (critical >= 1 && high >= 1) ? "critical"
    : critical >= 1 || high >= 1 ? "high"
    : best.hits >= 2 ? "medium"
    : "low"

  const place      = findPlaceInText(post.text, post.location)
  const confidence = Math.min(95, 55 + best.hits * 8 + (critical + high) * 4 + (place ? 10 : 0) + (post.imageUrl ? 5 : 0))

  return {
    isIncident:          true,
    type:                best.type,
    severity,
    confidence,
    locationName:        place?.nombre ?? post.location ?? "San Miguel de Tucuman",
    coordinatesInferred: place ? { lat: place.lat, lng: place.lng } : undefined,
    affectedPeopleEst:   estimateAffected(text, severity),
    summary:             post.text.length > 180 ? `${post.text.slice(0, 177)}…` : post.text,
    reasoning:
      `Análisis por reglas (sin LLM): ${best.hits} término(s) de "${best.type}" detectados, ` +
      `${critical} indicador(es) críticos y ${high} de alta severidad. ` +
      (place ? `Ubicación resuelta por nomenclátor: ${place.nombre}.` : "Ubicación no reconocida; se usa la reportada por el autor."),
    relatedPostIds:      [post.id],
    suggestedActions:    SUGGESTED_ACTIONS[best.type] ?? [],
  }
}
