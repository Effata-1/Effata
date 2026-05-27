import { callAgent } from '@/lib/api-client'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let toolName: string
  try {
    const body = await req.json() as { toolName?: unknown }
    if (typeof body.toolName !== 'string' || !body.toolName.trim()) throw new Error()
    toolName = body.toolName.trim()
  } catch {
    return new Response('toolName is required', { status: 400 })
  }

  try {
    const result = await callAgent<unknown>('tool-review', { toolName })
    return Response.json(result)
  } catch (err) {
    console.error('dlp-tool-review error', err)
    return new Response('Internal error', { status: 500 })
  }
}
