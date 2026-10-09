"use client"

import { useEffect, useCallback, useRef } from "react"
import { useSWRConfig } from "swr"

interface AutoResolveOptions {
  onResolved?: (locations: string[]) => void
  intervalMs?: number
}

/** Development maintenance applies only to incidents explicitly simulated.
 * Operational resources never auto-release as a side effect of this hook.
 */
export function useAutoResolve({ onResolved, intervalMs = 60_000 }: AutoResolveOptions = {}) {
  const { mutate } = useSWRConfig()
  const onResolvedRef = useRef(onResolved)
  useEffect(() => { onResolvedRef.current = onResolved }, [onResolved])
  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/incidentes/auto-resolve", { method: "POST" })
      if (!res.ok) return
      const data = await res.json()
      if (data.resolved > 0) {
        await Promise.all([mutate("/api/incidentes?estado=activo"), mutate("/api/incidentes?estado=atendido"), mutate("/api/analytics")])
        onResolvedRef.current?.(data.locations ?? [])
      }
    } catch (error) {
      console.warn("[useAutoResolve] Simulation maintenance failed:", error)
    }
  }, [mutate])
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    void check()
    const timer = setInterval(check, intervalMs)
    return () => clearInterval(timer)
  }, [check, intervalMs])
}
