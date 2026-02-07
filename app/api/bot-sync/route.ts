import { NextRequest, NextResponse } from 'next/server'

const RAILWAY_BOT_URL = process.env.RAILWAY_BOT_URL || ''

export async function GET(req: NextRequest) {
  try {
    if (!RAILWAY_BOT_URL) {
      return NextResponse.json({ 
        success: false, 
        error: 'RAILWAY_BOT_URL not configured' 
      }, { status: 500 })
    }

    // Fetch data from Railway bot
    const response = await fetch(`${RAILWAY_BOT_URL}/api/copy-trades`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Bot API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching from bot:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!RAILWAY_BOT_URL) {
      return NextResponse.json({ 
        success: false, 
        error: 'RAILWAY_BOT_URL not configured' 
      }, { status: 500 })
    }

    // Get the data from request body
    const body = await req.json()

    // Send data to Railway bot
    const response = await fetch(`${RAILWAY_BOT_URL}/api/copy-trades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Bot API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error syncing to bot:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
