/**
 * lib/mock-data.ts
 *
 * Datos de prueba centralizados para el sistema de monitoreo de crisis.
 *
 * Cuando se integren APIs reales (X/Twitter, sensores, camaras), este archivo
 * es el unico que debe modificarse. El resto de la app consume estas estructuras
 * sin conocer el origen de los datos.
 *
 * Para conectar una fuente real:
 *   1. Reemplazar el array correspondiente (SOCIAL_REPORTS, SENSOR_REPORTS, CAMERA_REPORTS)
 *      con una funcion async que llame a la API externa.
 *   2. El shape de cada objeto debe mantenerse identico para no romper los consumidores.
 */

// ---------------------------------------------------------------------------
// Tipos base compartidos
// ---------------------------------------------------------------------------

export type IncidentTipo = "flood" | "fire" | "storm" | "looting" | "violence" | "accident" | "general"
export type IncidentSeveridad = "critical" | "high" | "medium" | "low"
export type IncidentFuente = "social" | "sensor" | "camera"

export interface SocialReport {
  texto: string
  fuente: string
  tipo: IncidentTipo
  zona: { lat: number; lng: number; nombre: string }
  imageUrl?: string
}

export interface SensorReport {
  sensorId: string
  tipo: IncidentTipo
  zona: { lat: number; lng: number; nombre: string }
  temperature: number
  humidity: number
  windSpeed: number
  pressure: number
}

export interface CameraReport {
  cameraId: string
  tipo: IncidentTipo
  zona: { lat: number; lng: number; nombre: string }
  imageUrl: string
}

// ---------------------------------------------------------------------------
// Pool de imágenes para rotar y evitar repetición visual
// ---------------------------------------------------------------------------

const FLOOD_IMAGES = [
  "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600",
  "https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=600",
  "https://images.unsplash.com/photo-1603791440277-8d8d35568690?w=600",
  "https://images.unsplash.com/photo-1547036967-23d11caca055?w=600",
]

const FIRE_IMAGES = [
  "https://images.unsplash.com/photo-1583245177184-4ab53e5e391a?w=600",
  "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600",
  "https://images.unsplash.com/photo-1486551937199-baf066858de7?w=600",
  "https://images.unsplash.com/photo-1563298723-dcfeba8fa4e6?w=600",
]

const STORM_IMAGES = [
  "https://images.unsplash.com/photo-1527482937786-6f4c6c3fd49c?w=600",
  "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=600",
  "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=600",
]

const VIOLENCE_IMAGES = [
  "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600",
  "https://images.unsplash.com/photo-1505664194779-8bebcb35da64?w=600",
  "https://images.unsplash.com/photo-1619890831007-a15ecdcd9745?w=600",
]

const LOOTING_IMAGES = [
  "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600",
  "https://images.unsplash.com/photo-1590102421139-3074769fc7e9?w=600",
]

const ACCIDENT_IMAGES = [
  "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600",
  "https://images.unsplash.com/photo-1518364538800-6bcb3f25da49?w=600",
]

const GENERAL_IMAGES = [
  "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600",
]

function pickImage(type: IncidentTipo): string {
  const pool = type === "flood" ? FLOOD_IMAGES
    : type === "fire" ? FIRE_IMAGES
    : type === "storm" ? STORM_IMAGES
    : type === "violence" ? VIOLENCE_IMAGES
    : type === "looting" ? LOOTING_IMAGES
    : type === "accident" ? ACCIDENT_IMAGES
    : GENERAL_IMAGES
  return pool[Math.floor(Math.random() * pool.length)]
}

// ---------------------------------------------------------------------------
// Pool de textos variados para simular reportes reales de redes sociales
// ---------------------------------------------------------------------------

