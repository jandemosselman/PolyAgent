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

    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }

    if (method !== 'GET' && method !== 'HEAD') {
      init.body = await request.text()
    }

    const response = await fetch(targetUrl, init)
    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Bot proxy error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return proxyRequest(request, 'GET')
}

export async function POST(request: Request) {
  return proxyRequest(request, 'POST')
}
