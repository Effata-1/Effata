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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const upstream = await fetch(`${process.env.RAILWAY_API_BASE_URL}/api/ai/coaching-message`, {
    method:  'POST',
    headers: {
      'Content-Type':               'application/json',
      'Authorization':              `Bearer ${session.access_token}`,
      'x-effata-internal-secret':   process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify(body),
  })

  if (!upstream.ok) {
    return new Response(await upstream.text(), { status: upstream.status })
  }

  const data = await upstream.json()
  return Response.json(data)
}
