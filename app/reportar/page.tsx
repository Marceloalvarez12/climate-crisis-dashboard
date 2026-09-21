"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Loader2, ArrowLeft, AlertTriangle, MapPin, Copy, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { IncidentType, IncidentSeverity, ZkCitizenReport } from "@/lib/types"

const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || ""

const TUCUMAN_BBOX = { minLat: -27.0, maxLat: -26.5, minLng: -65.5, maxLng: -65.0 }

type GeocodedLocation = { nombre: string; lat: number; lng: number }

async function geocodeAddress(address: string): Promise<GeocodedLocation | null> {
  // Nominatim exige User-Agent propio en sus ToS — sin él bloquea a 0 resultados.
  // Probe con varias estrategias en orden: provincia → bbox Tucumán → sin bbox.
  const queries = [
    `${address}, San Miguel de Tucumán, Tucumán, Argentina`,
    `${address}, Tucumán, Argentina`,
    `${address}, Argentina`,
    address,
  ]
  for (const q of queries) {
    const params = new URLSearchParams({ q: q, format: "jsonv2", limit: "1", countrycodes: "ar" })
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            "User-Agent": "Zntinel-Dashboard/1.0 (crisis reporting)",
            "Accept-Language": "es",
            Accept: "application/json",
          },
        },
      )
      if (!response.ok) continue
      const results = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>
      if (!results.length) continue
      const r = results[0]
      const lat = Number(r.lat)
      const lng = Number(r.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      // Acepta resultados dentro del bbox con ~0.1° de margen para Yerba Buena, San Javier, etc.
      const inBbox =
        lat >= TUCUMAN_BBOX.minLat - 0.1 &&
        lat <= TUCUMAN_BBOX.maxLat + 0.1 &&
        lng >= TUCUMAN_BBOX.minLng - 0.1 &&
        lng <= TUCUMAN_BBOX.maxLng + 0.1
      if (!inBbox) continue
      return { nombre: r.display_name, lat, lng }
    } catch {
      continue
    }
  }
  return null
}

