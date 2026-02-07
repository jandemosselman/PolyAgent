import { CopyTradeRun, StoredTrade } from './trade-storage.js'

interface Market {
  conditionId: string
  closed: boolean
  outcomes: Array<{
    price: string
  }>
}

export async function checkResolutionsForStoredTrades(
  run: CopyTradeRun
): Promise<{ resolvedTrades: StoredTrade[], budgetReturned: number }> {
  
  const openTrades = run.trades.filter(t => t.status === 'open')
  
  if (openTrades.length === 0) {
    console.log(`  ℹ️  No open trades to check`)
    return { resolvedTrades: [], budgetReturned: 0 }
  }
  
  console.log(`  🔍 Checking ${openTrades.length} open trades for resolutions...`)
  
  // Get unique condition IDs
  const conditionIds = [...new Set(openTrades.map(t => t.conditionId))]
  console.log(`  📋 Checking ${conditionIds.length} unique markets...`)
  
  // Fetch market data
  const marketsUrl = `https://gamma-api.polymarket.com/markets?condition_ids=${conditionIds.join(',')}`
  const response = await fetch(marketsUrl)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.statusText}`)
  }
  
  const markets: Market[] = await response.json()
  const marketsMap = new Map(markets.map(m => [m.conditionId, m]))
  
  console.log(`  📊 Received ${markets.length} markets`)
  
  // Check each trade for resolution
  const resolvedTrades: StoredTrade[] = []
  let budgetReturned = 0
  
  for (const trade of openTrades) {
    const market = marketsMap.get(trade.conditionId)
    
    if (!market) {
      console.log(`  ⚠️  Market not found for condition ${trade.conditionId}`)
      continue
    }
    
    if (market.closed) {
      // Determine if won or lost
      const outcomeIndex = trade.outcome === 'Yes' ? 0 : 1
      const finalPrice = parseFloat(market.outcomes[outcomeIndex]?.price || '0')
      
      const won = finalPrice > 0.99 // Winner if price is ~1.0
      
      if (won) {
        // Calculate profit
        const payout = trade.amount / trade.price
        const profit = payout - trade.amount
        trade.pnl = profit
        trade.status = 'won'
        budgetReturned += payout // Return original bet + profit
        
        console.log(`  ✅ Won: ${trade.market} - P&L: +$${profit.toFixed(2)}`)
      } else {
        trade.pnl = -trade.amount
        trade.status = 'lost'
        // Lost trades don't return funds
        
        console.log(`  ❌ Lost: ${trade.market} - P&L: -$${trade.amount.toFixed(2)}`)
      }
      
      resolvedTrades.push(trade)
    }
  }
  
  console.log(`  📊 Resolved ${resolvedTrades.length} trade(s), budget returned: $${budgetReturned.toFixed(2)}`)
  
  return { resolvedTrades, budgetReturned }
}
