import { CopyTradeRun, StoredTrade } from './trade-storage.js'

interface Activity {
  id: string
  user: string
  market: string
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
  
  // Filter activities
  const existingTradeIds = new Set(run.trades.map(t => t.transactionHash))
  
  const matchingTrades = activities.filter(activity => {
    // Must be a BUY
    if (activity.type !== 'TRADE' || activity.side !== 'BUY') return false
    
    // Must be after run creation
    if (activity.timestamp < run.createdAt) return false
    
    // Skip duplicates
    if (existingTradeIds.has(activity.transactionHash)) return false
    
    // Check amount filter
    const amount = parseFloat(activity.size)
    if (amount < run.minTriggerAmount) return false
    
    // Check price filter
    const price = parseFloat(activity.price)
    if (price < run.minPrice || price > run.maxPrice) return false
    
    return true
  })
  
  console.log(`  ✅ Found ${matchingTrades.length} matching trades`)
  
  // Calculate how many we can afford
  const affordableCount = Math.floor(run.currentBudget / run.fixedBetAmount)
  const tradesToCopy = matchingTrades.slice(0, affordableCount)
  
  console.log(`  💰 Budget allows ${affordableCount} trades, copying ${tradesToCopy.length}`)
  
  // Create simulated trades
  const newTrades: StoredTrade[] = tradesToCopy.map(activity => ({
    id: `${run.id}-${activity.transactionHash}`,
    originalTrade: activity,
    timestamp: activity.timestamp,
    market: activity.market,
    outcome: activity.outcome || 'Unknown',
    price: parseFloat(activity.price),
    amount: run.fixedBetAmount,
    asset: activity.asset,
    conditionId: activity.conditionId || '',
    slug: activity.slug,
    transactionHash: activity.transactionHash,
    icon: activity.icon,
    status: 'open',
    pnl: 0
  }))
  
  return {
    newTrades,
    totalMatching: matchingTrades.length
  }
}
