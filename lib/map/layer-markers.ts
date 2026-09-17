/**
 * Helpers para pintar sismos y clima en un canvas 2D → billboard de Cesium.
 * Cache de canvas por clave para evitar re-pintar.
 */

const cache = new Map<string, HTMLCanvasElement>()

export function earthquakeCanvas(magnitude: number): HTMLCanvasElement {
  const m = Math.max(0, Math.min(10, magnitude))
  const key = `eq:${m.toFixed(1)}`
  const cached = cache.get(key)
  if (cached) return cached

  const size = 56
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  const radius = 8 + m * 2.4
  const intensity = Math.min(1, (m - 2.5) / 7.5)
  const r = Math.round(255)
  const g = Math.round(120 - intensity * 100)
  const b = Math.round(40 - intensity * 30)
  const color = `rgb(${r}, ${g}, ${b})`

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, radius + 8, 0, Math.PI * 2)
  ctx.fillStyle = color.replace("rgb", "rgba").replace(")", ", 0.18)")
  ctx.fill()

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#ffffff"
  ctx.stroke()

  ctx.font = "bold 13px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#ffffff"
  ctx.fillText(m.toFixed(1), size / 2, size / 2)

  cache.set(key, canvas)
  return canvas
}

export function weatherCanvas(opts: {
  tempC: number
  windKmh: number
  precipMm: number
}): HTMLCanvasElement {
  const key = `wx:${opts.tempC.toFixed(0)}:${opts.windKmh.toFixed(0)}:${opts.precipMm.toFixed(1)}`
  const cached = cache.get(key)
  if (cached) return cached

  const width = 220
  const height = 90
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  ctx.fillStyle = "rgba(10, 12, 16, 0.88)"
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = "rgba(120, 200, 240, 0.45)"
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  ctx.font = "bold 32px sans-serif"
  ctx.fillStyle = "#f8fafc"
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillText(`${opts.tempC.toFixed(0)}°`, 12, 8)

  ctx.font = "13px sans-serif"
  ctx.fillStyle = "rgba(220, 230, 240, 0.78)"
  ctx.textAlign = "right"
  ctx.fillText("Open-Meteo", width - 10, 10)

  ctx.font = "13px sans-serif"
  ctx.fillStyle = "#cbd5e1"
  ctx.textAlign = "left"
  ctx.fillText(`Viento ${opts.windKmh.toFixed(0)} km/h`, 12, 50)
  ctx.fillText(`Lluvia ${opts.precipMm.toFixed(1)} mm`, 12, 68)

  cache.set(key, canvas)
  return canvas
}
