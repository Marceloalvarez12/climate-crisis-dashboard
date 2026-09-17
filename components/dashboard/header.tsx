"use client"

import { useEffect, useState } from "react"
import { Bell, Settings, Zap, Radio, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import type { Incident } from "@/lib/types"

interface DashboardHeaderProps {
  incidents?: Incident[]
  onSelectIncident?: (incident: Incident) => void
}

export function DashboardHeader({ incidents = [], onSelectIncident }: DashboardHeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [alertCount, setAlertCount] = useState(3)

  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setAlertCount(prev => Math.min(prev + 1, 9))
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold text-foreground sm:text-base">Climate Crisis Center</h1>
          <p className="hidden text-[10px] text-muted-foreground sm:block">AI Agent Monitoring System</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/reportar" target="_blank" className="sm:block">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 text-xs font-semibold cursor-pointer">
            <ShieldCheck className="h-3.5 w-3.5" />
            ZK Report
          </Button>
        </Link>

        <Link href="/auditoria" target="_blank" className="sm:block">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs font-semibold cursor-pointer">
            <ShieldCheck className="h-3.5 w-3.5" />
            Audit Portal
          </Button>
        </Link>

        <div className="hidden items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5 sm:flex">
          <Radio className="h-3 w-3 text-success animate-pulse" />
          <span className="text-xs text-muted-foreground">System Active</span>
        </div>

        {currentTime && (
          <div className="hidden rounded-md border border-border bg-secondary/50 px-2.5 py-1.5 font-mono text-xs text-foreground md:block">
            {currentTime.toLocaleString("en-US", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        )}

        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-primary p-0 text-[10px]">
              {alertCount}
            </Badge>
          )}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
