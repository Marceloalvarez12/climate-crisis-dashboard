import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { ingestSocialPost } from "@/lib/services/social-incident-service"
import { LlmAnalyzer } from "@/lib/agents/llm-analyzer"
import { TRIGGER_HASHTAG } from "@/lib/agents/hashtag"
import { apiSuccess, apiError, apiValidationError } from "@/lib/services/api-response"
import { SocialMentionSchema } from "@/lib/validation"

/**
 * Webhook de ingesta de menciones en redes sociales.
 *
 * Cualquier fuente (feed simulado, Zapier/Make/n8n, scraper, Meta webhooks
 * reenviados) puede publicar aquí un post. Sólo los que contienen el hashtag
 * disparador (por defecto #AlertaTucuman) generan un incidente.
 *
 * POST /api/social/mention[?dryRun=true]
 * Headers: x-api-secret: <API_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = SocialMentionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiValidationError(parsed.error.flatten())

    const m = parsed.data
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "true"

    const outcome = await ingestSocialPost(
      {
        id:        m.postId ?? `${m.platform}-${randomUUID()}`,
        platform:  m.platform,
        text:      m.text,
        author:    m.author,
        authorUrl: m.authorUrl,
        imageUrl:  m.imageUrl,
        location:  m.location,
        geoLat:    m.lat,
        geoLng:    m.lng,
        postedAt:  m.postedAt ? new Date(m.postedAt) : new Date(),
        simulated: m.simulated,
      },
      { dryRun },
    )

    return apiSuccess({ ...outcome, dryRun })
  } catch (err) {
    console.error("[API/social/mention]", err)
    return apiError(err instanceof Error ? err.message : String(err))
  }
}

/** Estado del listener: hashtag monitoreado y analizador activo */
export async function GET() {
  return apiSuccess({
    hashtag:  TRIGGER_HASHTAG,
    analyzer: LlmAnalyzer.isConfigured() ? "openrouter" : process.env.GOOGLE_AI_API_KEY ? "gemini" : "heuristic",
    endpoint: "/api/social/mention",
  })
}
