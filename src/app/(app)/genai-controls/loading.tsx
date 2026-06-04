export default function GenAIControlsLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-muted/40" />
          <div className="h-4 w-80 rounded bg-muted/30" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-muted/30" />
      </div>

      {/* Filter / toolbar row */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-52 rounded-md bg-muted/30" />
        <div className="h-8 w-24 rounded-md bg-muted/30" />
        <div className="flex-1" />
        <div className="h-8 w-20 rounded-md bg-muted/30" />
        <div className="h-8 w-28 rounded-md bg-muted/40" />
      </div>

      {/* Content block */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="h-10 bg-muted/20 border-b border-border/30" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border/30 last:border-0">
            <div className="h-3 rounded bg-muted/40" style={{ width: `${120 + (i % 3) * 60}px` }} />
            <div className="h-3 w-20 rounded bg-muted/30" />
            <div className="h-3 w-32 rounded bg-muted/30" />
            <div className="flex-1" />
            <div className="h-5 w-14 rounded-full bg-muted/30" />
            <div className="h-5 w-16 rounded-full bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  )
}