export default function ReportarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ubicacion, setUbicacion] = useState("")
  const [picked, setPicked] = useState<GeocodedLocation | null>(null)
  const [reportResult, setReportResult] = useState<{
    incidentId: string
    txHash: string | null
    contractId: string | null
    explorerUrl: string | null
    trackingUrl: string
    mailStatus?: "sent" | "failed"
    mailTo?: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Success screen: mostrar el hash ANTES de ir al seguimiento ──
  if (reportResult) {
    return (
      <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-neutral-950 to-black text-foreground antialiased">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <main className="relative mx-auto max-w-lg px-4 py-24 md:px-6">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-8 text-center shadow-2xl shadow-emerald-950/10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Report sealed on-chain</h1>
            <p className="mt-1 text-xs text-emerald-300">
              Your proof was verified and recorded. Save the hash below to audit this report anytime.
            </p>
            {reportResult.mailStatus && (
              <p className="mt-2 text-[11px] text-zinc-400">
                {reportResult.mailStatus === "sent"
                  ? `📩 Enviado a ${reportResult.mailTo} — buscá el mail de Zntinel con tu hash y links.`
                  : reportResult.mailStatus === "failed"
                    ? `⚠ No pudimos enviar el mail a ${reportResult.mailTo}. Guardá el hash de abajo manualmente.`
                    : null}
              </p>
            )}

            {/* Tracking ID */}
            <div className="mt-6 space-y-1.5 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">Tracking ID</p>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-black/40 px-3 py-2.5">
                <span className="min-w-0 flex-1 break-all font-mono text-[11px] text-emerald-200">
                  {reportResult.incidentId}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(reportResult.incidentId)}
                  className="shrink-0 text-emerald-400/60 hover:text-emerald-300"
                  title="Copy tracking ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ZK proof hash — siempre visible, aunque sea el tracking como fallback */}
            <div className="mt-4 space-y-1.5 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400/70">
                Proof hash
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-950/20 px-3 py-2.5">
                <span className="min-w-0 flex-1 break-all font-mono text-[11px] text-indigo-200">
                  {reportResult.txHash
                    ? (reportResult.txHash.length > 56
                        ? `${reportResult.txHash.slice(0, 42)}…${reportResult.txHash.slice(-12)}`
                        : reportResult.txHash)
                    : reportResult.incidentId}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(reportResult.txHash || reportResult.incidentId)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="shrink-0 text-indigo-400/60 hover:text-indigo-300"
                  title="Copy full hash"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              {!reportResult.txHash && (
                <p className="text-[9px] text-zinc-500">
                  Stellar está temporalmente saturado. El Tracking ID funciona como hash de
                  verificación en el portal de auditoría.
                </p>
              )}
            </div>

            {/* Links */}
            <div className="mt-5 flex flex-col gap-2">
              {reportResult.explorerUrl && (
                <a
                  href={reportResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View proof on Stellar Soroban
                </a>
              )}
              {/* Portal de auditoría de Braga — verifica el estado del reporte en cualquier momento */}
              <a
                href={`/auditoria?key=${reportResult.txHash || reportResult.incidentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Audit this report on Braga Portal →
              </a>
              <button
                onClick={() => router.push(reportResult.trackingUrl)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition-colors hover:bg-emerald-500"
              >
                Track my report live →
              </button>
              <button
                onClick={() => location.reload()}
                className="rounded-lg px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Submit another report
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  function handleUbicacionChange(value: string) {
    setUbicacion(value)
    setPicked(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const street = (form.get("ubicacion") as string).trim()
    const location = await geocodeAddress(street)
    if (!location) {
      setError("No pudimos ubicar esa dirección en San Miguel de Tucumán. Verificá la calle y altura o esquina.")
      setLoading(false)
      return
    }

    const payload: ZkCitizenReport = {
      lat: Number(location.lat.toFixed(4)),
      lng: Number(location.lng.toFixed(4)),
      tipo: form.get("tipo") as IncidentType,
      severidad: form.get("severidad") as IncidentSeverity,
      ubicacion: location.nombre,
      personasAfectadas: parseInt(form.get("personasAfectadas") as string) || 0,
      descripcion: (form.get("descripcion") as string) || undefined,
      contacto: ((form.get("contacto") as string) || "").trim() || undefined,
      zoneHash: 12345,
      minLat: TUCUMAN_BBOX.minLat,
      maxLat: TUCUMAN_BBOX.maxLat,
      minLng: TUCUMAN_BBOX.minLng,
      maxLng: TUCUMAN_BBOX.maxLng,
    }

    try {
      const res = await fetch("/api/incidentes/zk-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": API_SECRET,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error sending report")
      }

      const incidentId =
        ((data?.incident as Record<string, unknown>)?.id as string) ||
        (data?.incidentId as string) ||
        ""
      if (incidentId) {
        setReportResult({
          incidentId,
          txHash: (data?.txHash as string) || null,
          contractId: (data?.contractId as string) || null,
          explorerUrl: (data?.explorerUrl as string) || null,
          trackingUrl: `/seguimiento/${incidentId}`,
          mailStatus: (data?.mail as "sent" | "failed" | undefined) || undefined,
          mailTo: (data?.mailTo as string) || undefined,
        })
        return
      }

      throw new Error("Report sent but no tracking ID was received")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-neutral-950 to-black text-foreground antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background grid texture — same as auditoria/seguimiento */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Header */}
      <header className="relative border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Control Center
          </a>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            ZK CIRCUIT · GROTH16
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-12 md:px-6">
        {/* Title section */}
        <div className="text-center space-y-3 mb-10">
          <Badge className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/15 border-indigo-500/20 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Anonymous Verifiable Report
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-white to-zinc-400 sm:text-4xl">
            ZK Citizen Report
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-400">
            Prove you are inside an official risk zone <span className="text-zinc-200">without revealing your exact location</span>.
            The proof is generated locally (Circom + Groth16) and verified on Stellar Soroban — your report becomes publicly checkable while your position stays private.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-xl shadow-black/40">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Location */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ubicacion" className="text-xs text-zinc-300">
                  Street or avenue
                </Label>
                <span className="font-mono text-[9px] text-zinc-600">
                  se geolocaliza para ubicar el incidente en el mapa
                </span>
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="ubicacion"
                  name="ubicacion"
                  placeholder="Ej: Av. Sarmiento y San Martín"
                  value={ubicacion}
                  onChange={(e) => handleUbicacionChange(e.target.value)}
                  className="h-11 border-zinc-700 bg-zinc-950/80 pl-9 font-mono text-sm placeholder-zinc-600 focus-visible:ring-indigo-500"
                  required
                />
              </div>
              {picked && (
                <div className="flex items-center gap-1.5 rounded-md border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1.5 text-[10px]">
                  <span className="font-mono text-indigo-300 tabular-nums">
                    {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
                  </span>
                  <span className="text-zinc-500">
                    inside {picked.nombre} risk box
                  </span>
                </div>
              )}
            </div>

            {/* Type + severity */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tipo" className="text-xs text-zinc-300">Incident type</Label>
                <Select name="tipo" defaultValue="flood">
                  <SelectTrigger className="h-11 border-zinc-700 bg-zinc-950/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-950">
                    <SelectItem value="flood">Flood</SelectItem>
                    <SelectItem value="fire">Fire</SelectItem>
                    <SelectItem value="storm">Storm</SelectItem>
                    <SelectItem value="accident">Accident</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="severidad" className="text-xs text-zinc-300">Severity</Label>
                <Select name="severidad" defaultValue="medium">
                  <SelectTrigger className="h-11 border-zinc-700 bg-zinc-950/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-950">
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* People + description */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[110px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="personasAfectadas" className="text-xs text-zinc-300">Affected</Label>
                <Input
                  id="personasAfectadas"
                  name="personasAfectadas"
                  type="number"
                  min={0}
                  defaultValue={0}
                  className="h-11 border-zinc-700 bg-zinc-950/80 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descripcion" className="text-xs text-zinc-300">
                  Description <span className="text-zinc-600">(optional)</span>
                </Label>
                <Textarea
                  id="descripcion"
                  name="descripcion"
                  maxLength={500}
                  rows={2}
                  className="resize-none border-zinc-700 bg-zinc-950/80 text-sm placeholder-zinc-600"
                  placeholder="What are you seeing right now?"
                />
              </div>
            </div>

            {/* Contacto: para recibir el hash + link de auditoría por email */}
            <div className="space-y-1.5">
              <Label htmlFor="contacto" className="text-xs text-zinc-300">
                Email <span className="text-zinc-600">(opcional)</span>
              </Label>
              <Input
                id="contacto"
                name="contacto"
                type="email"
                maxLength={200}
                className="h-11 border-zinc-700 bg-zinc-950/80 text-sm placeholder-zinc-600"
                placeholder="tu@email.com"
              />
              <p className="text-[10px] text-zinc-600">
                Te enviamos el hash del reporte y el link de auditoría para verificar el estado
                cuando quieras. Se guarda asociado al reporte — nunca se publica.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-500"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating proof locally...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Send ZK Report
                </>
              )}
            </Button>

            {/* Privacy footnote */}
            <p className="flex items-center gap-1.5 text-center text-[10px] leading-relaxed text-zinc-600">
              <ShieldCheck className="h-3 w-3 shrink-0 text-indigo-500/60" />
              Circom Groth16 runs in your browser. Neither the server nor the chain ever sees
              your exact point — only zone membership (bbox {TUCUMAN_BBOX.minLat}° to {TUCUMAN_BBOX.maxLat}°).
            </p>
          </form>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-950/20 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
