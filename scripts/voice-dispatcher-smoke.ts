/**
 * Unit smoke del dispatcher de comandos de voz.
 * Verifica que cada comando esperado matchea la acción correcta.
 */
import { dispatchCommand } from "../lib/voice/voice-actions.ts"

const ctx = {
  incidents: [
    { id: "1", type: "flood", severity: "critical", location: "Plaza Independencia - Centro", coordinates: { lat: -26.83, lng: -65.20 }, affectedPeople: 100, timestamp: new Date(), source: "social", sourceDetails: {} },
    { id: "2", type: "fire",  severity: "high",     location: "Parque 9 de Julio - Av. Soldati", coordinates: { lat: -26.82, lng: -65.19 }, affectedPeople: 50, timestamp: new Date(), source: "sensor", sourceDetails: {} },
  ],
  earthquakes: [
    { id: "eq1", magnitude: 5.4, place: "Chile - 80 km NW", coordinates: { lat: -25, lng: -70, depthKm: 10 }, occurredAt: new Date(), url: "" },
  ],
  weather: { fetchedAt: new Date(), location: { lat: -26.8, lng: -65.2, label: "Tuc" }, temperatureC: 23.8, windSpeedKmh: 5.2, windDirectionDeg: 158, precipitationMm: 0, weatherCode: 2 },
  showEarthquakes: true,
  showWeather: true,
  visualMode: "satellite",
}

let failed = 0
function assert(name: string, cond: boolean, msg = "") {
  const tag = cond ? "✓" : "✗"
  console.log(`  ${tag} ${name}${msg ? ` — ${msg}` : ""}`)
  if (!cond) failed++
}

const calls: string[] = []
const actions = {
  selectIncident: (i: { id: string }) => calls.push(`select:${i.id}`),
  flyToOverview: () => calls.push("overview"),
  setShowEarthquakes: (v: boolean) => calls.push(`eq:${v}`),
  setShowWeather: (v: boolean) => calls.push(`wx:${v}`),
  setVisualMode: (m: string) => calls.push(`mode:${m}`),
}

console.log("Voice dispatcher smoke")
console.log("─".repeat(50))

// mostrar / ocultar sismos
calls.length = 0
const ctxEqOff = { ...ctx, showEarthquakes: false }
let r = dispatchCommand("mostrar sismos", ctxEqOff, actions)
assert("mostrar sismos (off → on) → eq:true", calls[0] === "eq:true", calls.join(","))

calls.length = 0
r = dispatchCommand("ocultar sismos", ctx, actions)
assert("ocultar sismos (on → off) → eq:false", calls[0] === "eq:false", calls.join(","))

// idempotente
calls.length = 0
r = dispatchCommand("mostrar sismos", ctx, actions)
assert("mostrar sismos (already on) → no action", calls.length === 0, calls.join(","))

// mostrar / ocultar clima
calls.length = 0
const ctxWxOff = { ...ctx, showWeather: false }
r = dispatchCommand("mostrar clima", ctxWxOff, actions)
assert("mostrar clima (off → on) → wx:true", calls[0] === "wx:true", calls.join(","))

calls.length = 0
r = dispatchCommand("ocultar clima", ctx, actions)
assert("ocultar clima (on → off) → wx:false", calls[0] === "wx:false", calls.join(","))

// modos
calls.length = 0
r = dispatchCommand("modo satelite", ctx, actions)
assert("modo satelite → mode:satellite", calls[0] === "mode:satellite", calls.join(","))

calls.length = 0
r = dispatchCommand("modo noche tactico", ctx, actions)
assert("modo noche → mode:dark", calls[0] === "mode:dark", calls.join(","))

calls.length = 0
r = dispatchCommand("modo calles", ctx, actions)
assert("modo calles → mode:street", calls[0] === "mode:street", calls.join(","))

calls.length = 0
r = dispatchCommand("modo topografico", ctx, actions)
assert("modo topo → mode:topo", calls[0] === "mode:topo", calls.join(","))

// vista general
calls.length = 0
r = dispatchCommand("vista general", ctx, actions)
assert("vista general → overview", calls[0] === "overview", calls.join(","))

calls.length = 0
r = dispatchCommand("alejar", ctx, actions)
assert("alejar → overview", calls[0] === "overview", calls.join(","))

// incidente crítico
calls.length = 0
r = dispatchCommand("incidente crítico", ctx, actions)
assert("incidente crítico → select:1 (critical)", calls[0] === "select:1", calls.join(","))

// centrar en ubicación
calls.length = 0
r = dispatchCommand("centrar en Plaza Independencia", ctx, actions)
assert("centrar Plaza Independencia → select:1", calls[0] === "select:1", calls.join(","))

calls.length = 0
r = dispatchCommand("ir a Parque", ctx, actions)
assert("ir a Parque → select:2", calls[0] === "select:2", calls.join(","))

// status
calls.length = 0
r = dispatchCommand("estado del sistema", ctx, actions)
assert("estado del sistema → handled", r.handled)
assert("estado menciona incidentes", r.message.includes("incidentes"), r.message)

// temperatura
calls.length = 0
r = dispatchCommand("cuál es la temperatura?", ctx, actions)
assert("temperatura → handled", r.handled)
assert("temperatura menciona grados", r.message.includes("°C"), r.message)

// sismos cerca
calls.length = 0
r = dispatchCommand("hay sismos cerca?", ctx, actions)
assert("sismos cerca → handled", r.handled)

// no entiende
calls.length = 0
r = dispatchCommand("xyz abc 123", ctx, actions)
assert("xyz → not handled", !r.handled)
assert("xyz → mensaje de error", r.message.includes("No entendí"), r.message)

// normalización: acentos
calls.length = 0
r = dispatchCommand("crítico", ctx, actions)
assert("crítico (sin acento) → handled", r.handled)

console.log("─".repeat(50))
if (failed > 0) {
  console.error(`FAIL ${failed} assertions`)
  process.exit(1)
}
console.log("PASS")
