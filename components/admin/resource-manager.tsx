"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Truck,
  Ambulance,
  Shield,
  Ship,
  Plane,
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ResourceFormModal } from "./resource-form-modal"
import { toast } from "sonner"
import { groupResourcesByTypeAndBase, getTipoLabel, calculateEstado } from "@/lib/resource-helpers"
import type { DbResource } from "@/lib/types"

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  ambulance: <Ambulance className="h-4 w-4" />,
  firefighter: <Truck className="h-4 w-4" />,
  helicopter: <Plane className="h-4 w-4" />,
  boat: <Ship className="h-4 w-4" />,
  shelter: <Truck className="h-4 w-4" />,
  medical: <Ambulance className="h-4 w-4" />,
  police: <Shield className="h-4 w-4" />,
}

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  dispatched: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  busy: "bg-red-500/10 text-red-400 border-red-500/20",
  retired: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
}

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  dispatched: "En Route",
  busy: "Occupied",
  retired: "Retired",
}

export function ResourceManager() {
  const [resources, setResources] = useState<DbResource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFormModal, setShowFormModal] = useState(false)
  const [editResource, setEditResource] = useState<DbResource | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const loadResources = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/recursos")
      if (res.ok) {
        const data = await res.json()
        setResources(Array.isArray(data) ? data : [])
      }
    } catch {
      setResources([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadResources()
  }, [loadResources])

  const groupedResources = groupResourcesByTypeAndBase(resources)

  const filteredGroups = groupedResources.filter((group) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      getTipoLabel(group.tipo).toLowerCase().includes(query) ||
      group.ubicacion.toLowerCase().includes(query) ||
      group.resources.some((r) => r.nombre.toLowerCase().includes(query))
    )
  })

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleDelete = async (resource: DbResource) => {
    if (!confirm(`Remove "${resource.nombre}" from system?`)) return

    setDeletingId(resource.id)
    try {
      const res = await fetch(`/api/recursos?id=${resource.id}`, { method: "DELETE" })
      if (res.ok) {
        setResources((prev) => prev.filter((r) => r.id !== resource.id))
        toast.success("Resource removed from system")
      } else {
        toast.error("Error removing resource")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setDeletingId(null)
    }
  }

  const handleFormSuccess = () => {
    setShowFormModal(false)
    setEditResource(null)
    loadResources()
    toast.success(editResource ? "Resource updated" : "Resource created")
  }

  const openEdit = (resource: DbResource) => {
    setEditResource(resource)
    setShowFormModal(true)
  }

  const openCreate = () => {
    setEditResource(null)
    setShowFormModal(true)
  }

  const stats = {
    total: resources.reduce((sum, r) => sum + (r.cantidad || 1), 0),
    available: resources.reduce((sum, r) => sum + (r.cantidad_disponible ?? (r.cantidad || 1)), 0),
    dispatched: resources.filter((r) => r.estado === "dispatched").reduce((sum, r) => sum + ((r.cantidad || 1) - (r.cantidad_disponible ?? (r.cantidad || 1))), 0),
    busy: resources.filter((r) => r.estado === "busy").reduce((sum, r) => sum + (r.cantidad || 1), 0),
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
          <Truck className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Resource Management
          </h2>
          <p className="text-[11px] text-zinc-500">
            Manage units, vehicles and equipment
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/20">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-zinc-500 font-mono">
            {stats.available} available
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-yellow-500" />
          <span className="text-[10px] text-zinc-500 font-mono">
            {stats.dispatched} en route
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-zinc-500 font-mono">
            {stats.busy} occupied
          </span>
        </div>
        <span className="text-[10px] text-zinc-600 font-mono ml-auto">
          Total: {stats.total}
        </span>
      </div>

      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, tipo o ubicación..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Resource
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
            <p className="text-xs text-zinc-500">Loading resources...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-zinc-600">
            <Truck className="h-8 w-8 mb-2" />
            <p className="text-sm">No resources found</p>
            <p className="text-xs mt-1">
              {searchQuery ? "Try a different search term" : "Add a new resource to get started"}
            </p>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            {filteredGroups.map((group) => {
              const groupKey = `${group.tipo}|${group.ubicacion}`
              const isExpanded = expandedGroups.has(groupKey)
              const disponible = group.totalDisponible
              const total = group.totalCantidad
              const percent = total > 0 ? (disponible / total) * 100 : 0

              return (
                <div key={groupKey} className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 shrink-0">
                      {RESOURCE_ICONS[group.tipo] || <Truck className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-200">
                          {getTipoLabel(group.tipo)}
                        </span>
                        <span className="text-xs text-zinc-500">—</span>
                        <span className="text-sm text-zinc-400">
                          {group.ubicacion}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          "text-xs font-mono font-semibold",
                          disponible === total ? "text-emerald-400" :
                          disponible > 0 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {disponible}/{total}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {disponible === total ? "available" :
                           disponible > 0 ? `${total - disponible} in use` : "all occupied"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            percent >= 80 ? "bg-emerald-500" :
                            percent >= 40 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-800/50">
                      {group.resources.map((resource) => {
                        const rDisponible = resource.cantidad_disponible ?? (resource.cantidad || 1)
                        const rTotal = resource.cantidad || 1
                        const rPercent = rTotal > 0 ? (rDisponible / rTotal) * 100 : 0
                        const rEstado = calculateEstado(rTotal, rDisponible)

                        return (
                          <div key={resource.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/30 last:border-b-0 hover:bg-zinc-800/20 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-300 truncate">
                                  {resource.nombre}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-mono font-semibold",
                                  rDisponible === rTotal ? "text-emerald-400" :
                                  rDisponible > 0 ? "text-yellow-400" : "text-red-400"
                                )}>
                                  {rDisponible}/{rTotal}
                                </span>
                              </div>
                              <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    rPercent >= 80 ? "bg-emerald-500" :
                                    rPercent >= 40 ? "bg-yellow-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${rPercent}%` }}
                                />
                              </div>
                            </div>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0",
                                STATUS_STYLES[rEstado] || STATUS_STYLES.available
                              )}
                            >
                              <div
                                className={cn(
                                  "h-1 w-1 rounded-full",
                                  rEstado === "available" ? "bg-emerald-400" :
                                  rEstado === "dispatched" ? "bg-yellow-400" :
                                  rEstado === "busy" ? "bg-red-400" : "bg-zinc-500"
                                )}
                              />
                              {STATUS_LABELS[rEstado] || rEstado}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openEdit(resource)}
                                className="p-1 rounded text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 transition-colors"
                                title="Edit"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(resource)}
                                disabled={deletingId === resource.id}
                                className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-30"
                                title="Remove"
                              >
                                {deletingId === resource.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ResourceFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false)
          setEditResource(null)
        }}
        onSuccess={handleFormSuccess}
        editResource={editResource}
      />
    </div>
  )
}
