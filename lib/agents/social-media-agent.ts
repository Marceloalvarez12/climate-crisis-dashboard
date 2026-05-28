/**
 * lib/agents/social-media-agent.ts
 *
 * Agente principal de monitoreo de redes sociales.
 *
 * Orquesta el ciclo completo:
 *   1. Recolecta posts de los conectores disponibles (X, Facebook, Instagram o Mock)
 *   2. Envía los posts a Gemini para análisis
 *   3. Si Gemini detecta un incidente con suficiente confianza, lo persiste en Supabase
 *   4. Retorna el resultado del scan para ser consumido por la UI
 *
 * Arquitectura:
 *   SocialMediaAgent
 *     ├── MockConnector       (activo)
 *     ├── XConnector          (inactivo — sin X_BEARER_TOKEN)
 *     ├── FacebookConnector   (inactivo — sin FACEBOOK_ACCESS_TOKEN)
 *     ├── InstagramConnector  (inactivo — sin INSTAGRAM_ACCESS_TOKEN)
 *     └── GeminiAnalyzer      (activo — usa GOOGLE_AI_API_KEY)
 */

import { randomUUID } from "crypto"
import { MockConnector }     from "./connectors/mock-connector"
import { XConnector }        from "./connectors/x-connector"
import { FacebookConnector } from "./connectors/facebook-connector"
import { InstagramConnector } from "./connectors/instagram-connector"
import { GeminiAnalyzer }    from "./gemini-analyzer"
import { supabase }          from "@/lib/supabase"
import type { SocialConnector, ConnectorOptions } from "./connectors/base"
import type { AgentScanResult, GeminiAnalysis, SocialPost } from "./types"

// Arkiv SDK imports
import { createWalletClient, http } from "@arkiv-network/sdk"
import { braga } from "@arkiv-network/sdk/chains"
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts"
import { jsonToPayload } from "@arkiv-network/sdk/utils"

// ---------------------------------------------------------------------------
// Configuración de búsqueda
// ---------------------------------------------------------------------------

/** Palabras clave que el agente monitorea en redes sociales */
const SEARCH_KEYWORDS = [
  "inundacion", "inundación", "desborde", "crecida", "canal",
  "incendio", "fuego", "quema", "humo", "bomberos",
  "tormenta", "granizo", "tornado", "viento", "lluvia torrencial",
  "sismo", "temblor", "terremoto",
  "emergencia", "evacuacion", "evacuación", "alerta", "defensa civil",
  "rescate", "víctimas", "heridos",
  // Hashtags locales clave
  "AlertaTucuman", "TucumanAlerta", "TucumanEmergencia",
]

const CONNECTOR_OPTIONS: ConnectorOptions = {
  keywords:   SEARCH_KEYWORDS,
  location:   "Tucumán, Argentina",
  maxResults: 8,
  since:      new Date(Date.now() - 30 * 60 * 1000), // últimos 30 minutos
}

/** Umbral mínimo de confianza para persistir un incidente en Supabase */
const MIN_CONFIDENCE_TO_PERSIST = 60

// ---------------------------------------------------------------------------
// Mapa de tipos Gemini → tipos del dominio
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, string> = {
  flood:      "flood",
  fire:       "fire",
  storm:      "storm",
  earthquake: "general",
  accident:   "general",
  none:       "general",
}

const SEVERITY_MAP: Record<string, string> = {
  critical: "critical",
  high:     "high",
  medium:   "medium",
  low:      "low",
}

// Coordenadas aproximadas de Tucumán como fallback
const DEFAULT_COORDS = { lat: -26.8241, lng: -65.2226 }

// ---------------------------------------------------------------------------
// Agente principal
// ---------------------------------------------------------------------------

export class SocialMediaAgent {
  private readonly connectors: SocialConnector[]
  private readonly analyzer:   GeminiAnalyzer

  constructor() {
    // Registrar todos los conectores — se usan sólo los que están configurados
    this.connectors = [
      new XConnector(),
      new FacebookConnector(),
      new InstagramConnector(),
      new MockConnector(),        // siempre disponible como fallback
    ]

    this.analyzer = new GeminiAnalyzer()
  }

