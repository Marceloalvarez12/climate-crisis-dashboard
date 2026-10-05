/**
 * lib/agents/social-media-agent.ts
 *
 * Agente principal de monitoreo de redes sociales.
 *
 * Orquesta el ciclo completo:
 *   1. Recolecta posts de los conectores disponibles (X, Facebook, Instagram o Mock)
 *   2. Cada post pasa por el pipeline de ingesta (`ingestSocialPost`):
 *      sólo los que contienen el hashtag disparador (#AlertaTucuman) se analizan
 *      con IA y, si describen una emergencia, se persisten como incidente
 *   3. Retorna el resultado del scan para ser consumido por la UI
 *
 * Arquitectura:
 *   SocialMediaAgent
 *     ├── XConnector          (inactivo — sin X_BEARER_TOKEN)
 *     ├── FacebookConnector   (inactivo — sin FACEBOOK_ACCESS_TOKEN)
 *     ├── InstagramConnector  (inactivo — sin INSTAGRAM_ACCESS_TOKEN)
 *     ├── MockConnector       (fallback si no hay conectores reales)
 *     └── ingestSocialPost    (filtro de hashtag → OpenRouter/Gemini/reglas → Supabase)
 */

import { randomUUID } from "crypto"
import { MockConnector }     from "./connectors/mock-connector"
import { XConnector }        from "./connectors/x-connector"
import { FacebookConnector } from "./connectors/facebook-connector"
import { InstagramConnector } from "./connectors/instagram-connector"
import { TRIGGER_HASHTAG }   from "./hashtag"
import { CONFIG }            from "@/lib/config"
import { ingestSocialPost }  from "@/lib/services/social-incident-service"
import type { SocialConnector, ConnectorOptions } from "./connectors/base"
import type { AgentScanResult, GeminiAnalysis, MentionOutcome, SocialPlatform, SocialPost } from "./types"

// ---------------------------------------------------------------------------
// Configuración de búsqueda
// ---------------------------------------------------------------------------

function connectorOptions(): ConnectorOptions {
  return {
    // El hashtag va primero: es el disparador; el resto amplía la búsqueda en APIs reales
    keywords:   [TRIGGER_HASHTAG, ...CONFIG.SEARCH_KEYWORDS],
    location:   "Tucumán, Argentina",
    maxResults: 8,
    since:      new Date(Date.now() - 30 * 60 * 1000), // últimos 30 minutos
  }
}

// ---------------------------------------------------------------------------
// Agente principal
// ---------------------------------------------------------------------------

export class SocialMediaAgent {
  private readonly realConnectors: SocialConnector[]
  private readonly fallback:       SocialConnector

  constructor() {
    this.realConnectors = [
      new XConnector(),
      new FacebookConnector(),
      new InstagramConnector(),
    ]
    this.fallback = new MockConnector()
  }

  /** Conectores que se usarán en el scan: los reales configurados o, si no hay, el mock */
  private activeConnectors(): SocialConnector[] {
    const real = this.realConnectors.filter((c) => c.isConfigured())
    return real.length > 0 ? real : [this.fallback]
  }

  /**
   * Ejecuta un ciclo completo de escaneo:
   *   collect → filtro de hashtag → analyze → persist
   */
  async runScan(): Promise<AgentScanResult> {
    const scanId    = randomUUID()
    const startedAt = new Date()
    const connectors = this.activeConnectors()
    let allPosts: SocialPost[] = []

    // 1. Recolectar posts de todos los conectores disponibles
    for (const connector of connectors) {
      try {
        const posts = await connector.fetchPosts(connectorOptions())
        allPosts = [...allPosts, ...posts]
        console.log(`[Agent/${connector.platform}] ${posts.length} posts recolectados`)
      } catch (err) {
        console.warn(`[Agent/${connector.platform}] Error al recolectar:`, err)
      }
    }

    const platform = (connectors[0]?.platform ?? "mock") as SocialPlatform

    if (allPosts.length === 0) {
      return this.buildResult(scanId, startedAt, platform, 0, [], "No se obtuvieron posts de ningún conector")
    }

    // 2. Pipeline de ingesta por post (filtro de hashtag + IA + persistencia)
    const outcomes: MentionOutcome[] = []
    for (const post of allPosts) {
      try {
        outcomes.push(await ingestSocialPost(post))
      } catch (err) {
        console.error(`[Agent] Error al procesar post ${post.id}:`, err)
      }
    }

    return this.buildResult(scanId, startedAt, platform, allPosts.length, outcomes)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildResult(
    scanId:         string,
    startedAt:      Date,
    platform:       SocialPlatform,
    postsCollected: number,
    outcomes:       MentionOutcome[],
    error?:         string,
  ): AgentScanResult {
    const matched = outcomes.filter((o) => o.status !== "ignored")
    const incidents: GeminiAnalysis[] = outcomes
      .filter((o) => (o.status === "created" || o.status === "corroborated") && o.analysis)
      .map((o) => o.analysis!)

    return {
      scanId,
      startedAt,
      completedAt:    new Date(),
      postsCollected,
      postsAnalyzed:  matched.filter((o) => o.analysis).length,
      postsMatched:   matched.length,
      hashtag:        TRIGGER_HASHTAG,
      incidentsFound: incidents,
      outcomes,
      platform,
      ...(error ? { error } : {}),
    }
  }

  /** Lista los conectores disponibles y su estado */
  getConnectorStatus() {
    return [...this.realConnectors, this.fallback].map((c) => ({
      platform:     c.platform,
      isConfigured: c.isConfigured(),
    }))
  }
}
