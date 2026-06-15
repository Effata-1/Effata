'use server'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ChannelCoverageLevel } from '@/lib/onboarding/data'

export interface CustomToolData {
  label:            string
  description:      string
  category?:        string[]
  website?:         string
  channelCoverage?: {
    email:         ChannelCoverageLevel
    web:           ChannelCoverageLevel
    'saas-inline': ChannelCoverageLevel
    'saas-api':    ChannelCoverageLevel
    endpoint:      ChannelCoverageLevel
    genai:         ChannelCoverageLevel
    network:       ChannelCoverageLevel
  }
  modules?: { id: string; label: string; description: string }[]
}

export interface CustomToolRow {
  id:          string
  tool_name:   string
  is_real_dlp: boolean | null
  status:      string
  tool_data:   CustomToolData
  created_at:  string
}

export async function listCustomTools(): Promise<CustomToolRow[]> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()
  const { data } = await supabase
    .from('custom_dlp_tools')
    .select('id, tool_name, is_real_dlp, status, tool_data, created_at')
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
  return (data ?? []) as CustomToolRow[]
}

export async function createCustomTool(
  toolName:   string,
  isRealDlp:  boolean | null,
  status:     'verified' | 'custom',
  toolData:   CustomToolData,
): Promise<string | null> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()
  const { data } = await supabase
    .from('custom_dlp_tools')
    .insert({ org_id: user.orgId, user_id: user.id, tool_name: toolName, is_real_dlp: isRealDlp, status, tool_data: toolData })
    .select('id')
    .single()
  revalidatePath('/dlp-tools/market')
  return data?.id ?? null
}

export async function updateCustomTool(
  id:       string,
  toolData: CustomToolData,
): Promise<{ error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()
  const { error } = await supabase
    .from('custom_dlp_tools')
    .update({ tool_data: toolData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)
  if (error) return { error: error.message }
  revalidatePath('/dlp-tools/market')
  return {}
}

export async function deleteCustomTool(id: string): Promise<{ error?: string }> {
  const user     = await requireRole('analyst')
  const supabase = await createClient()
  const { error } = await supabase
    .from('custom_dlp_tools')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)
  if (error) return { error: error.message }
  revalidatePath('/dlp-tools/market')
  return {}
}
