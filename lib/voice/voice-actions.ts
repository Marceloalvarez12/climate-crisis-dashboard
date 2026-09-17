/**
 * Dispatcher de comandos por voz para Zntinel.
 * Mapea transcripciones (ES-AR) a acciones sobre el estado del dashboard.
 * Sin dependencias externas — matching por includes() con normalización básica.
 */
import type { Incident } from "@/lib/types"
import type { VisualMode } from "@/lib/map/visual-modes"
import type { Earthquake, WeatherSnapshot } from "@/lib/data/layers"

export interface VoiceContext {
  incidents: Incident[]
  earthquakes: Earthquake[]
  weather: WeatherSnapshot | null
  showEarthquakes: boolean
  showWeather: boolean
  visualMode: VisualMode
}

export interface VoiceActions {
  selectIncident: (incident: Incident) => void
  flyToOverview: () => void
  setShowEarthquakes: (v: boolean) => void
  setShowWeather: (v: boolean) => void
  setVisualMode: (m: VisualMode) => void
}

export interface VoiceResult {
  handled: boolean
  message: string
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .trim()
}

export function dispatchCommand(
  transcript: string,
  ctx: VoiceContext,
  actions: VoiceActions,
): VoiceResult {
  const t = normalize(transcript)
  if (!t) return { handled: false, message: "No escuché nada" }

  // ── Capas: sismos ──────────────────────────────────────────────────────
  if (/(mostrar|activar|prender)\s+sismo/.test(t) || t === "sismos on" || t === "activar sismos") {
    if (ctx.showEarthquakes) return { handled: true, message: "Sismos ya estaban activados" }
    actions.setShowEarthquakes(true)
    return { handled: true, message: "Sismos activados" }
  }
  if (/(ocultar|apagar|quitar)\s+sismo/.test(t) || t === "sismos off") {
    if (!ctx.showEarthquakes) return { handled: true, message: "Sismos ya estaban ocultos" }
    actions.setShowEarthquakes(false)
    return { handled: true, message: "Sismos ocultos" }
  }

  // ── Capas: clima ───────────────────────────────────────────────────────
  if (/(mostrar|activar)\s+clima/.test(t) || t === "clima on") {
    if (ctx.showWeather) return { handled: true, message: "Clima ya estaba activado" }
    actions.setShowWeather(true)
    return { handled: true, message: "Clima activado" }
  }
  if (/(ocultar|apagar|quitar)\s+clima/.test(t) || t === "clima off") {
    if (!ctx.showWeather) return { handled: true, message: "Clima ya estaba oculto" }
    actions.setShowWeather(false)
    return { handled: true, message: "Clima ocultado" }
  }

  // ── Modo de visualización ─────────────────────────────────────────────
  const modeMatch = t.match(/modo\s+(satelite|satelital|calles|topo|topografico|noche|tactico)/)
  if (modeMatch) {
    const raw = modeMatch[1]
    const mode: VisualMode =
      raw === "satelite" || raw === "satelital" ? "satellite" :
      raw === "calles" ? "street" :
      raw === "topo" || raw === "topografico" ? "topo" :
      "dark"
    actions.setVisualMode(mode)
    return { handled: true, message: `Modo ${mode === "satellite" ? "satélite" : mode === "street" ? "calles" : mode === "topo" ? "topográfico" : "noche"}` }
  }

  // ── Vista general ──────────────────────────────────────────────────────
  if (/(vista\s+general|situacion\s+general|alejar|reset|volver)/.test(t)) {
    actions.flyToOverview()
    return { handled: true, message: "Vista general" }
  }

  // ── Incidente crítico ──────────────────────────────────────────────────
  if (/(incidente\s+critico|el\s+mas\s+grave|peor\s+caso|critico)/.test(t)) {
    const critical = ctx.incidents.find((i) => i.severity === "critical")
      ?? ctx.incidents.find((i) => i.severity === "high")
      ?? ctx.incidents[0]
    if (!critical) return { handled: true, message: "Sin incidentes activos" }
    actions.selectIncident(critical)
    return { handled: true, message: `Centrando en ${critical.location.split(" - ")[0]}` }
  }

  // ── Centrar en [ubicación] — match por substring ───────────────────────
  const centerMatch = t.match(/centrar\s+en\s+(.+)/) || t.match(/ir\s+a\s+(.+)/) || t.match(/enfocar\s+(.+)/)
  if (centerMatch) {
    const query = centerMatch[1].trim()
    if (query.length < 3) return { handled: false, message: "Ubicación muy corta" }
    const found = ctx.incidents.find((i) => normalize(i.location).includes(query))
      ?? ctx.earthquakes.find((e) => normalize(e.place).includes(query))
    if (!found) {
      return { handled: true, message: `No encontré "${query}"` }
    }
    if ("location" in found) {
      actions.selectIncident(found as Incident)
      return { handled: true, message: `Centrando en ${(found as Incident).location.split(" - ")[0]}` }
    }
    return { handled: true, message: `Sismo M${(found as Earthquake).magnitude.toFixed(1)} ${(found as Earthquake).place}` }
  }

  // ── Status ─────────────────────────────────────────────────────────────
  if (/(estado|reporte|status)/.test(t)) {
    const n = ctx.incidents.length
    const crit = ctx.incidents.filter((i) => i.severity === "critical").length
    const eq = ctx.earthquakes.length
    const temp = ctx.weather ? `${ctx.weather.temperatureC.toFixed(0)}°C` : "N/D"
    return {
      handled: true,
      message: `${n} incidentes${crit ? `, ${crit} críticos` : ""}. ${eq} sismos. Clima ${temp}`,
    }
  }

  if (/(temperatura|clima\s+actual)/.test(t)) {
    if (!ctx.weather) return { handled: true, message: "Sin datos de clima" }
    return {
      handled: true,
      message: `${ctx.weather.temperatureC.toFixed(0)}°C, viento ${ctx.weather.windSpeedKmh.toFixed(0)} km/h, lluvia ${ctx.weather.precipitationMm.toFixed(1)} mm`,
    }
  }

  if (/(sismo|cantidad\s+de\s+sismo).*cerca/.test(t) || /hay\s+sismo/.test(t)) {
    const recent = ctx.earthquakes.filter((e) => e.magnitude >= 4).length
    return {
      handled: true,
      message: `${recent} sismos M≥4 en últimos 7 días`,
    }
  }

  return { handled: false, message: `No entendí "${transcript}"` }
}

export const VOICE_COMMAND_HINTS = [
  '"Centrar en incidente crítico"',
  '"Centrar en Plaza Independencia"',
  '"Mostrar / ocultar sismos"',
  '"Mostrar / ocultar clima"',
  '"Modo satélite / calles / topo / noche"',
  '"Vista general"',
  '"Estado del sistema"',
  '"Cuál es la temperatura?"',
] as const
