import { Droplets, Flame, Wind, AlertTriangle, Twitter, Thermometer, Camera, Store, Siren, Car } from "lucide-react"
import type { IncidentType, IncidentSource } from "@/lib/types"

// ---------------------------------------------------------------------------
// Icon by incident type
// ---------------------------------------------------------------------------

export function IncidentIcon({ type }: { type: IncidentType }) {
  switch (type) {
    case "flood":   return <Droplets      className="h-3 w-3" />
    case "fire":    return <Flame         className="h-3 w-3" />
    case "storm":   return <Wind          className="h-3 w-3" />
    case "looting": return <Store         className="h-3 w-3" />
    case "violence":return <Siren         className="h-3 w-3" />
    case "accident":return <Car           className="h-3 w-3" />
    case "general": return <AlertTriangle className="h-3 w-3" />
  }
}

// ---------------------------------------------------------------------------
// CSS color class by severity
// ---------------------------------------------------------------------------

export function severityColorClass(severity: string): string {
  switch (severity) {
    case "critical": return "bg-primary border-primary text-primary-foreground"
    case "high":     return "bg-accent border-accent text-accent-foreground"
    case "medium":   return "bg-yellow-500 border-yellow-500 text-black"
    default:         return "bg-success border-success text-success-foreground"
  }
}

// ---------------------------------------------------------------------------
// Hex color by severity (for Leaflet marker)
// ---------------------------------------------------------------------------

export function severityHex(severity: string): string {
  switch (severity) {
    case "critical": return "#dc2626"
    case "high":     return "#f97316"
    case "medium":   return "#eab308"
    default:         return "#22c55e"
  }
}

// ---------------------------------------------------------------------------
// Source icon / label
// ---------------------------------------------------------------------------

export function SourceIcon({ source }: { source: IncidentSource }) {
  switch (source) {
    case "social":  return <Twitter     className="h-3 w-3" />
    case "sensor":  return <Thermometer className="h-3 w-3" />
    case "camera":  return <Camera      className="h-3 w-3" />
  }
}

export function sourceLabel(source: IncidentSource): string {
  switch (source) {
    case "social":  return "Social Media"
    case "sensor":  return "Sensors"
    case "camera":  return "Cameras"
  }
}

// ---------------------------------------------------------------------------
// Type -> English label
// ---------------------------------------------------------------------------

export function incidentTypeLabel(type: IncidentType): string {
  switch (type) {
    case "flood":   return "Flood"
    case "fire":    return "Fire"
    case "storm":   return "Storm"
    case "looting": return "Looting"
    case "violence":return "Violence"
    case "accident":return "Accident"
    case "general": return "General"
  }
}

export function incidentSeverityLabel(severity: string): string {
  switch (severity) {
    case "critical": return "Critical"
    case "high":     return "High"
    case "medium":   return "Medium"
    default:         return "Low"
  }
}
