import { SettingsSidebar } from './_components/settings-sidebar'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    // -m-8 cancels the parent layout's p-8 so settings fills edge-to-edge
    <div className="-m-8 flex h-screen overflow-hidden bg-zinc-950">
      <SettingsSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