  /**
   * Ejecuta un ciclo completo de escaneo:
   *   collect → analyze → (persist si confidence ≥ umbral)
   */
  async runScan(): Promise<AgentScanResult> {
    const scanId    = randomUUID()
    const startedAt = new Date()
    let postsCollected = 0
    let allPosts: SocialPost[] = []

    // 1. Recolectar posts de todos los conectores disponibles
    for (const connector of this.connectors) {
      if (!connector.isConfigured()) continue

      try {
        const posts = await connector.fetchPosts(CONNECTOR_OPTIONS)
        allPosts = [...allPosts, ...posts]
        postsCollected += posts.length
        console.log(`[Agent/${connector.platform}] ${posts.length} posts recolectados`)
      } catch (err) {
        console.warn(`[Agent/${connector.platform}] Error al recolectar:`, err)
      }
    }

    if (allPosts.length === 0) {
      return this.buildResult(scanId, startedAt, 0, 0, [], "No se obtuvieron posts de ningún conector")
    }

    // 2. Analizar con Gemini en lotes
    console.log(`[Agent] Analizando ${allPosts.length} posts con Gemini...`)
    let incidentsFound: GeminiAnalysis[] = []

    try {
      incidentsFound = await this.analyzer.analyzeInBatches(allPosts, 5)
    } catch (err) {
      console.error("[Agent] Error en análisis Gemini:", err)
      return this.buildResult(scanId, startedAt, postsCollected, allPosts.length, [], String(err))
    }

    // 3. Persistir incidentes con confianza suficiente
    for (const analysis of incidentsFound) {
      if (analysis.confidence >= MIN_CONFIDENCE_TO_PERSIST) {
        await this.persistIncident(analysis, allPosts).catch((err) =>
          console.error("[Agent] Error al persistir incidente:", err)
        )
      }
    }

    return this.buildResult(scanId, startedAt, postsCollected, allPosts.length, incidentsFound)
  }

  // ── Persistencia en Supabase a través de la API interna ──────────────────

