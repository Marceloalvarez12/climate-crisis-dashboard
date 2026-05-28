import { Ambulance, Shield, Truck, Wind, AlertTriangle } from "lucide-react"

// ---------------------------------------------------------------------------
// Icono de recurso según tipo
// ---------------------------------------------------------------------------

export function RecursoIcon({ tipo }: { tipo: string }) {
  switch (tipo) {
    case "ambulance":   return <Ambulance     className="h-5 w-5" />
    case "firefighter": return <Truck         className="h-5 w-5" />
    case "police":      return <Shield        className="h-5 w-5" />
    case "boat":        return <AlertTriangle className="h-5 w-5" />
    case "helicopter":  return <Wind          className="h-5 w-5" />
    default:            return <Shield        className="h-5 w-5" />
  }
}

// ---------------------------------------------------------------------------
// Etiqueta en español según tipo de recurso
// ---------------------------------------------------------------------------

export function tipoRecursoLabel(tipo: string): string {
  switch (tipo) {
    case "ambulance":   return "Ambulancia"
    case "firefighter": return "Volunteer Firefighters"
    case "police":      return "Provincial Police"
    case "boat":        return "Rescue Boats"
    case "helicopter":  return "Helicopters"
    default:            return tipo
  }
}
