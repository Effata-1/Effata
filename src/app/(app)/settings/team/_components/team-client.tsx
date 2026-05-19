'use client'

import { useState, useTransition, useActionState } from 'react'
import { cn } from '@/lib/utils'
import { UserPlus, Trash2, Loader2, X, Check } from 'lucide-react'
import { inviteTeamMember, updateMemberRole, removeMember } from '../actions'
import type { TeamMember, UserRole } from '../actions'

const ROLE_LABELS: Record<UserRole, string> = {
  admin:     'Admin',
  analyst:   'Analyst',
  read_only: 'Read-only',
}

const ROLE_BADGE: Record<UserRole, string> = {
  admin:     'bg-blue-500/15 text-blue-400',
  analyst:   'bg-green-500/15 text-green-400',
  read_only: 'bg-zinc-700/50 text-zinc-400',
}

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
            <p className="text-sm text-zinc-300 text-center">Invite sent! They'll receive a magic link to join your organisation as an Analyst.</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
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
            <p className="text-xs text-zinc-600">New members join as Analyst. You can change their role after they accept.</p>
            {state?.error && (
              <p className="text-xs text-red-400">{state.error}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isCurrentUser,
}: {
  member: TeamMember
  isCurrentUser: boolean
}) {
  const [roleValue,   setRoleValue]   = useState<UserRole>(member.role)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [roleError,   setRoleError]   = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [isPending,   startTransition]= useTransition()

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
    if (!confirmDel) { setConfirmDel(true); return }
    setConfirmDel(false)
    setRemoveError(null)
    startTransition(async () => {
      const { error } = await removeMember(member.id)
      if (error) setRemoveError(error)
    })
  }

  return (
    <tr className="hover:bg-zinc-900/40 transition-colors">
      <td className="px-5 py-3.5">
        <div>
          <p className="text-sm text-white font-medium">{member.email}</p>
          {member.full_name && (
            <p className="text-xs text-zinc-500 mt-0.5">{member.full_name}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        {isCurrentUser ? (
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded', ROLE_BADGE[roleValue])}>
            {ROLE_LABELS[roleValue]}
          </span>
        ) : (
          <div>
            <select
              value={roleValue}
              onChange={e => handleRoleChange(e.target.value as UserRole)}
              disabled={isPending}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            {roleError && <p className="text-[10px] text-red-400 mt-0.5">{roleError}</p>}
          </div>
        )}
      </td>
      <td className="px-4 py-3.5 text-xs text-zinc-600 whitespace-nowrap">
        {new Date(member.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-4 py-3.5 text-right">
        {isCurrentUser ? (
          <span className="text-[10px] text-zinc-600 px-2 py-0.5 rounded bg-zinc-800">You</span>
        ) : confirmDel ? (
          <div className="flex items-center justify-end gap-1">
            <span className="text-xs text-zinc-500">Remove?</span>
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={handleRemove}
            className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
            title="Remove member"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {removeError && <p className="text-[10px] text-red-400 mt-0.5 text-right">{removeError}</p>}
      </td>
    </tr>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TeamClient({
  members,
  currentUserId,
}: {
  members: TeamMember[]
  currentUserId: string
}) {
  const [showInvite, setShowInvite] = useState(false)

  return (
    <div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-zinc-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Invite user
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-5 py-2.5">Member</th>
              <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Role</th>
              <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Joined</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {members.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                isCurrentUser={m.id === currentUserId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
