import { sendTelegramUpdate, notifyWinRateChange, notifyNewTrades, notifyError } from './telegram-notifier.js'
import fs from 'fs'
import path from 'path'

interface Configuration {
  id: string
  name: string
  traderAddress: string
  minTriggerAmount: number
  minPrice: number
  maxPrice: number
  initialBudget: number
  fixedBetAmount: number
}

interface ConfigStats {
  configId: string
  configName: string
  traderAddress: string
  winRate: number
  totalTrades: number
  wins: number
  losses: number
  avgPnL: number
  totalPnL: number
  lastChecked: Date
}

interface ClosedPosition {
  proxyWallet: string
  asset: string
  conditionId: string
  avgPrice: number
  totalBought: number
  realizedPnl: number
  curPrice: number
  timestamp: number
  title: string
  slug: string
  icon: string
  eventSlug: string
  outcome: string
  outcomeIndex: number
}

interface Activity {
  proxyWallet: string
  timestamp: number
  conditionId: string
  type: string
  size: number
  usdcSize: number
  transactionHash: string
  price: number
  asset: string
  side: 'BUY' | 'SELL'
  outcomeIndex: number
  title: string
  slug: string
  icon: string
  eventSlug: string
  outcome: string
}

const STATS_FILE = path.join(process.cwd(), 'stats-cache.json')
const CONFIG_FILE = path.join(process.cwd(), 'configurations.json')

// Load configurations from localStorage export
function loadConfigurations(): Configuration[] {
  try {
    // Try environment variable first (for Railway)
    if (process.env.CONFIGURATIONS) {
      return JSON.parse(process.env.CONFIGURATIONS)
    }
    
    // Fall back to file (for local development)
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading configurations:', error)
  }
  return []
}

// Load stats from file
function loadStats(): Map<string, ConfigStats> {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, 'utf-8')
      const obj = JSON.parse(data)
      return new Map(Object.entries(obj))
    }
  } catch (error) {
    console.error('Error loading stats cache:', error)
  }
  return new Map()
}

// Save stats to file
function saveStats(stats: Map<string, ConfigStats>) {
  try {
    const obj = Object.fromEntries(stats)
    fs.writeFileSync(STATS_FILE, JSON.stringify(obj, null, 2))
  } catch (error) {
    console.error('Error saving stats cache:', error)
  }
}

const statsCache = loadStats()

export async function checkResolutionsForTrader(address: string) {
  console.log(`🔍 Checking ${address.slice(0, 8)}...`)
  
  try {
    // Fetch activity and closed positions
    const [activity, closedPositions] = await Promise.all([
      fetchActivity(address, 5000),
      fetchClosedPositions(address, 10000)
    ])
    
    // Match and calculate stats
    const { trades, stats } = matchResolvedBuys(activity, closedPositions)
    
    const newWinRate = stats.winRate
    const totalTrades = trades.length
    const wins = stats.wins
    const losses = stats.losses
    const avgPnL = stats.avgPnL
    const totalPnL = stats.totalPnL
    
    // Check if this is first time tracking this trader
    const oldStats = statsCache.get(address)
    
    if (!oldStats) {
      // First check - send initial stats
      await sendTelegramUpdate(`
🎯 *Now tracking trader*

Address: \`${address.slice(0, 10)}...\`
Win Rate: *${newWinRate.toFixed(1)}%*
Total Trades: ${totalTrades}
Wins: ${wins} | Losses: ${losses}
Avg P&L: $${avgPnL.toFixed(2)}
Total P&L: $${totalPnL.toFixed(2)}
      `.trim())
    } else {
      // Check for significant changes
      const winRateChange = Math.abs(newWinRate - oldStats.winRate)
      const newTradesCount = totalTrades - oldStats.totalTrades
      
      // Notify if win rate changed by >1% OR 5+ new trades
      if (winRateChange > 1) {
        await notifyWinRateChange(
          address,
          oldStats.winRate,
          newWinRate,
          totalTrades,
          wins,
          losses,
          avgPnL
        )
      } else if (newTradesCount >= 5) {
        await notifyNewTrades(
          address,
          newTradesCount,
          newWinRate,
          totalTrades,
          avgPnL
        )
      }
    }
    
    // Update cache
    statsCache.set(address, {
      address,
      winRate: newWinRate,
      totalTrades,
      wins,
      losses,
      avgPnL,
      totalPnL,
      lastChecked: new Date()
    })
    
    // Save to disk
    saveStats(statsCache)
    
    console.log(`✅ ${address.slice(0, 8)}: ${newWinRate.toFixed(1)}% WR (${totalTrades} trades)`)
    
  } catch (error: any) {
    console.error(`❌ Error checking ${address}:`, error.message)
    await notifyError(address, error.message)
  }
}

