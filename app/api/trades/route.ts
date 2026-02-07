import { NextResponse } from 'next/server'

export interface Trade {
  proxyWallet: string
  side: 'BUY' | 'SELL'
  asset: string
  conditionId: string
  size: number
  price: number
  timestamp: number
  title: string
  slug: string
  icon: string
  eventSlug: string
  outcome: string
  outcomeIndex: number
  name: string
  pseudonym: string
  bio: string
  profileImage: string
  profileImageOptimized: string
  transactionHash: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const limit = searchParams.get('limit') || '100'
  const offset = searchParams.get('offset') || '0'
  const takerOnly = searchParams.get('takerOnly') || 'true'
  const user = searchParams.get('user')
  const market = searchParams.get('market')
  const eventId = searchParams.get('eventId')
  const side = searchParams.get('side')
  const filterType = searchParams.get('filterType')
  const filterAmount = searchParams.get('filterAmount')

  try {
    const apiUrl = new URL('https://data-api.polymarket.com/trades')
    
    apiUrl.searchParams.set('limit', limit)
    apiUrl.searchParams.set('offset', offset)
    apiUrl.searchParams.set('takerOnly', takerOnly)
    
    if (user) apiUrl.searchParams.set('user', user)
    if (market) apiUrl.searchParams.set('market', market)
    if (eventId) apiUrl.searchParams.set('eventId', eventId)
    if (side) apiUrl.searchParams.set('side', side)
    if (filterType && filterAmount) {
      apiUrl.searchParams.set('filterType', filterType)
      apiUrl.searchParams.set('filterAmount', filterAmount)
    }

    console.log('Fetching trades from:', apiUrl.toString())

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
    console.log('Successfully fetched trades')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    )
  }
}
