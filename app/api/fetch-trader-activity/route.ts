import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const trader = searchParams.get('trader')
  const offset = searchParams.get('offset') || '0'
  const limit = searchParams.get('limit') || '1000'

  if (!trader) {
    return NextResponse.json(
      { error: 'Trader address is required' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(
      `https://clob.polymarket.com/events?trader=${trader}&offset=${offset}&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: `Polymarket API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching trader activity:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trader activity' },
      { status: 500 }
    )
  }
}
