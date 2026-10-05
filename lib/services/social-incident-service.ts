/**
 * lib/services/social-incident-service.ts
 *
 * Pipeline único de ingesta de menciones en redes sociales:
 *
 *   post ──► ¿contiene #AlertaTucuman? ──no──► ignored
 *                    │ sí
 *                    ▼
 *            ¿ya fue procesado? ──sí──► duplicate
 *                    │ no
 *                    ▼
 *     análisis IA (OpenRouter → Gemini → reglas) ──no es emergencia──► rejected
 *                    │
 *                    ▼
 *     georreferenciación (geo del post → nomenclátor → aproximada)
 *                    │
 *        ¿incidente activo en el mismo lugar? ──sí──► corroborated
 *                    │ no
 *                    ▼
 *        ¿límite de activos? ──sí──► skipped
 *                    │ no
 *                    ▼
 *                 created  (Supabase → Realtime → mapa)
 *
 * Lo usan tanto el webhook POST /api/social/mention como el SocialMediaAgent.
 */

import { randomUUID } from "crypto"
import { CONFIG } from "@/lib/config"
import { LlmAnalyzer } from "@/lib/agents/llm-analyzer"
import { analyzePostHeuristically } from "@/lib/agents/heuristic-analyzer"
import { containsTriggerHashtag, extractHashtags, TRIGGER_HASHTAG } from "@/lib/agents/hashtag"
import { DEFAULT_PLACE, findPlaceInText, jitter } from "@/lib/agents/tucuman-gazetteer"
import type { GeminiAnalysis, MentionOutcome, SocialPlatform, SocialPost } from "@/lib/agents/types"

const TYPE_MAP: Record<string, string> = {
  flood:      "flood",
  fire:       "fire",
  storm:      "storm",
  accident:   "accident",
  looting:    "looting",
  violence:   "violence",
  earthquake: "general",
  general:    "general",
  none:       "general",
}

const SEVERITY_RANK = ["low", "medium", "high", "critical"] as const

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  twitter:   "X (Twitter)",
  facebook:  "Facebook",
  instagram: "Instagram",
  tiktok:    "TikTok",
  mock:      "Feed simulado",
  usgs:      "USGS Earthquake Feed",
  eonet:     "NASA EONET",
}

// Import diferido: permite usar el pipeline en modo dryRun sin credenciales de Supabase
async function db() {
  return (await import("@/lib/supabase")).supabase
}

let llm: LlmAnalyzer | null = null

async function analyze(post: SocialPost): Promise<{ analysis: GeminiAnalysis; analyzer: "llm" | "heuristic" }> {
  if (LlmAnalyzer.hasAnyProvider()) {
    llm ??= new LlmAnalyzer()
    const analysis = await llm.analyzePosts([post])
    // confidence 0 + isIncident=false es la respuesta vacía que devuelven los analizadores ante un error
    const failed = !analysis.isIncident && analysis.confidence === 0
    if (!failed) return { analysis: { ...analysis, relatedPostIds: [post.id] }, analyzer: "llm" }
    console.warn("[SocialIngest] LLM no disponible, usando análisis por reglas")
  }
  return { analysis: analyzePostHeuristically(post), analyzer: "heuristic" }
}

function resolveLocation(post: SocialPost, analysis: GeminiAnalysis) {
  const place = findPlaceInText(analysis.locationName, post.text, post.location)
  if (post.geoLat !== undefined && post.geoLng !== undefined) {
    return { nombre: place?.nombre ?? analysis.locationName ?? post.location ?? DEFAULT_PLACE.nombre, lat: post.geoLat, lng: post.geoLng }
  }
  if (place) return { nombre: place.nombre, lat: place.lat, lng: place.lng }
  if (analysis.coordinatesInferred) return { nombre: analysis.locationName, ...analysis.coordinatesInferred }
  return { nombre: analysis.locationName || DEFAULT_PLACE.nombre, lat: jitter(DEFAULT_PLACE.lat, 600), lng: jitter(DEFAULT_PLACE.lng, 600) }
}

function maxSeverity(a: string, b: string): string {
  return SEVERITY_RANK[Math.max(SEVERITY_RANK.indexOf(a as never), SEVERITY_RANK.indexOf(b as never), 0)]
}

export interface IngestOptions {
  /** Ejecuta filtro + análisis sin escribir en la base de datos */
  dryRun?: boolean
}

