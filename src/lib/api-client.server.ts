import 'server-only'
import { createClient } from '@/lib/supabase/server'

const API_BASE = process.env.RAILWAY_API_BASE_URL

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return session.access_token
}

export async function callAgent<T>(agent: string, payload: unknown): Promise<T> {
  if (!API_BASE) throw new Error('RAILWAY_API_BASE_URL is not configured')

  const token = await getToken()
  const res = await fetch(`${API_BASE}/api/ai/run`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ agent, payload }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Railway API error ${res.status}`)
  }

  const json = await res.json() as { result: T }
  return json.result
}

export async function callData<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (!API_BASE) throw new Error('RAILWAY_API_BASE_URL is not configured')

  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method:  options.method ?? 'GET',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Railway API error ${res.status}`)
  }

  return res.json() as Promise<T>
}
