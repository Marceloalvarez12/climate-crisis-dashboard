/**
 * lib/agents/tucuman-gazetteer.ts
 *
 * Nomenclátor de lugares de San Miguel de Tucumán y alrededores.
 * Permite georreferenciar un post de redes sociales a partir del texto
 * ("Canal Norte desbordado en Bº San Pablo…") cuando la plataforma no
 * provee coordenadas. Módulo isomórfico (sin dependencias de servidor).
 */

import { CONFIG } from "@/lib/config"
import { normalizeText } from "./hashtag"

export interface GazetteerPlace {
  nombre:  string
  lat:     number
  lng:     number
  aliases: string[]
}

export const TUCUMAN_PLACES: GazetteerPlace[] = [
  { nombre: "Plaza Independencia - Centro Historico",   lat: -26.8305, lng: -65.2038, aliases: ["plaza independencia", "casa de gobierno", "microcentro", "centro historico"] },
  { nombre: "Plaza Urquiza - Barrio Norte",             lat: -26.8214, lng: -65.2028, aliases: ["plaza urquiza", "barrio norte"] },
  { nombre: "Plaza San Martin - Barrio Sur",            lat: -26.8398, lng: -65.2088, aliases: ["plaza san martin", "barrio sur"] },
  { nombre: "Parque 9 de Julio - Av. Soldati",          lat: -26.8288, lng: -65.1912, aliases: ["parque 9 de julio", "9 de julio", "soldati", "lago san miguel"] },
  { nombre: "Plazoleta Mitre - Av. Belgrano y Mitre",   lat: -26.8159, lng: -65.2153, aliases: ["plazoleta mitre", "belgrano y mitre"] },
  { nombre: "Av. Ejercito del Norte y Mendoza",         lat: -26.8188, lng: -65.2346, aliases: ["ejercito del norte"] },
  { nombre: "Parque Avellaneda - Av. Mate de Luna",     lat: -26.8261, lng: -65.2239, aliases: ["parque avellaneda", "mate de luna"] },
  { nombre: "Terminal de Omnibus - Av. Brigido Teran",  lat: -26.8366, lng: -65.1954, aliases: ["terminal", "brigido teran"] },
  { nombre: "Av. Fco. de Aguirre y Juan B. Justo",      lat: -26.8001, lng: -65.2014, aliases: ["aguirre", "juan b. justo", "juan b justo"] },
  { nombre: "Av. Roca y Lincoln - Zona Sur",            lat: -26.8453, lng: -65.2198, aliases: ["av. roca", "avenida roca", "lincoln", "zona sur"] },
  { nombre: "Barrio San Pablo",                         lat: -26.8400, lng: -65.2500, aliases: ["san pablo", "canal norte"] },
  { nombre: "Villa Urquiza",                            lat: -26.7800, lng: -65.2000, aliases: ["villa urquiza"] },
  { nombre: "Banda del Rio Sali",                       lat: -26.8350, lng: -65.1720, aliases: ["banda del rio sali", "los pocitos", "rio sali"] },
  { nombre: "Yerba Buena",                              lat: -26.8160, lng: -65.3160, aliases: ["yerba buena"] },
  { nombre: "Cerro San Javier",                         lat: -26.8012, lng: -65.3456, aliases: ["san javier", "cerro"] },
  { nombre: "El Manantial",                             lat: -26.9100, lng: -65.3200, aliases: ["el manantial", "ruta 38"] },
  { nombre: "Av. Aconquija y Muñecas",                  lat: -26.8241, lng: -65.2226, aliases: ["aconquija", "munecas"] },
  { nombre: "Av. Sarmiento",                            lat: -26.8299, lng: -65.2178, aliases: ["sarmiento"] },
  { nombre: "Av. 24 de Septiembre y Congreso",          lat: -26.8355, lng: -65.2022, aliases: ["24 de septiembre", "congreso"] },
  { nombre: "Ciudadela",                                lat: -26.8150, lng: -65.2250, aliases: ["ciudadela"] },
  { nombre: "Villa 9 de Julio",                         lat: -26.8050, lng: -65.2380, aliases: ["villa 9 de julio"] },
  { nombre: "Barrio Echeverria",                        lat: -26.8520, lng: -65.2120, aliases: ["echeverria"] },
]

// Aliases más largos primero: "villa 9 de julio" debe ganarle a "9 de julio"
const ALIAS_INDEX = TUCUMAN_PLACES
  .flatMap((place) => place.aliases.map((alias) => ({ alias: normalizeText(alias), place })))
  .sort((a, b) => b.alias.length - a.alias.length)

/** Busca el primer lugar conocido mencionado en uno o más textos */
export function findPlaceInText(...texts: Array<string | undefined>): GazetteerPlace | null {
  const haystack = normalizeText(texts.filter(Boolean).join(" "))
  if (!haystack) return null
  return ALIAS_INDEX.find(({ alias }) => haystack.includes(alias))?.place ?? null
}

/** Pequeño desplazamiento (~150 m) para que posts sin ubicación no se apilen en un solo punto */
export function jitter(coord: number, meters = 150): number {
  return coord + ((Math.random() - 0.5) * 2 * meters) / 111_000
}

export const DEFAULT_PLACE: GazetteerPlace = {
  nombre:  "San Miguel de Tucuman (ubicacion aproximada)",
  ...CONFIG.INCIDENTS.DEFAULT_COORDS,
  aliases: [],
}
