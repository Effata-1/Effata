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
        <TeamClient members={members} currentUserId={user.id} currentUserRole={user.role} />
      )}

    </div>
  )
}
