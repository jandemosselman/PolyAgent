import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const user = searchParams.get('user')
  const markets = searchParams.getAll('market')
  const title = searchParams.get('title')
  const eventIds = searchParams.getAll('eventId')
  const requestedLimit = parseInt(searchParams.get('limit') || '50')
  const sortBy = searchParams.get('sortBy') || 'REALIZEDPNL'
  const sortDirection = searchParams.get('sortDirection') || 'DESC'

  if (!user) {
    return NextResponse.json(
      { error: 'User address is required' },
      { status: 400 }
    )
  }

  try {
    // Polymarket API has a max limit of 50 per request
    // So we need to paginate if user requests more
    const maxPerRequest = 50
    const numRequests = Math.ceil(requestedLimit / maxPerRequest)
    
    console.log(`Fetching ${requestedLimit} closed positions (${numRequests} requests needed)`)
    
    let allPositions: any[] = []
    
    for (let i = 0; i < numRequests; i++) {
      const offset = i * maxPerRequest
      const limit = Math.min(maxPerRequest, requestedLimit - allPositions.length)
      
      const params = new URLSearchParams({
        user,
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy,
        sortDirection
      })
      
      // Add multiple market parameters if provided
      markets.forEach(market => {
        params.append('market', market)
      })

      // Add title filter if provided
      if (title) {
        params.set('title', title)
      }

      // Add multiple eventId parameters if provided
      eventIds.forEach(eventId => {
        params.append('eventId', eventId)
      })

      const apiUrl = `https://data-api.polymarket.com/v1/closed-positions?${params.toString()}`
      console.log(`Request ${i + 1}/${numRequests}: offset=${offset}, limit=${limit}`)

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }

      const data = await response.json()
      allPositions = allPositions.concat(data)
      
      console.log(`Received ${data.length} positions. Total so far: ${allPositions.length}`)
      
      // If we got less than requested, there's no more data
      if (data.length < maxPerRequest) {
        console.log('Received less than max, no more data available')
        break
      }
      
      // Small delay to respect rate limits (150 requests per 10 seconds = ~66ms between requests)
      if (i < numRequests - 1) {
        await new Promise(resolve => setTimeout(resolve, 70))
      }
    }
    
    console.log(`Total closed positions fetched: ${allPositions.length}`)
    return NextResponse.json(allPositions)
  } catch (error) {
    console.error('Error fetching closed positions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch closed positions' },
      { status: 500 }
    )
  }
}
