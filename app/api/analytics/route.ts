import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { STATIC_RESPONSE_TIME_MIN } from "@/lib/mock-data"

export async function GET() {
  try {
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // 1. Active incidents
    const { data: activeIncidents, error: activeIncError } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")

    if (activeIncError) {
      return NextResponse.json({ error: activeIncError.message }, { status: 500 })
    }

    // 2. All incidents in last 48h
    const { data: allIncidents, error: allIncError } = await supabase
      .from("incidentes")
      .select("*")
      .gte("created_at", since48h)

    if (allIncError) {
      return NextResponse.json({ error: allIncError.message }, { status: 500 })
    }

    // 3. Resources
    const { data: recursos, error: recError } = await supabase
      .from("recursos")
      .select("*")

    if (recError) {
      return NextResponse.json({ error: recError.message }, { status: 500 })
    }

    const active = activeIncidents || []
    const incidents24h = (allIncidents || []).filter(i => i.created_at >= since24h)
    const incidents48h = (allIncidents || []).filter(i => i.created_at >= since48h && i.created_at < since24h)
    const allResources = recursos || []

    // Affected people — only count currently active incidents
    const affectedNow = active.reduce((s, i) => s + (i.personas_afectadas || 0), 0)
    const prev24Active = incidents48h.filter(i => i.estado === "activo")
    const affectedPrev = prev24Active.reduce((s, i) => s + (i.personas_afectadas || 0), 0)
    const affectedChange = affectedPrev > 0
      ? Math.round(((affectedNow - affectedPrev) / affectedPrev) * 100)
      : 0

    // Risk level
    const criticalCount = active.filter(i => i.severidad === "critical").length
    const highCount    = active.filter(i => i.severidad === "high").length
    const mediumCount  = active.filter(i => i.severidad === "medium").length
    const lowCount     = active.filter(i => i.severidad === "low").length
    let riskLevel = "LOW"
    let riskProgress = 20
    if (criticalCount >= 2) { riskLevel = "CRITICAL"; riskProgress = 95 }
    else if (criticalCount === 1) { riskLevel = "CRITICAL"; riskProgress = 85 }
    else if (highCount >= 2) { riskLevel = "HIGH"; riskProgress = 70 }
    else if (highCount === 1 || active.length >= 3) { riskLevel = "MEDIUM"; riskProgress = 50 }
    else if (active.length > 0) { riskLevel = "LOW-MEDIUM"; riskProgress = 35 }

    // Avg response time — static reference for mock
    const avgResponseMin: number = STATIC_RESPONSE_TIME_MIN

    // Incident trend
    const incidentsTrend = incidents24h.length > 0 && incidents48h.length > 0
      ? Math.round(((incidents24h.length - incidents48h.length) / incidents48h.length) * 100)
      : null

    // Resources
    const totalResources = allResources.length
    const deployedResources = allResources.filter(r => r.estado !== "available").length
    const enCamino = allResources.filter(r => r.estado === "dispatched").length
    const ocupados = allResources.filter(r => r.estado === "busy").length

    return NextResponse.json({
      riskLevel,
      riskProgress,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      affectedNow,
      affectedChange,
      avgResponseMin,
      activeIncidentCount: active.length,
      incidentsTrend,
      totalResources,
      deployedResources,
      enCamino,
      ocupados,
      resourceProgress: totalResources > 0 ? Math.round((deployedResources / totalResources) * 100) : 0,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

