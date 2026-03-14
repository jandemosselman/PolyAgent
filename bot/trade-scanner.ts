import { CopyTradeRun, StoredTrade } from './trade-storage.js'
import { fetchJsonWithRetry } from './http-client.js'

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
  
  // Calculate last check time - use the most recent trade timestamp, or run creation time
  const lastCheckTimestamp = run.trades.length > 0
    ? Math.max(...run.trades.map(t => t.timestamp), run.createdAt)
    : run.createdAt
  
  // Fetch trader's recent activity with a much higher limit to avoid missing trades
  // Use 5000 to handle very active traders (Polymarket API max is likely 10000)
  const activityUrl = `https://data-api.polymarket.com/activity?user=${run.traderAddress}&limit=5000&sortBy=TIMESTAMP&sortDirection=DESC`
  
  const activities = await fetchJsonWithRetry<Activity[]>({
    url: activityUrl,
    context: `Activity fetch for ${run.name}`,
    maxRetries: 4
  })
  
  // Filter activities
  const existingTradeIds = new Set(run.trades.map(t => t.transactionHash))
  
  const matchingTrades = activities.filter(activity => {
    // Must be a BUY
    if (activity.type !== 'TRADE' || activity.side !== 'BUY') return false
    
    // Skip duplicates (already copied)
    if (existingTradeIds.has(activity.transactionHash)) return false
    
    // ⚡ CRITICAL: Only trades AFTER last check timestamp (optimization)
    // This prevents re-processing the same trades every check cycle
    // Detect if timestamp is in seconds (< 10 billion) or milliseconds
    const activityTimestampMs = activity.timestamp > 10000000000 
      ? activity.timestamp 
      : activity.timestamp * 1000
    
    if (activityTimestampMs <= lastCheckTimestamp) {
      return false // Trade already processed or happened before last check
    }
    
    // Additional safety: Must be after run creation
    if (activityTimestampMs < run.createdAt) {
      return false
    }
    
    // Check amount filter
    const amount = parseFloat(activity.size)
    if (amount < run.minTriggerAmount) return false
    
    // Check price filter
    const price = parseFloat(activity.price)
    if (price < run.minPrice || price > run.maxPrice) return false
    
    return true
  })
  
  // Calculate available budget
  // Formula: Initial Budget + Closed Trades P&L - Open Trades Cost
  // Open trades cost = sum of actual amounts (works for both fixed and percentage mode)
  const openTrades = run.trades.filter(t => t.status === 'open')
  const closedTrades = run.trades.filter(t => t.status !== 'open')
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const openTradesCost = openTrades.reduce((sum, t) => sum + (t.amount || 0), 0)
  const actualAvailableBudget = run.initialBudget + totalPnL - openTradesCost
  const budgetToUse = Math.max(0, actualAvailableBudget)

  // Greedy selection: compute bet amount per trade and include while budget allows
  const tradesToCopy: typeof matchingTrades = []
  let remainingBudget = budgetToUse
  for (const activity of matchingTrades) {
    let betAmount: number
    if (run.bettingMode === 'percentage') {
      const traderUSDC = parseFloat(activity.size) * parseFloat(activity.price)
      betAmount = traderUSDC * ((run.betPercentage || 1) / 100)
    } else {
      betAmount = run.fixedBetAmount
    }
    if (betAmount <= 0 || betAmount > remainingBudget) break
    tradesToCopy.push(activity)
    remainingBudget -= betAmount
  }

  // Create simulated trades
  const newTrades: StoredTrade[] = tradesToCopy.map((activity, index) => {
    // Handle timestamp - Polymarket API returns in seconds, need milliseconds
    const timestampMs = activity.timestamp > 10000000000 
      ? activity.timestamp  // Already in milliseconds
      : activity.timestamp * 1000  // Convert from seconds
    
    // Compute the actual bet amount for this trade
    let betAmount: number
    if (run.bettingMode === 'percentage') {
      const traderUSDC = parseFloat(activity.size) * parseFloat(activity.price)
      betAmount = traderUSDC * ((run.betPercentage || 1) / 100)
    } else {
      betAmount = run.fixedBetAmount
    }
    
    // Get best available market name
    const marketName = activity.title || activity.market || activity.slug || `Market ${activity.asset.substring(0, 8)}...`
    
    return {
      id: `${activity.transactionHash}-${activity.asset}-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}`,
      // originalAmount: the USD value the original trader placed (needed for MC trigger filter)
      originalAmount: parseFloat(activity.size) * parseFloat(activity.price),
      // ⚡ MEMORY OPTIMIZATION: Only store essential fields from originalTrade
      // (Not full API response, saves ~90% memory while keeping functionality)
      originalTrade: {
        amount: activity.size, // Needed for Auto-Find features
        size: activity.size,
        price: activity.price,
        type: activity.type,
        side: activity.side
      },
      timestamp: timestampMs,
      market: marketName,
      outcome: activity.outcome || activity.outcomeName || 'Unknown',
      price: parseFloat(activity.price),
      amount: betAmount,
      asset: activity.asset,
      conditionId: activity.conditionId || '',
      slug: activity.slug || '',
      transactionHash: activity.transactionHash,
      icon: activity.icon || '',
      status: 'open',
      pnl: 0
    }
  })
  
  if (newTrades.length > 0) {
    console.log(`  📝 ${run.name}: copying ${newTrades.length} new trade(s) | budget $${budgetToUse.toFixed(2)}`)
  }

  return {
    newTrades,
    totalMatching: matchingTrades.length
  }
}
