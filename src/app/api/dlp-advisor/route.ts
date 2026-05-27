import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

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
