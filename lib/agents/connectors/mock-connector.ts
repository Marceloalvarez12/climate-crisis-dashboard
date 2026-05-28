/**
 * lib/agents/connectors/mock-connector.ts
 *
 * Conector mock que simula la respuesta de APIs reales de redes sociales.
 * Se usa cuando no hay credenciales disponibles para las APIs reales.
 *
 * ─── ESTADO: ACTIVO (por defecto) ───────────────────────────────────────────
 *
 * Genera posts realistas sobre crisis climáticas en Tucumán, Argentina.
 * El pool de posts rota aleatoriamente en cada scan para simular
 * el flujo de información real en redes sociales.
 *
 * Cuándo dejarás de necesitar esto:
 *   - Cuando configures X_BEARER_TOKEN → usar XConnector
 *   - Cuando configures FACEBOOK_ACCESS_TOKEN → usar FacebookConnector
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { SocialPost, SocialPlatform } from "../types"
import type { ConnectorOptions } from "./base"
import { SocialConnector } from "./base"

// ---------------------------------------------------------------------------
// Pool de posts simulados — representan distintos tipos de crisis
// ---------------------------------------------------------------------------

const MOCK_POSTS_POOL = [
  // ── Inundaciones ──────────────────────────────────────────────────────────
  {
    platform: "twitter" as SocialPlatform,
    text: "⚠️ URGENTE: Canal Norte completamente desbordado en Bº San Pablo. Agua llegando a la vereda. 180 familias en zona de riesgo. #AlertaTucuman #Inundacion",
    author: "@rescate_tucuman",
    authorUrl: "https://x.com/rescate_tucuman",
    location: "Barrio San Pablo, Tucumán",
    geoLat: -26.8400, geoLng: -65.2500,
    imageUrl: "https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=600&h=400&fit=crop",
  },
  {
    platform: "facebook" as SocialPlatform,
    text: "ALERTA DEFENSA CIVIL: Se registran desbordes en el arroyo El Manantial a la altura del km 7. Corte total de Ruta 38. Eviten circular por la zona. Los bomberos voluntarios están trabajando.",
    author: "Defensa Civil Tucumán",
    authorUrl: "https://facebook.com/defensacivilTUC",
    location: "El Manantial, Tucumán",
    geoLat: -26.9100, geoLng: -65.3200,
  },
  {
    platform: "twitter" as SocialPlatform,
    text: "Se inundó completamente la bajada del Parque 9 de Julio. El agua llegó hasta las rodillas. Hay autos varados. Alguien avise a @MunicipalidadSMT",
    author: "@vecino_tucuman",
    authorUrl: "https://x.com/vecino_tucuman",
    location: "Centro Histórico, San Miguel de Tucumán",
    geoLat: -26.8241, geoLng: -65.2226,
  },
  {
    platform: "twitter" as SocialPlatform,
    text: "Av. Roca entre Muñecas y Lavalle INTRANSITABLE. La lluvia de anoche dejó todo bajo el agua. #Tucuman #Lluvia",
    author: "@info_tucuman",
    authorUrl: "https://x.com/info_tucuman",
    location: "Av. Roca, San Miguel de Tucumán",
    geoLat: -26.8241, geoLng: -65.2226,
  },

  // ── Incendios ─────────────────────────────────────────────────────────────
  {
    platform: "twitter" as SocialPlatform,
    text: "🔥 INCENDIO en las sierras del cerro San Javier. Columna de humo visible desde el centro. Bomberos ya se encuentran en el lugar. Vientos fuertes complican la situación. #TucumanAlerta",
    author: "@bomberos_tucuman",
    authorUrl: "https://x.com/bomberos_tucuman",
    location: "Cerro San Javier, Tucumán",
    geoLat: -26.8012, geoLng: -65.3456,
    imageUrl: "https://images.unsplash.com/photo-1486551937199-baf066858de7?w=600&h=400&fit=crop",
  },
  {
    platform: "facebook" as SocialPlatform,
    text: "ATENCIÓN VECINOS DE YERBA BUENA: Se detectó un foco de incendio en el sector norte del parque Sierra de San Javier. Favor de no acercarse a la zona y evitar el humo. Las autoridades están actuando.",
    author: "Municipalidad de Yerba Buena",
    authorUrl: "https://facebook.com/muni.yerba.buena",
    location: "Yerba Buena, Tucumán",
    geoLat: -26.8012, geoLng: -65.3300,
  },

  // ── Tormentas ─────────────────────────────────────────────────────────────
  {
    platform: "twitter" as SocialPlatform,
    text: "Granizo del tamaño de pelotas de golf cayendo en Villa Urquiza. Mucho daño en techos y autos. Hay personas con cortes por vidrios. Se necesita asistencia médica.",
    author: "@villaUrquizaVecinos",
    authorUrl: "https://x.com/villaUrquizaVecinos",
    location: "Villa Urquiza, Tucumán",
    geoLat: -26.7800, geoLng: -65.2000,
  },
  {
    platform: "twitter" as SocialPlatform,
    text: "Tornado o tromba de agua reportada cerca de Banda del Río Salí. Árboles caídos en varios puntos. Sin luz en el barrio Los Pocitos. #AlertaMeteorologica #Tucuman",
    author: "@meteorologiaTUC",
    authorUrl: "https://x.com/meteorologiaTUC",
    location: "Banda del Río Salí, Tucumán",
    geoLat: -26.8350, geoLng: -65.1720,
  },

  // ── Posts NO relevantes (para que Gemini aprenda a filtrar) ───────────────
  {
    platform: "twitter" as SocialPlatform,
    text: "Excelente partido de River hoy. La Selección Argentina campeona del mundo. 🇦🇷⚽",
    author: "@deportes_arg",
    authorUrl: "https://x.com/deportes_arg",
    location: "Buenos Aires, Argentina",
    geoLat: -34.6037, geoLng: -58.3816,
  },
  {
    platform: "facebook" as SocialPlatform,
    text: "Nuevo local de empanadas tucumanas en el centro! Probá las de carne cortada a cuchillo 🫓❤️ Hacemos envíos.",
    author: "Empanadas Don Tuco",
    authorUrl: "https://facebook.com/empanadas.don.tuco",
    location: "San Miguel de Tucumán",
    geoLat: -26.8241, geoLng: -65.2226,
  },
]

// ---------------------------------------------------------------------------
// Conector mock
// ---------------------------------------------------------------------------

export class MockConnector extends SocialConnector {
  readonly platform: SocialPlatform = "mock"

  isConfigured(): boolean {
    return true // siempre disponible
  }

  async fetchPosts(options: ConnectorOptions): Promise<SocialPost[]> {
    // Simular latencia de red (300-800 ms)
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500))

    const now   = new Date()
    const limit = options.maxResults ?? 10

    // Selección aleatoria de posts del pool para simular diferentes momentos
    const shuffled = [...MOCK_POSTS_POOL].sort(() => Math.random() - 0.5)
    const selected  = shuffled.slice(0, Math.min(limit, shuffled.length))

    return selected.map((post, idx): SocialPost => ({
      id:        `mock-${now.getTime()}-${idx}`,
      platform:  post.platform,
      text:      post.text,
      author:    post.author,
      authorUrl: post.authorUrl,
      imageUrl:  (post as { imageUrl?: string }).imageUrl,
      location:  post.location,
      geoLat:    post.geoLat,
      geoLng:    post.geoLng,
      postedAt:  new Date(now.getTime() - Math.random() * 30 * 60 * 1000), // últimos 30 min
    }))
  }
}
