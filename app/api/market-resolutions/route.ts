import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { conditionIds } = await request.json()
    
    console.log(`\n🔍 /api/market-resolutions called`)
    console.log(`   Received ${conditionIds?.length || 0} conditionIds`)
    
    if (!conditionIds || !Array.isArray(conditionIds) || conditionIds.length === 0) {
      console.error(`❌ Invalid request: conditionIds is not a valid array`)
      return NextResponse.json(
        { error: 'conditionIds array is required' },
        { status: 400 }
      )
    }
    
    console.log(`   Sample conditionIds (first 3):`)
    conditionIds.slice(0, 3).forEach((id: string, i: number) => {
      console.log(`      ${i + 1}. ${id}`)
    })

    // Gamma API can handle multiple condition IDs at once
    // Batch them in groups of 100 to avoid URL length limits
    const batchSize = 100
    const allMarkets: any[] = []
    
    for (let i = 0; i < conditionIds.length; i += batchSize) {
      const batch = conditionIds.slice(i, i + batchSize)
      const conditionIdsParam = batch.join(',')
      
      const url = `https://gamma-api.polymarket.com/markets?condition_ids=${conditionIdsParam}`
      console.log(`\n   📡 Fetching batch ${Math.floor(i/batchSize) + 1}:`)
      console.log(`      URL: ${url.substring(0, 120)}...`)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      })

      console.log(`      Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        console.error(`      ❌ Failed to fetch: ${response.status}`)
        const errorText = await response.text()
        console.error(`      Error body: ${errorText.substring(0, 200)}`)
        continue
      }

      const markets = await response.json()
      console.log(`      Received data type: ${Array.isArray(markets) ? 'array' : typeof markets}`)
      console.log(`      Array length: ${Array.isArray(markets) ? markets.length : 'N/A'}`)
      
      if (Array.isArray(markets)) {
        console.log(`      ✅ Got ${markets.length} markets`)
        if (markets.length > 0) {
          console.log(`      Sample market (first one):`)
          const sample = markets[0]
          console.log(`         conditionId: ${sample.conditionId}`)
          console.log(`         closed: ${sample.closed}`)
          console.log(`         umaResolutionStatus: ${sample.umaResolutionStatus}`)
          console.log(`         outcomePrices: ${JSON.stringify(sample.outcomePrices)}`)
        }
        allMarkets.push(...markets)
      } else {
        console.error(`      ❌ Response is not an array:`, markets)
      }
      
      // Small delay between batches
      if (i + batchSize < conditionIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    console.log(`\n   📊 Total markets fetched: ${allMarkets.length}`)
    console.log(`\n   📊 Total markets fetched: ${allMarkets.length}`)

    // Create a map of conditionId -> resolution data
    const resolutionMap: Record<string, any> = {}
    allMarkets.forEach(market => {
      if (market.conditionId) {
        // Parse outcome prices - they come as JSON string like '["0.5", "0.5"]'
        let outcomePrices: string[] = []
        try {
          outcomePrices = typeof market.outcomePrices === 'string' 
            ? JSON.parse(market.outcomePrices) 
            : (market.outcomePrices || [])
        } catch (e) {
          console.warn(`Failed to parse outcomePrices for ${market.conditionId}:`, market.outcomePrices)
          outcomePrices = []
        }
        
        // Determine winning outcome: if one price is "1" or "1.0", that's the winner
        let winningOutcome: number | null = null
        if (outcomePrices.length >= 2) {
          if (outcomePrices[0] === '1' || outcomePrices[0] === '1.0') {
            winningOutcome = 0
          } else if (outcomePrices[1] === '1' || outcomePrices[1] === '1.0') {
            winningOutcome = 1
          }
        }
        
        // A market is resolved if it's closed AND has a winning outcome
        const resolved = market.closed && winningOutcome !== null
        
        resolutionMap[market.conditionId] = {
          closed: market.closed || false,
          resolved: resolved,
          outcomePrices: outcomePrices,
          winningOutcome: winningOutcome
        }
      }
    })

    console.log(`   ✅ Created resolution map with ${Object.keys(resolutionMap).length} entries`)
    const resolvedCount = Object.values(resolutionMap).filter((r: any) => r.resolved).length
    console.log(`   📊 Resolved markets: ${resolvedCount}`)
    console.log(`   📊 Open markets: ${Object.keys(resolutionMap).length - resolvedCount}`)
    
    return NextResponse.json(resolutionMap)

  } catch (error) {
    console.error('❌ Error in /api/market-resolutions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market resolutions' },
      { status: 500 }
    )
  }
}
