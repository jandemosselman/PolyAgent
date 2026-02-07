import { NextResponse } from 'next/server'

export interface UserActivity {
  proxyWallet: string
  timestamp: number
  conditionId: string
  type: 'TRADE' | 'SPLIT' | 'MERGE' | 'REDEEM' | 'REWARD' | 'CONVERSION' | 'MAKER_REBATE'
  size: number
  usdcSize: number
  transactionHash: string
  price: number
  asset: string
  side: 'BUY' | 'SELL'
  outcomeIndex: number
  title: string
  slug: string
  icon: string
  eventSlug: string
  outcome: string
  name: string
  pseudonym: string
  bio: string
  profileImage: string
  profileImageOptimized: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const user = searchParams.get('user')
  const requestedLimit = parseInt(searchParams.get('limit') || '100')
  const market = searchParams.get('market')
  const eventId = searchParams.get('eventId')
  const type = searchParams.get('type')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const sortBy = searchParams.get('sortBy') || 'TIMESTAMP'
  const sortDirection = searchParams.get('sortDirection') || 'DESC'
  const side = searchParams.get('side')

  if (!user) {
    return NextResponse.json(
      { error: 'User address is required' },
      { status: 400 }
    )
  }

  try {
    // Polymarket API has a max limit of 50 per request (likely same as closed positions)
    const maxPerRequest = 50
    const numRequests = Math.ceil(requestedLimit / maxPerRequest)
    
    console.log('🚀 ACTIVITY API CALLED:')
    console.log(`  - Requested limit: ${requestedLimit}`)
    console.log(`  - Max per request: ${maxPerRequest}`)
    console.log(`  - Number of requests needed: ${numRequests}`)
    
    let allActivities: any[] = []
    
    for (let i = 0; i < numRequests; i++) {
      const offset = i * maxPerRequest
      const limit = Math.min(maxPerRequest, requestedLimit - allActivities.length)
      
      const apiUrl = new URL('https://data-api.polymarket.com/activity')
      
      apiUrl.searchParams.set('user', user)
      apiUrl.searchParams.set('limit', limit.toString())
      apiUrl.searchParams.set('offset', offset.toString())
      apiUrl.searchParams.set('sortBy', sortBy)
      apiUrl.searchParams.set('sortDirection', sortDirection)
      
      if (market) apiUrl.searchParams.set('market', market)
      if (eventId) apiUrl.searchParams.set('eventId', eventId)
      if (type) apiUrl.searchParams.set('type', type)
      if (start) apiUrl.searchParams.set('start', start)
      if (end) apiUrl.searchParams.set('end', end)
      if (side) apiUrl.searchParams.set('side', side)

      console.log(`  📡 Request ${i + 1}/${numRequests}: offset=${offset}, limit=${limit}`)

      const response = await fetch(apiUrl.toString(), {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      })

      if (!response.ok) {
        console.error(`  ❌ API responded with status: ${response.status}`)
        throw new Error(`API responded with status: ${response.status}`)
      }

      const data = await response.json()
      allActivities = allActivities.concat(data)
      
      console.log(`  ✅ Received ${data.length} activities. Total so far: ${allActivities.length}/${requestedLimit}`)
      
      // If we got less than requested, there's no more data
      if (data.length < maxPerRequest) {
        console.log(`  🏁 Received less than max (${data.length} < ${maxPerRequest}), no more data available`)
        break
      }
      
      // Small delay to respect rate limits (150 requests per 10 seconds = ~66ms between requests)
      if (i < numRequests - 1) {
        await new Promise(resolve => setTimeout(resolve, 70))
      }
    }
    
    console.log(`🎉 TOTAL ACTIVITIES FETCHED: ${allActivities.length} (requested: ${requestedLimit})`)
    return NextResponse.json(allActivities)
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user activity' },
      { status: 500 }
    )
  }
}
