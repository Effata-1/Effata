'use client'

import { useState } from 'react'
import { Play, RotateCcw, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SimulationParams, SimResult, SimSource, SimDataType, SimChannel, SimDest, SimUserType, SimAction } from './types'
import type { DistrictData } from './types'

// ─── Option lists ────────────────────────────────────────────────────────────
const SOURCES: { value: SimSource; label: string }[] = [
  { value: 'managed-endpoint', label: 'Managed Endpoint' },
  { value: 'byod',             label: 'BYOD / Mobile'    },
  { value: 'server',           label: 'Server / VM'      },
  { value: 'saas-user',        label: 'SaaS User'        },
  { value: 'mail-infra',       label: 'Mail Infrastructure' },
  { value: 'developer',        label: 'Developer / CI-CD' },
]

const DATA_TYPES: { value: SimDataType; label: string }[] = [
  { value: 'confidential-file', label: 'Confidential File'  },
  { value: 'pii',               label: 'PII / Personal Data' },
  { value: 'credentials',       label: 'Credentials / Secrets' },
  { value: 'source-code',       label: 'Source Code'        },
  { value: 'bulk-data',         label: 'Bulk Dataset'       },
  { value: 'email-message',     label: 'Email Message'      },
]

const CHANNELS: { value: SimChannel; label: string }[] = [
  { value: 'email',       label: 'Email'           },
  { value: 'web',         label: 'Web / Browser'   },
  { value: 'saas-inline', label: 'SaaS Inline'     },
  { value: 'saas-api',    label: 'SaaS API / At-Rest' },
  { value: 'endpoint',    label: 'Endpoint / Device' },
  { value: 'genai',       label: 'GenAI / AI Apps' },
  { value: 'network',     label: 'Network Egress'  },
]

const DESTINATIONS: { value: SimDest; label: string }[] = [
  { value: 'personal-email',  label: 'Personal Email (Gmail)' },
  { value: 'saas-app',        label: 'SaaS App (SharePoint)'  },
  { value: 'public-web',      label: 'Public Web / File Transfer' },
  { value: 'usb',             label: 'USB / Removable Media'  },
  { value: 'genai-app',       label: 'GenAI App (ChatGPT)'    },
  { value: 'cloud-storage',   label: 'Cloud Storage (S3)'     },
  { value: 'external-host',   label: 'External Host / FTP'    },
]

const USER_TYPES: { value: SimUserType; label: string }[] = [
  { value: 'standard',    label: 'Standard User'  },
  { value: 'privileged',  label: 'Privileged User' },
  { value: 'leaver',      label: 'Leaver / Offboarding' },
  { value: 'contractor',  label: 'Contractor'     },
]

// ─── Action badge styles ──────────────────────────────────────────────────────
const ACTION_STYLES: Record<SimAction, { bg: string; text: string; border: string; label: string }> = {
  block: { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/25',    label: 'Action: Block'  },
  coach: { bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/25',  label: 'Action: Coach'  },
  allow: { bg: 'bg-emerald-500/15',text: 'text-emerald-400',border: 'border-emerald-500/25',label: 'Action: Allow'  },
  gap:   { bg: 'bg-slate-500/15',  text: 'text-slate-400',  border: 'border-slate-500/25',  label: 'Gap — No Inspection' },
}

// ─── Simulation logic ─────────────────────────────────────────────────────────
function computeResult(params: SimulationParams, districts: DistrictData[]): SimResult {
  const district = districts.find(d => d.channelKey === params.channel)
  const level = district?.level ?? 'unknown'

  const highRisk = ['confidential-file', 'pii', 'credentials'].includes(params.dataType)
  const elevatedUser = params.userType === 'leaver' || params.userType === 'privileged'

  let action: SimAction
  let reason: string

  if (level === 'none' || level === 'unknown') {
    action = 'gap'
    reason = `No DLP inspection on ${params.channel === 'saas-inline' ? 'SaaS Inline' : params.channel} channel — data moves unmonitored.`
  } else if (level === 'full') {
    if (highRisk || elevatedUser) {
      action = 'block'
      reason = `Full DLP coverage — ${params.dataType.replace(/-/g, ' ')} with ${params.userType} profile triggers Block policy.`
    } else {
      action = 'coach'
      reason = `Full DLP coverage — data movement is visible. Policy applies Coach or Monitor based on classification.`
    }
  } else if (level === 'partial') {
    action = 'coach'
    reason = `Partial DLP coverage — some activities on this channel are inspected. Coach policy likely applies.`
  } else {
    action = 'allow'
    reason = `Add-on module covers this channel with limited inspection. Data passes with metadata logging only.`
  }

  return { action, reason, channelKey: params.channel }
}

// ─── Select field ─────────────────────────────────────────────────────────────
function Field<T extends string>({
  label, value, onChange, options,
}: {
  label:    string
  value:    T
  onChange: (v: T) => void
  options:  { value: T; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <label className="text-[9.5px] font-semibold text-slate-500 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value as T)}
          className="w-full appearance-none bg-slate-800/60 border border-white/8 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-slate-500 pr-8"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface ScenarioBuilderProps {
  districts:   DistrictData[]
  onSimulate:  (result: SimResult) => void
  onClear:     () => void
  lastResult:  SimResult | null
}

export function ScenarioBuilder({ districts, onSimulate, onClear, lastResult }: ScenarioBuilderProps) {
  const [source,   setSource]   = useState<SimSource>('managed-endpoint')
  const [dataType, setDataType] = useState<SimDataType>('confidential-file')
  const [channel,  setChannel]  = useState<SimChannel>('web')
  const [dest,     setDest]     = useState<SimDest>('public-web')
  const [userType, setUserType] = useState<SimUserType>('standard')

  function handleRun() {
    const params: SimulationParams = { source, dataType, channel, dest, userType }
    onSimulate(computeResult(params, districts))
  }

  const actionStyle = lastResult ? ACTION_STYLES[lastResult.action] : null

  return (
    <div className="w-full h-full border-r border-white/6 bg-[#030c1a] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/6">
        <p className="text-[9px] text-slate-600 uppercase tracking-[0.18em] font-medium">Interactive</p>
        <h2 className="text-xs font-bold text-slate-200 mt-0.5">Scenario Builder</h2>
      </div>

      {/* Scenario flow */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <Field label="Source"    value={source}   onChange={setSource}   options={SOURCES}      />
        <Field label="Data Type" value={dataType} onChange={setDataType} options={DATA_TYPES}   />
        <Field label="Channel"   value={channel}  onChange={setChannel}  options={CHANNELS}     />
        <Field label="Destination" value={dest}   onChange={setDest}     options={DESTINATIONS} />
        <Field label="User Type" value={userType} onChange={setUserType} options={USER_TYPES}   />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-white/6 space-y-2">
        <button
          onClick={handleRun}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/25 text-emerald-400 text-xs font-semibold transition-colors"
        >
          <Play size={11} />
          Run Simulation
        </button>

        {lastResult && (
          <button
            onClick={onClear}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-white/6 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            <RotateCcw size={10} />
            Clear
          </button>
        )}
      </div>

      {/* Last result */}
      {lastResult && actionStyle && (
        <div className={cn('mx-4 mb-4 p-3 rounded-lg border space-y-1.5', actionStyle.bg, actionStyle.border)}>
          <p className={cn('text-[10px] font-bold uppercase tracking-wide', actionStyle.text)}>{actionStyle.label}</p>
          <p className="text-[10px] text-slate-400 leading-snug">{lastResult.reason}</p>
        </div>
      )}
    </div>
  )
}
