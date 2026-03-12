import { NextResponse } from 'next/server'

// Proxy all requests to the Railway bot to avoid CORS preflight issues.
// The browser calls /api/bot-proxy (same origin) and this route forwards
// server-side to the Railway bot URL.

async function proxyRequest(request: Request, method: string) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''
    const botUrl = process.env.NEXT_PUBLIC_RAILWAY_BOT_URL || searchParams.get('botUrl') || ''

    if (!botUrl) {
      return NextResponse.json({ error: 'Bot URL not configured' }, { status: 400 })
    }

    const targetUrl = `${botUrl.replace(/\/$/, '')}${path}`
    console.log(`[bot-proxy] ${method} ${targetUrl}`)

    // First test health endpoint to diagnose connectivity
    try {
      const healthUrl = `${botUrl.replace(/\/$/, '')}/health`
      const healthRes = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
      console.log(`[bot-proxy] Health check: ${healthRes.status}`)
    } catch (healthErr: any) {
      console.log(`[bot-proxy] Health check failed: ${healthErr.message}`)
    }

    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    }

    if (method !== 'GET' && method !== 'HEAD') {
      init.body = await request.text()
    }

    const response = await fetch(targetUrl, init)
    const rawText = await response.text()
    console.log(`[bot-proxy] Response ${response.status}: ${rawText.slice(0, 300)}`)

    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      data = { raw: rawText }
    }

    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('[bot-proxy] Fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return proxyRequest(request, 'GET')
}

export async function POST(request: Request) {
  return proxyRequest(request, 'POST')
}
