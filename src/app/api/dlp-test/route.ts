import { NextRequest, NextResponse } from 'next/server'

// Public DLP test receiver — accepts any request, echoes back a confirmation.
// Purpose: user's browser POSTs synthetic sensitive data through their corporate
// network. If DLP intercepts it, the request never arrives here and the client
// gets a network error. If it arrives, we return confirmation (NOT BLOCKED).
// We never store payload content.

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'X-DLP-Test-Endpoint':          'true',
  'Cache-Control':                'no-store',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

const DLP_HEADER_PREFIXES = [
  'x-netskope', 'x-zscaler', 'x-forcepoint', 'x-bluecoat',
  'x-proxy',    'x-dlp',     'x-coach',      'x-justify',   'x-policy',
]

async function handle(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? 'unknown'
  const start       = Date.now()

  // Sniff for DLP/proxy vendor headers added by the forwarding proxy
  const dlpHeaders: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    if (DLP_HEADER_PREFIXES.some(p => key.toLowerCase().startsWith(p))) {
      dlpHeaders[key] = value
    }
  })

  let payloadBytes = 0
  try {
    const buf    = await req.arrayBuffer()
    payloadBytes = buf.byteLength
  } catch { /* ignore body read errors */ }

  return NextResponse.json(
    {
      received:       true,
      test_id:        crypto.randomUUID(),
      timestamp:      new Date().toISOString(),
      method:         req.method,
      content_type:   contentType,
      payload_size:   payloadBytes,
      elapsed_ms:     Date.now() - start,
      proxy_detected: Object.keys(dlpHeaders).length > 0,
      dlp_headers:    Object.keys(dlpHeaders).length > 0 ? dlpHeaders : undefined,
      note:           'DLP test endpoint — payload is not stored or logged',
    },
    { headers: CORS }
  )
}

export const GET  = handle
export const POST = handle
