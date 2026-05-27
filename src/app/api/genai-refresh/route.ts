import 'server-only'

// Give the Edge Function time to finish before Vercel times out
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader  = request.headers.get('authorization')
  const cronSecret  = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const railwayBase = process.env.RAILWAY_API_BASE_URL
  if (!railwayBase) {
    return Response.json({ error: 'RAILWAY_API_BASE_URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${railwayBase}/api/internal/genai-refresh`, {
      method:  'POST',
      headers: { 'x-cron-key': process.env.CRON_API_KEY! },
    })
    const body = await res.json()
    return Response.json(body, { status: res.status })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
