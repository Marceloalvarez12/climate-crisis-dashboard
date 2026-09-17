/**
 * Modos de visualización para el globo 3D.
 * Cada modo define un imagery provider y ajustes de escena.
 */

export type VisualMode = "satellite" | "street" | "topo" | "dark"

export interface VisualModeConfig {
  id: VisualMode
  label: string
  description: string
  url: string
  credit: string
  /** Aplica gamma/invert al canvas para look tipo "FLIR" o "noche táctica". */
  toneMode?: "none" | "invert" | "grayscale" | "thermal"
  /** Ajustes de escena */
  lighting: boolean
  atmosphere: boolean
  backgroundColor: string
}

export const VISUAL_MODES: VisualModeConfig[] = [
  {
    id: "satellite",
    label: "Satélite",
    description: "Esri World Imagery — alta resolución",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri, Maxar, Earthstar Geographics",
    toneMode: "none",
    lighting: true,
    atmosphere: true,
    backgroundColor: "#0a0c10",
  },
  {
    id: "street",
    label: "Calles",
    description: "OpenStreetMap claro",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credit: "© OpenStreetMap contributors · ODbL",
    toneMode: "none",
    lighting: false,
    atmosphere: false,
    backgroundColor: "#cfe2f3",
  },
  {
    id: "topo",
    label: "Topográfico",
    description: "OpenTopoMap — relieve + curvas de nivel",
    url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    credit: "© OpenTopoMap (CC BY-SA 3.0) · OpenStreetMap",
    toneMode: "none",
    lighting: false,
    atmosphere: false,
    backgroundColor: "#dde7d6",
  },
  {
    id: "dark",
    label: "Noche táctica",
    description: "Stadia Maps Alidade Smooth Dark — operativo nocturno",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png",
    credit: "© Stadia Maps © OpenStreetMap",
    toneMode: "none",
    lighting: false,
    atmosphere: false,
    backgroundColor: "#0a0c10",
  },
]

export function getVisualMode(id: VisualMode): VisualModeConfig {
  return VISUAL_MODES.find((m) => m.id === id) ?? VISUAL_MODES[0]
}
