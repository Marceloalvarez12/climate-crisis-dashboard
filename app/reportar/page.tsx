"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ShieldCheck, Loader2, ArrowLeft, AlertTriangle, MapPin, Crosshair, Copy, Check, ExternalLink, Search, Navigation, FileText } from "lucide-react"
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

// Mini-mapa con pin arrastrable — carga client-side only (Leaflet toca window)
const LocationPickerMap = dynamic(
  () => import("@/components/reportar/location-picker-map").then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/60">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    ),
  },
)

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
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ubicacion, setUbicacion] = useState("")
  const [picked, setPicked] = useState<GeocodedLocation | null>(null)
  // Pin movido manualmente por el usuario — tiene prioridad sobre el geocode
  const [manualPick, setManualPick] = useState<GeocodedLocation | null>(null)
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

  useEffect(() => {
    if (!reportResult) return
    const timer = setTimeout(() => router.replace(`/mapa?reporte=${encodeURIComponent(reportResult.incidentId)}`), 4000)
    return () => clearTimeout(timer)
  }, [reportResult, router])

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
            <h1 className="text-xl font-bold text-white">Reporte recibido</h1>
            <p className="mt-1 text-xs text-emerald-300">
              Tu reporte ya está en el mapa. Volverás automáticamente en unos segundos; guardá este comprobante para seguirlo.
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">Código de seguimiento</p>
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
                Comprobante digital
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
                  Guardá el código de seguimiento para consultar el estado de tu reporte.
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
                  Ver comprobante en Stellar
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
                Consultar auditoría del reporte →
              </a>
              <button
                onClick={() => router.replace(`/mapa?reporte=${encodeURIComponent(reportResult.incidentId)}`)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition-colors hover:bg-emerald-500"
              >
                Ver mi reporte en el mapa →
              </button>
              <a href={reportResult.trackingUrl} className="text-center text-xs text-emerald-300 hover:underline">
                Seguir mi reporte y ver el comprobante
              </a>
              <button
                onClick={() => location.reload()}
                className="rounded-lg px-3 py-2 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Hacer otro reporte
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
    setManualPick(null)
    setError(null)
  }

  async function handleFindAddress() {
    if (!ubicacion.trim() || geocoding) return
    setGeocoding(true)
    setError(null)
    try {
      const result = await geocodeAddress(ubicacion.trim())
      if (!result) {
        setError("No encontramos esa dirección en Tucumán. Probá con otra referencia o seleccioná el lugar en el mapa.")
        return
      }
      setPicked(result)
      setManualPick(null)
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const street = ((form.get("ubicacion") as string) || "").trim()

    // Prioridad: pin movido manualmente > resultado de Nominatim
    let location: GeocodedLocation | null = manualPick ?? picked
    if (!location && street.length >= 3) location = await geocodeAddress(street)
    if (!location) {
      setError(
        "Indicá una dirección válida o marcá el punto en el mapa antes de enviar el reporte.",
      )
      setLoading(false)
      return
    }

    if (location.lat < TUCUMAN_BBOX.minLat || location.lat > TUCUMAN_BBOX.maxLat ||
        location.lng < TUCUMAN_BBOX.minLng || location.lng > TUCUMAN_BBOX.maxLng) {
      setError("Seleccioná un punto dentro de la zona habilitada de San Miguel de Tucumán.")
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
          <a href="/mapa" className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Volver al mapa
          </a>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-300">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            ZNTINEL <span className="font-normal text-zinc-500">/ PORTAL CIUDADANO</span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
        {/* Title section */}
        <div className="mb-8 space-y-3">
          <Badge className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/15 border-indigo-500/20 text-xs px-3 py-1">
            Reporte ciudadano
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            ¿Qué está pasando?
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
            Indicá el lugar y describí la emergencia. Al enviarla volverás al mapa para verla en vivo.
            Tu dirección exacta no se mostrará en la vista pública.
          </p>
        </div>

        {/* Form card */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-2xl shadow-black/30">
          <form onSubmit={handleSubmit} className="space-y-0">
            <section className="space-y-5 border-b border-zinc-800 p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-300">01</span>
                <div>
                  <h2 className="font-semibold text-white">Ubicación de la emergencia</h2>
                  <p className="text-xs text-zinc-400">Buscá la dirección y ajustá el pin en el mapa si hace falta.</p>
                </div>
              </div>
            {/* Location */}
            <div className="space-y-1.5">
              <Label htmlFor="ubicacion" className="text-xs text-zinc-300">Calle o dirección <span className="text-zinc-500">(opcional si marcás el mapa)</span></Label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    id="ubicacion"
                    name="ubicacion"
                    placeholder="Ej: Av. Sarmiento y San Martín"
                    value={ubicacion}
                    onChange={(e) => handleUbicacionChange(e.target.value)}
                    disabled={geocoding}
                    className="h-11 border-zinc-700 bg-zinc-950/80 pl-9 text-sm placeholder-zinc-600 focus-visible:ring-cyan-500"
                    minLength={3}
                    maxLength={200}
                    required={!manualPick}
                  />
                </div>
                <Button type="button" variant="outline" disabled={geocoding || ubicacion.trim().length < 3} onClick={handleFindAddress}
                  className="h-11 gap-2 border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white">
                  {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline">Buscar</span>
                </Button>
              </div>
              {picked && (
                <div className="flex items-center gap-1.5 rounded-md border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1.5 text-[10px]">
                  <span className="font-mono text-indigo-300 tabular-nums">
                    {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
                  </span>
                  <span className="text-zinc-500">
                    Cerca de {picked.nombre}
                  </span>
                </div>
              )}
              {manualPick && (
                <div className="flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/5 px-2.5 py-1.5 text-[10px]">
                  <Crosshair className="h-3 w-3 shrink-0 text-amber-400" />
                  <span className="font-mono text-amber-300 tabular-nums">
                    {manualPick.lat.toFixed(4)}, {manualPick.lng.toFixed(4)}
                  </span>
                  <span className="text-zinc-500">ubicación marcada manualmente</span>
                </div>
              )}
            </div>

            {/* Mapa con pin arrastrable — el ciudadano confirma/ajusta la ubicación exacta */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">
                Ajustá el punto <span className="text-zinc-500">(tocá el mapa o arrastrá el pin)</span>
              </Label>
              <LocationPickerMap
                key={picked ? `${picked.lat}-${picked.lng}` : "default"}
                initial={picked}
                onChange={(v) => setManualPick({ lat: v.lat, lng: v.lng, nombre: v.nombre })}
                height={260}
              />
              <p className="flex items-center gap-1.5 text-xs text-zinc-400"><Navigation className="h-3.5 w-3.5 text-cyan-400" />El mapa público no muestra el punto exacto.</p>
            </div>
            </section>

            <section className="space-y-5 border-b border-zinc-800 p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-300">02</span>
                <div>
                  <h2 className="font-semibold text-white">Contanos lo que sucede</h2>
                  <p className="text-xs text-zinc-400">Estos datos ayudarán a entender y priorizar la emergencia.</p>
                </div>
              </div>
            {/* Type + severity */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tipo" className="text-xs text-zinc-300">Tipo de emergencia</Label>
                <Select name="tipo" required>
                  <SelectTrigger id="tipo" className="h-11 w-full border-zinc-700 bg-zinc-950/80">
                    <SelectValue placeholder="Elegí una opción" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-950">
                    <SelectItem value="flood">Inundación</SelectItem>
                    <SelectItem value="fire">Incendio</SelectItem>
                    <SelectItem value="storm">Tormenta</SelectItem>
                    <SelectItem value="accident">Accidente</SelectItem>
                    <SelectItem value="general">Otra emergencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="severidad" className="text-xs text-zinc-300">Gravedad</Label>
                <Select name="severidad" defaultValue="medium">
                  <SelectTrigger id="severidad" className="h-11 w-full border-zinc-700 bg-zinc-950/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-950">
                    <SelectItem value="critical">Crítica</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* People + description */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[110px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="personasAfectadas" className="text-xs text-zinc-300">Personas afectadas</Label>
                <Input
                  id="personasAfectadas"
                  name="personasAfectadas"
                  type="number"
                  min={0}
                  max={100000}
                  defaultValue={0}
                  className="h-11 border-zinc-700 bg-zinc-950/80 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descripcion" className="text-xs text-zinc-300">
                  Descripción <span className="text-zinc-500">(opcional)</span>
                </Label>
                <Textarea
                  id="descripcion"
                  name="descripcion"
                  maxLength={500}
                  rows={3}
                  className="resize-none border-zinc-700 bg-zinc-950/80 text-sm placeholder-zinc-600"
                  placeholder="Contanos qué estás viendo"
                />
              </div>
            </div>

            </section>

            <section className="space-y-5 p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-300">03</span>
                <div>
                  <h2 className="font-semibold text-white">Confirmá tu reporte</h2>
                  <p className="text-xs text-zinc-400">Podés recibir el comprobante por correo. No es obligatorio.</p>
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
              disabled={loading || geocoding}
              className="h-12 w-full bg-red-600 text-sm font-bold text-white shadow-lg shadow-red-950/30 hover:bg-red-500"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando reporte...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Enviar reporte
                </>
              )}
            </Button>

            {/* Privacy footnote */}
            <p className="flex items-start gap-2 rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3 text-xs leading-relaxed text-zinc-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              Tu ubicación exacta se usa para registrar el incidente, pero el mapa público solo muestra una zona aproximada.
            </p>
            </section>
          </form>

          {error && (
            <div role="alert" className="m-5 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-950/20 p-4 sm:mx-7">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