async function fetchActivity(address: string, limit: number): Promise<Activity[]> {
  const response = await fetch(
    `https://gamma-api.polymarket.com/activity?user=${address}&limit=${limit}&offset=0`
  )
  
  if (!response.ok) throw new Error(`Activity fetch failed: ${response.statusText}`)
  return response.json()
}

async function fetchClosedPositions(address: string, limit: number): Promise<ClosedPosition[]> {
  const response = await fetch(
    `https://gamma-api.polymarket.com/positions?user=${address}&limit=${limit}&offset=0&closed=true`
  )
  
  if (!response.ok) throw new Error(`Closed positions fetch failed: ${response.statusText}`)
  return response.json()
}

function matchResolvedBuysWithFilters(
  activity: Activity[], 
  closedPositions: ClosedPosition[],
  minTriggerAmount: number,
  minPrice: number,
  maxPrice: number
) {
  // Get only BUY trades from activity
  const allBuyTrades = activity.filter(a => a.type === 'TRADE' && a.side === 'BUY')
  
  // Remove duplicates
  const seenTrades = new Set<string>()
  const uniqueBuyTrades = allBuyTrades.filter(trade => {
    const uniqueKey = `${trade.transactionHash}-${trade.asset}-${trade.outcomeIndex || 0}`
    if (seenTrades.has(uniqueKey)) return false
    seenTrades.add(uniqueKey)
    return true
  })
  
  // Create a map of closed positions for quick lookup
  const closedMap = new Map<string, ClosedPosition>()
  closedPositions.forEach(pos => {
    if (pos.asset) closedMap.set(pos.asset, pos)
    if (pos.conditionId) closedMap.set(pos.conditionId, pos)
    if (pos.slug) closedMap.set(pos.slug, pos)
  })
  
  // Match buy trades with closed positions AND apply filters
  const resolvedTrades = uniqueBuyTrades
    .map(trade => {
      const closedPos = closedMap.get(trade.asset) || closedMap.get(trade.conditionId) || closedMap.get(trade.slug)
      if (!closedPos) return null
      
      const investment = trade.size * trade.price
      
      // Apply filters - skip trades that don't match
      if (investment < minTriggerAmount) return null
      if (trade.price < minPrice || trade.price > maxPrice) return null
      
      const roi = closedPos.totalBought > 0 
        ? (closedPos.realizedPnl / (closedPos.totalBought * closedPos.avgPrice)) * 100 
        : 0
      
      return {
        ...trade,
        resolved: true,
        won: closedPos.realizedPnl > 0,
        pnl: closedPos.realizedPnl,
        roi: roi,
        investment: investment
      }
    })
    .filter(t => t !== null)
  
  // Calculate stats
  const wins = resolvedTrades.filter(t => t.won).length
  const losses = resolvedTrades.length - wins
  const winRate = resolvedTrades.length > 0 ? (wins / resolvedTrades.length) * 100 : 0
  const totalPnL = resolvedTrades.reduce((sum, t) => sum + t.pnl, 0)
  const avgPnL = resolvedTrades.length > 0 ? totalPnL / resolvedTrades.length : 0
  
  return {
    trades: resolvedTrades,
    stats: {
      winRate,
      wins,
      losses,
      avgPnL,
      totalPnL
    }
  }
}
