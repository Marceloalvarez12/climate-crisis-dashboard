"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, Shield, AlertTriangle, MapPin, Users, Clock, ExternalLink, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { GeneradorReportePDF } from "./GeneradorReportePDF"
import type { EmergencyIncident, ArkivDispatchResponse } from "@/lib/types"

interface IncidentDispatchCardProps {
  incident?: EmergencyIncident
  onDispatchSuccess?: (entityKey: string) => void
  onDismiss?: () => void
}

const DEFAULT_INCIDENT: EmergencyIncident = {
  id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  tipo: "flood",
  severidad: "critical",
  ubicacion: "Barrio San Pablo - Canal Norte",
  afectados: 720,
  timestamp: new Date().toISOString(),
}

export function IncidentDispatchCard({
  incident = DEFAULT_INCIDENT,
  onDispatchSuccess,
  onDismiss,
}: IncidentDispatchCardProps) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<ArkivDispatchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleValidarYDespachar = async () => {
    setIsDeploying(true)
    setError(null)
    setDispatchResult(null)

    const incidenteData: EmergencyIncident = {
      ...incident,
      timestamp: new Date().toISOString(),
    }

    try {
      const response = await fetch("/api/incidentes/arkiv-dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(incidenteData),
      })

      const data: ArkivDispatchResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Fallo al registrar on-chain")
      }

      console.log("Registrado on-chain. EntityKey:", data.entityKey)
      setDispatchResult(data)
      onDispatchSuccess?.(data.entityKey!)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      console.error("Fallo el despacho:", errorMessage)
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
  }[incident.severidad]

  const tipoLabel = {
    flood: "Inundación",
    fire: "Incendio",
    medical: "Emergencia Médica",
    general: "Emergencia General",
  }[incident.tipo]

  if (dispatchResult?.success && dispatchResult.entityKey) {
    const key = dispatchResult.entityKey
    const truncatedKey = key.length > 12 ? `${key.slice(0, 6)}...${key.slice(-4)}` : key

    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6 shadow-2xl shadow-emerald-950/20 text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-500/10 p-3">
              <ShieldCheck className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-emerald-400">Despacho Verificado On-Chain</h3>
            <p className="text-xs text-emerald-300">
              Registrado de forma transparente e inmutable en la red
            </p>
          </div>
          <div className="p-3 rounded-lg bg-black/40 border border-emerald-800/40 font-mono text-xs">
            <p className="text-[10px] text-emerald-500/80 mb-1">Entity Key (Hash de Auditoría)</p>
            <a
              href={`https://data.arkiv.network/${key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1.5"
            >
              {truncatedKey}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          
          <GeneradorReportePDF
            incidente={{
              id: incident.id,
              tipo: incident.tipo,
              severidad: incident.severidad,
              ubicacion: incident.ubicacion,
              afectados: incident.afectados,
              timestamp: incident.timestamp,
              resumenIA: (incident as any).resumenIA || 
                `Evaluación automática por Zntinel AI: Se identificó una alerta de ${tipoLabel.toLowerCase()} en ${incident.ubicacion} con un nivel de severidad ${incident.severidad}. Se ha completado el registro inmutable on-chain y despachado unidades de respuesta prioritaria.`
            }}
            entityKey={key}
          />

          <Button
            variant="outline"
            className="w-full border-emerald-800 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-semibold"
            onClick={onDismiss}
          >
            Cerrar Panel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border-2 border-orange-500/50 bg-gradient-to-b from-orange-950/30 to-background p-6 shadow-2xl shadow-orange-500/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-400" />
            <h3 className="font-bold text-foreground">Validar y Despachar</h3>
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
              <p className="text-xs text-muted-foreground">Requiere validación del operador</p>
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

        {/* Arkiv Info */}
        <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30 mb-4">
          <p className="text-[10px] text-purple-300">
            <span className="font-medium">Blockchain Arkiv:</span> Al despachar, este incidente será registrado de forma inmutable en la Red Braga para auditoría pública.
          </p>
        </div>

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
            onClick={handleValidarYDespachar}
            disabled={isDeploying}
          >
            {isDeploying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrando on-chain...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Validar y Despachar
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
