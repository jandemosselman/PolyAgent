import { CopyTradeRun, StoredTrade } from './trade-storage.js'

interface Activity {
  id: string
  user: string
  market: string
  title?: string
  asset: string
  type: string
  side: string
  size: string
  price: string
  timestamp: number
  slug?: string
  icon?: string
  transactionHash: string
  outcome?: string
  outcomeName?: string
  conditionId?: string
}

export async function scanForNewTrades(
  run: CopyTradeRun
): Promise<{ newTrades: StoredTrade[], totalMatching: number }> {
  
  console.log(`  🔍 Scanning for new trades for ${run.name}...`)
  console.log(`  📅 Run created at: ${new Date(run.createdAt).toISOString()}`)
  console.log(`  💰 Current budget: $${run.currentBudget.toFixed(2)}`)
  console.log(`  🎯 Filters: Amount >= $${run.minTriggerAmount}, Price ${run.minPrice}-${run.maxPrice}`)
  
  // Fetch trader's recent activity
  const activityUrl = `https://data-api.polymarket.com/activity?user=${run.traderAddress}&limit=2000&sortBy=TIMESTAMP&sortDirection=DESC`
  
  const response = await fetch(activityUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch activity: ${response.statusText}`)
  }
  
  const activities: Activity[] = await response.json()
  console.log(`  📊 Fetched ${activities.length} activities`)
  
  // Debug first activity timestamp
  if (activities.length > 0) {
    const firstActivity = activities[0]
    console.log(`  🔍 First activity timestamp debug:`)
    console.log(`     Raw timestamp: ${firstActivity.timestamp}`)
    console.log(`     As seconds: ${new Date(firstActivity.timestamp * 1000).toISOString()}`)
    console.log(`     As milliseconds: ${new Date(firstActivity.timestamp).toISOString()}`)
  }
  
  // Filter activities
  const existingTradeIds = new Set(run.trades.map(t => t.transactionHash))
  
  const matchingTrades = activities.filter(activity => {
    // Must be a BUY
    if (activity.type !== 'TRADE' || activity.side !== 'BUY') return false
    
    // Skip duplicates (already copied)
    if (existingTradeIds.has(activity.transactionHash)) return false
    if (existingTradeIds.has(activity.transactionHash)) return false
    
    // ⚡ CRITICAL: Only trades AFTER run creation timestamp
    // Detect if timestamp is in seconds (< 10 billion) or milliseconds
    const activityTimestampMs = activity.timestamp > 10000000000 
      ? activity.timestamp 
      : activity.timestamp * 1000
    
    if (activityTimestampMs < run.createdAt) {
      return false // Trade happened BEFORE this run was created
    }
    
    // Check amount filter
    const amount = parseFloat(activity.size)
    if (amount < run.minTriggerAmount) return false
    
    // Check price filter
    const price = parseFloat(activity.price)
    if (price < run.minPrice || price > run.maxPrice) return false
    
    return true
  })
  
  console.log(`  ✅ Found ${matchingTrades.length} matching trades (after timestamp filter)`)
  
  // Debug: Show how many were filtered by timestamp
  const totalBuys = activities.filter(a => a.type === 'TRADE' && a.side === 'BUY').length
  const beforeCreation = activities.filter(a => {
    if (a.type !== 'TRADE' || a.side !== 'BUY') return false
    const timestampMs = a.timestamp > 10000000000 ? a.timestamp : a.timestamp * 1000
    return timestampMs < run.createdAt
  }).length
  
  console.log(`  📊 Timestamp filter stats:`)
  console.log(`     Total BUYs in API: ${totalBuys}`)
  console.log(`     Before run creation: ${beforeCreation} (filtered out)`)
  console.log(`     After run creation: ${totalBuys - beforeCreation}`)
  console.log(`     Final matching: ${matchingTrades.length}`)
  
  // Calculate available budget like localhost does
  // Formula: Initial Budget + Closed Trades P&L - Open Trades Cost
  const openTrades = run.trades.filter(t => t.status === 'open')
  const closedTrades = run.trades.filter(t => t.status !== 'open')
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const openTradesCost = openTrades.length * run.fixedBetAmount
  const actualAvailableBudget = run.initialBudget + totalPnL - openTradesCost
  
  console.log(`  💰 Budget calculation:`)
  console.log(`     Initial: $${run.initialBudget.toFixed(2)}`)
  console.log(`     Closed P&L: $${totalPnL.toFixed(2)}`)
  console.log(`     Open cost: $${openTradesCost.toFixed(2)} (${openTrades.length} trades)`)
  console.log(`     Available: $${actualAvailableBudget.toFixed(2)}`)
  console.log(`     Current (old method): $${run.currentBudget.toFixed(2)}`)
  
  // Use the calculated available budget, but ensure it's not negative
  const budgetToUse = Math.max(0, actualAvailableBudget)
  
  // Calculate how many we can afford
  const affordableCount = Math.floor(budgetToUse / run.fixedBetAmount)
  const tradesToCopy = matchingTrades.slice(0, affordableCount)
  
  console.log(`  💰 Can afford ${affordableCount} new trades, copying ${tradesToCopy.length}`)
  console.log(`  📊 Current state: ${run.trades.length} total (${openTrades.length} open, ${closedTrades.length} closed)`)

  // Create simulated trades
  const newTrades: StoredTrade[] = tradesToCopy.map((activity, index) => {
    // Handle timestamp - Polymarket API returns in seconds, need milliseconds
    const timestampMs = activity.timestamp > 10000000000 
      ? activity.timestamp  // Already in milliseconds
      : activity.timestamp * 1000  // Convert from seconds
    
    // Get best available market name
    const marketName = activity.title || activity.market || activity.slug || `Market ${activity.asset.substring(0, 8)}...`
    
    console.log(`  📝 Trade ${index + 1}: ${marketName} @ $${activity.price} on ${new Date(timestampMs).toISOString()}`)
    
    return {
      id: `${activity.transactionHash}-${activity.asset}-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`,
      // ⚡ MEMORY OPTIMIZATION: Don't store full originalTrade object
      // All essential fields extracted below (saves ~60% memory)
      timestamp: timestampMs,
      market: marketName,
      outcome: activity.outcome || activity.outcomeName || 'Unknown',
      price: parseFloat(activity.price),
      amount: run.fixedBetAmount,
      asset: activity.asset,
      conditionId: activity.conditionId || '',
      slug: activity.slug || '',
      transactionHash: activity.transactionHash,
      icon: activity.icon || '',
      status: 'open',
      pnl: 0
    }
  })
  
  return {
    newTrades,
    totalMatching: matchingTrades.length
  }
}
