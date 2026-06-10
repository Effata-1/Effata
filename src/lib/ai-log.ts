import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth'

export async function logAiSearch(
  source: string,
  prompt: string,
  result?: string
): Promise<void> {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser?.orgId) return
    const supabase = await createClient()
    await supabase.from('ai_search_logs').insert({
      org_id:  sessionUser.orgId,
      user_id: sessionUser.id,
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
    const sessionUser = await getSessionUser()
    if (!sessionUser?.orgId) return
    const supabase = await createClient()
    await supabase.from('ai_learned_templates').upsert(
      {
        org_id:      sessionUser.orgId,
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
