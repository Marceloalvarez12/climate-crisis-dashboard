import { supabase } from "@/lib/supabase"
import { CONFIG } from "@/lib/config"
import { isNonReportIncident, type DbIncident } from "@/lib/types"

export class IncidentService {
  static async getActiveIncidents(): Promise<DbIncident[]> {
    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "activo")
      .order("created_at", { ascending: false })

    if (error) throw new Error(`Failed to fetch incidents: ${error.message}`)
    return (data || []).filter(i => !isNonReportIncident(i))
  }

  static async getAttendedIncidents(): Promise<DbIncident[]> {
    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .eq("estado", "atendido")
      .order("created_at", { ascending: false })
      .limit(CONFIG.INCIDENTS.MAX_HISTORY)

    if (error) throw new Error(`Failed to fetch incidents: ${error.message}`)
    return (data || []).filter(i => !isNonReportIncident(i))
  }

  static async countActive(): Promise<number> {
    return (await this.getActiveIncidents()).length
  }

  static async findByLocation(ubicacion: string): Promise<DbIncident | null> {
    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .eq("ubicacion", ubicacion)

    if (error) throw new Error(`Failed to find incident: ${error.message}`)
    return data?.find(i => !isNonReportIncident(i)) || null
  }

  static async findById(id: string): Promise<DbIncident | null> {
    const { data, error } = await supabase
      .from("incidentes")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch incident: ${error.message}`)
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

  static async deleteById(id: string): Promise<void> {
    const { error } = await supabase
      .from("incidentes")
      .delete()
      .eq("id", id)

    if (error) throw new Error(`Failed to delete incident: ${error.message}`)
  }

  static async deleteSimulated(estado?: "activo" | "atendido"): Promise<number> {
    let query = supabase
      .from("incidentes")
      .delete()
      .contains("fuente_detalles", { simulated: true })

    if (estado) {
      query = query.eq("estado", estado)
    }

    const { error } = await query
    if (error) throw new Error(`Failed to delete simulated incidents: ${error.message}`)
    return 0
  }
}
