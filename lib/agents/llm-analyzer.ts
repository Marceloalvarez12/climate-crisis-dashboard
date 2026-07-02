/**
 * lib/agents/llm-analyzer.ts
 *
 * Analizador que usa OpenRouter (OpenAI-compatible) para procesar posts de
 * redes sociales y detectar incidentes de emergencia climática.
 *
 * Si OpenRouter falla o no está configurado, delega al GeminiAnalyzer como fallback.
 */

import OpenAI from "openai"
import { z } from "zod"
import { GeminiAnalyzer } from "./gemini-analyzer"
import type { SocialPost, GeminiAnalysis } from "./types"

// ---------------------------------------------------------------------------
// Esquema de respuesta validado con Zod
// ---------------------------------------------------------------------------

const AnalysisSchema = z.object({
  isIncident: z.boolean().describe("true si los posts reportan un incidente de emergencia real"),
  type: z.enum(["flood", "fire", "storm", "earthquake", "accident", "none"]).describe("Tipo de incidente detectado"),
  severity: z.enum(["critical", "high", "medium", "low"]).describe("Severidad estimada"),
  confidence: z.number().min(0).max(100).describe("Confianza 0-100"),
  locationName: z.string().describe("Nombre del lugar afectado"),
  affectedPeopleEst: z.number().int().min(0).describe("Estimación de personas afectadas"),
  summary: z.string().describe("Resumen en 1-2 oraciones en español"),
  reasoning: z.string().describe("Razonamiento de la conclusión"),
  relatedPostIds: z.array(z.string()).describe("IDs de posts relevantes"),
  suggestedActions: z.array(z.string()).describe("Acciones recomendadas"),
})

// ---------------------------------------------------------------------------
// Prompt del sistema
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un agente de análisis de emergencias climáticas para el Centro de Crisis de Tucumán, Argentina.
Tu tarea es analizar posts de redes sociales y determinar si reportan un incidente de emergencia real.

TIPOS DE INCIDENTES:
- flood: inundaciones, desbordes, lluvias torrenciales con daños
- fire: incendios forestales, urbanos, quemas
- storm: tormentas severas, granizo, tornados, vientos fuertes
- earthquake: sismos, temblores
- accident: accidentes viales graves
- none: no es un incidente

CRITERIOS DE SEVERIDAD:
- critical: riesgo de vida, >100 afectados, evacuación
- high: daños severos, 20-100 afectados
- medium: daños moderados, <20 afectados
- low: daños menores, informativo

REGLAS:
- Ignora posts sobre deportes, comida, política, etc. (isIncident=false, type=none)
- Solo considera incidentes en Tucumán, Argentina
- Devolvé SIEMPRE un JSON válido con TODOS los campos requeridos
- relatedPostIds debe contener solo IDs de posts que realmente sustenten el incidente`

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function postsToText(posts: SocialPost[]): string {
  return posts
    .map((p, i) =>
      `[POST ${i + 1}] ID:${p.id} | Plataforma:${p.platform} | Autor:${p.author}\n` +
      `Ubicación reportada: ${p.location ?? "no especificada"}\n` +
      `Contenido: "${p.text}"\n` +
      `Fecha: ${p.postedAt.toLocaleString("es-AR")}`
    )
    .join("\n\n---\n\n")
}

function safeJsonParse(text: string): unknown {
  // Extraer JSON si viene envuelto en markdown
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const clean = jsonMatch ? jsonMatch[1].trim() : text.trim()
  try {
    return JSON.parse(clean)
  } catch {
    // Último intento: buscar cualquier objeto JSON en el texto
    const objMatch = clean.match(/\{[\s\S]*\}/)
    if (objMatch) {
      try { return JSON.parse(objMatch[0]) } catch { /* ignore */ }
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Clase principal
// ---------------------------------------------------------------------------

export class LlmAnalyzer {
  private client: OpenAI | null
  private model: string
  private fallback: GeminiAnalyzer | null

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY
    const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct"

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Climate Crisis Dashboard",
        },
        dangerouslyAllowBrowser: false,
      })
      this.model = model
    } else {
      this.client = null
      this.model = model
    }

    // Fallback a Gemini si está configurado
    try {
      this.fallback = new GeminiAnalyzer()
    } catch {
      this.fallback = null
    }
  }

  static isConfigured(): boolean {
    return !!process.env.OPENROUTER_API_KEY
  }

  private emptyAnalysis(): GeminiAnalysis {
    return {
      isIncident: false,
      type: "none",
      severity: "low",
      confidence: 0,
      locationName: "",
      affectedPeopleEst: 0,
      summary: "No se detectó ningún incidente",
      reasoning: "No se pudo analizar el contenido",
      relatedPostIds: [],
      suggestedActions: [],
    }
  }

  async analyzePosts(posts: SocialPost[], retries = 2): Promise<GeminiAnalysis> {
    if (posts.length === 0) return this.emptyAnalysis()

    // Si OpenRouter no está configurado, ir directo al fallback
    if (!this.client) {
      if (this.fallback) return this.fallback.analyzePosts(posts)
      return this.emptyAnalysis()
    }

    const prompt = `Analiza los siguientes ${posts.length} posts de redes sociales y determina si reportan un incidente de emergencia. Respondé ÚNICAMENTE con el JSON solicitado, sin texto adicional:\n\n${postsToText(posts)}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 1024,
        })

        const raw = completion.choices[0]?.message?.content
        if (!raw) throw new Error("Empty response from OpenRouter")

        const parsed = safeJsonParse(raw)
        if (!parsed) throw new Error("Failed to parse JSON response")

        const validated = AnalysisSchema.parse(parsed)
        return {
          isIncident: validated.isIncident,
          type: validated.type,
          severity: validated.severity,
          confidence: validated.confidence,
          locationName: validated.locationName,
          affectedPeopleEst: validated.affectedPeopleEst,
          summary: validated.summary,
          reasoning: validated.reasoning,
          relatedPostIds: validated.relatedPostIds ?? [],
          suggestedActions: validated.suggestedActions ?? [],
        }
      } catch (err) {
        console.error(`[LlmAnalyzer] Attempt ${attempt + 1} failed:`, err)
        if (attempt === retries) break
      }
    }

    // Fallback a Gemini tras agotar reintentos
    if (this.fallback) {
      console.log("[LlmAnalyzer] Falling back to Gemini")
      return this.fallback.analyzePosts(posts)
    }

    return {
      ...this.emptyAnalysis(),
      reasoning: "OpenRouter falló después de reintentos y no hay fallback configurado",
    }
  }

  async analyzeInBatches(posts: SocialPost[], batchSize = 5): Promise<GeminiAnalysis[]> {
    const results: GeminiAnalysis[] = []

    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize)
      const result = await this.analyzePosts(batch)
      if (result.isIncident) {
        results.push(result)
      }
    }

    return results
  }
}
