'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export interface SavedChat {
  id:         string
  title:      string
  created_at: string
  expires_at: string
}

type MessageRow = { role: string; content: string }

export async function upsertAdvisorChat(
  chatId:   string | null,
  title:    string,
  messages: MessageRow[],
): Promise<string | null> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  if (chatId) {
    const { error } = await supabase
      .from('dlp_advisor_chats')
      .update({ messages, title })
      .eq('id', chatId)
      .eq('user_id', user.id)
    if (error) return null
    return chatId
  }

  const { data } = await supabase
    .from('dlp_advisor_chats')
    .insert({ org_id: user.orgId, user_id: user.id, title, messages })
    .select('id')
    .single()
  return data?.id ?? null
}

export async function listAdvisorChats(): Promise<SavedChat[]> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { data } = await supabase
    .from('dlp_advisor_chats')
    .select('id, title, created_at, expires_at')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function loadAdvisorChat(
  chatId: string,
): Promise<{ title: string; messages: MessageRow[] } | null> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { data } = await supabase
    .from('dlp_advisor_chats')
    .select('title, messages')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single()
  return data as { title: string; messages: MessageRow[] } | null
}

export async function deleteAdvisorChat(chatId: string): Promise<{ error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()
  const { error } = await supabase
    .from('dlp_advisor_chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  return {}
}