const SOCIAL_TEXTS: Record<IncidentTipo, string[]> = {
  flood: [
    "URGENTE: Inundacion severa en {zona}. El agua supera los 50cm. Vecinos atrapados. #InundacionTucuman",
    "Barrio bajo el agua. Evacuacion en curso. #AlertaTucuman",
    "Canal desbordado en {zona}. El agua arrastra objetos y motos estacionadas.",
    "Lluvia torrencial inunda calles en {zona}. Transito imposible. #TormentaTucuman",
    "Vecinos de {zona} piden ayuda urgente. Agua entrando a las casas.",
    "Calle cortada por inundacion en {zona}. Eviten la zona.",
  ],
  fire: [
    "EMERGENCIA en {zona}. Humo denso dificulta la respiracion. Ambulancias bloqueadas. #SOSTucuman",
    "Incendio en las afueras de {zona}. Humo negro visible a kilometros.",
    "Fuego activo en {zona}. Bomberos en camino. Evacuar edificios cercanos.",
    "Columna de humo sobre {zona}. Residentes reportan olor a quemado intenso.",
    "Incendio forestal cerca de {zona}. Viento empeora la situacion.",
  ],
  storm: [
    "Alerta roja por tormenta electrica. Vientos de 85km/h. Arboles caidos en {zona}. #TormentaTucuman",
    "Vientos destructivos en {zona}. Arboles inmensos aplastaron autos.",
    "Granizo del tamaño de pelotas de tennis en {zona}. Techos dañados.",
    "Tormenta severa azota {zona}. Sin luz en varios barrios.",
    "Tornado confirmado cerca de {zona}. Buscar refugio inmediatamente.",
  ],
  looting: [
    "Tension en {zona}. Grupo de personas intento saquear un comercio local.",
    "Saqueo en curso en {zona}. Policia en camino. Eviten la zona.",
    "Comercio asaltado por grupo numeroso en {zona}. #SeguridadTucuman",
    "Vecinos de {zona} organizan barricadas ante intentos de saqueo.",
  ],
  violence: [
    "Peleas callejeras y disturbios generalizados en {zona}. Eviten la zona.",
    "Enfrentamientos violentos en {zona}. Policia solicita refuerzos.",
    "Situacion critica en {zona}. Motos sospechosas merodeando el area.",
    "Tiroteo reportado en {zona}. Residentes encerrados en sus casas.",
  ],
  accident: [
    "Caos vehicular en {zona} por accidente multiple causado por neblina.",
    "Accidente grave en {zona}. Ambulancias y bomberos en el lugar.",
    "Choque multiple bloquea {zona}. Transito desviado por calles laterales.",
    "Vuelco de camion en {zona}. Material peligroso derramado en la calzada.",
  ],
  general: [
    "Situacion inusual reportada en {zona}. Autoridades investigando.",
    "Emergencia en {zona}. Vecinos solicitan asistencia urgente.",
    "Alerta preventiva en {zona}. Defensa civil monitorea la situacion.",
    "Reporte ciudadano: situacion de riesgo en {zona}. #EmergenciaTucuman",
  ],
}

function generateSocialText(tipo: IncidentTipo, zona: string): string {
  const texts = SOCIAL_TEXTS[tipo]
  const template = texts[Math.floor(Math.random() * texts.length)]
  return template.replace("{zona}", zona)
}

// ---------------------------------------------------------------------------
// Reportes crudos simulados — reemplazar con llamadas a APIs reales
// ---------------------------------------------------------------------------

