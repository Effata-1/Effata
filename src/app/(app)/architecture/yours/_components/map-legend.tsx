const ITEMS = [
  { label: 'Full Coverage', dot: 'bg-emerald-500' },
  { label: 'Partial',       dot: 'bg-amber-500'   },
  { label: 'Add-on Only',   dot: 'bg-blue-500'    },
  { label: 'Gap',           dot: 'bg-red-500'      },
  { label: 'Not Assessed',  dot: 'bg-slate-500'   },
]

export function MapLegend() {
  return (
    <div className="flex items-center gap-4 px-3.5 py-2 rounded-lg bg-slate-900/80 backdrop-blur border border-white/8 text-[10px]">
      {ITEMS.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${item.dot} opacity-80`} />
          <span className="text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
