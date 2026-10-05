/**
 * lib/agents/hashtag.ts
 *
 * Detección del hashtag disparador de incidentes (por defecto #AlertaTucuman).
 * Es tolerante a mayúsculas y tildes: #alertatucumán, #ALERTATUCUMAN, etc.
 * Módulo isomórfico: se usa en el servidor (webhook/agente) y en el cliente (dev panel).
 */

import { CONFIG } from "@/lib/config"

export const TRIGGER_HASHTAG = CONFIG.SOCIAL.TRIGGER_HASHTAG

export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

const normalizedTag = normalizeText(TRIGGER_HASHTAG.startsWith("#") ? TRIGGER_HASHTAG : `#${TRIGGER_HASHTAG}`)
const tagRegex = new RegExp(`${normalizedTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9_])`)

export function containsTriggerHashtag(text: string): boolean {
  return tagRegex.test(normalizeText(text))
}

/** Extrae todos los hashtags de un texto (en su forma original) */
export function extractHashtags(text: string): string[] {
  return Array.from(new Set(text.match(/#[\p{L}\p{N}_]+/gu) ?? []))
}
