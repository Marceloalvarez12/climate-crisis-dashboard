"use client"

import { useState, useEffect } from "react"
import { X, Check, Loader2, Truck, Ambulance, Shield, Ship, Plane } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateResourceName } from "@/lib/resource-helpers"

const RESOURCE_TYPES = [
  { id: "ambulance", label: "Ambulancia", icon: <Ambulance className="h-4 w-4" /> },
  { id: "firefighter", label: "Bomberos", icon: <Truck className="h-4 w-4" /> },
  { id: "helicopter", label: "Helicóptero", icon: <Plane className="h-4 w-4" /> },
  { id: "boat", label: "Lancha", icon: <Ship className="h-4 w-4" /> },
  { id: "shelter", label: "Albergue", icon: <Truck className="h-4 w-4" /> },
  { id: "medical", label: "Médico", icon: <Ambulance className="h-4 w-4" /> },
  { id: "police", label: "Policía", icon: <Shield className="h-4 w-4" /> },
]

interface ResourceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editResource?: { id: string; nombre: string; tipo: string; cantidad?: number; estado: string; ubicacion: string } | null
}

export function ResourceFormModal({ isOpen, onClose, onSuccess, editResource }: ResourceFormModalProps) {
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("ambulance")
  const [cantidad, setCantidad] = useState(1)
  const [ubicacion, setUbicacion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (editResource) {
      setNombre(editResource.nombre)
      setTipo(editResource.tipo)
      setCantidad(editResource.cantidad || 1)
      setUbicacion(editResource.ubicacion)
    } else {
      setNombre("")
      setTipo("ambulance")
      setCantidad(1)
      setUbicacion("")
    }
    setError("")
  }, [editResource, isOpen])

  useEffect(() => {
    if (!editResource && tipo && ubicacion) {
      const suggestedName = generateResourceName(tipo, ubicacion)
      setNombre(suggestedName)
    }
  }, [tipo, ubicacion, editResource])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const url = editResource ? `/api/recursos?id=${editResource.id}` : "/api/recursos"
      const method = editResource ? "PATCH" : "POST"

      const body = editResource
        ? { id: editResource.id, nombre, tipo, cantidad, ubicacion }
        : { nombre, tipo, cantidad, ubicacion }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Error al guardar recurso")
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {editResource ? "Editar Recurso" : "Nuevo Recurso"}
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wider">
                {editResource ? "MODIFICAR RECURSO EXISTENTE" : "AGREGAR AL SISTEMA"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5">
              <p className="text-[11px] font-mono text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1.5">
              Nombre del Recurso
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Ambulancias SAME - Base Central"
              required
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1.5">
              Cantidad de Unidades
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                className="h-9 w-9 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 flex items-center justify-center transition-colors"
              >
                −
              </button>
              <input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                required
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 text-center font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
              <button
                type="button"
                onClick={() => setCantidad(cantidad + 1)}
                className="h-9 w-9 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">Total de unidades en este grupo</p>
          </div>

          <div>
            <label className="block text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1.5">
              Tipo de Recurso
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RESOURCE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all",
                    tipo === t.id
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1.5">
              Base / Ubicación
            </label>
            <input
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ej: Base Central"
              required
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>

          <div className="px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-[11px] font-mono text-emerald-400">
              Estado: Disponible (por defecto)
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/50 transition-all disabled:opacity-30"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex items-center justify-center gap-2 flex-1 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all",
                loading
                  ? "bg-zinc-600 cursor-wait"
                  : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 active:scale-[0.98] shadow-lg shadow-cyan-500/20"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {editResource ? "Actualizar" : "Crear Recurso"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
