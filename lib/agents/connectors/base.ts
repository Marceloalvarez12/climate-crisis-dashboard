/**
 * lib/agents/connectors/base.ts
 *
 * Interfaz base que todos los conectores de redes sociales deben implementar.
 * Cada plataforma (X, Facebook, Instagram…) provee su propio conector
 * que implementa este contrato.
 */

import type { SocialPost } from "../types"

export interface ConnectorOptions {
  /** Palabras clave a buscar */
  keywords:    string[]
  /** Ubicación geográfica a centrar la búsqueda (texto libre o bbox) */
  location?:   string
  /** Máximo de posts a retornar */
  maxResults?: number
  /** No traer posts anteriores a este timestamp */
  since?:      Date
}

/**
 * Conector abstracto de red social.
 * Cualquier plataforma nueva debe extender esta clase e implementar `fetchPosts`.
 */
export abstract class SocialConnector {
  abstract readonly platform: string

  /** Busca y retorna posts normalizados */
  abstract fetchPosts(options: ConnectorOptions): Promise<SocialPost[]>

  /** Verifica que las credenciales/config sean válidas */
  abstract isConfigured(): boolean
}
