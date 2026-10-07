"use client"

import { useState } from "react"
import {
  X,
  UserPlus,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createOperator } from "@/app/admin/actions"

interface CreateOperatorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateOperatorModal({ isOpen, onClose, onSuccess }: CreateOperatorModalProps) {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const resetState = () => {
    setNombre("")
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setSaving(false)
    setSuccess(false)
    setError("")
  }

  const handleClose = () => {
    if (saving) return
    resetState()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required")
      return
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters")
      return
    }

    setSaving(true)

    try {
      await createOperator({ nombre: nombre.trim(), email: email.trim(), password })
      setSuccess(true)
      setTimeout(() => {
        resetState()
        onSuccess()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating operator")
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Add New Operator</h2>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wider">ROL: OPERADOR</p>
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

        {/* Body */}
        <div className="px-6 py-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
              </div>
              <p className="text-sm font-semibold text-emerald-400">Operator Created</p>
              <p className="text-[10px] text-zinc-500 font-mono">Redirecting...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ex: Juan Pérez"
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  disabled={saving}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@zntinel.com"
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  disabled={saving}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1.5">
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 12 characters"
                    className="w-full px-3 py-2.5 pr-10 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-[11px] font-mono text-red-400">{error}</p>
                </div>
              )}

              {/* Info */}
              <div className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/30">
                <p className="text-[10px] text-zinc-500">
                  <span className="text-cyan-400 font-medium">Note:</span> The operator will be able to log in immediately with these credentials. It is recommended to change the password on first access.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex gap-3 border-t border-zinc-800 px-6 py-4 bg-zinc-900/30">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700/50 transition-all disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-all",
                saving
                  ? "bg-zinc-600 cursor-wait"
                  : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 active:scale-[0.98] shadow-lg shadow-cyan-500/20"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Create Operator
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