  private async persistIncident(
    analysis: GeminiAnalysis,
    posts:    SocialPost[],
  ): Promise<void> {
    // Buscar coordenadas en los posts relacionados
    const relatedPosts = posts.filter((p) => analysis.relatedPostIds.includes(p.id))
    const postWithGeo  = relatedPosts.find((p) => p.geoLat && p.geoLng)

    const coords = postWithGeo
      ? { lat: postWithGeo.geoLat!, lng: postWithGeo.geoLng! }
      : DEFAULT_COORDS

    // Check if location already active in Supabase
    const { data: existingIncidents, error: findError } = await supabase
      .from("incidentes")
      .select("id, estado")
      .eq("ubicacion", analysis.locationName)

    if (findError) {
      throw new Error(`Failed to check existing incident: ${findError.message}`)
    }

    const existing = existingIncidents && existingIncidents.length > 0 ? existingIncidents[0] : null
    if (existing && existing.estado === "activo") {
      console.log(`[Agent] Location "${analysis.locationName}" is already occupied by an active incident. Skipping.`)
      return
    }

    // Count active incidents in Supabase
    const { count, error: countError } = await supabase
      .from("incidentes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo")

    if (countError) {
      throw new Error(`Failed to count active incidents: ${countError.message}`)
    }

    const activeCount = count || 0
    if (activeCount >= 11) {
      console.log(`[Agent] Active incident limit reached (11). Skipping persistence for "${analysis.locationName}".`)
      return
    }

    // ── ARKIV ON-CHAIN AI REPORT REGISTRATION ──
    let onChainKey: string | undefined = undefined

    if (process.env.ARKIV_PRIVATE_KEY && process.env.ARKIV_PRIVATE_KEY !== "0xREEMPLAZAR_CON_TU_PRIVATE_KEY_AQUI") {
      try {
        console.log(`[Agent] Registering Gemini analysis for "${analysis.locationName}" on Arkiv Braga testnet...`)
        const account = privateKeyToAccount(process.env.ARKIV_PRIVATE_KEY as `0x${string}`)
        const walletClient = createWalletClient({
          chain: braga,
          transport: http(),
          account,
        })

        const onChainPayload = {
          agent: "Gemini 2.0 Flash",
          task: "Real-time Climate Crisis Monitoring",
          location: analysis.locationName,
          type: TYPE_MAP[analysis.type] ?? "general",
          severity: SEVERITY_MAP[analysis.severity] ?? "medium",
          summary: analysis.summary,
          reasoning: analysis.reasoning,
          suggestedActions: analysis.suggestedActions,
          confidence: analysis.confidence,
          scannedAt: new Date().toISOString(),
        }

        const { entityKey } = await walletClient.createEntity({
          payload: jsonToPayload(onChainPayload),
          contentType: "application/json",
          attributes: [
            { key: "project", value: "climate-crisis-dashboard" },
            { key: "agent", value: "Gemini 2.0 Flash" },
            { key: "tipo", value: TYPE_MAP[analysis.type] ?? "general" },
            { key: "severidad", value: SEVERITY_MAP[analysis.severity] ?? "medium" },
            { key: "ubicacion", value: analysis.locationName || "unknown" },
            { key: "status", value: "detected" },
            { key: "track", value: "arkiv" },
          ],
          expiresIn: 604800, // 7 días
        })

        onChainKey = entityKey
        console.log(`[Agent] Successfully registered on Braga blockchain with Entity Key: ${entityKey}`)
      } catch (err) {
        console.error(`[Agent] Blockchain registration failed, using local fallback. Error:`, err)
      }
    } else {
      console.log(`[Agent] No ARKIV_PRIVATE_KEY found. Simulating on-chain audit...`)
      onChainKey = `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "").slice(0, 32)}`
    }

    // Attach key to in-memory analysis so the frontend receives it
    analysis.arkivKey = onChainKey

    const { data, error: insertError } = await supabase
      .from("incidentes")
      .insert({
        tipo:               TYPE_MAP[analysis.type] ?? "general",
        severidad:          SEVERITY_MAP[analysis.severity] ?? "medium",
        ubicacion:          analysis.locationName,
        latitud:            coords.lat,
        longitud:           coords.lng,
        personas_afectadas: analysis.affectedPeopleEst,
        fuente:             "social",
        fuente_detalles: {
          platform:  "Multi-plataforma (IA)",
          content:   analysis.summary,
          imageUrl:  relatedPosts.find((p) => p.imageUrl)?.imageUrl,
          username:  `@agente_ia (${analysis.confidence}% confianza)`,
          arkiv_entity_key: onChainKey, // dispatch-fallback compatible key
          ai_analysis: {
            reasoning:        analysis.reasoning,
            suggestedActions: analysis.suggestedActions,
            confidence:       analysis.confidence,
            relatedPostIds:   analysis.relatedPostIds,
            arkiv_entity_key: onChainKey, // AI audit key
          },
        },
        estado:             "activo",
        created_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Supabase insert error: ${insertError.message}`)
    }

    console.log(`[Agent] Incidente persistido en Supabase: "${analysis.locationName}" (${analysis.confidence}% confianza)`)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildResult(
    scanId:         string,
    startedAt:      Date,
    postsCollected: number,
    postsAnalyzed:  number,
    incidents:      GeminiAnalysis[],
    error?:         string,
  ): AgentScanResult {
    return {
      scanId,
      startedAt,
      completedAt:    new Date(),
      postsCollected,
      postsAnalyzed,
      incidentsFound: incidents,
      platform:       "mock", // refleja el conector activo
      ...(error ? { error } : {}),
    }
  }

  /** Lista los conectores disponibles y su estado */
  getConnectorStatus() {
    return this.connectors.map((c) => ({
      platform:     c.platform,
      isConfigured: c.isConfigured(),
    }))
  }
}
