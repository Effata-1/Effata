import { createClient } from '@/lib/supabase/server'
import { getSessionUser, ROLE_RANK } from '@/lib/auth'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const authUser = await getSessionUser()
  if (!authUser) return new Response('Unauthorized', { status: 401 })
  if (ROLE_RANK[authUser.role] < ROLE_RANK.analyst) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return new Response('Unauthorized', { status: 401 })

  let messages: { role: 'user' | 'assistant'; content: string }[]
  try {
    const body = await req.json()
    messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) throw new Error()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const upstream = await fetch(`${process.env.RAILWAY_API_BASE_URL}/api/ai/dlp-advisor`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages }),
  })

  if (!upstream.ok) {
    return new Response(await upstream.text(), { status: upstream.status })
  }

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
