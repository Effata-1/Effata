'use client'

import { useState, useMemo } from 'react'
import { FilterSelect } from '@/components/ui/filter-select'
import { AppLogo } from '../../apps/_components/app-logo'
import type { AppFields, DLPActivities, AppGroup } from '@/lib/genai/types'

interface AppRow {
  app_id:      string
  app_name:    string
  vendor:      string
  domain:      string
  logo_letter: string
  logo_bg:     string
  logo_url:    string | null
  app_group:   AppGroup | null
  profile:     { fields: AppFields; dlp: DLPActivities } | null
}

interface ColDef {
  key:      string
  label:    string
  negative?: boolean
}

type GroupId = 'dlp' | 'compliance' | 'data-privacy' | 'security-genai'

const COLUMN_GROUPS: Record<GroupId, { label: string; type: 'dlp' | 'field'; columns: ColDef[] }> = {
  dlp: {
    label: 'DLP Coverage', type: 'dlp',
    columns: [
      { key: 'post_prompt',    label: 'Prompt'   },
      { key: 'upload',         label: 'Upload'   },
      { key: 'download',       label: 'Download' },
      { key: 'response',       label: 'Response' },
      { key: 'login_instance', label: 'Login'    },
      { key: 'edit',           label: 'Edit'     },
      { key: 'attach',         label: 'Attach'   },
    ],
  },
  compliance: {
    label: 'Compliance', type: 'field',
    columns: [
      { key: 'soc2',      label: 'SOC 2'     },
      { key: 'iso27001',  label: 'ISO 27001' },
      { key: 'iso27018',  label: 'ISO 27018' },
      { key: 'fedramp',   label: 'FedRAMP'   },
      { key: 'pci_dss',   label: 'PCI DSS'   },
      { key: 'hipaa_baa', label: 'HIPAA BAA' },
    ],
  },
  'data-privacy': {
    label: 'Data & Privacy', type: 'field',
    columns: [
      { key: 'dpa_available',             label: 'DPA'           },
      { key: 'customer_owns_data',        label: 'Cust. Owns'    },
      { key: 'trains_on_customer_data',   label: 'Trains',        negative: true },
      { key: 'opt_out_of_training',       label: 'Opt-out'       },
      { key: 'data_retention',            label: 'Retention'     },
      { key: 'data_deletion',             label: 'Deletion'      },
      { key: 'data_residency',            label: 'Residency'     },
      { key: 'subprocessor_list',         label: 'Subprocessors' },
      { key: 'pii_sharing_third_parties', label: 'PII Sharing',   negative: true },
      { key: 'data_sharing_genai_vendor', label: 'Data Sharing',  negative: true },
    ],
  },
  'security-genai': {
    label: 'Security & GenAI', type: 'field',
    columns: [
      { key: 'encryption_at_rest',        label: 'At Rest'         },
      { key: 'encryption_in_transit',     label: 'In Transit'      },
      { key: 'tenant_segregation',        label: 'Tenant Seg.'     },
      { key: 'model_provider_clear',      label: 'Model Provider'  },
      { key: 'prompt_retention_controls', label: 'Prompt Controls' },
      { key: 'connectors_agents_risk',    label: 'Connectors Risk', negative: true },
    ],
  },
}

const GROUP_ORDER: GroupId[] = ['dlp', 'compliance', 'data-privacy', 'security-genai']

