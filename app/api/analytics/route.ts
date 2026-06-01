import { supabase } from "@/lib/supabase"
import { STATIC_RESPONSE_TIME_MIN } from "@/lib/mock-data"
import { apiSuccess, apiError } from "@/lib/services/api-response"

export async function GET() {
  try {
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [activeResult, allResult, recursosResult] = await Promise.all([
      supabase.from("incidentes").select("*").eq("estado", "activo"),
      supabase.from("incidentes").select("*").gte("created_at", since48h),
      supabase.from("recursos").select("*"),
    ])

    if (activeResult.error) return apiError(activeResult.error.message)
    if (allResult.error) return apiError(allResult.error.message)
    if (recursosResult.error) return apiError(recursosResult.error.message)

    const active = activeResult.data || []
    const incidents24h = (allResult.data || []).filter(i => i.created_at >= since24h)
    const incidents48h = (allResult.data || []).filter(i => i.created_at >= since48h && i.created_at < since24h)
    const allResources = recursosResult.data || []

    const affectedNow = active.reduce((s, i) => s + (i.personas_afectadas || 0), 0)
    const prev24Active = incidents48h.filter(i => i.estado === "activo")
    const affectedPrev = prev24Active.reduce((s, i) => s + (i.personas_afectadas || 0), 0)
    const affectedChange = affectedPrev > 0
      ? Math.round(((affectedNow - affectedPrev) / affectedPrev) * 100)
      : 0

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

    const avgResponseMin: number = STATIC_RESPONSE_TIME_MIN

    const incidentsTrend = incidents24h.length > 0 && incidents48h.length > 0
      ? Math.round(((incidents24h.length - incidents48h.length) / incidents48h.length) * 100)
      : null

    const totalResources = allResources.length
    const deployedResources = allResources.filter(r => r.estado !== "available").length
    const enCamino = allResources.filter(r => r.estado === "dispatched").length
    const ocupados = allResources.filter(r => r.estado === "busy").length

    return apiSuccess({
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
    const message = err instanceof Error ? err.message : String(err)
    return apiError(message)
  }
}
