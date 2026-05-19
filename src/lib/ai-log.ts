import { createClient } from '@/lib/supabase/server'

function getOrgId(accessToken: string): string | null {
  try {
    return JSON.parse(atob(accessToken.split('.')[1]))?.org_id ?? null
  } catch {
    return null
  }
}

export async function logAiSearch(
  source: string,
  prompt: string,
  result?: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    const orgId = session?.access_token ? getOrgId(session.access_token) : null
    if (!orgId) return
    await supabase.from('ai_search_logs').insert({
      org_id:  orgId,
      user_id: user.id,
      source,
      prompt:  prompt.slice(0, 1000),
      result:  result ? result.slice(0, 500) : null,
    })
  } catch {
    // non-critical — never throw
  }
}

export async function saveLearnedTemplate(data: {
  ext:         string
  filename:    string
  description: string
  content:     string
  mimeType:    string
}): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    const orgId = session?.access_token ? getOrgId(session.access_token) : null
    if (!orgId) return
    await supabase.from('ai_learned_templates').upsert(
      {
        org_id:      orgId,
        ext:         data.ext,
        filename:    data.filename,
        description: data.description,
        content:     data.content,
        mime_type:   data.mimeType,
      },
      { onConflict: 'org_id,ext', ignoreDuplicates: true }
    )
  } catch {
    // non-critical — never throw
  }
}
