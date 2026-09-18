"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Radio, ShieldCheck, Zap, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import type { Incident } from "@/lib/types"

interface DashboardHeaderProps {
  incidents?: Incident[]
  onSelectIncident?: (incident: Incident) => void
}

export function DashboardHeader({ incidents = [] }: DashboardHeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Real count: critical + high incidents (no fake random accumulation)
  const criticalCount = incidents.filter(
    (i) => i.severity === "critical" || i.severity === "high",
  ).length

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md">
      {/* Left: brand */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
          <Radio className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-sm font-bold tracking-wide text-white sm:text-[15px]">
            Climate Crisis Center
          </h1>
          <p className="hidden font-mono text-[9px] uppercase tracking-wider text-muted-foreground sm:block">
            Command &amp; Control · Tucumán Node
          </p>
        </div>
      </div>

      {/* Right: actions + status */}
      <div className="flex items-center gap-2">
        {/* Critical incidents chip — real data, clickable filter target */}
        {criticalCount > 0 && (
          <Badge
            variant="outline"
            className="hidden h-7 items-center gap-1.5 border-red-500/30 bg-red-500/10 px-2.5 font-mono text-[10px] font-semibold text-red-400 md:flex"
          >
            <AlertTriangle className="h-3 w-3" />
            {criticalCount} CRITICAL
          </Badge>
        )}

        {/* Links unified: same shape, differentiated by accent color only */}
        <Link
          href="/reportar"
          target="_blank"
          className="flex h-7 items-center gap-1.5 rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2.5 text-[11px] font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20"
        >
          <ShieldCheck className="h-3 w-3" />
          ZK Report
          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
        </Link>

        <Link
          href="/auditoria"
          target="_blank"
          className="flex h-7 items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
        >
          <ShieldCheck className="h-3 w-3" />
          Audit
          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
        </Link>

        {/* Live clock — telemetry feel */}
        {currentTime && (
          <div className="hidden h-7 items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 font-mono text-[10px] tabular-nums text-foreground/80 lg:flex">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
            {currentTime.toLocaleString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })} UTC-3
          </div>
        )}
      </div>
    </header>
  )
}
