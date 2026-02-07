import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { traderAddress, openTrades } = body

    if (openTrades.length === 0) {
      return NextResponse.json({
        success: true,
        resolvedTrades: []
      })
    }

    console.log(`🔍 Checking ${openTrades.length} open trades for resolution...`)
    
    // Get unique condition IDs from open trades
    const conditionIds = [...new Set(openTrades.map((t: any) => t.conditionId).filter(Boolean))]
    
    if (conditionIds.length === 0) {
      console.error('❌ No condition IDs found in open trades')
      return NextResponse.json({
        success: true,
        resolvedTrades: []
      })
    }
    
    console.log(`  Checking ${conditionIds.length} unique condition IDs via markets API...`)
    console.log(`  Condition IDs:`, conditionIds.map((id: any) => id.substring(0, 20) + '...'))
    
    // Build the markets API URL with all condition IDs
    const conditionIdsParam = conditionIds.map(id => `condition_ids=${id}`).join('&')
    const marketsUrl = `https://gamma-api.polymarket.com/markets?${conditionIdsParam}`
    
    console.log(`  Full URL: ${marketsUrl}`)
    
    const marketsResponse = await fetch(marketsUrl, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    })
    
    if (!marketsResponse.ok) {
      console.error('❌ Failed to fetch markets:', marketsResponse.status)
      return NextResponse.json({
        success: true,
        resolvedTrades: []
      })
    }
    
    const markets = await marketsResponse.json()
    console.log(`📦 Received ${markets.length} markets`)
    
    // Log each market's status
    markets.forEach((market: any) => {
      console.log(`  Market: ${market.question}`)
      console.log(`    - Condition ID: ${market.conditionId}`)
      console.log(`    - Closed: ${market.closed}`)
      console.log(`    - Outcome prices: ${market.outcomePrices}`)
    })
    
    // Create a map of markets by condition ID
    const marketsMap = new Map()
    markets.forEach((market: any) => {
      if (market.conditionId) {
        marketsMap.set(market.conditionId, market)
      }
    })
    
    console.log(`  Markets map size: ${marketsMap.size}`)
    
    // Check each open trade against the markets
    console.log(`\n🔍 Checking each open trade:`)
    openTrades.forEach((trade: any, index: number) => {
      const market = marketsMap.get(trade.conditionId)
      console.log(`  Trade ${index + 1}: ${trade.market}`)
      console.log(`    - Condition ID: ${trade.conditionId}`)
      console.log(`    - Outcome bet on: ${trade.outcome}`)
      console.log(`    - Found in markets? ${!!market}`)
      if (market) {
        console.log(`    - Market closed? ${market.closed}`)
      }
    })
    
    // Check which trades have resolved (market is closed)
    const resolvedTrades = openTrades
      .map((trade: any) => {
        const market = marketsMap.get(trade.conditionId)
        
        if (!market) {
          return null // Market not found
        }
        
        if (!market.closed) {
          return null // Market still open
        }
        
        console.log(`  ✅ Market resolved: ${market.question}`)
        console.log(`     Outcome prices: ${market.outcomePrices}`)
        
        // Parse outcome prices to determine winner
        // outcomePrices is like ["0", "1"] where 1 means that outcome won
        const outcomePrices = JSON.parse(market.outcomePrices)
        const outcomes = JSON.parse(market.outcomes)
        
        // Find which outcome index has price = 1 (the winner)
        const winningIndex = outcomePrices.findIndex((price: string) => parseFloat(price) === 1)
        
        if (winningIndex === -1) {
          console.log(`     ⚠️ Could not determine winner from prices: ${market.outcomePrices}`)
          return null
        }
        
        const winningOutcome = outcomes[winningIndex]
        console.log(`     Winner: ${winningOutcome}`)
        console.log(`     Trade bet on: ${trade.outcome}`)
        
        // Check if our trade won
        const won = trade.outcome === winningOutcome
        
        // Calculate P&L
        let pnl: number
        if (won) {
          const shares = trade.amount / trade.price
          const payout = shares * 1.0
          pnl = payout - trade.amount
        } else {
          pnl = -trade.amount
        }
        
        const roi = (pnl / trade.amount) * 100
        
        console.log(`     ${won ? '🎉 WON' : '😞 LOST'} - P&L: $${pnl.toFixed(2)} (${roi.toFixed(1)}%)`)
        
        return {
          id: trade.id,
          originalTrade: trade.originalTrade,
          timestamp: trade.timestamp,
          market: trade.market,
          outcome: trade.outcome,
          price: trade.price,
          amount: trade.amount,
          asset: trade.asset,
          conditionId: trade.conditionId,
          transactionHash: trade.transactionHash,
          icon: trade.icon,
          status: won ? 'won' : 'lost',
          pnl,
          roi
        }
      })
      .filter((t: any) => t !== null)
    
    console.log(`✅ Found ${resolvedTrades.length} resolved trades`)

    return NextResponse.json({
      success: true,
      resolvedTrades
    })
  } catch (error) {
    console.error('Error checking resolved trades:', error)
    return NextResponse.json(
      { error: 'Failed to check resolved trades' },
      { status: 500 }
    )
  }
}
