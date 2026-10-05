/**
 * lib/agents/connectors/mock-connector.ts
 *
 * Conector mock que simula la respuesta de APIs reales de redes sociales.
 * Se usa cuando no hay credenciales disponibles para las APIs reales.
 *
 * ─── ESTADO: ACTIVO (por defecto) ───────────────────────────────────────────
 *
 * Genera en cada scan un lote fresco de posts de Facebook / Instagram / X
 * sobre Tucumán usando `buildSimulatedPost`. Algunos llevan #AlertaTucuman
 * (disparan incidentes), otros no (el agente los ignora) y otros son ruido
 * off-topic (la IA los rechaza).
 *
 * Cuándo dejarás de necesitar esto:
 *   - Cuando configures X_BEARER_TOKEN → usar XConnector
 *   - Cuando configures FACEBOOK_ACCESS_TOKEN → usar FacebookConnector
 *   - O cuando conectes una fuente real al webhook POST /api/social/mention
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildSimulatedPost } from "@/lib/social-feed-simulator"
import type { SocialPost, SocialPlatform } from "../types"
import type { ConnectorOptions } from "./base"
import { SocialConnector } from "./base"

/** Posts por scan del feed simulado (bajo, para no saturar el mapa ni la cuota del LLM) */
const MOCK_POSTS_PER_SCAN = 3

export class MockConnector extends SocialConnector {
  readonly platform: SocialPlatform = "mock"

  isConfigured(): boolean {
    return true // siempre disponible
  }

  async fetchPosts(options: ConnectorOptions): Promise<SocialPost[]> {
    // Simular latencia de red (300-800 ms)
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500))

    const now   = Date.now()
    const limit = Math.min(options.maxResults ?? MOCK_POSTS_PER_SCAN, MOCK_POSTS_PER_SCAN)

    return Array.from({ length: limit }, (): SocialPost => {
      const post = buildSimulatedPost()
      return {
        id:        post.postId,
        platform:  post.platform,
        text:      post.text,
        author:    post.author,
        authorUrl: post.authorUrl,
        imageUrl:  post.imageUrl,
        location:  post.location,
        postedAt:  new Date(now - Math.random() * 10 * 60 * 1000), // últimos 10 min
        simulated: true,
      }
    })
  }
}
