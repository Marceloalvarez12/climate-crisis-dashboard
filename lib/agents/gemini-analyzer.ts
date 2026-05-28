/**
 * lib/agents/gemini-analyzer.ts
 *
 * Analizador que usa Google Gemini 2.0 Flash para procesar posts de redes
 * sociales y determinar si representan un incidente de emergencia climática.
 *
 * Gemini recibe los posts en batch, razona sobre ellos y devuelve un análisis
 * estructurado en JSON con: tipo de incidente, severidad, ubicación,
 * confianza y recomendaciones de acción.
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import type { SocialPost, GeminiAnalysis } from "./types"

// ---------------------------------------------------------------------------
// Esquema de respuesta JSON que Gemini debe seguir
// ---------------------------------------------------------------------------

const ANALYSIS_SCHEMA = {
  type:       SchemaType.OBJECT,
  properties: {
    isIncident: {
      type:        SchemaType.BOOLEAN,
      description: "true si los posts reportan un incidente de emergencia real",
    },
    type: {
      type:        SchemaType.STRING,
      enum:        ["flood", "fire", "storm", "earthquake", "accident", "none"],
      description: "Tipo de incidente detectado",
    },
    severity: {
      type:        SchemaType.STRING,
      enum:        ["critical", "high", "medium", "low"],
      description: "Severidad estimada del incidente",
    },
    confidence: {
      type:        SchemaType.NUMBER,
      description: "Nivel de confianza del análisis, de 0 a 100",
    },
    locationName: {
      type:        SchemaType.STRING,
      description: "Nombre del lugar afectado inferido de los posts",
    },
    affectedPeopleEst: {
      type:        SchemaType.NUMBER,
      description: "Estimación de personas afectadas",
    },
    summary: {
      type:        SchemaType.STRING,
      description: "Resumen del incidente en 1-2 oraciones en español",
    },
    reasoning: {
      type:        SchemaType.STRING,
      description: "Explicación del razonamiento que llevó a esta conclusión",
    },
    relatedPostIds: {
      type:  SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "IDs de los posts que sustentan el análisis",
    },
    suggestedActions: {
      type:  SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Lista de acciones recomendadas para los equipos de emergencia",
    },
  },
  required: ["isIncident", "type", "severity", "confidence", "locationName",
             "affectedPeopleEst", "summary", "reasoning", "relatedPostIds", "suggestedActions"],
}

// ---------------------------------------------------------------------------
// Prompt del sistema
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un agente de análisis de emergencias climáticas para el Centro de Crisis de Tucumán, Argentina.
Tu tarea es analizar posts de redes sociales y determinar si reportan un incidente de emergencia real.

TIPOS DE INCIDENTES que debes detectar:
- flood: inundaciones, desbordes de canales/ríos, lluvias torrenciales con daños
- fire: incendios forestales, incendios urbanos, quemas
- storm: tormentas severas, granizo, tornados, vientos fuertes con daños
- earthquake: sismos, temblores
- accident: accidentes viales graves con múltiples víctimas
- none: no es un incidente de emergencia

CRITERIOS DE SEVERIDAD:
- critical: riesgo de vida inmediato, más de 100 personas afectadas, requiere evacuación
- high: daños severos, 20-100 personas afectadas, recursos de emergencia necesarios
- medium: daños moderados, menos de 20 personas, situación controlable
- low: daños menores, situación informativa

IMPORTANTE:
- Si los posts no son sobre emergencias (deportes, comida, política, etc.), devuelve isIncident=false y type="none"
- Solo considera incidentes en la provincia de Tucumán, Argentina
- Un solo post puede ser suficiente para detectar un incidente crítico
- Triangula la información de múltiples posts para aumentar la confianza
- Las coordenadas de Tucumán están alrededor de lat:-26.8, lng:-65.2`

// ---------------------------------------------------------------------------
// Clase principal
// ---------------------------------------------------------------------------

export class GeminiAnalyzer {
  private readonly model

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY no está configurado en .env.local")
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    this.model  = genAI.getGenerativeModel({
      model:            "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema:   ANALYSIS_SCHEMA as Parameters<typeof genAI.getGenerativeModel>[0]["generationConfig"] extends undefined ? never : NonNullable<Parameters<typeof genAI.getGenerativeModel>[0]["generationConfig"]>["responseSchema"],
      },
    })
  }

  /**
   * Analiza un conjunto de posts y determina si representan un incidente.
   * Los posts se agrupan porque pueden referirse al mismo evento.
   */
  async analyzePosts(posts: SocialPost[]): Promise<GeminiAnalysis> {
    if (posts.length === 0) {
      return this.emptyAnalysis()
    }

    // Construir el texto del prompt con los posts formateados
    const postsText = posts
      .map((p, i) =>
        `[POST ${i + 1}] ID:${p.id} | Plataforma:${p.platform} | Autor:${p.author}\n` +
        `Ubicación reportada: ${p.location ?? "no especificada"}\n` +
        `Contenido: "${p.text}"\n` +
        `Fecha: ${p.postedAt.toLocaleString("es-AR")}`
      )
      .join("\n\n---\n\n")

    const prompt = `Analiza los siguientes ${posts.length} posts de redes sociales y determina si reportan un incidente de emergencia:\n\n${postsText}`

    try {
      const result   = await this.model.generateContent(prompt)
      const rawJson  = result.response.text()
      const analysis = JSON.parse(rawJson) as GeminiAnalysis

      // Asegurar que relatedPostIds y suggestedActions sean arrays
      return {
        ...analysis,
        relatedPostIds:   analysis.relatedPostIds   ?? [],
        suggestedActions: analysis.suggestedActions ?? [],
      }
    } catch (err) {
      console.error("[GeminiAnalyzer] Error al llamar a la API:", err)
      return {
        ...this.emptyAnalysis(),
        reasoning: `Error al procesar con Gemini: ${String(err)}`,
      }
    }
  }

  /**
   * Analiza posts en lotes — útil cuando hay muchos posts y queremos
   * detectar múltiples incidentes simultáneos.
   */
  async analyzeInBatches(
    posts: SocialPost[],
    batchSize = 5,
  ): Promise<GeminiAnalysis[]> {
    const results: GeminiAnalysis[] = []

    for (let i = 0; i < posts.length; i += batchSize) {
      const batch  = posts.slice(i, i + batchSize)
      const result = await this.analyzePosts(batch)
      if (result.isIncident) {
        results.push(result)
      }
    }

    return results
  }

  private emptyAnalysis(): GeminiAnalysis {
    return {
      isIncident:         false,
      type:               "none",
      severity:           "low",
      confidence:         0,
      locationName:       "",
      affectedPeopleEst:  0,
      summary:            "No se detectó ningún incidente",
      reasoning:          "Los posts no contienen información relevante sobre emergencias",
      relatedPostIds:     [],
      suggestedActions:   [],
    }
  }
}
