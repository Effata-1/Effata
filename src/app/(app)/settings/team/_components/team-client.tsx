'use client'

import { useState, useTransition, useActionState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { UserPlus, Trash2, Loader2, X, Check, Search, ChevronDown, MoreHorizontal, Shield, Users, Lock } from 'lucide-react'
import { inviteTeamMember, updateMemberRole, removeMember } from '../actions'
import type { TeamMember, UserRole } from '../actions'

const ROLE_LABELS: Record<UserRole, string> = {
  admin:     'Admin',
  analyst:   'Analyst',
  read_only: 'Read-only',
}

const ROLE_BADGE: Record<UserRole, string> = {
  admin:     'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  analyst:   'bg-green-500/15 text-green-400 border border-green-500/20',
  read_only: 'bg-zinc-700/40 text-zinc-400 border border-zinc-700',
}

const ROLES_REFERENCE = [
  {
    key:         'admin' as UserRole,
    label:       'Admin',
    description: 'Full access — settings, team management, all tools and reports.',
    type:        'Predefined',
    scope:       'Full access',
    permissions: ['Settings & Team', 'All tools', 'Compliance', 'Data in Motion', 'Dashboard'],
    icon:        Shield,
    iconColor:   'text-blue-400',
    iconBg:      'bg-blue-500/10',
  },
  {
    key:         'analyst' as UserRole,
    label:       'Analyst',
    description: 'Operate all tools and compliance sections. No settings access.',
    type:        'Predefined',
    scope:       'Restricted',
    permissions: ['All tools', 'Compliance', 'Data in Motion', 'Dashboard'],
    icon:        Users,
    iconColor:   'text-green-400',
    iconBg:      'bg-green-500/10',
  },
  {
    key:         'read_only' as UserRole,
    label:       'Read-only',
    description: 'Dashboard and reports only. Cannot access tools, compliance, or settings.',
    type:        'Predefined',
    scope:       'Dashboard only',
    permissions: ['Dashboard'],
    icon:        Lock,
    iconColor:   'text-zinc-400',
    iconBg:      'bg-zinc-700/40',
  },
]

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(inviteTeamMember, null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Invite team member</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {state?.success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-sm text-zinc-300 text-center">
              Invite sent! They&apos;ll receive a magic link to join your organisation as an Analyst.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email address</label>
              <input
                name="email"
                type="email"
                required
                placeholder="colleague@company.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-zinc-600">
              New members join as Analyst. You can change their role after they accept.
            </p>
            {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Send invite
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Row actions menu ──────────────────────────────────────────────────────────

function RowMenu({
  member,
  isCurrentUser,
  roleValue,
  onRoleChange,
  onRemove,
  isPending,
}: {
  member:        TeamMember
  isCurrentUser: boolean
  roleValue:     UserRole
  onRoleChange:  (r: UserRole) => void
  onRemove:      () => void
  isPending:     boolean
}) {
  const [open,       setOpen]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [editRole,   setEditRole]   = useState(false)

  if (isCurrentUser) {
    return <span className="text-[10px] text-zinc-600 px-2 py-0.5 rounded bg-zinc-800/60">You</span>
  }

  return (
    <div className="relative flex justify-end">
      <button
        onClick={() => { setOpen(o => !o); setConfirmDel(false); setEditRole(false) }}
        className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-44 py-1 text-sm">
            {editRole ? (
              <div className="px-3 py-2 space-y-1">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Change role</p>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                  <button
                    key={r}
                    disabled={isPending}
                    onClick={() => { onRoleChange(r); setEditRole(false); setOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                      r === roleValue
                        ? 'bg-zinc-700/60 text-white'
                        : 'text-zinc-300 hover:bg-zinc-800',
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', {
                      'bg-blue-400':  r === 'admin',
                      'bg-green-400': r === 'analyst',
                      'bg-zinc-500':  r === 'read_only',
                    })} />
                    {ROLE_LABELS[r]}
                    {r === roleValue && <Check className="w-3 h-3 ml-auto text-zinc-400" />}
                  </button>
                ))}
                <button
                  onClick={() => setEditRole(false)}
                  className="w-full text-left px-2 py-1 text-[10px] text-zinc-600 hover:text-zinc-400 mt-1"
                >
                  Cancel
                </button>
              </div>
            ) : confirmDel ? (
              <div className="px-3 py-2">
                <p className="text-xs text-zinc-400 mb-2">Remove <span className="text-white">{member.email}</span>?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onRemove(); setOpen(false) }}
                    disabled={isPending}
                    className="flex-1 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setConfirmDel(false)}
                    className="flex-1 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setEditRole(true)}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Edit role
                </button>
                <div className="my-1 border-t border-zinc-800" />
                <button
                  onClick={() => setConfirmDel(true)}
                  className="w-full text-left px-3 py-2 text-red-400 hover:bg-zinc-800 transition-colors"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({ member, isCurrentUser }: { member: TeamMember; isCurrentUser: boolean }) {
  const [roleValue,  setRoleValue]  = useState<UserRole>(member.role)
  const [roleError,  setRoleError]  = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  function handleRoleChange(newRole: UserRole) {
    setRoleError(null)
    const prev = roleValue
    setRoleValue(newRole)
    startTransition(async () => {
      const { error } = await updateMemberRole(member.id, newRole)
      if (error) { setRoleValue(prev); setRoleError(error) }
    })
  }

  function handleRemove() {
    startTransition(async () => { await removeMember(member.id) })
  }

  return (
    <tr className="hover:bg-zinc-900/40 transition-colors group">
      {/* Name / email */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-400 shrink-0">
            {(member.full_name ?? member.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm text-white font-medium leading-tight">{member.email}</p>
            {member.full_name && <p className="text-xs text-zinc-500 mt-0.5">{member.full_name}</p>}
          </div>
        </div>
      </td>
      {/* Type */}
      <td className="px-4 py-3.5">
        <span className="text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700/50 px-2 py-0.5 rounded-full">
          User Account
        </span>
      </td>
      {/* Provisioned by */}
      <td className="px-4 py-3.5 text-xs text-zinc-500">Local</td>
      {/* Role */}
      <td className="px-4 py-3.5">
        <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full', ROLE_BADGE[roleValue])}>
          {ROLE_LABELS[roleValue]}
        </span>
        {roleError && <p className="text-[10px] text-red-400 mt-0.5">{roleError}</p>}
      </td>
      {/* Joined */}
      <td className="px-4 py-3.5 text-xs text-zinc-500 whitespace-nowrap">
        {new Date(member.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      {/* Actions */}
      <td className="px-4 py-3.5 text-right">
        <RowMenu
          member={member}
          isCurrentUser={isCurrentUser}
          roleValue={roleValue}
          onRoleChange={handleRoleChange}
          onRemove={handleRemove}
          isPending={isPending}
        />
      </td>
    </tr>
  )
}

// ── Administrators tab ────────────────────────────────────────────────────────

function AdministratorsTab({
  members,
  currentUserId,
  currentUserRole,
}: {
  members:         TeamMember[]
  currentUserId:   string
  currentUserRole: UserRole
}) {
  const [showInvite,  setShowInvite]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [roleFilter,  setRoleFilter]  = useState<string>('all')

  const filtered = useMemo(() => {
    return members.filter(m => {
      const matchSearch = !search ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        (m.full_name ?? '').toLowerCase().includes(search.toLowerCase())
      const matchRole = roleFilter === 'all' || m.role === roleFilter
      return matchSearch && matchRole
    })
  }, [members, search, roleFilter])

  return (
    <div className="space-y-4">
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}

      {/* Info bar */}
      <div className="text-xs text-zinc-500 bg-zinc-900/40 border border-zinc-800 rounded-lg px-4 py-2.5">
        You are logged in as{' '}
        <span className={cn('font-semibold', ROLE_BADGE[currentUserRole].includes('blue') ? 'text-blue-400' : 'text-green-400')}>
          {ROLE_LABELS[currentUserRole]}
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg pl-8 pr-8 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="appearance-none bg-zinc-800/60 border border-zinc-700 rounded-lg pl-3 pr-7 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 cursor-pointer"
          >
            <option value="all">Role: All</option>
            {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        {(search || roleFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setRoleFilter('all') }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-500">{filtered.length} found</span>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              {['Name', 'Type', 'Provisioned by', 'Role', 'Joined', ''].map(h => (
                <th
                  key={h}
                  className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-3 first:px-5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-zinc-600">
                  No members match your filters.
                </td>
              </tr>
            ) : (
              filtered.map(m => (
                <MemberRow key={m.id} member={m} isCurrentUser={m.id === currentUserId} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Roles tab ─────────────────────────────────────────────────────────────────

function RolesTab({ members }: { members: TeamMember[] }) {
  const countByRole = useMemo(() => {
    const counts: Record<UserRole, number> = { admin: 0, analyst: 0, read_only: 0 }
    members.forEach(m => { counts[m.role] = (counts[m.role] ?? 0) + 1 })
    return counts
  }, [members])

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            {['Name', 'Description', 'Type', 'Assigned to', 'Scope', 'Permissions'].map(h => (
              <th
                key={h}
                className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-3 first:px-5"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {ROLES_REFERENCE.map(role => {
            const Icon = role.icon
            return (
              <tr key={role.key} className="hover:bg-zinc-900/40 transition-colors">
                {/* Name */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', role.iconBg)}>
                      <Icon className={cn('w-3.5 h-3.5', role.iconColor)} />
                    </div>
                    <span className="font-medium text-white text-sm">{role.label}</span>
                  </div>
                </td>
                {/* Description */}
                <td className="px-4 py-4 text-xs text-zinc-500 max-w-xs">{role.description}</td>
                {/* Type */}
                <td className="px-4 py-4">
                  <span className="text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700/50 px-2 py-0.5 rounded-full">
                    {role.type}
                  </span>
                </td>
                {/* Assigned to */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                      countByRole[role.key] > 0
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-800 text-zinc-600',
                    )}>
                      {countByRole[role.key]}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {countByRole[role.key] === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </td>
                {/* Scope */}
                <td className="px-4 py-4 text-xs text-zinc-500">{role.scope}</td>
                {/* Permissions */}
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map(p => (
                      <span
                        key={p}
                        className="text-[10px] bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 px-2 py-0.5 rounded"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TeamClient({
  members,
  currentUserId,
  currentUserRole,
}: {
  members:         TeamMember[]
  currentUserId:   string
  currentUserRole: UserRole
}) {
  const [tab, setTab] = useState<'administrators' | 'roles'>('administrators')

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 mb-6">
        {(['administrators', 'roles'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-blue-500 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'administrators' ? (
        <AdministratorsTab
          members={members}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      ) : (
        <RolesTab members={members} />
      )}
    </div>
  )
}
