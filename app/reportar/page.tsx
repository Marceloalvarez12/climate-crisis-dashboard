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
import { CONFIG } from "@/lib/config"
import type { IncidentType, IncidentSeverity, ZkCitizenReport } from "@/lib/types"

const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || ""

export default function ReportarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const payload: ZkCitizenReport = {
      lat: parseFloat(form.get("lat") as string),
      lng: parseFloat(form.get("lng") as string),
      tipo: form.get("tipo") as IncidentType,
      severidad: form.get("severidad") as IncidentSeverity,
      ubicacion: form.get("ubicacion") as string,
      personasAfectadas: parseInt(form.get("personasAfectadas") as string) || 0,
      descripcion: (form.get("descripcion") as string) || undefined,
      zoneHash: 12345,
      minLat: -27.0,
      maxLat: -26.5,
      minLng: -65.5,
      maxLng: -65.0,
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

      const incidentId = (data.data?.incident as Record<string, unknown>)?.id as string
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
            Groth16 y se verifica vía Stellar/Soroban (modo simulado en este
            entorno).
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lat">Latitud</Label>
                <Input
                  id="lat"
                  name="lat"
                  type="number"
                  step="0.0001"
                  defaultValue={String(CONFIG.INCIDENTS.DEFAULT_COORDS.lat)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lng">Longitud</Label>
                <Input
                  id="lng"
                  name="lng"
                  type="number"
                  step="0.0001"
                  defaultValue={String(CONFIG.INCIDENTS.DEFAULT_COORDS.lng)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ubicacion">Ubicación aproximada</Label>
              <Input
                id="ubicacion"
                name="ubicacion"
                placeholder="Ej: Av. Sarmiento y San Martín"
                required
              />
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
