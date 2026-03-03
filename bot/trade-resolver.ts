import { CopyTradeRun, StoredTrade } from './trade-storage.js'

interface Market {
  conditionId: string
  closed: boolean
  question?: string
  outcomePrices: string  // JSON string like '["0", "1"]'
  outcomes: string       // JSON string like '["Yes", "No"]'
}

export async function checkResolutionsForStoredTrades(
  run: CopyTradeRun
): Promise<{ resolvedTrades: StoredTrade[], budgetReturned: number }> {
  
  const openTrades = run.trades.filter(t => t.status === 'open')
  
  if (openTrades.length === 0) {
    return { resolvedTrades: [], budgetReturned: 0 }
  }
  
  // Get unique condition IDs
  const conditionIds = [...new Set(openTrades.map(t => t.conditionId).filter(Boolean))]
  
  // Fetch market data - Build URL with proper format
  const conditionIdsParam = conditionIds.map(id => `condition_ids=${id}`).join('&')
  const marketsUrl = `https://gamma-api.polymarket.com/markets?${conditionIdsParam}`
  
  const response = await fetch(marketsUrl)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.statusText}`)
  }
  
  const markets: Market[] = await response.json()
  const marketsMap = new Map(markets.map(m => [m.conditionId, m]))
  
  // Check each trade for resolution
  const resolvedTrades: StoredTrade[] = []
  let budgetReturned = 0
  
  for (const trade of openTrades) {
    const market = marketsMap.get(trade.conditionId)
    
    if (!market) {
      continue
    }
    
    if (market.closed) {
      // Parse outcome prices and outcomes
      const outcomePrices = JSON.parse(market.outcomePrices)
      const outcomes = JSON.parse(market.outcomes)
      
      // Find which outcome has price = 1 (the winner)
      const winningIndex = outcomePrices.findIndex((price: string) => parseFloat(price) === 1)
      
      if (winningIndex === -1) {
        continue
      }
      
      const winningOutcome = outcomes[winningIndex]
      
      // Check if our trade won
      const won = trade.outcome === winningOutcome
      
      if (won) {
        // Calculate profit
        const shares = trade.amount / trade.price
        const payout = shares * 1.0
        const profit = payout - trade.amount
        trade.pnl = profit
        trade.status = 'won'
        budgetReturned += payout // Return original bet + profit
        console.log(`  ✅ Won: ${trade.market} | P&L: +$${profit.toFixed(2)}`)
      } else {
        trade.pnl = -trade.amount
        trade.status = 'lost'
        console.log(`  ❌ Lost: ${trade.market} | P&L: -$${trade.amount.toFixed(2)}`)
      }
      
      resolvedTrades.push(trade)
    }
  }
  
  if (resolvedTrades.length > 0) {
    console.log(`  📊 Resolved ${resolvedTrades.length} trade(s) | budget returned: $${budgetReturned.toFixed(2)}`)
  }
  
  return { resolvedTrades, budgetReturned }
}
