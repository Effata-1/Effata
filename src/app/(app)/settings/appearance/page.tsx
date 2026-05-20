import { ThemeSelector } from './_components/theme-selector'

export default function AppearancePage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Appearance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how the interface looks to you.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-6 space-y-5 shadow-sm">
        <div>
          <p className="text-sm font-medium text-foreground">Theme</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your preference is saved locally and applied on every visit.
          </p>
        </div>
        <ThemeSelector />
      </div>
    </div>
  )
}
