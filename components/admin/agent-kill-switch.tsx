'use client'

import { useState, useCallback } from 'react'
import { ShieldAlert, Bot, Power, AlertTriangle, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateAgentMode } from '@/app/admin/actions'

interface ImpactItem {
  label: string
  activeText: string
  inactiveText: string
  alwaysActive?: boolean
}

const IMPACT_ITEMS: ImpactItem[] = [
  {
    label: 'Real-Time Scanning',
    activeText: 'X, Facebook, Logs active',
    inactiveText: 'X, Facebook, Logs active',
    alwaysActive: true,
  },
  {
    label: 'Auto-Close Incidents',
    activeText: 'Auto-close enabled',
    inactiveText: 'Requires manual intervention',
  },
  {
    label: 'Severity Analysis',
    activeText: 'Autonomous classification active',
    inactiveText: 'Autonomous classification active',
    alwaysActive: true,
  },
]

interface AgentKillSwitchProps {
  initialAutonomous: boolean
}

export function AgentKillSwitch({ initialAutonomous }: AgentKillSwitchProps) {
  const [isAutonomous, setIsAutonomous] = useState(initialAutonomous)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleDeactivate = useCallback(async () => {
    setIsUpdating(true)
    try {
      await updateAgentMode(false)
      setIsAutonomous(false)
    } catch (error) {
      console.error('Error desactivando agente:', error)
    } finally {
      setIsUpdating(false)
      setIsModalOpen(false)
    }
  }, [])

  const handleActivate = useCallback(async () => {
    setIsUpdating(true)
    try {
      await updateAgentMode(true)
      setIsAutonomous(true)
    } catch (error) {
      console.error('Error activando agente:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [])

  const handleToggle = useCallback(() => {
    if (isAutonomous) {
      setIsModalOpen(true)
    } else {
      handleActivate()
    }
  }, [isAutonomous, handleActivate])

  return (
    <>
      {/* Tarjeta Principal */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              isAutonomous ? 'bg-emerald-500/10' : 'bg-red-500/10'
            )}
          >
            <ShieldAlert
              className={cn(
                'h-5 w-5',
                isAutonomous ? 'text-emerald-400' : 'text-red-400'
              )}
            />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">
              AI Agent Command Control
            </h2>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isAutonomous ? 'bg-emerald-400' : 'bg-red-400'
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-mono tracking-wider uppercase',
                  isAutonomous ? 'text-emerald-400/70' : 'text-red-400/70'
                )}
              >
                {isAutonomous ? 'Autonomous Mode' : 'Manual Control'}
              </span>
            </div>
          </div>
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-mono',
              isAutonomous
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            <Activity className="h-3 w-3" />
            {isAutonomous ? 'IA ACTIVA' : 'SUSPENDIDA'}
          </div>
        </div>

        {/* Toggle Principal */}
        <div className="px-6 py-8">
          <button
            onClick={handleToggle}
            disabled={isUpdating}
            className={cn(
              'group relative w-full rounded-xl border-2 p-6 transition-all duration-300',
              'hover:scale-[1.01] active:scale-[0.99]',
              isUpdating && 'pointer-events-none opacity-60',
              isAutonomous
                ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                : 'border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-xl transition-colors',
                    isAutonomous ? 'bg-emerald-500/20' : 'bg-red-500/20'
                  )}
                >
                  {isAutonomous ? (
                    <Bot className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-7 w-7 text-red-400" />
                  )}
                </div>
                <div className="text-left">
                  <p
                    className={cn(
                      'text-lg font-bold transition-colors',
                      isAutonomous ? 'text-emerald-300' : 'text-red-300'
                    )}
                  >
                    {isAutonomous
                      ? 'Autonomous Mode (AI Active)'
                      : 'Manual Control (AI Suspended)'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isAutonomous
                      ? 'The Gemini Agent is scanning and making decisions'
                      : '100% human intervention required'}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'flex h-8 w-14 items-center rounded-full p-1 transition-colors',
                  isAutonomous ? 'bg-emerald-500' : 'bg-red-500'
                )}
              >
                <div
                  className={cn(
                    'h-6 w-6 rounded-full bg-white shadow-md transition-transform',
                    isAutonomous ? 'translate-x-6' : 'translate-x-0'
                  )}
                />
              </div>
            </div>
          </button>
        </div>

        {/* Panel de Impacto */}
        <div className="border-t border-zinc-800 px-6 py-5">
          <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 mb-4">
            Impact of Change
          </p>
          <div className="space-y-3">
            {IMPACT_ITEMS.map((item) => {
              const isActive = isAutonomous || item.alwaysActive
              return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-4 py-3"
              >
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  )}
                >
                  {isActive ? (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <Power className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-200">
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      'text-[11px] transition-colors',
                      isActive ? 'text-emerald-400/60' : 'text-red-400/60'
                    )}
                  >
                    {isActive ? item.activeText : item.inactiveText}
                  </p>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal de Confirmación */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => !isUpdating && setIsModalOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-red-500/20 bg-zinc-950 p-0 shadow-2xl shadow-red-500/10 mx-4">
            {/* Header del Modal */}
            <div className="flex items-center gap-3 border-b border-red-500/20 bg-red-500/5 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-300">
                  ⚠️ WARNING
                </h3>
                <p className="text-[10px] font-mono text-red-400/60 uppercase tracking-wider">
                  Critical System Action
                </p>
              </div>
            </div>

            {/* Cuerpo del Modal */}
            <div className="px-6 py-5">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Disabling AI will stop:
              </p>
              <ul className="mt-3 space-y-2">
                {[
                  'Auto-dispatch of resources',
                  'Automatic incident closure',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm text-zinc-400"
                  >
                    <span className="h-1 w-1 rounded-full bg-red-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-medium text-zinc-200">
                Confirm switch to manual mode?
              </p>
            </div>

            {/* Footer del Modal */}
            <div className="flex gap-3 border-t border-zinc-800 px-6 py-4">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isUpdating}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isUpdating}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-500 active:scale-95 disabled:opacity-50"
              >
                {isUpdating ? 'Processing...' : 'Disable AI'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
