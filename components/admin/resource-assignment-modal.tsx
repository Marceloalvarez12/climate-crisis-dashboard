"use client"

import { useState, useEffect, useCallback } from "react"
import {
  X,
  Truck,
  Ambulance,
  Shield,
  Ship,
  Plane,
  Check,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getOperatorAssignments,
  assignResourcesToOperator,
} from "@/app/admin/actions"

const RESOURCE_TYPE_MAP: Record<string, { category: "salud" | "rescate" | "seguridad"; icon: React.ReactNode }> = {
  ambulance:   { category: "salud",    icon: <Ambulance className="h-4 w-4" /> },
  medical:     { category: "salud",    icon: <Ambulance className="h-4 w-4" /> },
  helicopter:  { category: "salud",    icon: <Plane className="h-4 w-4" /> },
  firefighter: { category: "rescate",  icon: <Truck className="h-4 w-4" /> },
  boat:        { category: "rescate",  icon: <Ship className="h-4 w-4" /> },
  police:      { category: "seguridad", icon: <Shield className="h-4 w-4" /> },
  shelter:     { category: "rescate",  icon: <Truck className="h-4 w-4" /> },
}

const CATEGORIES = [
  { id: "salud" as const, label: "Health", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  { id: "rescate" as const, label: "Rescue / Firefighters", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { id: "seguridad" as const, label: "Security", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
]

interface DbResource {
  id: string
  tipo: string
  nombre: string
  cantidad: number
  cantidad_disponible: number
  estado: string
  ubicacion: string
}

interface ResourceAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  operatorId: string
  operatorName: string
}

export function ResourceAssignmentModal({ isOpen, onClose, operatorId, operatorName }: ResourceAssignmentModalProps) {
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resources, setResources] = useState<DbResource[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [assigned, response] = await Promise.all([
        getOperatorAssignments(operatorId),
        fetch("/api/recursos"),
      ])

      setSelectedResources(new Set(assigned))

      if (response.ok) {
        const data = await response.json()
        setResources(Array.isArray(data) ? data : [])
      } else {
        console.error("Error cargando recursos:", await response.text())
        setResources([])
      }
    } catch (err) {
      console.error("Error en loadData:", err)
      setSelectedResources(new Set())
      setResources([])
    } finally {
      setLoading(false)
    }
  }, [operatorId])

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

  const toggleResource = (resourceId: string) => {
    setSelectedResources((prev) => {
      const next = new Set(prev)
      if (next.has(resourceId)) {
        next.delete(resourceId)
      } else {
        next.add(resourceId)
      }
      return next
    })
  }

  const toggleCategory = (categoryId: string) => {
    const categoryResources = resources
      .filter((r) => (RESOURCE_TYPE_MAP[r.tipo]?.category ?? "rescate") === categoryId)
      .map((r) => r.id)
    const allSelected = categoryResources.every((id) => selectedResources.has(id))

    setSelectedResources((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        categoryResources.forEach((id) => next.delete(id))
      } else {
        categoryResources.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const isCategoryFullySelected = (categoryId: string) => {
    const categoryResources = resources
      .filter((r) => (RESOURCE_TYPE_MAP[r.tipo]?.category ?? "rescate") === categoryId)
      .map((r) => r.id)
    return categoryResources.length > 0 && categoryResources.every((id) => selectedResources.has(id))
  }

  const isCategoryPartiallySelected = (categoryId: string) => {
    const categoryResources = resources
      .filter((r) => (RESOURCE_TYPE_MAP[r.tipo]?.category ?? "rescate") === categoryId)
      .map((r) => r.id)
    const selectedCount = categoryResources.filter((id) => selectedResources.has(id)).length
    return selectedCount > 0 && selectedCount < categoryResources.length
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await assignResourcesToOperator(operatorId, Array.from(selectedResources))
      setTimeout(() => {
        setSaving(false)
        onClose()
      }, 1000)
    } catch (error) {
      console.error("Error guardando asignación:", error)
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  if (!isOpen) return null

  const totalAssignedUnits = Array.from(selectedResources).reduce((sum: number, resourceId: string) => {
    const resource = resources.find((r) => r.id === resourceId)
    return sum + (resource?.cantidad || 1)
  }, 0)

  const availableResources = resources.filter((r) => {
    const disp = r.cantidad_disponible ?? (r.cantidad || 1)
    return disp > 0
  })

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg mx-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Assign Resources</h2>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wider">
                {operatorName.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              <p className="text-xs text-zinc-500">Loading assignments...</p>
            </div>
          ) : availableResources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Truck className="h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">No available resources</p>
              <p className="text-xs text-zinc-600 text-center">
                All resources are assigned or in use.<br />
                Create new resources from "Resource Management".
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {CATEGORIES.map((cat) => {
                const categoryResources = availableResources.filter(
                  (r) => (RESOURCE_TYPE_MAP[r.tipo]?.category ?? "rescate") === cat.id
                )
                if (categoryResources.length === 0) return null

                const fullySelected = isCategoryFullySelected(cat.id)
                const partiallySelected = isCategoryPartiallySelected(cat.id)

                return (
                  <div key={cat.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30",
                        fullySelected && "bg-emerald-500/5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-6 w-6 items-center justify-center rounded border transition-all", cat.border, cat.bg, cat.color)}>
                          {fullySelected ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : partiallySelected ? (
                            <div className="h-2 w-2 rounded-sm bg-current" />
                          ) : (
                            <div className="h-2.5 w-2.5 rounded-sm border border-current" />
                          )}
                        </div>
                        <span className={cn("text-xs font-semibold", cat.color)}>{cat.label}</span>
                        <span className="text-[10px] text-zinc-600">
                          ({categoryResources.filter((r) => selectedResources.has(r.id)).length}/{categoryResources.length})
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-mono tracking-wider">SELECT ALL</span>
                    </button>

                    <div className="divide-y divide-zinc-800/30">
                      {categoryResources.map((resource) => {
                        const isSelected = selectedResources.has(resource.id)
                        const typeInfo = RESOURCE_TYPE_MAP[resource.tipo] || RESOURCE_TYPE_MAP.shelter
                        const cantidad = resource.cantidad || 1
                        const disponible = resource.cantidad_disponible ?? cantidad

                        return (
                          <button
                            key={resource.id}
                            onClick={() => toggleResource(resource.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-800/20",
                              isSelected && "bg-emerald-500/5"
                            )}
                          >
                            <div className={cn(
                              "flex h-5 w-5 items-center justify-center rounded border transition-all shrink-0",
                              isSelected
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-zinc-700 bg-zinc-900"
                            )}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={cn("shrink-0", isSelected ? "text-emerald-400" : "text-zinc-500")}>
                                {typeInfo.icon}
                              </span>
                              <span className={cn("text-xs truncate", isSelected ? "text-zinc-200 font-medium" : "text-zinc-400")}>
                                {resource.nombre}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn("text-[10px] font-mono font-semibold", isSelected ? "text-cyan-400" : "text-zinc-600")}>
                                {disponible}/{cantidad}
                              </span>
                              <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                                {resource.ubicacion}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!loading && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4 bg-zinc-900/30 shrink-0">
            <div className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-zinc-600" />
              <span className="text-xs text-zinc-500">
                <span className={cn("font-semibold", totalAssignedUnits > 0 ? "text-emerald-400" : "text-zinc-600")}>
                  {totalAssignedUnits}
                </span>{" "}
                unidad{totalAssignedUnits !== 1 ? "es" : ""} assigned{totalAssignedUnits !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={saving}
                className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700/50 transition-all disabled:opacity-30"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold text-white transition-all",
                  saving
                    ? "bg-zinc-600 cursor-wait"
                    : "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Save Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
