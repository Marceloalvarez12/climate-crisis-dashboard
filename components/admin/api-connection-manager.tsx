"use client"

import { CheckCircle2, CircleAlert, Database, Globe, Cpu, Map } from "lucide-react"

const SERVICES = [
  { id: "openrouter", name: "OpenRouter", icon: Cpu, variable: "OPENROUTER_API_KEY" },
  { id: "gemini", name: "Gemini", icon: Cpu, variable: "GOOGLE_AI_API_KEY" },
  { id: "twitter", name: "X", icon: Globe, variable: "X_BEARER_TOKEN" },
  { id: "supabase", name: "Supabase", icon: Database, variable: "SUPABASE_SERVICE_ROLE_KEY" },
  { id: "leaflet", name: "Leaflet (sin clave)", icon: Map, variable: "" },
] as const

export function ApiConnectionManager({ initialKeys }: { initialKeys: Record<string, boolean> }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 text-zinc-100">
      <div className="border-b border-zinc-800 px-6 py-4">
        <h2 className="text-sm font-semibold">Configuración de integraciones</h2>
        <p className="mt-1 text-xs text-zinc-400">Estado de configuración, no prueba de conexión en vivo.</p>
      </div>
      <div className="divide-y divide-zinc-800">
        {SERVICES.map(({ id, name, icon: Icon, variable }) => (
          <div key={id} className="flex items-center gap-3 px-6 py-4">
            <Icon className="h-5 w-5 text-cyan-400" />
            <span className="flex-1 text-sm">{name}</span>
            <span className={`flex items-center gap-1 text-xs ${initialKeys[id] ? "text-emerald-400" : "text-amber-400"}`}>
              {initialKeys[id] ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
              {initialKeys[id] ? "Configurado" : "Sin configurar"}
            </span>
            {variable && <span className="hidden text-xs text-zinc-500 sm:inline">{variable}</span>}
          </div>
        ))}
      </div>
      <p className="border-t border-zinc-800 px-6 py-4 text-xs text-zinc-400">
        Administrá las claves en el gestor de secretos del alojamiento y reiniciá el despliegue.
        Por seguridad, este panel nunca muestra ni guarda valores de claves.
      </p>
    </section>
  )
}
