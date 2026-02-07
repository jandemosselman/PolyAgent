import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const markets = searchParams.getAll('market')
  const limit = searchParams.get('limit') || '20'
  const minBalance = searchParams.get('minBalance') || '1'

  if (markets.length === 0) {
    return NextResponse.json(
      { error: 'At least one market (conditionId) is required' },
      { status: 400 }
    )
  }

  try {
    const params = new URLSearchParams({
      limit,
      minBalance
    })
    
    // Add multiple market parameters
    markets.forEach(market => {
      params.append('market', market)
    })

    const response = await fetch(
      `https://data-api.polymarket.com/holders?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 30 } // Cache for 30 seconds
      }
    )

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching top holders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch top holders' },
      { status: 500 }
    )
  }
}
