import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const account = searchParams.get('account')
  const offset = searchParams.get('offset') || '0'
  const limit = searchParams.get('limit') || '1000'

  if (!account) {
    return NextResponse.json(
      { error: 'Account address is required' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(
      `https://clob.polymarket.com/positions?account=${account}&limit=${limit}&offset=${offset}`,
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
    console.error('Error fetching closed positions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch closed positions' },
      { status: 500 }
    )
  }
}
