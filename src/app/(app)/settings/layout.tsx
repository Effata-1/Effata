import { getSessionUser } from '@/lib/auth'
import { SettingsSidebar } from './_components/settings-sidebar'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  const role = user?.role ?? 'read_only'

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SettingsSidebar role={role} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
