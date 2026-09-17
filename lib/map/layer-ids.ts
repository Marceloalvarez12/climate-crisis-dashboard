/**
 * IDs por capa en el globo. Evita choques entre incidentes, sismos y clima.
 *  - "inc:<uuid>"     → incidente Zntinel (DB)
 *  - "eq:<usgs-id>"   → terremoto USGS
 *  - "wx:tucuman"     → clima Open-Meteo (un solo punto para Tucumán)
 */

export const ID_INC = (id: string) => `inc:${id}`
export const ID_EQ = (id: string) => `eq:${id}`
export const ID_WX_TUCUMAN = "wx:tucuman"

export function isIncidentId(id: string): boolean {
  return id.startsWith("inc:")
}

export function incidentIdFromEntity(entityId: string): string {
  return entityId.slice(4)
}
