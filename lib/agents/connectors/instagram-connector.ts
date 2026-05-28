/**
 * lib/agents/connectors/instagram-connector.ts
 *
 * Conector para Instagram usando la Instagram Graph API.
 *
 * ─── ESTADO: COMENTADO — requiere credenciales reales ───────────────────────
 *
 * Para activarlo:
 *   1. La Instagram Graph API sólo funciona con cuentas de NEGOCIO o CREATOR.
 *   2. Necesitás la misma app de Facebook con el producto "Instagram Graph API".
 *   3. Configurar permisos: instagram_basic, instagram_manage_insights
 *   4. Agregar al .env.local:
 *        INSTAGRAM_ACCESS_TOKEN=IGQxxxxxxxxx...
 *        INSTAGRAM_ACCOUNT_IDS=id_cuenta1,id_cuenta2
 *
 * LIMITACIÓN IMPORTANTE: Instagram no permite búsqueda por hashtag en tiempo
 * real de forma gratuita desde 2023. La estrategia válida es monitorear
 * cuentas específicas de organismos de emergencia.
 *
 * Para búsqueda por hashtag en tiempo real considerar la API de RapidAPI
 * (servicio de terceros): https://rapidapi.com/search/instagram
 *
 * Documentación: https://developers.facebook.com/docs/instagram-api/reference/ig-user/media
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { SocialPost, SocialPlatform } from "../types"
import type { ConnectorOptions } from "./base"
import { SocialConnector } from "./base"

export class InstagramConnector extends SocialConnector {
  readonly platform: SocialPlatform = "instagram"

  isConfigured(): boolean {
    // return !!process.env.INSTAGRAM_ACCESS_TOKEN
    return false
  }

  async fetchPosts(_options: ConnectorOptions): Promise<SocialPost[]> {
    /*
    ─── IMPLEMENTACIÓN REAL ──────────────────────────────────────────────────

    const accountIds = (process.env.INSTAGRAM_ACCOUNT_IDS ?? "").split(",").filter(Boolean)
    const token = process.env.INSTAGRAM_ACCESS_TOKEN!
    const allPosts: SocialPost[] = []

    for (const accountId of accountIds) {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${accountId}/media?` +
        `fields=id,caption,timestamp,media_url,location&` +
        `access_token=${token}&limit=20`
      )
      if (!res.ok) continue
      const data = await res.json()

      for (const media of data.data ?? []) {
        if (!media.caption) continue
        const text = media.caption as string
        const matches = _options.keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()))
        if (!matches) continue

        allPosts.push({
          id:        media.id,
          platform:  "instagram",
          text:      media.caption,
          author:    accountId,
          authorUrl: `https://instagram.com/${accountId}`,
          imageUrl:  media.media_url,
          geoLat:    media.location?.latitude,
          geoLng:    media.location?.longitude,
          location:  media.location?.name ?? _options.location,
          postedAt:  new Date(media.timestamp),
          rawData:   media,
        })
      }
    }
    return allPosts
    ─── FIN IMPLEMENTACIÓN REAL ─────────────────────────────────────────────*/

    return []
  }
}
