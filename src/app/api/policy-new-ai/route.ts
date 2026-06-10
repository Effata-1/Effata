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

  let body: { message: string; context: unknown }
  try {
    body = await req.json()
    if (!body.message || typeof body.message !== 'string') throw new Error()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const apiBase = process.env.RAILWAY_API_BASE_URL
  if (!apiBase) return new Response('Service unavailable', { status: 503 })

  const upstream = await fetch(`${apiBase}/api/ai/policy-create`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ message: body.message, context: body.context }),
  })

  if (!upstream.ok) {
    const errorBody = await upstream.text()
    const msg = errorBody.includes('<') ? `Backend unavailable (${upstream.status} ${upstream.statusText})` : errorBody
    return new Response(msg, { status: upstream.status })
  }

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
