"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, Truck, AlertTriangle, MapPin, Users, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { RecursoIcon, tipoRecursoLabel } from "./crisis-map/resource-helpers"

// ──────────────────────────────────────────────────────────
// NOTA: La funcionalidad de despacho on-chain (Arkiv Blockchain)
// está comentada más abajo. Para habilitarla, descomentar el
// bloque marcado con [ARKIV ON-CHAIN] y asegurar que
// ARKIV_PRIVATE_KEY esté configurada en .env.local
// ──────────────────────────────────────────────────────────

interface IncidentData {
  id: string
  tipo: string
  severidad: string
  ubicacion: string
  afectados: number
  timestamp: string
}

interface IncidentDispatchCardProps {
  incident?: IncidentData
  selectedCounts?: Record<string, number>
  onConfirmDispatch?: () => Promise<void>
  onDispatchSuccess?: () => void
  onDismiss?: () => void
}

const DEFAULT_INCIDENT: IncidentData = {
  id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  tipo: "flood",
  severidad: "critical",
  ubicacion: "Barrio San Pablo - Canal Norte",
  afectados: 720,
  timestamp: new Date().toISOString(),
}

export function IncidentDispatchCard({
  incident = DEFAULT_INCIDENT,
  selectedCounts,
  onConfirmDispatch,
  onDispatchSuccess,
  onDismiss,
}: IncidentDispatchCardProps) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployed, setDeployed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDesplegarRecursos = async () => {
    setIsDeploying(true)
    setError(null)

    try {
      let blockchainKey: string | undefined = undefined

      // [ARKIV ON-CHAIN] — Intento de registro en blockchain con fallback local
      try {
        const response = await fetch("/api/incidentes/arkiv-dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...incident,
            timestamp: new Date().toISOString(),
          }),
        })
        const data = await response.json()
        if (response.ok && data.success) {
          blockchainKey = data.entityKey
          console.log("Registrado on-chain con éxito. EntityKey:", blockchainKey)
        } else {
          console.warn("Firma on-chain omitida o no autorizada:", data.error || "Fallo en API")
        }
      } catch (bcError) {
        console.warn("Error de conexión on-chain, continuando con despacho local de respaldo:", bcError)
      }

      // Ejecutar despacho (actualización de base de datos) si se provee
      if (onConfirmDispatch) {
        await onConfirmDispatch()
      } else {
        // Despacho LOCAL fallback: simula despliegue de recursos
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      setDeployed(true)
      onDispatchSuccess?.()

      if (blockchainKey) {
        toast.success("Despliegue Autorizado On-Chain", {
          description: `Recursos enviados a ${incident.ubicacion}. Hash: ${blockchainKey.slice(0, 12)}...`,
        })
      } else {
        toast.success("Recursos Desplegados (Modo Local)", {
          description: `Unidades enviadas a ${incident.ubicacion}. (Registro on-chain omitido)`,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      console.error("Fallo el despliegue:", errorMessage)
      setError(errorMessage)
    } finally {
      setIsDeploying(false)
    }
  }

  const severityColor = {
    critical: "text-red-400 bg-red-500/10 border-red-500/30",
    high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    low: "text-green-400 bg-green-500/10 border-green-500/30",
  }[incident.severidad] || "text-green-400 bg-green-500/10 border-green-500/30"

  const tipoLabel = {
    flood: "Inundación",
    fire: "Incendio",
    storm: "Tormenta",
    looting: "Saqueos",
    violence: "Violencia",
    accident: "Accidente",
    medical: "Emergencia Médica",
    general: "Emergencia General",
  }[incident.tipo] || incident.tipo

  // ── Vista de éxito ──
  if (deployed) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6 shadow-2xl shadow-emerald-950/20 text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-500/10 p-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-emerald-400">Recursos Desplegados</h3>
            <p className="text-xs text-emerald-300">
              Unidades de respuesta enviadas a la zona de emergencia
            </p>
          </div>
          
          <div className="p-3 rounded-lg bg-black/40 border border-emerald-800/40 text-xs space-y-1">
            <p className="text-emerald-500/80">
              <span className="font-medium text-emerald-400">Destino:</span> {incident.ubicacion}
            </p>
            <p className="text-emerald-500/80">
              <span className="font-medium text-emerald-400">Tipo:</span> {tipoLabel} — {incident.severidad.toUpperCase()}
            </p>
            <p className="text-emerald-500/80">
              <span className="font-medium text-emerald-400">Hora despacho:</span> {new Date().toLocaleTimeString("es-AR")}
            </p>
          </div>

          {selectedCounts && Object.values(selectedCounts).some(v => v > 0) && (
            <div className="p-3 rounded-lg bg-black/40 border border-emerald-800/40 text-xs text-left space-y-1.5">
              <p className="font-bold text-emerald-400 text-xs">Detalle de Unidades:</p>
              {Object.entries(selectedCounts)
                .filter(([_, count]) => count > 0)
                .map(([tipo, count]) => (
                  <div key={tipo} className="flex justify-between items-center text-emerald-500/80">
                    <span className="capitalize">{tipoRecursoLabel(tipo)}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full border-emerald-800 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-semibold"
            onClick={onDismiss}
          >
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  // ── Vista principal ──
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border-2 border-orange-500/50 bg-gradient-to-b from-orange-950/30 to-background p-6 shadow-2xl shadow-orange-500/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-400" />
            <h3 className="font-bold text-foreground">Autorizar Despliegue</h3>
          </div>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", severityColor)}>
            {incident.severidad.toUpperCase()}
          </span>
        </div>

        {/* Incident Details */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <AlertTriangle className="h-8 w-8 text-orange-500 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">{tipoLabel}</p>
              <p className="text-xs text-muted-foreground">Requiere despliegue de unidades</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
              <MapPin className="h-4 w-4 text-orange-400 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground">Ubicación</p>
              <p className="text-[10px] font-semibold truncate">{incident.ubicacion}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
              <Users className="h-4 w-4 text-red-400 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground">Afectados</p>
              <p className="text-[10px] font-semibold">{incident.afectados}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
              <Clock className="h-4 w-4 text-yellow-400 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground">Hora</p>
              <p className="text-[10px] font-semibold">
                {new Date(incident.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </div>

        {/* Selected Resources List */}
        {selectedCounts && Object.values(selectedCounts).some(v => v > 0) && (
          <div className="space-y-2 mb-4 bg-muted/20 border border-border p-3 rounded-lg">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Unidades a enviar:</p>
            <div className="space-y-1.5">
              {Object.entries(selectedCounts)
                .filter(([_, count]) => count > 0)
                .map(([tipo, count]) => (
                  <div key={tipo} className="flex justify-between items-center bg-background/50 rounded p-2 border border-border/30">
                    <div className="flex items-center gap-2">
                      <div className="text-orange-400">
                        <RecursoIcon tipo={tipo} />
                      </div>
                      <span className="text-xs font-medium text-foreground capitalize">{tipoRecursoLabel(tipo)}</span>
                    </div>
                    <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold disabled:opacity-50"
            onClick={handleDesplegarRecursos}
            disabled={isDeploying}
          >
            {isDeploying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Desplegando...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4 mr-2" />
                Confirmar Despliegue
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="border-border text-muted-foreground"
            onClick={onDismiss}
            disabled={isDeploying}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
