/**
 * lib/agents/connectors/facebook-connector.ts
 *
 * Conector para Facebook usando la Graph API v20.
 *
 * ─── ESTADO: COMENTADO — requiere credenciales reales ───────────────────────
 *
 * Para activarlo:
 *   1. Crear una app en https://developers.facebook.com/
 *   2. Agregar el producto "Graph API" y "Pages API"
 *   3. Obtener un Page Access Token con permisos:
 *        pages_read_engagement, pages_read_user_content, public_content
 *   4. Agregar al .env.local:
 *        FACEBOOK_ACCESS_TOKEN=EAAxxxxxxxxx...
 *        FACEBOOK_PAGE_IDS=defensa_civil_tucuman,municipalidad_smt
 *   5. Descomentar este archivo y agregarlo al agente
 *
 * NOTA: Facebook no permite buscar posts públicos arbitrarios por palabra clave
 * como lo hace X. La estrategia aquí es monitorear PÁGINAS específicas de
 * emergencia (Defensa Civil, municipalidades, bomberos) y analizar sus posts.
 *
 * Documentación: https://developers.facebook.com/docs/graph-api/reference/page/feed/
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { SocialPost, SocialPlatform } from "../types"
import type { ConnectorOptions } from "./base"
import { SocialConnector } from "./base"

export class FacebookConnector extends SocialConnector {
  readonly platform: SocialPlatform = "facebook"

  // private readonly accessToken = process.env.FACEBOOK_ACCESS_TOKEN
  // private readonly pageIds     = (process.env.FACEBOOK_PAGE_IDS ?? "").split(",").filter(Boolean)

  isConfigured(): boolean {
    // return !!process.env.FACEBOOK_ACCESS_TOKEN && this.pageIds.length > 0
    return false
  }

  async fetchPosts(options: ConnectorOptions): Promise<SocialPost[]> {
    if (!this.isConfigured()) {
      throw new Error("Facebook connector no configurado: falta FACEBOOK_ACCESS_TOKEN en .env.local")
    }

    /*
    ─── IMPLEMENTACIÓN REAL ──────────────────────────────────────────────────

    const allPosts: SocialPost[] = []
    const fields = "id,message,created_time,place,attachments,from"
    const sinceUnix = options.since ? Math.floor(options.since.getTime() / 1000) : undefined

    for (const pageId of this.pageIds) {
      const params = new URLSearchParams({
        fields,
        access_token: this.accessToken!,
        limit:        String(options.maxResults ?? 25),
        ...(sinceUnix ? { since: String(sinceUnix) } : {}),
      })

      const res = await fetch(
        `https://graph.facebook.com/v20.0/${pageId}/feed?${params}`,
        { next: { revalidate: 120 } }
      )
      if (!res.ok) continue

      const data = await res.json()

      for (const post of data.data ?? []) {
        if (!post.message) continue

        // Filtrar por palabras clave
        const text = (post.message as string).toLowerCase()
        const matches = options.keywords.some(kw => text.includes(kw.toLowerCase()))
        if (!matches) continue

        const imageUrl = post.attachments?.data?.[0]?.media?.image?.src

        allPosts.push({
          id:        post.id,
          platform:  "facebook",
          text:      post.message,
          author:    post.from?.name ?? pageId,
          authorUrl: `https://facebook.com/${post.from?.id ?? pageId}`,
          location:  post.place?.name ?? options.location,
          geoLat:    post.place?.location?.latitude,
          geoLng:    post.place?.location?.longitude,
          imageUrl,
          postedAt:  new Date(post.created_time),
          rawData:   post,
        })
      }
    }

    return allPosts
    ─── FIN IMPLEMENTACIÓN REAL ─────────────────────────────────────────────*/

    return []
  }
}
