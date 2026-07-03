"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft, ShieldCheck, ShieldAlert, Clock, MapPin, ExternalLink, Radio, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import type { DbIncident } from "@/lib/types"

interface AuditTrail {
  stellarZk?: {
    verified: boolean
    hash?: string
    contractId?: string
    explorerUrl?: string
    dispatchedAt?: string
    isSimulated?: boolean
    txHash?: string
    txExplorerUrl?: string
    operator?: string
    journalDigestLo?: string
    journalDigestHi?: string
  }
  arkivDispatch?: {
    entityKey?: string
    explorerUrl?: string
    dispatchedAt?: string
  }
}

export default function SeguimientoPage() {
  const params = useParams()
  const id = params.id as string

  const [incident, setIncident] = useState<DbIncident | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchIncident = async () => {
      try {
        const res = await fetch(`/api/incidentes/${id}?secret=${process.env.NEXT_PUBLIC_API_SECRET || ""}`)
        if (!res.ok) {
          if (res.status === 404) {
            setIncident(null)
            return
          }
          throw new Error("Error al consultar el reporte")
        }
        const json = await res.json()
        setIncident(json)
      } catch (err) {
        toast.error("No se pudo cargar el seguimiento")
      } finally {
        setLoading(false)
      }
    }

    fetchIncident()
    const interval = setInterval(fetchIncident, 10000)
    return () => clearInterval(interval)
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Cargando seguimiento...</p>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-zinc-400 px-4 text-center gap-4">
        <ShieldAlert className="h-12 w-12 text-red-400" />
        <h1 className="text-xl font-bold text-white">Reporte no encontrado</h1>
        <p className="text-sm max-w-md">El ID de seguimiento no corresponde a ningún incidente registrado.</p>
        <Link href="/reportar">
          <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white">
            Volver a reportar
          </Button>
        </Link>
      </div>
    )
  }

  const details = incident.fuente_detalles || {}
  const stellarAuditDetails = details.stellar_audit as (AuditTrail["stellarZk"] & { txHash?: string }) | undefined
  const audit: AuditTrail = {
    stellarZk: stellarAuditDetails
      ? {
          verified: stellarAuditDetails.verified ?? true,
          hash: stellarAuditDetails.hash,
          contractId: stellarAuditDetails.contractId,
          explorerUrl: stellarAuditDetails.explorerUrl,
          dispatchedAt: stellarAuditDetails.dispatchedAt,
          isSimulated: stellarAuditDetails.isSimulated,
          txHash: stellarAuditDetails.txHash,
          txExplorerUrl: stellarAuditDetails.txHash
            ? `https://stellar.expert/explorer/testnet/tx/${stellarAuditDetails.txHash}`
            : undefined,
          operator: stellarAuditDetails.operator,
          journalDigestLo: stellarAuditDetails.journalDigestLo,
          journalDigestHi: stellarAuditDetails.journalDigestHi,
        }
      : undefined,
    arkivDispatch: incident.arkiv_entity_key ? {
      entityKey: incident.arkiv_entity_key,
      explorerUrl: `https://explorer.braga.hoodi.arkiv.network/entity/${incident.arkiv_entity_key}`,
    } : undefined,
  }

  const severityColor: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  }

  const statusSteps = [
    { label: "Reporte recibido", done: true },
    { label: "Verificaci\u00f3n ZK", done: !!audit.stellarZk?.verified },
    { label: "En atenci\u00f3n", done: incident.estado !== "activo" },
    { label: "Despacho auditado", done: !!audit.arkivDispatch },
    { label: "Resuelto", done: incident.estado === "atendido" },
  ]

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-neutral-950 to-black text-foreground antialiased">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <header className="relative border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Volver al Centro de Control
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            SEGUIMIENTO EN VIVO
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-10 md:px-6">
        <div className="text-center space-y-3 mb-8">
          <Badge className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/15 border-indigo-500/20 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Reporte Ciudadano ZK
          </Badge>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Estado de tu reporte
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 font-mono break-all">
            ID: {incident.id}
          </p>
        </div>

        {/* Status steps */}
        <Card className="mb-6 border-zinc-800 bg-zinc-900/40 backdrop-blur-sm shadow-xl shadow-black/40">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" />
              Línea de tiempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-zinc-800" />
              <div className="space-y-6">
                {statusSteps.map((step, idx) => (
                  <div key={idx} className="relative flex items-start gap-4">
                    <div className={`relative z-10 h-6 w-6 rounded-full flex items-center justify-center border ${step.done ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-600"}`}>
                      {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px]">{idx + 1}</span>}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${step.done ? "text-zinc-200" : "text-zinc-500"}`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incident detail */}
        <Card className="mb-6 border-zinc-800 bg-zinc-900/40 backdrop-blur-sm shadow-xl shadow-black/40">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-400" />
              Detalle del incidente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-zinc-500 uppercase tracking-wider text-[10px]">Tipo</p>
                <p className="text-zinc-200 font-semibold capitalize">{incident.tipo}</p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase tracking-wider text-[10px]">Severidad</p>
                <Badge className={`text-[10px] ${severityColor[incident.severidad] || severityColor.medium}`}>
                  {incident.severidad.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-zinc-500 uppercase tracking-wider text-[10px]">Ubicación</p>
                <p className="text-zinc-200">{incident.ubicacion}</p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase tracking-wider text-[10px]">Estado</p>
                <p className="text-zinc-200 font-semibold capitalize">{incident.estado}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audits */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className={`border ${audit.stellarZk?.verified ? "border-emerald-500/30 bg-emerald-950/15" : "border-zinc-800 bg-zinc-900/40"}`}>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                {audit.stellarZk?.verified ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-zinc-400" />}
                <span className={audit.stellarZk?.verified ? "text-emerald-400" : "text-zinc-300"}>Stellar ZK</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {audit.stellarZk ? (
                <>
                  <p className="text-zinc-300">
                    {audit.stellarZk.verified
                      ? "Proof Groth16 verificado. La ubicaci\u00f3n del reportante est\u00e1 dentro de la zona de riesgo oficial."
                      : "Verificaci\u00f3n pendiente o fallida."}
                  </p>
                  {audit.stellarZk.isSimulated ? (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px]">
                      Modo simulado (sin SECRET_KEY)
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">
                      Verificado on-chain (Soroban)
                    </Badge>
                  )}
                  {audit.stellarZk.txHash && (
                    <p className="text-[10px] text-zinc-500 font-mono break-all">
                      TX: {audit.stellarZk.txHash.slice(0, 16)}…{audit.stellarZk.txHash.slice(-8)}
                    </p>
                  )}
                  {audit.stellarZk.txExplorerUrl && (
                    <Button variant="outline" size="sm" asChild className="h-7 text-[10px] border-emerald-500/20 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40 w-full">
                      <a href={audit.stellarZk.txExplorerUrl} target="_blank" rel="noopener noreferrer">
                        Ver TX en Stellar Expert
                        <ExternalLink className="h-3 w-3 ml-1.5" />
                      </a>
                    </Button>
                  )}
                  {audit.stellarZk.explorerUrl && (
                    <Button variant="outline" size="sm" asChild className="h-7 text-[10px] border-indigo-500/20 bg-indigo-950/20 text-indigo-400 hover:bg-indigo-950/40 w-full">
                      <a href={audit.stellarZk.explorerUrl} target="_blank" rel="noopener noreferrer">
                        Ver contrato en Stellar
                        <ExternalLink className="h-3 w-3 ml-1.5" />
                      </a>
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-zinc-500">Este incidente no tiene verificaci\u00f3n ZK.</p>
              )}
            </CardContent>
          </Card>

          <Card className={`border ${audit.arkivDispatch ? "border-blue-500/30 bg-blue-950/15" : "border-zinc-800 bg-zinc-900/40"}`}>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                {audit.arkivDispatch ? <ShieldCheck className="h-4 w-4 text-blue-400" /> : <Clock className="h-4 w-4 text-zinc-400" />}
                <span className={audit.arkivDispatch ? "text-blue-400" : "text-zinc-300"}>Arkiv Despacho</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {audit.arkivDispatch ? (
                <>
                  <p className="text-zinc-300">
                    El despacho de recursos fue registrado en la blockchain de Arkiv.
                  </p>
                  <Button variant="outline" size="sm" asChild className="h-7 text-[10px] border-blue-500/20 bg-blue-950/20 text-blue-400 hover:bg-blue-950/40 w-full">
                    <a href={audit.arkivDispatch.explorerUrl} target="_blank" rel="noopener noreferrer">
                      Ver en Arkiv
                      <ExternalLink className="h-3 w-3 ml-1.5" />
                    </a>
                  </Button>
                </>
              ) : (
                <p className="text-zinc-500">A\u00fan no hay despacho auditado en Arkiv para este incidente.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-zinc-500">
            Esta p\u00e1gina se actualiza autom\u00e1ticamente cada 10 segundos.
          </p>
        </div>
      </main>
    </div>
  )
}
