"use client"

import { useState, useEffect, useMemo } from "react"
import { Truck, Users, Plane, Ship, Building2, HeartPulse } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useResources } from "./crisis-map/use-map-data"

interface Resource {
  id: string
  name: string
  type: "ambulance" | "firefighter" | "helicopter" | "boat" | "shelter" | "medical" | "police"
  status: "available" | "dispatched" | "busy"
  location: string
  eta?: string
}

const getIcon = (type: Resource["type"]) => {
  switch (type) {
    case "ambulance":
      return <Truck className="h-4 w-4" />
    case "firefighter":
      return <Users className="h-4 w-4" />
    case "helicopter":
      return <Plane className="h-4 w-4" />
    case "boat":
      return <Ship className="h-4 w-4" />
    case "shelter":
      return <Building2 className="h-4 w-4" />
    case "medical":
      return <HeartPulse className="h-4 w-4" />
    case "police":
      return <Users className="h-4 w-4" />
    default:
      return <Users className="h-4 w-4" />
  }
}

const getStatusBadge = (status: Resource["status"]) => {
  switch (status) {
    case "available":
      return (
        <Badge variant="outline" className="border-success/50 bg-success/10 text-success text-[10px] px-1.5 py-0">
          Available
        </Badge>
      )
    case "dispatched":
      return (
        <Badge variant="outline" className="border-accent/50 bg-accent/10 text-accent text-[10px] px-1.5 py-0">
          En route
        </Badge>
      )
    case "busy":
      return (
        <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary text-[10px] px-1.5 py-0">
          Busy
        </Badge>
      )
  }
}

export function ResourcesPanel() {
  // Fetch resources from shared hook (unified SWR cache)
  const { data: dbResources, error } = useResources()

  // Transform database resources to local format
  const [dispatchedETAs, setDispatchedETAs] = useState<Record<string, string>>({})

  useEffect(() => {
    const interval = setInterval(() => {
      setDispatchedETAs((prev) => {
        const next = { ...prev }
        let changed = false
        Object.keys(next).forEach((id) => {
          const match = next[id].match(/(\d+)/)
          if (match) {
            const val = parseInt(match[1])
            if (val > 1) {
              next[id] = `${val - 1} min`
              changed = true
            } else {
              delete next[id]
              changed = true
            }
          }
        })
        return changed ? next : prev
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const resources: Resource[] = dbResources ? dbResources.map((r: { id: string; tipo: string; nombre: string; estado: string; ubicacion: string }) => ({
    id: r.id,
    name: r.nombre,
    type: r.tipo as Resource["type"],
    status: r.estado as Resource["status"],
    location: r.ubicacion || "Central Base",
    eta: r.estado === "dispatched" ? (dispatchedETAs[r.id] ?? `${Math.floor(Math.random() * 15) + 5} min`) : undefined
  })) : []

  const availableCount = resources.filter(r => r.status === "available").length
  const enRouteCount = resources.filter(r => r.status === "dispatched").length
  const busyCount = resources.filter(r => r.status === "busy").length

  if (error) {
    return (
      <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Error loading resources</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Available Resources</h2>
        <div className="mt-2 flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-muted-foreground">{availableCount}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-muted-foreground">{enRouteCount}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">{busyCount}</span>
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-2">
          {resources.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Loading resources...</p>
          ) : (
            resources.map((resource) => (
              <div
                key={resource.id}
                className={cn(
                  "rounded-md border border-border bg-secondary/30 p-2.5 transition-all",
                  resource.status === "dispatched" && "border-accent/30",
                  resource.status === "busy" && "border-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "shrink-0",
                      resource.status === "available" && "text-success",
                      resource.status === "dispatched" && "text-accent",
                      resource.status === "busy" && "text-primary"
                    )}>
                      {getIcon(resource.type)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{resource.name}</p>
                      <p className="text-[10px] text-muted-foreground">{resource.location}</p>
                    </div>
                  </div>
                  {getStatusBadge(resource.status)}
                </div>
                {resource.eta && (
                  <p className="mt-1.5 text-[10px] font-mono text-accent">
                    ETA: {resource.eta}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
