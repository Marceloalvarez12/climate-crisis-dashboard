import {
  Bot, Search, AlertTriangle, Database, Radio, CheckCircle2, Brain,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ActivityItem } from "./types"

// ---------------------------------------------------------------------------
// Icono por tipo de actividad
// ---------------------------------------------------------------------------

export function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  switch (type) {
    case "extraction": return <Search      className="h-3.5 w-3.5" />
    case "analysis":   return <Bot         className="h-3.5 w-3.5" />
    case "alert":      return <AlertTriangle className="h-3.5 w-3.5" />
    case "database":   return <Database    className="h-3.5 w-3.5" />
    case "monitoring": return <Radio       className="h-3.5 w-3.5" />
    case "complete":   return <CheckCircle2 className="h-3.5 w-3.5" />
    case "reasoning":  return <Brain       className="h-3.5 w-3.5" />
  }
}

// ---------------------------------------------------------------------------
// Color del icono por tipo
// ---------------------------------------------------------------------------

export function activityIconColor(type: ActivityItem["type"]): string {
  switch (type) {
    case "extraction": return "text-blue-400"
    case "analysis":   return "text-accent"
    case "alert":      return "text-primary"
    case "database":   return "text-muted-foreground"
    case "monitoring": return "text-accent"
    case "complete":   return "text-success"
    case "reasoning":  return "text-purple-400"
  }
}

// ---------------------------------------------------------------------------
// Badge de severidad
// ---------------------------------------------------------------------------

export function SeverityBadge({ severity }: { severity?: ActivityItem["severity"] }) {
  switch (severity) {
    case "critical":
      return <Badge variant="destructive" className="text-[9px] h-4 px-1">CRITICAL</Badge>
    case "high":
      return <Badge className="bg-accent text-accent-foreground text-[9px] h-4 px-1">HIGH</Badge>
    case "medium":
      return <Badge className="bg-yellow-500 text-black text-[9px] h-4 px-1">MEDIUM</Badge>
    case "low":
      return <Badge variant="secondary" className="text-[9px] h-4 px-1">LOW</Badge>
    default:
      return null
  }
}
