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
    console.log(`  ℹ️  No open trades to check`)
    return { resolvedTrades: [], budgetReturned: 0 }
  }
  
  console.log(`  🔍 Checking ${openTrades.length} open trades for resolutions...`)
  
  // Get unique condition IDs
  const conditionIds = [...new Set(openTrades.map(t => t.conditionId).filter(Boolean))]
  console.log(`  📋 Checking ${conditionIds.length} unique markets...`)
  
  // Fetch market data - Build URL with proper format
  const conditionIdsParam = conditionIds.map(id => `condition_ids=${id}`).join('&')
  const marketsUrl = `https://gamma-api.polymarket.com/markets?${conditionIdsParam}`
  console.log(`  🌐 Fetching from: ${marketsUrl.substring(0, 100)}...`)
  
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
      console.log(`  🔍 Resolving: ${trade.market} (${market.question || 'Unknown'})`)
      console.log(`     Outcome prices: ${market.outcomePrices}`)
      console.log(`     Outcomes: ${market.outcomes}`)
      
      // Parse outcome prices and outcomes
      const outcomePrices = JSON.parse(market.outcomePrices)
      const outcomes = JSON.parse(market.outcomes)
      
      // Find which outcome has price = 1 (the winner)
      const winningIndex = outcomePrices.findIndex((price: string) => parseFloat(price) === 1)
      
      if (winningIndex === -1) {
        console.log(`     ⚠️ Could not determine winner from prices: ${market.outcomePrices}`)
        continue
      }
      
      const winningOutcome = outcomes[winningIndex]
      console.log(`     Winner: ${winningOutcome}`)
      console.log(`     Trade bet on: ${trade.outcome}`)
      
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
