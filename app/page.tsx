"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard/header"
import { AIActivityLog } from "@/components/dashboard/ai-activity-log"
import { ResourcesPanel } from "@/components/dashboard/resources-panel"
import { CrisisMap } from "@/components/dashboard/crisis-map"
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel"
import { BroadcastPanel } from "@/components/dashboard/broadcast-panel"
import { DevPanel } from "@/components/dashboard/dev-panel"
import { Suspense } from "react"
import { Map, Bot, Shield, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { mutate } from "swr"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

const supabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

type MobileTab = "map" | "agent" | "resources" | "analytics"

const MOBILE_TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  { id: "map",       label: "Map",       icon: <Map className="h-5 w-5" /> },
  { id: "agent",     label: "AI Agent",  icon: <Bot className="h-5 w-5" /> },
  { id: "resources", label: "Resources", icon: <Shield className="h-5 w-5" /> },
  { id: "analytics", label: "Analytics", icon: <BarChart2 className="h-5 w-5" /> },
]

export default function CrisisDashboard() {
  const [activeTab, setActiveTab] = useState<MobileTab>("map")

  // Realtime subscription to Supabase changes
  useEffect(() => {
    if (!supabaseClient) return

    const channel = supabaseClient
      .channel("realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidentes" },
        (payload) => {
          console.log("Realtime incidentes change:", payload)
          mutate("/api/incidentes?estado=activo")
          mutate("/api/incidentes?estado=atendido")
          mutate("/api/analytics")
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recursos" },
        (payload) => {
          console.log("Realtime recursos change:", payload)
          mutate("/api/recursos")
          mutate("/api/analytics")
        }
      )
      .subscribe()

    return () => {
      supabaseClient.removeChannel(channel)
    }
  }, [])

  // Revalidate all SWR data when user returns to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        mutate("/api/incidentes?estado=activo")
        mutate("/api/incidentes?estado=atendido")
        mutate("/api/recursos")
        mutate("/api/analytics")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <Suspense fallback={null}>
        <DevPanel />
      </Suspense>

      <DashboardHeader />

      {/* ── DESKTOP layout (lg+) ── */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Left sidebar — AI Activity */}
        <aside className="w-72 shrink-0 border-r border-border p-3 overflow-hidden">
          <AIActivityLog />
        </aside>

        {/* Center — Map + Analytics */}
        <main className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
          <div className="flex-1 min-h-0">
            <CrisisMap />
          </div>
          <div className="shrink-0">
            <AnalyticsPanel />
          </div>
        </main>

        {/* Right sidebar — Resources + Broadcast */}
        <aside className="hidden w-80 shrink-0 border-l border-border p-3 xl:block overflow-y-auto">
          <div className="space-y-3">
            <ResourcesPanel />
            <BroadcastPanel />
          </div>
        </aside>
      </div>

      {/* ── MOBILE layout (< lg) ── */}
      <div className="flex flex-1 flex-col overflow-hidden lg:hidden">
        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "map" && (
            <div className="flex flex-col">
              {/* CrisisMap handles its own height (400px map + incident list below) */}
              <CrisisMap />
            </div>
          )}

          {activeTab === "agent" && (
            <div className="h-full p-3">
              <div className="h-[calc(100dvh-8rem)] rounded-lg overflow-hidden">
                <AIActivityLog />
              </div>
            </div>
          )}

          {activeTab === "resources" && (
            <div className="p-3 space-y-3">
              <ResourcesPanel />
              <BroadcastPanel />
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="p-3">
              {/* Stack analytics cards vertically on mobile */}
              <AnalyticsPanel />
            </div>
          )}
        </div>

        {/* Bottom navigation bar */}
        <nav className="shrink-0 border-t border-border bg-card">
          <div className="grid grid-cols-4">
            {MOBILE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-primary border-t-2 border-primary -mt-px"
                    : "text-muted-foreground hover:text-foreground border-t-2 border-transparent -mt-px"
                )}
              >
                <span className={cn("transition-colors", activeTab === tab.id ? "text-primary" : "text-muted-foreground")}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