export async function ingestSocialPost(post: SocialPost, { dryRun = false }: IngestOptions = {}): Promise<MentionOutcome> {
  // Fuentes autoritativas (USGS, EONET) no usan hashtag: su propia API
  // es la verificación. El campo `hashtag` del outcome refleja qué lo disparó.
  const trigger = post.trusted ? PLATFORM_LABELS[post.platform] ?? post.platform : TRIGGER_HASHTAG
  const base = { postId: post.id, platform: post.platform, author: post.author, hashtag: trigger }

  if (!post.trusted && !containsTriggerHashtag(post.text)) {
    return { ...base, status: "ignored", reason: `El post no contiene ${TRIGGER_HASHTAG}` }
  }

  const supabase = dryRun ? null : await db()

  if (supabase) {
    const { data: dup, error } = await supabase
      .from("incidentes")
      .select("id")
      .contains("fuente_detalles", { related_post_ids: [post.id] })
      .limit(1)
    if (error) throw new Error(`Failed to check duplicate post: ${error.message}`)
    if (dup?.length) return { ...base, status: "duplicate", incidentId: dup[0].id, reason: "Post ya procesado" }
  }

  // Fuentes trusted traen su propio análisis determinístico
  const { analysis, analyzer } = post.preAnalysis
    ? { analysis: post.preAnalysis, analyzer: "api" as const }
    : await analyze(post)

  if (!analysis.isIncident || analysis.confidence < CONFIG.AI.MIN_CONFIDENCE_TO_PERSIST) {
    return { ...base, status: "rejected", analyzer, analysis, reason: analysis.reasoning }
  }

  const location = resolveLocation(post, analysis)
  analysis.locationName = location.nombre

  if (!supabase) {
    return { ...base, status: "created", analyzer, analysis, location: location.nombre, reason: "dryRun: no se persistió" }
  }

  const corroboration = {
    post_id:  post.id,
    platform: post.platform,
    author:   post.author,
    content:  post.text,
    at:       new Date().toISOString(),
  }

  // ── Corroboración: ya hay un incidente activo en ese lugar ────────────────
  const { data: existing, error: findError } = await supabase
    .from("incidentes")
    .select("id, severidad, personas_afectadas, fuente_detalles")
    .eq("ubicacion", location.nombre)
    .eq("estado", "activo")
    .limit(1)
  if (findError) throw new Error(`Failed to check existing incident: ${findError.message}`)

  if (existing?.length) {
    const current = existing[0]
    const details = (current.fuente_detalles ?? {}) as Record<string, unknown>
    const aiAnalysis = (details.ai_analysis ?? {}) as Record<string, unknown>
    const { error: updateError } = await supabase
      .from("incidentes")
      .update({
        severidad:          maxSeverity(current.severidad, analysis.severity),
        personas_afectadas: Math.max(current.personas_afectadas ?? 0, analysis.affectedPeopleEst),
        fuente_detalles: {
          ...details,
          reports_count:    Number(details.reports_count ?? 1) + 1,
          related_post_ids: [...((details.related_post_ids as string[]) ?? []), post.id],
          corroborations:   [...((details.corroborations as unknown[]) ?? []), corroboration].slice(-10),
          ai_analysis: {
            ...aiAnalysis,
            confidence: Math.min(99, Number(aiAnalysis.confidence ?? analysis.confidence) + CONFIG.SOCIAL.CORROBORATION_CONFIDENCE_BOOST),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
    if (updateError) throw new Error(`Failed to corroborate incident: ${updateError.message}`)
    return { ...base, status: "corroborated", analyzer, analysis, incidentId: current.id, location: location.nombre }
  }

  const { count, error: countError } = await supabase
    .from("incidentes")
    .select("*", { count: "exact", head: true })
    .eq("estado", "activo")
  if (countError) throw new Error(`Failed to count active incidents: ${countError.message}`)
  if ((count ?? 0) >= CONFIG.INCIDENTS.MAX_ACTIVE) {
    return { ...base, status: "skipped", analyzer, analysis, location: location.nombre, reason: `Límite de ${CONFIG.INCIDENTS.MAX_ACTIVE} incidentes activos alcanzado` }
  }

  // Las detecciones de IA quedan PENDIENTES (locales). Sólo al confirmarse y despacharse
  // se firman en Arkiv; si nadie las valida en 1 hora se eliminan (Darwinian Decay).
  const onChainKey = `${CONFIG.ARKIV.SIMULATED_KEY_PREFIX}Detection-${randomUUID().replace(/-/g, "")}`
  analysis.arkivKey = onChainKey
  const now = new Date().toISOString()

  const { data: inserted, error: insertError } = await supabase
    .from("incidentes")
    .insert({
      tipo:               TYPE_MAP[analysis.type] ?? "general",
      severidad:          analysis.severity,
      ubicacion:          location.nombre,
      latitud:            location.lat,
      longitud:           location.lng,
      personas_afectadas: analysis.affectedPeopleEst,
      fuente:             post.trusted ? "sensor" : "social",
      fuente_detalles: {
        platform:         PLATFORM_LABELS[post.platform] ?? post.platform,
        platform_id:      post.platform,
        username:         post.author,
        author_url:       post.authorUrl,
        content:          post.text,
        imageUrl:         post.imageUrl,
        post_id:          post.id,
        posted_at:        post.postedAt.toISOString(),
        hashtag:          post.trusted ? trigger : TRIGGER_HASHTAG,
        hashtags:         extractHashtags(post.text),
        ...(post.trusted ? { source_api: post.platform, source_url: post.authorUrl } : {}),
        reports_count:    1,
        related_post_ids: [post.id],
        corroborations:   [],
        analyzer,
        ...(post.simulated ? { simulated: true } : {}),
        arkiv_entity_key: onChainKey,
        ai_analysis: {
          summary:          analysis.summary,
          reasoning:        analysis.reasoning,
          suggestedActions: analysis.suggestedActions,
          confidence:       analysis.confidence,
          relatedPostIds:   [post.id],
          arkiv_entity_key: onChainKey,
        },
      },
      estado:     "activo",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()
  if (insertError) throw new Error(`Supabase insert error: ${insertError.message}`)

  console.log(`[SocialIngest] ${TRIGGER_HASHTAG} → incidente "${location.nombre}" (${analysis.type}, ${analysis.confidence}% vía ${analyzer})`)
  return { ...base, status: "created", analyzer, analysis, incidentId: inserted.id, location: location.nombre }
}
