import { NextResponse } from 'next/server'

export interface LeaderboardEntry {
  rank: string
  proxyWallet: string
  userName: string
  vol: number
  pnl: number
  profileImage: string
  xUsername: string
  verifiedBadge: boolean
}

export interface LeaderboardParams {
  category?: 'OVERALL' | 'POLITICS' | 'SPORTS' | 'CRYPTO' | 'CULTURE' | 'MENTIONS' | 'WEATHER' | 'ECONOMICS' | 'TECH' | 'FINANCE'
  timePeriod?: 'DAY' | 'WEEK' | 'MONTH' | 'ALL'
  orderBy?: 'PNL' | 'VOL'
  limit?: number
  offset?: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const category = searchParams.get('category') || 'OVERALL'
  const timePeriod = searchParams.get('timePeriod') || 'DAY'
  const orderBy = searchParams.get('orderBy') || 'PNL'
  const limit = parseInt(searchParams.get('limit') || '25')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    // Use the correct Polymarket Data API endpoint
    const apiUrl = new URL('https://data-api.polymarket.com/v1/leaderboard')
    
    // Add all the parameters that the API supports
    apiUrl.searchParams.set('category', category)
    apiUrl.searchParams.set('timePeriod', timePeriod)
    apiUrl.searchParams.set('orderBy', orderBy)
    apiUrl.searchParams.set('limit', limit.toString())
    
    if (offset > 0) {
      apiUrl.searchParams.set('offset', offset.toString())
    }

    console.log('Fetching from:', apiUrl.toString())

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    console.log('Successfully fetched real data from Polymarket API')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    )
  }
}
