"use client"

import { useState, useCallback } from "react"
import { Mic, MicOff, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
// NOTE: admin actions no existen en este repo; se necesita crear server actions
// o conectar con config_sistema. Por ahora el componente se deja como stub.
const getVoiceControlEnabled = async () => false
const updateVoiceControlEnabled = async (_v: boolean) => false

interface VoiceControlKillSwitchProps {
  initialEnabled: boolean
}

export function VoiceControlKillSwitch({ initialEnabled }: VoiceControlKillSwitchProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isUpdating, setIsUpdating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleActivate = useCallback(async () => {
    setIsUpdating(true)
    try {
      await updateVoiceControlEnabled(true)
      setEnabled(true)
    } catch (error) {
      console.error("Error activando voice control:", error)
    } finally {
      setIsUpdating(false)
    }
  }, [])

  const handleDeactivate = useCallback(async () => {
    setIsUpdating(true)
    try {
      await updateVoiceControlEnabled(false)
      setEnabled(false)
    } catch (error) {
      console.error("Error desactivando voice control:", error)
    } finally {
      setIsUpdating(false)
      setConfirmOpen(false)
    }
  }, [])

  const handleToggle = useCallback(() => {
    if (enabled) {
      setConfirmOpen(true)
    } else {
      handleActivate()
    }
  }, [enabled, handleActivate])

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              enabled ? "bg-cyan-500/10" : "bg-zinc-700/30",
            )}
          >
            {enabled ? (
              <Mic className="h-5 w-5 text-cyan-400" />
            ) : (
              <MicOff className="h-5 w-5 text-zinc-500" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">
              Control por Voz (OpenAI Realtime)
            </h2>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  enabled ? "bg-cyan-400 animate-pulse" : "bg-zinc-600",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-mono tracking-wider uppercase",
                  enabled ? "text-cyan-400/70" : "text-zinc-500",
                )}
              >
                {enabled ? "Voz habilitada" : "Voz desactivada"}
              </span>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-mono",
              enabled
                ? "bg-cyan-500/10 text-cyan-400"
                : "bg-zinc-800 text-zinc-500",
            )}
          >
            <ShieldAlert className="h-3 w-3" />
            {enabled ? "ENABLED" : "OFF"}
          </div>
        </div>

        <div className="px-6 py-6">
          <button
            onClick={handleToggle}
            disabled={isUpdating}
            className={cn(
              "group relative w-full rounded-xl border-2 p-5 transition-all duration-300",
              "hover:scale-[1.01] active:scale-[0.99]",
              isUpdating && "pointer-events-none opacity-60",
              enabled
                ? "border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-500/50"
                : "border-zinc-700/40 bg-zinc-900/30 hover:border-zinc-600/60",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl",
                    enabled ? "bg-cyan-500/20" : "bg-zinc-800",
                  )}
                >
                  {enabled ? (
                    <Mic className="h-6 w-6 text-cyan-400" />
                  ) : (
                    <MicOff className="h-6 w-6 text-zinc-500" />
                  )}
                </div>
                <div className="text-left">
                  <p
                    className={cn(
                      "text-base font-bold",
                      enabled ? "text-cyan-300" : "text-zinc-300",
                    )}
                  >
                    {enabled ? "Operador puede hablarle al sistema" : "Solo interfaz visual"}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {enabled
                      ? "WebSocket OpenAI Realtime · ~$0.06-$0.24/min audio"
                      : "Activar requiere OPENAI_API_KEY configurada"}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  "flex h-7 w-12 items-center rounded-full p-1 transition-colors",
                  enabled ? "bg-cyan-500" : "bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded-full bg-white shadow-md transition-transform",
                    enabled ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </div>
            </div>
          </button>
        </div>

        <div className="border-t border-zinc-800 px-6 py-4">
          <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 mb-3">
            Comandos disponibles cuando esté activo
          </p>
          <ul className="space-y-1.5 text-[11px] text-zinc-400">
            <li>· &quot;Centrar en incidente crítico&quot;</li>
            <li>· &quot;Mostrar / ocultar sismos / clima&quot;</li>
            <li>· &quot;Modo satélite / calles / topo / noche&quot;</li>
            <li>· &quot;Vista general&quot;</li>
            <li>· &quot;Cuál es la temperatura?&quot;</li>
          </ul>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => !isUpdating && setConfirmOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-500/20 bg-zinc-950 p-0 shadow-2xl mx-4">
            <div className="flex items-center gap-3 border-b border-cyan-500/20 bg-cyan-500/5 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                <MicOff className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-cyan-300">Desactivar voz</h3>
                <p className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-wider">
                  El operador volverá a usar sólo la UI
                </p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-zinc-300">
                La sesión de WebSocket se cerrará y no se podrán emitir comandos por voz.
                El operador podrá seguir usando mouse, teclado y touch.
              </p>
            </div>
            <div className="flex gap-3 border-t border-zinc-800 px-6 py-4">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={isUpdating}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isUpdating}
                className="flex-1 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
              >
                {isUpdating ? "Procesando..." : "Desactivar voz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
