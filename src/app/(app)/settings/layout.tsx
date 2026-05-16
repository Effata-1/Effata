import { SettingsNav } from './_components/settings-nav'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-10 min-h-full">
      <SettingsNav />
      <div className="flex-1 min-w-0 border-l border-zinc-800 pl-10">
        {children}
      </div>
    </div>
  )
}
