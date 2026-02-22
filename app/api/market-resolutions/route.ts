import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { conditionIds } = await request.json()
    
    if (!conditionIds || !Array.isArray(conditionIds) || conditionIds.length === 0) {
      return NextResponse.json(
        { error: 'conditionIds array is required' },
        { status: 400 }
      )
    }

    // Gamma API can handle multiple condition IDs at once
    // Batch them in groups of 100 to avoid URL length limits
    const batchSize = 100
    const allMarkets: any[] = []
    
    for (let i = 0; i < conditionIds.length; i += batchSize) {
      const batch = conditionIds.slice(i, i + batchSize)
      const conditionIdsParam = batch.join(',')
      
      const url = `https://gamma-api.polymarket.com/markets?condition_ids=${conditionIdsParam}`
      console.log(`Fetching resolutions for ${batch.length} markets (batch ${Math.floor(i/batchSize) + 1})`)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      })

      if (!response.ok) {
        console.error(`Failed to fetch market resolutions: ${response.status}`)
        continue
      }

      const markets = await response.json()
      if (Array.isArray(markets)) {
        allMarkets.push(...markets)
      }
      
      // Small delay between batches
      if (i + batchSize < conditionIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Create a map of conditionId -> resolution data
    const resolutionMap: Record<string, any> = {}
    allMarkets.forEach(market => {
      if (market.conditionId) {
        resolutionMap[market.conditionId] = {
          closed: market.closed || false,
          resolved: market.umaResolutionStatus === 'resolved',
          outcomePrices: market.outcomePrices || [],
          winningOutcome: market.outcomePrices ? 
            (market.outcomePrices[0] === '1' ? 0 : market.outcomePrices[1] === '1' ? 1 : null) : null
        }
      }
    })

    console.log(`✅ Fetched resolution data for ${Object.keys(resolutionMap).length} markets`)
    
    return NextResponse.json(resolutionMap)

  } catch (error) {
    console.error('Error fetching market resolutions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market resolutions' },
      { status: 500 }
    )
  }
}
