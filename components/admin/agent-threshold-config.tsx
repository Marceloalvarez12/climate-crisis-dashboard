'use client'

import { useState, useCallback } from 'react'
import { Sliders, Clock, Percent, Save, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateAgentThresholds } from '@/app/admin/actions'

interface ThresholdConfigProps {
  initialAutoResolve: number
  initialConfidence: number
}

const DEFAULT_AUTO_RESOLVE = 5
const DEFAULT_CONFIDENCE = 80

export function AgentThresholdConfig({
  initialAutoResolve,
  initialConfidence,
}: ThresholdConfigProps) {
  const [autoResolve, setAutoResolve] = useState(initialAutoResolve)
  const [confidence, setConfidence] = useState(initialConfidence)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleApply = useCallback(async () => {
    setIsSaving(true)
    setSaved(false)
    try {
      await updateAgentThresholds(autoResolve, confidence)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error aplicando calibración:', error)
    } finally {
      setIsSaving(false)
    }
  }, [autoResolve, confidence])

  const handleReset = useCallback(() => {
    setAutoResolve(DEFAULT_AUTO_RESOLVE)
    setConfidence(DEFAULT_CONFIDENCE)
    setSaved(false)
  }, [])

  const confidenceColor =
    confidence < 70
      ? 'text-yellow-400'
      : confidence >= 80
        ? 'text-emerald-400'
        : 'text-cyan-400'

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
          <Sliders className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Calibración de Sensibilidad IA
          </h2>
          <p className="text-[11px] text-zinc-500">
            Ajuste los parámetros operativos del razonamiento autónomo
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="px-6 py-6 space-y-8">
        {/* Control 1: Auto-Resolve Timer */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-500" />
              <label className="text-sm font-medium text-zinc-300">
                Tiempo de Auto-Cierre
              </label>
            </div>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {autoResolve} min
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={60}
            value={autoResolve}
            onChange={(e) => setAutoResolve(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-emerald-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-zinc-600 font-mono">1 min</span>
            <span className="text-[10px] text-zinc-600 font-mono">60 min</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            Tiempo máximo de inactividad antes de que la IA cierre un incidente
            de severidad baja/media automáticamente.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800/50" />

        {/* Control 2: Confidence Threshold */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-zinc-500" />
              <label className="text-sm font-medium text-zinc-300">
                Nivel Mínimo de Confianza
              </label>
            </div>
            <span
              className={cn(
                'text-lg font-bold font-mono transition-colors',
                confidenceColor
              )}
            >
              {confidence}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-zinc-600 font-mono">50%</span>
            <span className="text-[10px] text-zinc-600 font-mono">100%</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            Certeza mínima requerida por Gemini 2.0 para auto-despachar
            recursos sin validación humana.
          </p>
          {confidence < 70 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-yellow-400/80">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              Riesgo de falsos positivos
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
        <button
          onClick={handleReset}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar Valores por Defecto
        </button>
        <button
          onClick={handleApply}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all',
            saved
              ? 'bg-emerald-600 text-white'
              : 'bg-cyan-600 text-white hover:bg-cyan-500 active:scale-95 disabled:opacity-50'
          )}
        >
          {isSaving ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Sincronizando con Agente...
            </>
          ) : saved ? (
            <>
              <Save className="h-4 w-4" />
              Calibración Aplicada
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Aplicar Calibración
            </>
          )}
        </button>
      </div>
    </div>
  )
}
