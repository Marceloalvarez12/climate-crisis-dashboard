import { severityHex } from "./incident-helpers"
import type { IncidentType, IncidentSource } from "@/lib/types"

const INCIDENT_COLORS: Record<IncidentType, string> = {
  flood: "#3b82f6", // blue-500
  fire: "#ef4444", // red-500
  storm: "#8b5cf6", // violet-500
  looting: "#eab308", // yellow-500
  violence: "#f97316", // orange-500
  accident: "#64748b", // slate-500
  general: "#f59e0b", // amber-500
}

const ICON_MAP: Record<IncidentType, string> = {
  flood:   "💧",
  fire:    "🔥",
  storm:   "🌪️",
  looting: "🥷",
  violence: "🥊",
  accident: "🚗",
  general: "⚠️",
}

const SOURCE_INDICATOR: Record<IncidentSource, string> = {
  social: "🐦",
  sensor: "📡",
  camera: "📹",
  citizen: "🙋",
}

/**
 * Crea un icono personalizado de Leaflet con animación de pulso.
 * Debe llamarse sólo en el cliente (window !== undefined).
 */
export function createLeafletIcon(
  severity: string,
  type: IncidentType,
  source: IncidentSource,
) {
  if (typeof window === "undefined") return null

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L     = require("leaflet")
  const color = severityHex(severity)
  const icon  = ICON_MAP[type]
  const src   = SOURCE_INDICATOR[source]

  const isCriticalOrHigh = severity === "critical" || severity === "high"
  const sonarRing = isCriticalOrHigh
    ? `<div style="position:absolute;width:40px;height:40px;border:2.5px solid ${color};border-radius:50%;animation:sonar 1.8s infinite ease-out;pointer-events:none;z-index:0;"></div>`
    : ""

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        ${sonarRing}
        <div style="position:absolute;width:40px;height:40px;background:${color};border-radius:50%;opacity:0.3;animation:pulse 2s infinite;z-index:0;"></div>
        <div style="width:28px;height:28px;background:${color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.4);z-index:1;cursor:pointer;">${icon}</div>
        <div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#171717;border:1px solid ${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;z-index:2;">${src}</div>
      </div>
    `,
    iconSize:    [40, 40],
    iconAnchor:  [20, 20],
    popupAnchor: [0, -20],
  })
}

/** CSS base del tema oscuro. NO incluye filter — el filter se inyecta por tile style */
export const LEAFLET_DARK_STYLES = `
  .leaflet-container { height:100%; width:100%; background:#0a0c10; }
  .leaflet-popup-content-wrapper { background:#171717; border:1px solid #2a2a2a; border-radius:8px; }
  .leaflet-popup-content { color:#fafafa; margin:12px; }
  .leaflet-popup-tip { background:#171717; border:1px solid #2a2a2a; }
  .leaflet-control-zoom a { background:#171717 !important; color:#fafafa !important; border-color:#2a2a2a !important; }
  .leaflet-control-zoom a:hover { background:#2a2a2a !important; }
  .leaflet-control-attribution { background:rgba(23,23,23,0.8) !important; color:#737373 !important; }
  .leaflet-control-attribution a { color:#a3a3a3 !important; }
  @keyframes pulse {
    0%   { transform:scale(1);   opacity:0.3; }
    50%  { transform:scale(1.5); opacity:0.1; }
    100% {transform:scale(1);   opacity:0.3; }
  }
  @keyframes sonar {
    0%   { transform:scale(0.8); opacity:0.6; }
    100% { transform:scale(2.2); opacity:0; }
  }
`
