"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, Truck, AlertTriangle, MapPin, Users, Clock, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { RecursoIcon, tipoRecursoLabel } from "./crisis-map/resource-helpers"

// ---------------------------------------------------------------------------
// NOTE: The on-chain dispatch functionality (Arkiv Blockchain)
// is partially commented out below. To enable it, uncomment the
// block marked with [ARKIV ON-CHAIN] and ensure that
// ARKIV_PRIVATE_KEY is configured in .env.local
// ---------------------------------------------------------------------------

interface IncidentData {
  id: string
  tipo: string
  severidad: string
  ubicacion: string
  afectados: number
  timestamp: string
  arkivKey?: string
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
  const [stellarAudit, setStellarAudit] = useState<Record<string, unknown> | null>(null)
  const [arkivKey, setArkivKey] = useState<string | undefined>(undefined)

  const handleDeployResources = async () => {
    setIsDeploying(true)
    setError(null)

    try {
      let blockchainKey: string | undefined = undefined

      // [ARKIV ON-CHAIN] — Attempt blockchain registration with local fallback
      try {
        const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || ""
        const response = await fetch("/api/incidentes/arkiv-dispatch", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(apiSecret ? { "x-api-secret": apiSecret } : {}),
          },
          body: JSON.stringify({
            ...incident,
            timestamp: new Date().toISOString(),
          }),
        })
        const data = await response.json()
        if (response.ok && data.success) {
          blockchainKey = data.entityKey
          setArkivKey(blockchainKey)
          if (data.stellarAudit) {
            setStellarAudit(data.stellarAudit as Record<string, unknown>)
          }
          console.log("Successfully registered on-chain. EntityKey:", blockchainKey)
        } else {
          console.warn("On-chain signature skipped or unauthorized:", data.error || "API failure")
        }
      } catch (bcError) {
        console.warn("On-chain connection error, continuing with local fallback dispatch:", bcError)
      }

      // Execute dispatch (database update) if provided
      if (onConfirmDispatch) {
        await onConfirmDispatch()
      } else {
        // LOCAL fallback dispatch: simulates resource deployment
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      setDeployed(true)
      onDispatchSuccess?.()

      if (blockchainKey) {
        toast.success("On-Chain Deployment Authorized", {
          description: `Resources sent to ${incident.ubicacion}. Hash: ${blockchainKey.slice(0, 12)}...`,
        })
      } else {
        toast.success("Resources Deployed (Local Mode)", {
          description: `Units sent to ${incident.ubicacion}. (On-chain registration skipped)`,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      console.error("Deployment failed:", errorMessage)
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

  const typeLabel = {
    flood: "Flood",
    fire: "Fire",
    storm: "Storm",
    looting: "Looting",
    violence: "Violence",
    accident: "Accident",
    medical: "Medical Emergency",
    general: "General Emergency",
  }[incident.tipo] || incident.tipo

  // ── Success view ──
  if (deployed) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6 shadow-2xl shadow-emerald-950/20 text-center space-y-5">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-500/10 p-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-emerald-400">Resources Deployed</h3>
            <p className="text-xs text-emerald-300">
              Response units sent to the emergency zone
            </p>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-emerald-800/40 text-xs space-y-1 text-left">
            <p className="text-emerald-500/80">
              <span className="font-medium text-emerald-400">Destination:</span> {incident.ubicacion}
            </p>
            <p className="text-emerald-500/80">
              <span className="font-medium text-emerald-400">Type:</span> {typeLabel} — {incident.severidad.toUpperCase()}
            </p>
            <p className="text-emerald-500/80">
              <span className="font-medium text-emerald-400">Dispatch time:</span> {new Date().toLocaleTimeString("en-US")}
            </p>
          </div>

          {selectedCounts && Object.values(selectedCounts).some(v => v > 0) && (
            <div className="p-3 rounded-lg bg-black/40 border border-emerald-800/40 text-xs text-left space-y-1.5">
              <p className="font-bold text-emerald-400 text-xs">Unit Detail:</p>
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

          {stellarAudit && (
            <div className="p-4 rounded-lg bg-indigo-950/40 border border-indigo-400/40 text-xs shadow-lg shadow-indigo-950/20 text-left space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-pulse-ring" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-400" />
                  </span>
                  <span className="font-bold text-indigo-200 text-sm truncate">Stellar / RISC Zero Audit</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="shrink-0 text-indigo-400/60 hover:text-indigo-300 transition-colors">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-center leading-relaxed">
                      Cryptographic proof certifying that the dispatch is valid and immutable on Stellar.
                    </TooltipContent>
                  </Tooltip>
                </div>
                {(stellarAudit.isSimulated as boolean) && (
                  <span className="shrink-0 text-[9px] px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 font-medium">SIMULATED</span>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-indigo-300/50 font-medium">Verifiable hash</p>
                <p className="font-mono text-indigo-200/80 break-all text-[11px] leading-relaxed">
                  {(stellarAudit.hash as string)?.slice(0, 36)}...
                </p>
              </div>

              <a
                href={`/stellar-auditoria?seal=${stellarAudit.seal}&imageId=${stellarAudit.imageId}&journal=${stellarAudit.journalDigest}`}
                className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 font-medium"
              >
                View proof on Soroban verifier →
              </a>
            </div>
          )}

          {arkivKey && (
            <div className="pt-3 border-t border-emerald-800/30">
              <div className="flex items-center justify-between gap-3 text-[10px] text-emerald-500/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-emerald-400/60 shrink-0">Arkiv Braga Record</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="shrink-0 text-emerald-400/40 hover:text-emerald-300 transition-colors">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-center leading-relaxed">
                      Permanent dispatch record on blockchain for historical traceability.
                    </TooltipContent>
                  </Tooltip>
                  <span className="font-mono truncate">{arkivKey.slice(0, 12)}...{arkivKey.slice(-6)}</span>
                </div>
                <a
                  href={`https://explorer.braga.hoodi.arkiv.network/entity/${arkivKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-emerald-400/60 hover:text-emerald-300 underline-offset-2 hover:underline"
                >
                  View →
                </a>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full border-emerald-800 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-semibold"
            onClick={onDismiss}
          >
            Close
          </Button>
        </div>
      </div>
    )
  }

  // ── Main view ──
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border-2 border-orange-500/50 bg-gradient-to-b from-orange-950/30 to-background p-6 shadow-2xl shadow-orange-500/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-400" />
            <h3 className="font-bold text-foreground">Authorize Deployment</h3>
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
              <p className="font-semibold text-foreground">{typeLabel}</p>
              <p className="text-xs text-muted-foreground">Requires unit deployment</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
              <MapPin className="h-4 w-4 text-orange-400 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground">Location</p>
              <p className="text-[10px] font-semibold truncate">{incident.ubicacion}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
              <Users className="h-4 w-4 text-red-400 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground">Affected</p>
              <p className="text-[10px] font-semibold">{incident.afectados}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
              <Clock className="h-4 w-4 text-yellow-400 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground">Time</p>
              <p className="text-[10px] font-semibold">
                {new Date(incident.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </div>

        {/* Selected Resources List */}
        {selectedCounts && Object.values(selectedCounts).some(v => v > 0) && (
          <div className="space-y-2 mb-4 bg-muted/20 border border-border p-3 rounded-lg">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Units to send:</p>
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
            onClick={handleDeployResources}
            disabled={isDeploying}
          >
            {isDeploying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4 mr-2" />
                Confirm Deployment
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="border-border text-muted-foreground"
            onClick={onDismiss}
            disabled={isDeploying}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
