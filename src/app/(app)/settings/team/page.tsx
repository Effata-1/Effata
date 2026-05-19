import { requireRole } from '@/lib/auth'
import { getTeamMembers } from './actions'
import { TeamClient } from './_components/team-client'

export default async function TeamPage() {
  const user = await requireRole('admin')
  const { members, error } = await getTeamMembers()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-zinc-600">
        <span>Settings</span><span>›</span>
        <span className="text-zinc-400">Team</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Team</h1>
        <p className="text-zinc-500 text-sm">Manage members and roles in your organisation.</p>
      </div>

      {error ? (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <TeamClient members={members} currentUserId={user.id} />
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
        <h3 className="text-xs font-semibold text-zinc-400 mb-3">Role permissions</h3>
        <div className="grid grid-cols-3 gap-4 text-xs">
          {[
            { role: 'Admin',     color: 'text-blue-400',  desc: 'Full access — settings, team management, all tools and reports.' },
            { role: 'Analyst',   color: 'text-green-400', desc: 'All tools and compliance sections. No settings access.' },
            { role: 'Read-only', color: 'text-zinc-400',  desc: 'Dashboard only. Cannot access tools, compliance, or settings.' },
          ].map(r => (
            <div key={r.role}>
              <p className={`font-semibold mb-1 ${r.color}`}>{r.role}</p>
              <p className="text-zinc-600 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
