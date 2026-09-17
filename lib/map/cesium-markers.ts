import type { Incident } from "@/lib/types"
import { severityHex } from "@/components/dashboard/crisis-map/incident-helpers"

const TYPE_GLYPH: Record<Incident["type"], string> = {
  flood: "💧",
  fire: "🔥",
  storm: "🌪",
  looting: "⚠",
  violence: "🚨",
  accident: "🚗",
  general: "⚠",
}

const canvasCache = new Map<string, HTMLCanvasElement>()

export function incidentBillboardCanvas(incident: Incident): HTMLCanvasElement {
  const key = `${incident.severity}:${incident.type}`
  const cached = canvasCache.get(key)
  if (cached) return cached

  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  const color = severityHex(incident.severity)

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, 22, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.28
  ctx.fill()

  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, 14, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#ffffff"
  ctx.stroke()

  ctx.font = "16px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#ffffff"
  ctx.fillText(TYPE_GLYPH[incident.type] ?? "⚠", size / 2, size / 2 + 1)

  canvasCache.set(key, canvas)
  return canvas
}

export function pulseRadiusMeters(severity: Incident["severity"]): number {
  switch (severity) {
    case "critical":
      return 220
    case "high":
      return 160
    case "medium":
      return 110
    default:
      return 80
  }
}
