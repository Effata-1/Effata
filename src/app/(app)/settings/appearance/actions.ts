'use server'

import { getSessionUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const VALID_THEMES = new Set(['light', 'dark', 'system'])

export async function saveThemePreference(theme: string): Promise<{ error?: string }> {
  if (!VALID_THEMES.has(theme)) return { error: 'Invalid theme value' }
  const user = await getSessionUser()
  if (!user) return { error: 'Unauthorized' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_own_theme_preference', { p_theme: theme })
  if (error) return { error: error.message }
  return {}
}
