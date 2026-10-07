"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ShieldCheck, ExternalLink } from "lucide-react"
import Image from "next/image"
import { logout } from "@/app/login/actions"
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
        <Link href="/" aria-label="Zntinel, centro de control">
          <Image src="/zntinel-logo-optimized.png" alt="Zntinel" width={135} height={83} className="h-11 w-auto object-contain" priority />
        </Link>
        <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:block">Centro de control · Tucumán</span>
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

        <Link href="/admin" className="hidden text-xs text-zinc-400 hover:text-white md:block">Usuarios</Link>
        <form action={logout}><button type="submit" className="text-xs text-zinc-400 hover:text-white">Salir</button></form>

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