export const SOCIAL_REPORTS: SocialReport[] = [
  {
    texto: "URGENTE: Inundacion severa en Plaza Independencia. El agua supera los 50cm. Vecinos atrapados. #InundacionTucuman",
    fuente: "@tucuman_alerta",
    tipo: "flood",
    zona: { lat: -26.8305, lng: -65.2038, nombre: "Plaza Independencia - Centro Historico" },
    imageUrl: "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600",
  },
  {
    texto: "Barrio Norte bajo el agua. Evacuacion en Plaza Urquiza. #AlertaTucuman",
    fuente: "@rescate_tucuman",
    tipo: "flood",
    zona: { lat: -26.8214, lng: -65.2028, nombre: "Plaza Urquiza - Barrio Norte" },
    imageUrl: "https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=600",
  },
  {
    texto: "EMERGENCIA MAXIMA en Barrio Sur. Hospital solicita evacuacion por humo. Ambulancias bloqueadas. #SOSTucuman",
    fuente: "@emergencias_tuc",
    tipo: "fire",
    zona: { lat: -26.8398, lng: -65.2088, nombre: "Plaza San Martin - Barrio Sur" },
    imageUrl: "https://images.unsplash.com/photo-1583245177184-4ab53e5e391a?w=600",
  },
  {
    texto: "Vientos destructivos en el parque. Arboles inmensos aplastaron autos en Av. Soldati.",
    fuente: "@rescate_tucuman",
    tipo: "storm",
    zona: { lat: -26.8288, lng: -65.1912, nombre: "Parque 9 de Julio - Av. Soldati" },
  },
  {
    texto: "Caos vehicular en Plazoleta Mitre por accidente multiple causado por neblina.",
    fuente: "@vecino_mitre",
    tipo: "accident",
    zona: { lat: -26.8159, lng: -65.2153, nombre: "Plazoleta Mitre - Av. Belgrano y Mitre" },
  },
  {
    texto: "Tension en Ejercito del Norte. Grupo de personas intento saquear un supermercado local.",
    fuente: "@emergencias_tuc",
    tipo: "looting",
    zona: { lat: -26.8188, lng: -65.2346, nombre: "Av. Ejercito del Norte y Mendoza" },
  },
  {
    texto: "Alerta roja por tormenta electrica. Vientos de 85km/h. Arboles caidos en Parque Avellaneda. #TormentaTucuman",
    fuente: "@meteo_noa",
    tipo: "storm",
    zona: { lat: -26.8261, lng: -65.2239, nombre: "Parque Avellaneda - Av. Mate de Luna" },
    imageUrl: "https://images.unsplash.com/photo-1527482937786-6f4c6c3fd49c?w=600",
  },
  {
    texto: "Incendio en las afueras de la Terminal. Humo negro dificulta la respiracion.",
    fuente: "@pasajero_tuc",
    tipo: "fire",
    zona: { lat: -26.8366, lng: -65.1954, nombre: "Terminal de Omnibus - Av. Brigido Teran" },
  },
  {
    texto: "Peleas callejeras y disturbios generalizados en Fco. de Aguirre. Eviten la zona.",
    fuente: "@seguridad_norte",
    tipo: "violence",
    zona: { lat: -26.8001, lng: -65.2014, nombre: "Av. Fco. de Aguirre y Juan B. Justo" },
  },
  {
    texto: "URGENTE: Canal desbordado en Zona Sur. El agua arrastra motos estacionadas.",
    fuente: "@bomberos_tuc",
    tipo: "flood",
    zona: { lat: -26.8453, lng: -65.2198, nombre: "Av. Roca y Lincoln - Zona Sur" },
  },
]

export const SENSOR_REPORTS: SensorReport[] = [
  {
    sensorId: "WS-PI-012",
    tipo: "storm",
    zona: { lat: -26.8305, lng: -65.2038, nombre: "Plaza Independencia - Centro Historico" },
    temperature: 18, humidity: 94, windSpeed: 65, pressure: 1008,
  },
  {
    sensorId: "WS-PU-003",
    tipo: "general",
    zona: { lat: -26.8214, lng: -65.2028, nombre: "Plaza Urquiza - Barrio Norte" },
    temperature: 22, humidity: 78, windSpeed: 25, pressure: 1015,
  },
  {
    sensorId: "FL-RL-001",
    tipo: "flood",
    zona: { lat: -26.8453, lng: -65.2198, nombre: "Av. Roca y Lincoln - Zona Sur" },
    temperature: 20, humidity: 95, windSpeed: 30, pressure: 1010,
  },
]

export const CAMERA_REPORTS: CameraReport[] = [
  {
    cameraId: "CAM-SM-047",
    tipo: "fire",
    zona: { lat: -26.8398, lng: -65.2088, nombre: "Plaza San Martin - Barrio Sur" },
    imageUrl: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600",
  },
  {
    cameraId: "CAM-TO-023",
    tipo: "fire",
    zona: { lat: -26.8366, lng: -65.1954, nombre: "Terminal de Omnibus - Av. Brigido Teran" },
    imageUrl: "https://images.unsplash.com/photo-1486551937199-baf066858de7?w=600",
  },
]

