export default function PoliciesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded-lg bg-muted/40" />
          <div className="h-4 w-72 rounded bg-muted/30" />
        </div>
        <div className="text-right space-y-1">
          <div className="h-8 w-8 rounded bg-muted/40 ml-auto" />
          <div className="h-3.5 w-20 rounded bg-muted/30 ml-auto" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-52 rounded-md bg-muted/30" />
        <div className="h-8 w-24 rounded-md bg-muted/30" />
        <div className="flex-1" />
        <div className="h-8 w-24 rounded-md bg-muted/30" />
        <div className="h-8 w-16 rounded-md bg-muted/30" />
        <div className="h-8 w-28 rounded-md bg-muted/40" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/20 border-b border-border/30">
          <div className="h-3 w-6 rounded bg-muted/40" />
          <div className="h-3 w-32 rounded bg-muted/40" />
          <div className="h-3 w-20 rounded bg-muted/30" />
          <div className="h-3 w-28 rounded bg-muted/30" />
          <div className="h-3 w-16 rounded bg-muted/30" />
          <div className="flex-1" />
          <div className="h-3 w-12 rounded bg-muted/30" />
          <div className="h-3 w-14 rounded bg-muted/30" />
        </div>

        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/30 last:border-0">
            <div className="h-3 w-5 rounded bg-muted/30" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-3.5 rounded bg-muted/40" style={{ width: `${140 + (i % 4) * 40}px` }} />
              <div className="h-3 w-48 rounded bg-muted/25" />
            </div>
            <div className="h-3 w-16 rounded bg-muted/30" />
            <div className="h-3 w-20 rounded bg-muted/30" />
            <div className="h-3 w-14 rounded bg-muted/25" />
            <div className="h-5 w-14 rounded-full bg-muted/35" />
            <div className="h-5 w-16 rounded-full bg-muted/35" />
            <div className="h-4 w-4 rounded bg-muted/25" />
          </div>
        ))}
      </div>
    </div>
  )
}
