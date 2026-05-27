import 'server-only'

export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch(`${process.env.RAILWAY_API_BASE_URL}/api/internal/compliance-check`, {
      method:  'POST',
      headers: { 'x-cron-key': process.env.CRON_API_KEY! },
    })
    const body = await res.json()
    return Response.json(body, { status: res.status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