export interface CitizenReport {
  tipo: IncidentTipo
  severidad: IncidentSeveridad
  zona: { lat: number; lng: number; nombre: string }
  descripcion?: string
}

export const CITIZEN_REPORTS: CitizenReport[] = [
  { tipo: "flood", severidad: "high", zona: { lat: -26.8241, lng: -65.2226, nombre: "Av. Aconquija y Muñecas" }, descripcion: "Calle inundada, agua llega a los tobillos" },
  { tipo: "fire", severidad: "critical", zona: { lat: -26.8299, lng: -65.2178, nombre: "Av. Sarmiento 1234" }, descripcion: "Humo saliendo de un garage, posible incendio" },
  { tipo: "storm", severidad: "high", zona: { lat: -26.8156, lng: -65.2099, nombre: "Av. Mate de Luna y Lamadrid" }, descripcion: "Poste de luz caido, transito cortado" },
  { tipo: "accident", severidad: "medium", zona: { lat: -26.8355, lng: -65.2022, nombre: "Av. 24 de Septiembre y Congreso" }, descripcion: "Choque entre auto y moto" },
  { tipo: "general", severidad: "low", zona: { lat: -26.8212, lng: -65.2145, nombre: "Parque Avellaneda" }, descripcion: "Gente varada bajo la lluvia" },
]

// ---------------------------------------------------------------------------
// Zonas y helpers para incidentes generados dinamicamente (respawn)
// ---------------------------------------------------------------------------

export const RESPAWN_ZONES = [
  { nombre: "Plaza Independencia - Centro Historico", lat: -26.8305, lng: -65.2038 },
  { nombre: "Plaza Urquiza - Barrio Norte", lat: -26.8214, lng: -65.2028 },
  { nombre: "Plaza San Martin - Barrio Sur", lat: -26.8398, lng: -65.2088 },
  { nombre: "Parque 9 de Julio - Av. Soldati", lat: -26.8288, lng: -65.1912 },
  { nombre: "Plazoleta Mitre - Av. Belgrano y Mitre", lat: -26.8159, lng: -65.2153 },
  { nombre: "Av. Ejercito del Norte y Mendoza", lat: -26.8188, lng: -65.2346 },
  { nombre: "Parque Avellaneda - Av. Mate de Luna", lat: -26.8261, lng: -65.2239 },
  { nombre: "Terminal de Omnibus - Av. Brigido Teran", lat: -26.8366, lng: -65.1954 },
  { nombre: "Av. Fco. de Aguirre y Juan B. Justo", lat: -26.8001, lng: -65.2014 },
  { nombre: "Av. Roca y Lincoln - Zona Sur", lat: -26.8453, lng: -65.2198 }
]

export const TIPOS: IncidentTipo[] = ["flood", "fire", "storm", "looting", "violence", "accident", "general"]
export const SEVERIDADES: IncidentSeveridad[] = ["critical", "high", "medium", "low"]
export const FUENTES: IncidentFuente[] = ["social", "sensor", "camera"]

/**
 * Calcula personas afectadas segun tipo y severidad para mayor realismo.
 */
function estimateAffected(tipo: IncidentTipo, severidad: IncidentSeveridad): number {
  const ranges: Record<IncidentTipo, Record<IncidentSeveridad, [number, number]>> = {
    flood:      { critical: [200, 800], high: [50, 200], medium: [10, 80], low: [2, 20] },
    fire:       { critical: [100, 500], high: [30, 150], medium: [5, 50],  low: [1, 10] },
    storm:      { critical: [150, 600], high: [40, 200], medium: [10, 60], low: [2, 15] },
    looting:    { critical: [50, 200],  high: [20, 80],  medium: [5, 30],  low: [1, 10] },
    violence:   { critical: [30, 150],  high: [10, 50],  medium: [3, 20],  low: [1, 8] },
    accident:   { critical: [20, 100],  high: [5, 30],   medium: [2, 15],  low: [1, 5] },
    general:    { critical: [50, 200],  high: [15, 60],  medium: [5, 25],  low: [1, 10] },
  }
  const [min, max] = ranges[tipo]?.[severidad] ?? [5, 50]
  return min + Math.floor(Math.random() * (max - min + 1))
}

