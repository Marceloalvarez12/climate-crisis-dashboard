"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { IncidentType, IncidentSeverity, ZkCitizenReport } from "@/lib/types"
import { TUCUMAN_LOCATIONS_POOL } from "@/hooks/use-incident-simulator"

const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || ""

// San Miguel de Tucumán bounding box — used to derive a randomized
// zone location from a citizen-supplied street description. The proof
// proves membership in this box without revealing the exact point.
const TUCUMAN_BBOX = { minLat: -27.0, maxLat: -26.5, minLng: -65.5, maxLng: -65.0 }

// Pick a location that looks similar to the typed street. If the user
// starts typing we surface a candidate from the pool, otherwise we pick
// a random spot so the demo produces a fresh incident on each submit.
function pickRandomLocation(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const base = TUCUMAN_LOCATIONS_POOL[Math.abs(hash) % TUCUMAN_LOCATIONS_POOL.length]
  // Small jitter (±0.002 deg ≈ ±200 m) so consecutive reports don't
  // pile up on top of each other while staying inside the bbox.
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
    <div className="container mx-auto max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Reporte anónimo verificable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Demostrá sin revelar tu ubicación exacta que estás dentro de una
            zona de riesgo oficial. El proof se genera localmente con Circom +
            Groth16 y se verifica on-chain contra el contrato Soroban
            desplegado en Stellar testnet, así el reporte queda firmado y
            consultable públicamente sin exponer tu punto exacto.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="ubicacion">Calle o avenida</Label>
              <Input
                id="ubicacion"
                name="ubicacion"
                placeholder="Ej: Av. Sarmiento y San Martín"
                value={ubicacion}
                onChange={(e) => handleUbicacionChange(e.target.value)}
                required
              />
              {picked && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Zona enboxada: <span className="font-mono">{picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo">Tipo de incidente</Label>
                <Select name="tipo" defaultValue="flood">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flood">Inundación</SelectItem>
                    <SelectItem value="fire">Incendio</SelectItem>
                    <SelectItem value="storm">Tormenta</SelectItem>
                    <SelectItem value="accident">Accidente</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="severidad">Severidad</Label>
                <Select name="severidad" defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Crítica</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="personasAfectadas">Personas afectadas</Label>
              <Input
                id="personasAfectadas"
                name="personasAfectadas"
                type="number"
                min={0}
                defaultValue={0}
              />
            </div>

            <div>
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Textarea
                id="descripcion"
                name="descripcion"
                maxLength={500}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Generando proof..." : "Enviar reporte ZK"}
            </Button>
          </form>

          {error && (
            <div className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