const DLP_CELL: Record<string, { label: string; cls: string }> = {
  'enforcement':   { label: 'Enf.',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  'monitoring':    { label: 'Mon.',  cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  'partial':       { label: 'Part.', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  'no-published':  { label: '—',     cls: 'bg-muted/20 text-muted-foreground/40 border-border/40' },
  'not-supported': { label: '✕',     cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

const FIELD_CELL: Record<string, { label: string; cls: string }> = {
  'yes':             { label: '✓',    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  'configurable':    { label: 'Cfg.', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15' },
  'partial':         { label: '~',    cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  'enterprise-only': { label: 'Ent.', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/15' },
  'tier-dependent':  { label: 'Tier', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/15' },
  'no':              { label: '✕',    cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'no-published':    { label: '—',    cls: 'bg-muted/20 text-muted-foreground/40 border-border/40' },
  'na':              { label: 'N/A',  cls: 'bg-muted/10 text-muted-foreground/30 border-border/20' },
}

const FIELD_CELL_NEG: Record<string, { label: string; cls: string }> = {
  ...FIELD_CELL,
  'yes': { label: 'Yes', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'no':  { label: 'No',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
}

const NULL_CELL = { label: '—', cls: 'bg-muted/20 text-muted-foreground/30 border-border/40' }

function DLPCellBadge({ value }: { value: string | undefined }) {
  const c: { label: string; cls: string } = (value ? DLP_CELL[value] : undefined) ?? NULL_CELL
  return (
    <span className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${c.cls}`}>
      {c.label}
    </span>
  )
}

function FieldCellBadge({ value, negative }: { value: string | undefined; negative?: boolean }) {
  const map = negative ? FIELD_CELL_NEG : FIELD_CELL
  const c: { label: string; cls: string } = (value ? map[value] : undefined) ?? NULL_CELL
  return (
    <span className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${c.cls}`}>
      {c.label}
    </span>
  )
}

const APP_GROUP_OPTIONS = [
  { value: '',               label: 'All categories' },
  { value: 'productivity',   label: 'Productivity'   },
  { value: 'coding',         label: 'Coding'         },
  { value: 'communication',  label: 'Communication'  },
  { value: 'design',         label: 'Design'         },
  { value: 'data',           label: 'Data & Analytics' },
  { value: 'security',       label: 'Security'       },
  { value: 'hr',             label: 'HR'             },
  { value: 'finance',        label: 'Finance'        },
  { value: 'sales',          label: 'Sales & CRM'    },
  { value: 'other',          label: 'Other'          },
]

export function CapabilityMatrix({ rows }: { rows: AppRow[] }) {
  const [activeGroup, setActiveGroup]   = useState<GroupId>('dlp')
  const [filterGroup, setFilterGroup]   = useState('')
  const [search, setSearch]             = useState('')

  const group = COLUMN_GROUPS[activeGroup]

  const filtered = useMemo(() => {
    let r = rows
    if (filterGroup) r = r.filter(a => (a.app_group ?? '') === filterGroup)
    if (search)      r = r.filter(a => a.app_name.toLowerCase().includes(search.toLowerCase()))
    return r
  }, [rows, filterGroup, search])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-44">
          <FilterSelect
            value={filterGroup}
            onChange={setFilterGroup}
            options={APP_GROUP_OPTIONS}
            placeholder="All categories"
          />
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search apps…"
          className="h-9 w-52 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="ml-auto text-xs text-muted-foreground/60">{filtered.length} app{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border/50">
        {GROUP_ORDER.map(gid => (
          <button
            key={gid}
            onClick={() => setActiveGroup(gid)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              activeGroup === gid
                ? 'border-b-2 border-primary text-foreground -mb-px'
                : 'text-muted-foreground/60 hover:text-muted-foreground'
            }`}
          >
            {COLUMN_GROUPS[gid].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-auto max-h-[60vh]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="sticky top-0 z-20 bg-card border-b border-border/50">
              <th className="sticky left-0 z-30 bg-card w-56 text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                App
              </th>
              {group.columns.map(col => (
                <th key={col.key} className="w-24 text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={group.columns.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground/50">
                  No apps match your filters.
                </td>
              </tr>
            )}
            {filtered.map((row, idx) => (
              <tr
                key={row.app_id}
                className={`border-b border-border/30 last:border-0 ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'} hover:bg-muted/40 transition-colors`}
              >
                {/* App name — sticky left */}
                <td className="sticky left-0 z-10 w-56 px-4 py-3 bg-inherit">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AppLogo domain={row.domain} letter={row.logo_letter} bg={row.logo_bg} logoUrl={row.logo_url} size={28} radius="rounded-full" />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate text-xs">{row.app_name}</div>
                      <div className="text-[10px] text-muted-foreground/50 truncate">{row.vendor}</div>
                    </div>
                  </div>
                </td>

                {/* Capability cells */}
                {group.columns.map(col => (
                  <td key={col.key} className="w-24 text-center px-2 py-3">
                    {!row.profile ? (
                      <span className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium bg-muted/20 text-muted-foreground/30 border-border/40 tabular-nums">
                        —
                      </span>
                    ) : group.type === 'dlp' ? (
                      <DLPCellBadge value={(row.profile.dlp as unknown as Record<string, string>)[col.key]} />
                    ) : (
                      <FieldCellBadge
                        value={(row.profile.fields as unknown as Record<string, string>)[col.key]}
                        negative={col.negative}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <Legend groupType={group.type} />
    </div>
  )
}

function Legend({ groupType }: { groupType: 'dlp' | 'field' }) {
  if (groupType === 'dlp') {
    return (
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground/70">
        <span className="font-semibold text-muted-foreground">Legend:</span>
        {Object.entries(DLP_CELL).map(([, v]) => (
          <span key={v.label} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${v.cls}`}>{v.label}</span>
            <span>{{
              'Enf.':  'Enforcement',
              'Mon.':  'Monitoring only',
              'Part.': 'Partial coverage',
              '—':     'Not published',
              '✕':     'Not supported',
            }[v.label] ?? v.label}</span>
          </span>
        ))}
      </div>
    )
  }

  const entries = [
    { label: '✓',    desc: 'Supported'       },
    { label: 'Cfg.', desc: 'Configurable'     },
    { label: '~',    desc: 'Partial'          },
    { label: 'Ent.', desc: 'Enterprise tier'  },
    { label: 'Tier', desc: 'Tier-dependent'   },
    { label: '✕',    desc: 'Not supported'    },
    { label: '—',    desc: 'Not published'    },
    { label: 'N/A',  desc: 'Not applicable'   },
  ]
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground/70">
      <span className="font-semibold text-muted-foreground">Legend:</span>
      {entries.map(e => (
        <span key={e.label} className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium bg-muted/20 text-muted-foreground/60 border-border/50">{e.label}</span>
          <span>{e.desc}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5 ml-2 text-muted-foreground/50">
        <span>(</span><span className="text-red-400">red</span><span>= risk on negative fields like &ldquo;Trains on data&rdquo;,</span>
        <span className="text-emerald-400">green</span><span>= safe)</span>
      </span>
    </div>
  )
}