/** Construye un incidente aleatorio para el ciclo de respawn.
 * Opcionalmente se le puede forzar una ubicacion o tipo especifico.
 */
export function buildRespawnIncident(base?: { tipo?: string; fuente?: string; zonaIndex?: number }) {
  const zonaObj = base?.zonaIndex !== undefined && base.zonaIndex >= 0 && base.zonaIndex < RESPAWN_ZONES.length
    ? RESPAWN_ZONES[base.zonaIndex]
    : RESPAWN_ZONES[Math.floor(Math.random() * RESPAWN_ZONES.length)]

  const zona = zonaObj.nombre
  const lat = zonaObj.lat
  const lng = zonaObj.lng

  const tipo = (base?.tipo as IncidentTipo) ?? TIPOS[Math.floor(Math.random() * TIPOS.length)]
  const severidad = SEVERIDADES[Math.floor(Math.random() * SEVERIDADES.length)]
  const fuente = (base?.fuente as IncidentFuente) ?? FUENTES[Math.floor(Math.random() * FUENTES.length)]

  const personas_afectadas = estimateAffected(tipo, severidad)

  const simulatedHash = `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("")}`

  const fuente_detalles: Record<string, unknown> =
    fuente === "social"
      ? { platform: "X (Twitter)", username: "@alerta_tucuman", content: generateSocialText(tipo, zona), imageUrl: pickImage(tipo) }
      : fuente === "sensor"
      ? { sensorId: `WS-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`, temperature: 18 + Math.floor(Math.random() * 14), humidity: 70 + Math.floor(Math.random() * 28), windSpeed: 20 + Math.floor(Math.random() * 65), pressure: 1005 + Math.floor(Math.random() * 18) }
      : { cameraId: `CAM-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`, cameraLocation: zona, imageUrl: pickImage(tipo) }

  // Inject mock AI blockchain audit keys to respawned incidents
  fuente_detalles.arkiv_entity_key = simulatedHash
  fuente_detalles.simulated = true
  fuente_detalles.ai_analysis = {
    reasoning: `Análisis automático del incidente de ${tipo} en la zona de ${zona}. Coordenadas validadas por satélite.`,
    suggestedActions: ["Desplegar unidades de respuesta inmediata", "Notificar a Defensa Civil"],
    confidence: 80 + Math.floor(Math.random() * 20),
    relatedPostIds: [`post-${Math.floor(Math.random() * 1000)}`],
    arkiv_entity_key: simulatedHash,
  }

  return {
    tipo,
    severidad,
    ubicacion: zona,
    latitud: lat,
    longitud: lng,
    personas_afectadas,
    fuente,
    fuente_detalles,
    estado: "activo",
    updated_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Metricas estaticas de referencia
// Cuando se integren APIs reales, reemplazar estos valores con llamadas al backend.
// ---------------------------------------------------------------------------

/**
 * Tiempo de respuesta promedio en minutos.
 * Representa el tiempo historico promedio entre la deteccion de un incidente
 * y el despacho de recursos. Valor de referencia basado en datos operacionales.
 */
export const STATIC_RESPONSE_TIME_MIN = 18

/**
 * Tiempos del ciclo de vida de un recurso despachado (ms).
 * Compartidos por use-resource-lifecycle.ts y use-simulation-loop.ts
 * para garantizar consistencia entre despacho manual y simulacion.
 *
 * Flujo: available -> dispatched (2 min) -> busy (3 min) -> available
 * Tiempos realistas para operaciones de respuesta de emergencia.
 */
export const RESOURCE_DISPATCHED_TO_BUSY_MS  = 120_000
export const RESOURCE_BUSY_TO_AVAILABLE_MS   = 180_000

/** Intervalo entre spawns de incidentes en la simulacion automatica */
export const SIMULATION_SPAWN_INTERVAL_MS = 90_000
