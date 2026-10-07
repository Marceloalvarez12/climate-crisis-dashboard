'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Users,
  UserPlus,
  MoreVertical,
  Shield,
  Ban,
  RotateCcw,
  Search,
  Check,
  X,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  updateUserRole,
  suspendUser,
  resetUserPassword,
} from '@/app/admin/actions'
import { ResourceAssignmentModal } from './resource-assignment-modal'
import { CreateOperatorModal } from './create-operator-modal'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'operador' | 'agente_ia' | 'visualizador'
  status: 'activo' | 'suspendido'
  lastLogin: string | null
}

interface UserRoleManagerProps {
  initialUsers: User[]
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  operador: 'Operator',
  agente_ia: 'AI Agent',
  visualizador: 'Viewer',
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  operador: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  agente_ia: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  visualizador: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

const ROLES = ['admin', 'operador', 'agente_ia'] as const

export function UserRoleManager({ initialUsers }: UserRoleManagerProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [roleEditUser, setRoleEditUser] = useState<{ id: string; role: string } | null>(null)
  const [assignmentUser, setAssignmentUser] = useState<{ id: string; name: string } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string } | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSuspend = useCallback(async (user: User) => {
    const newStatus = user.status === 'activo' ? 'suspendido' : 'activo'
    try {
      await suspendUser(user.id, newStatus)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
      )
      setActionFeedback({
        id: user.id,
        message: newStatus === 'suspendido' ? 'Access suspended' : 'Access restored',
      })
      setTimeout(() => setActionFeedback(null), 2000)
    } catch (error) {
      console.error('Error suspendiendo usuario:', error)
    }
    setActiveDropdown(null)
  }, [])

  const handleResetPassword = useCallback(async (user: User) => {
    try {
      await resetUserPassword(user.id)
      setActionFeedback({ id: user.id, message: 'Password reset' })
      setTimeout(() => setActionFeedback(null), 2000)
    } catch (error) {
      console.error('Error reseteando contraseña:', error)
    }
    setActiveDropdown(null)
  }, [])

  const handleRoleChange = useCallback(async () => {
    if (!roleEditUser) return
    try {
      await updateUserRole(roleEditUser.id, roleEditUser.role as 'admin' | 'operador' | 'agente_ia')
      setUsers((prev) =>
        prev.map((u) =>
          u.id === roleEditUser.id ? { ...u, role: roleEditUser.role as User['role'] } : u
        )
      )
      setActionFeedback({ id: roleEditUser.id, message: 'Role updated' })
      setTimeout(() => setActionFeedback(null), 2000)
    } catch (error) {
      console.error('Error cambiando rol:', error)
    }
    setRoleEditUser(null)
    setActiveDropdown(null)
  }, [roleEditUser])

  const formatLastLogin = (date: string | null) => {
    if (!date) return 'Never'
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US')
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
          <Users className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Staff & Access Management
          </h2>
          <p className="text-[11px] text-zinc-500">
            User, role and permission administration
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 active:scale-95 transition-all"
        >
          <UserPlus className="h-4 w-4" />
          Add New Operator
        </button>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-zinc-800/50 bg-zinc-950">
              <th className="text-left px-6 py-3 text-[10px] font-mono tracking-widest uppercase text-zinc-600">
Operator
              </th>
              <th className="text-left px-6 py-3 text-[10px] font-mono tracking-widest uppercase text-zinc-600">
                Email
              </th>
              <th className="text-left px-6 py-3 text-[10px] font-mono tracking-widest uppercase text-zinc-600">
Access Level
              </th>
              <th className="text-left px-6 py-3 text-[10px] font-mono tracking-widest uppercase text-zinc-600">
Status
              </th>
              <th className="text-left px-6 py-3 text-[10px] font-mono tracking-widest uppercase text-zinc-600">
Last Access
              </th>
              <th className="text-right px-6 py-3 text-[10px] font-mono tracking-widest uppercase text-zinc-600">
Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/30">
            {filteredUsers.map((user) => {
              const isActive = user.status === 'activo'
              const feedback = actionFeedback?.id === user.id ? actionFeedback : null

              return (
                <tr
                  key={user.id}
                  className={cn(
                    'transition-colors',
                    !isActive && 'opacity-50'
                  )}
                >
                  {/* Operador */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                          isActive
                            ? 'bg-zinc-800 text-zinc-300'
                            : 'bg-red-500/10 text-red-400'
                        )}
                      >
                        {getInitials(user.name)}
                      </div>
                      <span className="font-medium text-zinc-200">
                        {user.name}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-3">
                    <span className="text-xs font-mono text-zinc-500">
                      {user.email}
                    </span>
                  </td>

                  {/* Rol */}
                  <td className="px-6 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                        ROLE_STYLES[user.role]
                      )}
                    >
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full',
                          isActive ? 'bg-emerald-500' : 'bg-red-500'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs',
                          isActive ? 'text-emerald-400' : 'text-red-400'
                        )}
                      >
                        {isActive ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </td>

                  {/* Último Acceso */}
                  <td className="px-6 py-3">
                    <span className="text-xs text-zinc-500 font-mono">
                      {formatLastLogin(user.lastLogin)}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {feedback && (
                        <span className="text-[10px] font-mono text-emerald-400 animate-pulse">
                          {feedback.message}
                        </span>
                      )}
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() =>
                            setActiveDropdown(
                              activeDropdown === user.id ? null : user.id
                            )
                          }
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {activeDropdown === user.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl z-10 overflow-hidden">
                            <button
                              onClick={() =>
                                setRoleEditUser({ id: user.id, role: user.role })
                              }
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Change Access Level
                            </button>
                            {user.role === 'operador' && (
                              <button
                                onClick={() => setAssignmentUser({ id: user.id, name: user.name })}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                Assign Resources
                              </button>
                            )}
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reset Password
                            </button>
                            <div className="border-t border-zinc-800" />
                            <button
                              onClick={() => handleSuspend(user)}
                              className={cn(
                                'w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-zinc-800 transition-colors',
                                isActive ? 'text-red-400' : 'text-emerald-400'
                              )}
                            >
                              {isActive ? (
                                <>
                                  <Ban className="h-3.5 w-3.5" />
                                  Suspend Access
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Restore Access
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-zinc-600">
            <Users className="h-8 w-8 mb-2" />
            <p className="text-sm">No users found</p>
            <p className="text-xs mt-1">
              Try a different search term
            </p>
          </div>
        )}
      </div>

      {/* Modal Cambio de Rol */}
      {roleEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setRoleEditUser(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl mx-4">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-zinc-100">
                Change Access Level
              </h3>
              <button
                onClick={() => setRoleEditUser(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs text-zinc-500 mb-3">
                Usuario:{' '}
                <span className="text-zinc-300">
                  {users.find((u) => u.id === roleEditUser.id)?.name}
                </span>
              </p>
              <select
                value={roleEditUser.role}
                onChange={(e) =>
                  setRoleEditUser({ ...roleEditUser, role: e.target.value })
                }
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 border-t border-zinc-800 px-6 py-4">
              <button
                onClick={() => setRoleEditUser(null)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 active:scale-95 transition-all"
              >
                Apply Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignación de Recursos */}
      {assignmentUser && (
        <ResourceAssignmentModal
          isOpen={!!assignmentUser}
          onClose={() => setAssignmentUser(null)}
          operatorId={assignmentUser.id}
          operatorName={assignmentUser.name}
        />
      )}

      {/* Modal Crear Operador */}
      <CreateOperatorModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          // Refresh users list by re-fetching from parent would be ideal,
          // but for now we reload the page to show the new user
          window.location.reload()
        }}
      />
    </div>
  )
}
