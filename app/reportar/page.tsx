"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Loader2, ArrowLeft, AlertTriangle, MapPin } from "lucide-react"
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
import { TUCUMAN_LOCATIONS_POOL } from "@/hooks/use-incident-simulator"

const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || ""

const TUCUMAN_BBOX = { minLat: -27.0, maxLat: -26.5, minLng: -65.5, maxLng: -65.0 }

function pickRandomLocation(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const base = TUCUMAN_LOCATIONS_POOL[Math.abs(hash) % TUCUMAN_LOCATIONS_POOL.length]
  const jitterLat = (Math.random() - 0.5) * 0.004
  const jitterLng = (Math.random() - 0.5) * 0.004
  return {
    nombre: base.nombre,
    lat: base.lat + jitterLat,
    lng: base.lng + jitterLng,
  }
}

export default function ReportarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ubicacion, setUbicacion] = useState("")
  const [picked, setPicked] = useState<{ nombre: string; lat: number; lng: number } | null>(null)

  function handleUbicacionChange(value: string) {
    setUbicacion(value)
    if (value.trim().length >= 3) {
      setPicked(pickRandomLocation(value))
    } else {
      setPicked(null)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const street = (form.get("ubicacion") as string).trim()
    const location = picked ?? pickRandomLocation(street || Date.now().toString())

    const payload: ZkCitizenReport = {
      lat: Number(location.lat.toFixed(4)),
      lng: Number(location.lng.toFixed(4)),
      tipo: form.get("tipo") as IncidentType,
      severidad: form.get("severidad") as IncidentSeverity,
      ubicacion: location.nombre,
      personasAfectadas: parseInt(form.get("personasAfectadas") as string) || 0,
      descripcion: (form.get("descripcion") as string) || undefined,
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

      const incidentId = (data?.incident as Record<string, unknown>)?.id as string
      if (incidentId) {
        router.push(`/seguimiento/${incidentId}`)
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
                  used to derive a risk-zone, never stored verbatim
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-[110px_1fr] gap-4">
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
