"use client"

import { useState } from "react"
import { X, MapPin, Send, Loader2 } from "lucide-react"
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
import { toast } from "sonner"
import type { IncidentType, IncidentSeverity } from "@/lib/types"

const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || ""

interface ReportAddressModalProps {
  open: boolean
  onClose: () => void
}

export function ReportAddressModal({ open, onClose }: ReportAddressModalProps) {
  const [loading, setLoading] = useState(false)
  const [address, setAddress] = useState("")
  const [tipo, setTipo] = useState<IncidentType>("flood")
  const [severidad, setSeveridad] = useState<IncidentSeverity>("medium")
  const [descripcion, setDescripcion] = useState("")
  const [personas, setPersonas] = useState(0)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) {
      toast.error("Ingresá una dirección")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/incidentes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": API_SECRET,
        },
        body: JSON.stringify({
          address: address.trim(),
          tipo,
          severidad,
          descripcion: descripcion.trim() || undefined,
          personas_afectadas: personas,
          fuente: "citizen",
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Error al reportar")
      }
      toast.success("Incidente reportado", {
        description: data.ubicacion ?? address,
      })
      setAddress("")
      setDescripcion("")
      setPersonas(0)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Reportar incidente por dirección</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="addr">Dirección</Label>
            <Input
              id="addr"
              placeholder="Ej: Av. Mate de Luna 123, San Miguel de Tucumán"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Se geocodifica automáticamente con OpenStreetMap (Nominatim).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as IncidentType)}>
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
              <Label>Severidad</Label>
              <Select value={severidad} onValueChange={(v) => setSeveridad(v as IncidentSeverity)}>
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
            <Label htmlFor="pers">Personas afectadas</Label>
            <Input
              id="pers"
              type="number"
              min={0}
              value={personas}
              onChange={(e) => setPersonas(parseInt(e.target.value) || 0)}
            />
          </div>

          <div>
            <Label htmlFor="desc">Descripción</Label>
            <Textarea
              id="desc"
              maxLength={500}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles del incidente..."
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Geocodificando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Reportar incidente
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
