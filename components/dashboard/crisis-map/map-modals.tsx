"use client"

import { useMemo, useState, useEffect } from "react"
import { Users, Clock, MapPinned, Twitter, Send, Phone, CheckCircle2, Truck, ShieldAlert, ShieldCheck, Loader2, ExternalLink, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { generateIncidentPdf } from "@/lib/pdf-generator"
import {
  IncidentIcon,
  SourceIcon,
  severityColorClass,
  sourceLabel,
  incidentTypeLabel,
  incidentSeverityLabel,
} from "./incident-helpers"
import { RecursoIcon, tipoRecursoLabel } from "./resource-helpers"
import type { Incident, DbResource } from "@/lib/types"

// ---------------------------------------------------------------------------
// Componente de Auditoría y Sello de Verificación On-Chain (Arkiv Network)
// ---------------------------------------------------------------------------

interface OnChainVerifierProps {
  arkivKey: string
}

function OnChainVerifier({ arkivKey }: OnChainVerifierProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    creator: string
    expiresAtBlock: string | null
    payload: any
  } | null>(null)

  useEffect(() => {
    let active = true
    const verify = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/incidentes/arkiv-verify/${arkivKey}`)
        const json = await res.json()
        if (!active) return
        if (json.success) {
          setData({
            creator: json.creator,
            expiresAtBlock: json.expiresAtBlock,
            payload: json.payload,
          })
        } else {
          setError(json.error || "No se pudo recuperar la información de la blockchain.")
        }
      } catch (err) {
        if (!active) return
        setError("Error de red al intentar verificar el estado on-chain.")
      } finally {
        if (active) setLoading(false)
      }
    }

    verify()
    return () => {
      active = false
    }
  }, [arkivKey])

  if (loading) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col items-center justify-center gap-2 animate-pulse">
        <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
        <p className="text-xs text-emerald-400 font-medium">Verificando firma criptográfica en Braga Testnet...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-red-400">
          <ShieldAlert className="h-5 w-5" />
          <span className="text-xs font-semibold">Error de Auditoría On-Chain</span>
        </div>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Verificación Criptográfica Exitosa</span>
            <p className="text-[10px] text-muted-foreground">Estado auditado y sellado de forma inmutable</p>
          </div>
        </div>
        <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
          Braga Network
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px] border-t border-emerald-500/10">
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground uppercase">Despachador (Public Key)</p>
          <p className="font-mono text-foreground truncate select-all" title={data?.creator}>
            {data?.creator}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] text-muted-foreground uppercase">Key de la Entidad</p>
          <p className="font-mono text-foreground truncate select-all" title={arkivKey}>
            {arkivKey}
          </p>
        </div>
      </div>

      <div className="space-y-1 text-[11px]">
        <p className="text-[9px] text-muted-foreground uppercase">Payload Registrado en Bloque</p>
        <pre className="font-mono text-[10px] text-emerald-300 bg-black/40 p-2.5 rounded border border-emerald-500/15 overflow-x-auto max-h-32 custom-scrollbar">
          {JSON.stringify(data?.payload, null, 2)}
        </pre>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-emerald-500/10">
        <span>Vence en bloque: <strong className="font-mono text-foreground">{data?.expiresAtBlock || 'Infinito'}</strong></span>
        <a
          href={`https://braga.explorer.arkiv.network/entity/${arkivKey}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Ver en Explorador
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de detalle del incidente
// ---------------------------------------------------------------------------

interface IncidentDetailModalProps {
  isOpen:          boolean
  incident:        Incident | null
  onClose:         () => void
  onOpenDeploy:    () => void
}

export function IncidentDetailModal({
  isOpen,
  incident,
  onClose,
  onOpenDeploy,
}: IncidentDetailModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownloadReport = async (inc: Incident) => {
    setIsGenerating(true)
    try {
      const pdfData = {
        id: inc.id,
        tipo: inc.type,
        severidad: inc.severity,
        ubicacion: inc.location,
        afectados: inc.affectedPeople,
        timestamp: inc.timestamp ? new Date(inc.timestamp).toISOString() : new Date().toISOString(),
        resumenIA: inc.sourceDetails?.ai_analysis?.reasoning || inc.sourceDetails?.content || "Análisis no disponible",
      }
      const aiKey = inc.sourceDetails?.ai_analysis?.arkiv_entity_key || inc.sourceDetails?.arkiv_entity_key
      await generateIncidentPdf(pdfData, aiKey, inc.arkiv_key)
    } catch (err) {
      console.error("Error generating incident PDF:", err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[9999]">
        {incident && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className={cn("rounded-full p-2", severityColorClass(incident.severity))}>
                  <IncidentIcon type={incident.type} />
                </div>
                <div>
                  <span className="text-base">{incident.location}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-normal text-muted-foreground">
                      {incidentTypeLabel(incident.type)} — Severity {incidentSeverityLabel(incident.severity)}
                    </span>
                    {incident.estado === "atendido" && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 text-[9px] px-1.5 py-0 border border-emerald-500/30">
                        Atendido
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={<Users className="h-4 w-4 mx-auto mb-1 text-primary" />} label="Affected">
                  {incident.affectedPeople.toLocaleString()}
                </StatCard>
                <StatCard icon={<Clock className="h-4 w-4 mx-auto mb-1 text-accent" />} label="Reported">
                  {incident.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </StatCard>
                <StatCard icon={<MapPinned className="h-4 w-4 mx-auto mb-1 text-blue-400" />} label="Coordinates" small>
                  {incident.coordinates.lat.toFixed(4)}, {incident.coordinates.lng.toFixed(4)}
                </StatCard>
              </div>

              {/* Source details */}
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <SourceIcon source={incident.source} />
                  <span className="text-sm font-medium">Source: {sourceLabel(incident.source)}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {incident.source === "social"
                      ? incident.sourceDetails.platform
                      : incident.source === "sensor"
                        ? incident.sourceDetails.sensorId
                        : incident.sourceDetails.cameraId}
                  </Badge>
                </div>
                <SourceDetail incident={incident} />
              </div>

              {/* On-Chain Verification / Dispatch Action */}
              {incident.estado === "atendido" ? (
                <div className="space-y-3">
                  {incident.arkiv_key && <OnChainVerifier arkivKey={incident.arkiv_key} />}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 py-5 cursor-pointer"
                      onClick={() => handleDownloadReport(incident)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          Reporte PDF
                        </>
                      )}
                    </Button>
                    {incident.arkiv_key && (
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-semibold flex items-center justify-center gap-2 py-5 cursor-pointer"
                        asChild
                      >
                        <a href={`/auditoria?key=${incident.arkiv_key}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Verificar Portal
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5" onClick={onOpenDeploy}>
                    <Truck className="h-5 w-5 mr-2" />
                    Despliegue de Recursos
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Small reusable stat card
function StatCard({ icon, label, children, small }: { icon: React.ReactNode; label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3 text-center">
      {icon}
      <p className={cn("font-bold text-foreground", small ? "text-[10px]" : "text-lg")}>{children}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

// Detalle según la fuente del incidente
function SourceDetail({ incident }: { incident: Incident }) {
  const { source, sourceDetails: sd } = incident

  if (source === "social") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Twitter className="h-4 w-4 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-blue-400">{sd.username}</span>
        </div>
        <p className="text-sm text-foreground bg-secondary/50 rounded-lg p-3 italic">
          &quot;{sd.content}&quot;
        </p>
        {sd.imageUrl && (
          <div className="relative aspect-video rounded-lg overflow-hidden">
            <img src={sd.imageUrl} alt="Imagen del incidente" className="w-full h-full object-cover" />
            <div className="absolute bottom-2 right-2">
              <Badge className="bg-black/70 text-white text-[10px]">Image attached to tweet</Badge>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (source === "sensor") {
    const fields = [
      { label: "Temperature", value: `${sd.temperature}°C` },
      { label: "Humidity",    value: `${sd.humidity}%` },
      { label: "Wind",        value: `${sd.windSpeed} km/h` },
      { label: "Pressure",    value: `${sd.pressure} hPa` },
    ]
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-secondary/50 p-3">
              <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
              <p className="text-xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Real-time data from sensor {sd.sensorId}
        </p>
      </div>
    )
  }

  // camera
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Location: {sd.cameraLocation}</p>
      {sd.imageUrl && (
        <div className="relative aspect-video rounded-lg overflow-hidden">
          <img src={sd.imageUrl} alt="Captura de cámara" className="w-full h-full object-cover" />
          <div className="absolute top-2 left-2">
            <Badge className="bg-red-500/90 text-white text-[10px] animate-pulse">LIVE</Badge>
          </div>
          <div className="absolute bottom-2 right-2">
            <Badge className="bg-black/70 text-white text-[10px]">{sd.cameraId}</Badge>
          </div>
          <div className="absolute bottom-2 left-2">
            <Badge className="bg-black/70 text-white text-[10px]">
              {new Date().toLocaleTimeString("en-US")}
            </Badge>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de despliegue de recursos
// ---------------------------------------------------------------------------

interface ResourceGroup {
  tipo:         string
  ids:          string[]
  availableIds: string[]
}

interface DeployModalProps {
  open:            boolean
  incident:        Incident | null
  dbRecursos:      DbResource[] | undefined
  resourceGroups:  ResourceGroup[]
  selectedCounts:  Record<string, number>
  deployingResources: boolean
  deploySuccess:   boolean
  onClose:         () => void
  onDeploy:        () => void
  onAdjustCount:   (tipo: string, delta: number, max: number) => void
}

export function DeployModal({
  open,
  incident,
  dbRecursos,
  resourceGroups,
  selectedCounts,
  deployingResources,
  deploySuccess,
  onClose,
  onDeploy,
  onAdjustCount,
}: DeployModalProps) {
  const totalSelected = useMemo(
    () => Object.values(selectedCounts).reduce((a, b) => a + b, 0),
    [selectedCounts],
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Deploy Emergency Resources
          </DialogTitle>
          <DialogDescription>
            Select the resources to send to{" "}
            <span className="font-medium text-foreground">{incident?.location}</span>
          </DialogDescription>
        </DialogHeader>

        {deploySuccess ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <p className="text-lg font-semibold text-foreground">Resources Deployed</p>
            <p className="text-sm text-muted-foreground text-center">
              Units have been notified and are on their way
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 py-2">
              {!dbRecursos ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading resources...</p>
              ) : resourceGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No resources registered</p>
              ) : (
                resourceGroups.map((group) => {
                  const available = group.availableIds.length
                  const busy      = group.ids.length - available
                  const count     = selectedCounts[group.tipo] ?? 0
                  const noStock   = available === 0

                  return (
                    <div
                      key={group.tipo}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 transition-all",
                        noStock  ? "border-border bg-secondary/20 opacity-60"
                        : count > 0 ? "border-primary bg-primary/10"
                        :            "border-border hover:bg-secondary/30",
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "h-10 w-10 shrink-0 rounded-full flex items-center justify-center",
                        noStock  ? "bg-secondary/50 text-muted-foreground"
                        : count > 0 ? "bg-primary text-primary-foreground"
                        :            "bg-secondary text-foreground",
                      )}>
                        <RecursoIcon tipo={group.tipo} />
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{tipoRecursoLabel(group.tipo)}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn("text-xs font-semibold", available > 0 ? "text-success" : "text-muted-foreground")}>
                            {available} available{available !== 1 ? "s" : ""}
                          </span>
                          {busy > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              · {busy} busy{busy !== 1 ? "" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Counter */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onAdjustCount(group.tipo, -1, available)}
                          disabled={count === 0}
                          className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-sm hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums text-foreground">{count}</span>
                        <button
                          onClick={() => onAdjustCount(group.tipo, +1, available)}
                          disabled={count >= available}
                          className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-sm hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Deployment summary</p>
              <p className="text-sm font-medium text-foreground">
                {totalSelected > 0
                  ? Object.entries(selectedCounts)
                      .filter(([, v]) => v > 0)
                      .map(([tipo, v]) => `${v} ${tipoRecursoLabel(tipo)}`)
                      .join(", ")
                  : "No resources selected"}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={onDeploy} disabled={deployingResources || totalSelected === 0}>
                {deployingResources ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Confirm Deployment
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
