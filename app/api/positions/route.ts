import { NextResponse } from 'next/server'

export interface UserPosition {
  proxyWallet: string
  asset: string
  conditionId: string
  size: number
  avgPrice: number
  initialValue: number
  currentValue: number
  cashPnl: number
  percentPnl: number
  totalBought: number
  realizedPnl: number
  percentRealizedPnl: number
  curPrice: number
  redeemable: boolean
  mergeable: boolean
  title: string
  slug: string
  icon: string
  eventSlug: string
  outcome: string
  outcomeIndex: number
  oppositeOutcome: string
  oppositeAsset: string
  endDate: string
  negativeRisk: boolean
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const user = searchParams.get('user')
  const sizeThreshold = searchParams.get('sizeThreshold') || '1'
  const limit = searchParams.get('limit') || '100'
  const offset = searchParams.get('offset') || '0'
  const sortBy = searchParams.get('sortBy') || 'TOKENS'
  const sortDirection = searchParams.get('sortDirection') || 'DESC'
  const redeemable = searchParams.get('redeemable') || 'false'
  const mergeable = searchParams.get('mergeable') || 'false'

  if (!user) {
    return NextResponse.json(
      { error: 'User address is required' },
      { status: 400 }
    )
  }

  try {
    const apiUrl = new URL('https://data-api.polymarket.com/positions')
    
    apiUrl.searchParams.set('user', user)
    apiUrl.searchParams.set('sizeThreshold', sizeThreshold)
    apiUrl.searchParams.set('limit', limit)
    apiUrl.searchParams.set('offset', offset)
    apiUrl.searchParams.set('sortBy', sortBy)
    apiUrl.searchParams.set('sortDirection', sortDirection)
    apiUrl.searchParams.set('redeemable', redeemable)
    apiUrl.searchParams.set('mergeable', mergeable)

    console.log('Fetching positions from:', apiUrl.toString())

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
    console.log('Successfully fetched user positions')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching user positions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user positions' },
      { status: 500 }
    )
  }
}
