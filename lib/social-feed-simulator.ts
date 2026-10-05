/**
 * lib/social-feed-simulator.ts
 *
 * Genera posts realistas de Facebook / Instagram / X para la demo.
 * Mezcla deliberadamente:
 *   - emergencias CON #AlertaTucuman        → deben disparar un incidente
 *   - emergencias SIN el hashtag            → el agente las ignora (filtro)
 *   - posts off-topic con el hashtag        → la IA los rechaza (no es emergencia)
 *   - ruido off-topic sin hashtag           → ignorados
 *
 * Módulo isomórfico usado por el dev panel (cliente) para posts de prueba.
 */

import { CONFIG } from "@/lib/config"
import { TRIGGER_HASHTAG } from "@/lib/agents/hashtag"
import { TUCUMAN_PLACES } from "@/lib/agents/tucuman-gazetteer"
import type { SocialPlatform } from "@/lib/agents/types"

export type SimulatedPlatform = Extract<SocialPlatform, "facebook" | "instagram" | "twitter">

export interface SimulatedPostPayload {
  postId:    string
  platform:  SimulatedPlatform
  author:    string
  authorUrl: string
  text:      string
  imageUrl?: string
  location?: string
  simulated: true
}

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

const EMERGENCY_TEMPLATES: Array<{ text: string; image?: string }> = [
  { text: "URGENTE: se desbordó el canal en {zona}. El agua ya entra a las casas, hay familias atrapadas. {tag}", image: "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600" },
  { text: "Calle totalmente inundada en {zona}, autos varados y el agua llega a las rodillas. Eviten la zona {tag} #Lluvia", image: "https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=600" },
  { text: "{n} familias evacuadas en {zona} por la crecida. Defensa Civil trabajando. {tag}" },
  { text: "🔥 Incendio en {zona}! Columna de humo enorme, los bomberos todavía no llegan {tag}", image: "https://images.unsplash.com/photo-1486551937199-baf066858de7?w=600" },
  { text: "Se prendió fuego un galpón en {zona}, hay mucho humo y vecinos con problemas para respirar. {tag}", image: "https://images.unsplash.com/photo-1583245177184-4ab53e5e391a?w=600" },
  { text: "Granizo enorme en {zona}, techos rotos y heridos por vidrios. Necesitamos ambulancia {tag}" },
  { text: "Árboles caídos y postes de luz en el piso en {zona} después del viento. Sin luz en todo el barrio {tag}", image: "https://images.unsplash.com/photo-1527482937786-6f4c6c3fd49c?w=600" },
  { text: "Choque múltiple en {zona}, hay heridos y el tránsito está cortado. {tag}" },
  { text: "Vuelco de camión en {zona}, se derramó combustible en la calzada. Urgente {tag}" },
  { text: "Intento de saqueo a un supermercado en {zona}, la policía no da abasto {tag}" },
]

const OFF_TOPIC_TEXTS = [
  "Hoy hay sorteo de empanadas tucumanas en la peatonal 🫓 ¡Participá!",
  "Qué lindo día para ir al Parque 9 de Julio con la familia ☀️",
  "Gran partido de Atlético esta noche, ¡vamos Decano! ⚽",
  "Nuevo café de especialidad en Barrio Norte, se los recomiendo ☕",
  "Reunión de vecinos el sábado para organizar la feria del barrio",
]

const AUTHORS: Record<SimulatedPlatform, string[]> = {
  facebook:  ["Vecinos de Tucumán", "María Fernández", "Defensa Civil Tucumán", "Juan Pérez", "Bomberos Voluntarios YB"],
  instagram: ["@tucuman.vecinal", "@lu.gomez.tuc", "@noticias_tucuman", "@fotografo_noa", "@yerbabuena.hoy"],
  twitter:   ["@rescate_tucuman", "@vecino_tucuman", "@info_tucuman", "@meteo_noa", "@bomberos_tuc"],
}

const PROFILE_URL: Record<SimulatedPlatform, (author: string) => string> = {
  facebook:  (a) => `https://facebook.com/${encodeURIComponent(a.replace(/\s+/g, "."))}`,
  instagram: (a) => `https://instagram.com/${a.replace("@", "")}`,
  twitter:   (a) => `https://x.com/${a.replace("@", "")}`,
}

export const SIMULATED_PLATFORMS: SimulatedPlatform[] = ["facebook", "instagram", "twitter"]

export function buildSimulatedPost(overrides: Partial<Pick<SimulatedPostPayload, "platform" | "text" | "author">> = {}): SimulatedPostPayload {
  const platform = overrides.platform ?? pick(SIMULATED_PLATFORMS)
  const author   = overrides.author ?? pick(AUTHORS[platform])
  let text  = overrides.text
  let image: string | undefined
  let location: string | undefined

  if (!text) {
    const roll = Math.random()
    const hashtagChance = CONFIG.SOCIAL.SIMULATED_HASHTAG_PROBABILITY
    if (roll < 0.82) {
      const place    = pick(TUCUMAN_PLACES)
      const template = pick(EMERGENCY_TEMPLATES)
      const withTag  = roll < hashtagChance
      text = template.text
        .replace("{zona}", place.nombre.split(" - ")[0])
        .replace("{n}", String(10 + Math.floor(Math.random() * 120)))
        .replace("{tag}", withTag ? TRIGGER_HASHTAG : "")
        .trim()
      image    = platform === "instagram" ? template.image ?? "https://images.unsplash.com/photo-1603791440277-8d8d35568690?w=600" : template.image
      location = place.nombre
    } else {
      text = `${pick(OFF_TOPIC_TEXTS)}${Math.random() < 0.5 ? ` ${TRIGGER_HASHTAG}` : ""}`
    }
  }

  return {
    postId:    `sim-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform,
    author,
    authorUrl: PROFILE_URL[platform](author),
    text,
    imageUrl:  image,
    location,
    simulated: true,
  }
}
