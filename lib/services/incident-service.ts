import { supabase } from "@/lib/supabase"
import { CONFIG } from "@/lib/config"
import type { DbIncident } from "@/lib/types"

let lastCleanupTime = 0
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

async function cleanupExpiredAiIncidents(): Promise<void> {
  const now = Date.now()
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return
  }

  lastCleanupTime = now
  const oneHourAgo = new Date(now - CONFIG.INCIDENTS.AI_DECAY_SECONDS * 1000).toISOString()
  const { error } = await supabase
    .from("incidentes")
    .delete()
    .eq("estado", "activo")
    .eq("fuente", "social")
    .lt("created_at", oneHourAgo)

  if (error) {
    console.error("[Decay Cleanup] Failed to expire old incidents:", error.message)
  }
}

export class IncidentService {
  static async getActiveIncidents(): Promise<DbIncident[]> {
    await cleanupExpiredAiIncidents()

    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")
      .neq("fuente", "social")
      .order("created_at", { ascending: false })

    if (error) throw new Error(`Failed to fetch incidents: ${error.message}`)
    return data || []
  }

  static async getAttendedIncidents(): Promise<DbIncident[]> {
    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .or("estado.eq.atendido,and(estado.eq.activo,fuente.eq.social)")
      .order("created_at", { ascending: false })

    if (error) throw new Error(`Failed to fetch incidents: ${error.message}`)
    return data || []
  }

  static async countActive(): Promise<number> {
    const { count, error } = await supabase
      .from("incidentes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo")

    if (error) throw new Error(`Failed to count incidents: ${error.message}`)
    return count || 0
  }

  static async findByLocation(ubicacion: string): Promise<DbIncident | null> {
    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .eq("ubicacion", ubicacion)

    if (error) throw new Error(`Failed to find incident: ${error.message}`)
    return data?.[0] || null
  }

  static async findById(id: string): Promise<DbIncident | null> {
    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .eq("id", id)
      .single()

    if (error) return null
    return data
  }

  static async create(incident: Omit<DbIncident, "id" | "created_at" | "updated_at">): Promise<DbIncident> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("incidentes")
      .insert({
        ...incident,
        fuente_detalles: incident.fuente_detalles ?? {},
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create incident: ${error.message}`)
    return data
  }

  static async update(id: string, updates: Partial<DbIncident>): Promise<DbIncident> {
    const { data, error } = await supabase
      .from("incidentes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update incident: ${error.message}`)
    return data
  }

  static async canCreateMore(): Promise<boolean> {
    const count = await this.countActive()
    return count < CONFIG.INCIDENTS.MAX_ACTIVE
  }
}
