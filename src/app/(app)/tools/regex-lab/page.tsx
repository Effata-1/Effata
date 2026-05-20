import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { RegexLab } from './_components/regex-lab'
import type { SavedPattern } from './actions'

async function fetchPatterns(): Promise<SavedPattern[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('regex_patterns')
      .select('id, name, description, pattern, flags, test_data, ai_generated, ai_explanation, created_at')
      .order('created_at', { ascending: false })
    return (data as SavedPattern[]) ?? []
  } catch {
    return []
  }
}

export default async function RegexLabPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; prompt?: string; testData?: string }>
}) {
  const patterns = await fetchPatterns()
  const { name, prompt, testData } = await searchParams
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Regex Lab</h1>
        <p className="text-muted-foreground/80 text-sm">Build, test, and save DLP regex patterns — AI-assisted or hand-crafted — with 50 built-in patterns across 7 categories</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground/60 italic">Loading regex lab...</div>}>
        <RegexLab
          initialPatterns={patterns}
          prefill={name ? { name, prompt, testData } : undefined}
        />
      </Suspense>
    </div>
  )
}
