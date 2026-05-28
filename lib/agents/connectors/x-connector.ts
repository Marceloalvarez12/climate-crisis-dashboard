/**
 * lib/agents/connectors/x-connector.ts
 *
 * Conector para X (ex-Twitter) usando la API oficial v2.
 *
 * ─── ESTADO: COMENTADO — requiere credenciales reales ───────────────────────
 *
 * Para activarlo:
 *   1. Crear una app en https://developer.x.com/en/portal/dashboard
 *   2. Obtener Bearer Token con permisos de lectura de tweets
 *   3. Agregar al .env.local:
 *        X_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAxxxxx...
 *   4. Descomentar este archivo y reemplazar el MockConnector en el agente
 *
 * Documentación: https://developer.x.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { SocialPost, SocialPlatform } from "../types"
import type { ConnectorOptions } from "./base"
import { SocialConnector } from "./base"

export class XConnector extends SocialConnector {
  readonly platform: SocialPlatform = "twitter"

  // private readonly bearerToken = process.env.X_BEARER_TOKEN

  isConfigured(): boolean {
    // return !!process.env.X_BEARER_TOKEN
    return false // desactivado hasta tener credenciales
  }

  async fetchPosts(options: ConnectorOptions): Promise<SocialPost[]> {
    if (!this.isConfigured()) {
      throw new Error("X connector no configurado: falta X_BEARER_TOKEN en .env.local")
    }

    /*
    ─── IMPLEMENTACIÓN REAL (descomenta cuando tengas credenciales) ──────────

    const query = [
      options.keywords.map(k => `"${k}"`).join(" OR "),
      options.location ? `place:${options.location}` : "",
      "-is:retweet",           // excluir retweets
      "lang:es",               // solo español
      "has:geo OR place_country:AR", // solo Argentina
    ].filter(Boolean).join(" ")

    const params = new URLSearchParams({
      query,
      max_results:       String(options.maxResults ?? 50),
      "tweet.fields":    "id,text,author_id,created_at,geo,entities,public_metrics",
      "user.fields":     "name,username,profile_image_url",
      "place.fields":    "full_name,geo",
      expansions:        "author_id,geo.place_id,attachments.media_keys",
      "media.fields":    "url,preview_image_url",
      ...(options.since ? { start_time: options.since.toISOString() } : {}),
    })

    const res = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 60 }, // cache 60 segundos en Next.js
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`X API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const usersMap = Object.fromEntries(
      (data.includes?.users ?? []).map((u: any) => [u.id, u])
    )
    const placesMap = Object.fromEntries(
      (data.includes?.places ?? []).map((p: any) => [p.id, p])
    )

    return (data.data ?? []).map((tweet: any): SocialPost => {
      const author = usersMap[tweet.author_id]
      const place  = tweet.geo?.place_id ? placesMap[tweet.geo.place_id] : null

      return {
        id:         tweet.id,
        platform:   "twitter",
        text:       tweet.text,
        author:     author?.name ?? tweet.author_id,
        authorUrl:  `https://x.com/${author?.username}`,
        location:   place?.full_name ?? options.location,
        geoLat:     place?.geo?.bbox ? (place.geo.bbox[1] + place.geo.bbox[3]) / 2 : undefined,
        geoLng:     place?.geo?.bbox ? (place.geo.bbox[0] + place.geo.bbox[2]) / 2 : undefined,
        postedAt:   new Date(tweet.created_at),
        rawData:    tweet,
      }
    })
    ─── FIN IMPLEMENTACIÓN REAL ─────────────────────────────────────────────*/

    return [] // placeholder hasta tener credenciales
  }
}
