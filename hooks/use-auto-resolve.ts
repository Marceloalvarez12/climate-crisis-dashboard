"use client"

import { useEffect, useCallback } from "react"
import { useSWRConfig } from "swr"

interface AutoResolveOptions {
  /** Callback para notificar incidentes cerrados automáticamente */
  onResolved?: (locations: string[]) => void
  /** Callback para notificar recursos liberados automáticamente */
  onResourcesReset?: (nombres: string[]) => void
  /** Intervalo de chequeo en ms. Default: 60 segundos */
  intervalMs?: number
}

/**
 * Ejecuta dos tareas de mantenimiento automático en un único intervalo:
 *
 * 1. Auto-resolve de incidentes: marca como "atendido" los incidentes activos
 *    con más de 5 minutos sin atención vía POST /api/incidentes/auto-resolve.
 *
 * 2. Auto-reset de recursos: detecta recursos en estado "dispatched" o "busy"
 *    con más de 3 minutos sin actualización (atascados por reinicio del servidor
 *    o recarga del navegador) y los devuelve a "available" vía
 *    POST /api/recursos/auto-reset.
 *
 * Ambas tareas corren en mount y luego cada `intervalMs` milisegundos.
 */
export function useAutoResolve({
  onResolved,
  onResourcesReset,
  intervalMs = 60_000,
}: AutoResolveOptions = {}) {
  const { mutate } = useSWRConfig()

  const check = useCallback(async () => {
    const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET ?? ""
    const headers: Record<string, string> = API_SECRET ? { "x-api-secret": API_SECRET } : {}

    // ── 1. Auto-resolve incidentes ──────────────────────────────────────────
    try {
      const res = await fetch("/api/incidentes/auto-resolve", {
        method: "POST",
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        if (data.resolved > 0) {
          mutate("/api/incidentes")
          mutate("/api/analytics")
          onResolved?.(data.locations ?? [])
        }
      }
    } catch {
      // Non-blocking — nunca crashear la UI por fallo de red
    }

    // ── 2. Auto-reset recursos atascados ────────────────────────────────────
    try {
      const res = await fetch("/api/recursos/auto-reset", {
        method: "POST",
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        if (data.reset > 0) {
          mutate("/api/recursos")
          const nombres = (data.recursos as Array<{ nombre: string }>).map((r) => r.nombre)
          onResourcesReset?.(nombres)
          console.log(`[useAutoResolve] ${data.reset} recursos liberados:`, nombres)
        }
      }
    } catch {
      // Non-blocking
    }
  }, [mutate, onResolved, onResourcesReset])

  useEffect(() => {
    // Ejecutar inmediatamente al montar (limpia recursos atascados desde el arranque)
    check()
    const id = setInterval(check, intervalMs)
    return () => clearInterval(id)
  }, [check, intervalMs])
}
