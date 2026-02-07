import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const user = searchParams.get('user')
  const markets = searchParams.getAll('market')

  if (!user) {
    return NextResponse.json(
      { error: 'User address is required' },
      { status: 400 }
    )
  }

  try {
    const params = new URLSearchParams({ user })
    
    // Add multiple market parameters if provided
    markets.forEach(market => {
      params.append('market', market)
    })

    const response = await fetch(
      `https://data-api.polymarket.com/value?${params.toString()}`,
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
    console.error('Error fetching user value:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user value' },
      { status: 500 }
    )
  }
}
