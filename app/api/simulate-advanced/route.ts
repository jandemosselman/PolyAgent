import { NextRequest, NextResponse } from 'next/server'

interface PriceRange {
  min: number
  max: number
  label: string
}

interface SimulationConfig {
  traderAddress: string
  traderRank: number
  portfolioSize: number
  fixedTradeSize: number
  minTradeSize: number
  tradeLimit: number
}

interface Trade {
  id: string
  market: string
  asset: string
  type: string
  side: string
  size: string
  price: string
  timestamp: string
  feeRateBps: string
  title?: string
  slug?: string
  conditionId?: string
  outcomeIndex?: number
}

interface SimulationResult {
  traderAddress: string
  traderRank: number
  portfolioSize: number
  fixedTradeSize: number
  minTradeSize: number
  totalTrades: number
  profitableTrades: number
  totalProfit: number
  roi: number
  winRate: number
  maxDrawdown: number
  longestLossStreak: number
  longestWinStreak: number
  finalBalance: number
  wentBroke: boolean
}

export async function POST(request: NextRequest) {
  try {
    const config: SimulationConfig = await request.json()
    
    const { 
      traderAddress, 
      traderRank,
      portfolioSize,
      fixedTradeSize, 
      minTradeSize, 
      tradeLimit 
    } = config

    // Fetch trader's activity
    const activityResponse = await fetch(
      `https://data-api.polymarket.com/activity?user=${traderAddress}&limit=${tradeLimit}`,
      { headers: { 'Accept': 'application/json' } }
    )

    if (!activityResponse.ok) {
      throw new Error(`Failed to fetch activity: ${activityResponse.status}`)
    }

    const allTrades: Trade[] = await activityResponse.json()

    // Fetch closed positions for profitability
    const closedResponse = await fetch(
      `https://data-api.polymarket.com/closed-positions?user=${traderAddress}&limit=${tradeLimit}`,
      { headers: { 'Accept': 'application/json' } }
    )

    const closedPositions = closedResponse.ok ? await closedResponse.json() : []

    // Create a map of closed positions by asset and condition
    const closedMap = new Map()
    closedPositions.forEach((pos: any) => {
      const payload = {
        asset: pos.asset,
        conditionId: pos.conditionId,
        avgPrice: parseFloat(pos.avgPrice || '0'),
        totalBought: parseFloat(pos.totalBought || '0'),
        realizedPnl: parseFloat(pos.realizedPnl || '0'),
        curPrice: parseFloat(pos.curPrice || '0')
      }

      if (pos.asset) closedMap.set(pos.asset, payload)
      if (pos.conditionId) closedMap.set(pos.conditionId, payload)
      if (pos.slug) closedMap.set(pos.slug, payload)
    })

    console.log(`Trader ${traderAddress}: ${allTrades.length} trades, ${closedPositions.length} closed positions`)

    // Fetch market statuses for open positions
    const uniqueSlugs = [...new Set(allTrades.map(t => t.slug).filter(Boolean))] as string[]
    let marketStatuses: Record<string, any> = {}

    if (uniqueSlugs.length > 0) {
      try {
        const statusResponse = await fetch(`${request.nextUrl.origin}/api/market-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs: uniqueSlugs })
        })
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          marketStatuses = statusData.markets || {}
        }
      } catch (error) {
        console.error('Error fetching market statuses:', error)
      }
    }

    // Run simulation
    const result = runSimulation(
      allTrades,
      closedMap,
      marketStatuses,
      portfolioSize,
      fixedTradeSize,
      minTradeSize,
      traderAddress,
      traderRank
    )

    return NextResponse.json({ result })

  } catch (error) {
    console.error('Advanced simulation error:', error)
    return NextResponse.json(
      { error: 'Simulation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function runSimulation(
  allTrades: Trade[],
  closedMap: Map<string, any>,
  marketStatuses: Record<string, any>,
  portfolioSize: number,
  fixedTradeSize: number,
  minTradeSize: number,
  traderAddress: string,
  traderRank: number
): SimulationResult {
  
  let currentBalance = portfolioSize
  let totalProfit = 0
  let profitableTrades = 0
  let totalTrades = 0
  let maxBalance = portfolioSize
  let minBalance = portfolioSize
  let wentBroke = false
  
  let currentStreak = 0
  let longestLossStreak = 0
  let longestWinStreak = 0
  let tempLossStreak = 0
  let tempWinStreak = 0
  
  // Collect all buy trades chronologically to track streaks correctly across assets
  const allBuyTrades = allTrades
    .filter(t => t.side === 'BUY')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  console.log(`Processing ${allBuyTrades.length} buy trades chronologically for ${traderAddress}`)

  // Process trades
  allBuyTrades.forEach(buyTrade => {
      const asset = buyTrade.asset
      const buyPrice = parseFloat(buyTrade.price)
      const buySize = parseFloat(buyTrade.size)
      const invested = buyPrice * buySize

      // Apply filters
      if (minTradeSize > 0 && invested < minTradeSize) return

      // Check if we can afford this trade
      if (currentBalance < fixedTradeSize) {
        wentBroke = true
        return
      }

      // Scale investment to fixed size
      const actualInvested = fixedTradeSize
      
      // Determine outcome
  let profit = 0
  let won = false

      const closedKey = closedMap.get(asset) ||
        (buyTrade.conditionId ? closedMap.get(buyTrade.conditionId) : undefined) ||
        (buyTrade.slug ? closedMap.get(buyTrade.slug) : undefined)

      // PRIORITY 1: Closed positions (user exited)
      if (closedKey) {
        const totalBought = Number(closedKey.totalBought || 0)
        const realizedPnl = Number(closedKey.realizedPnl || 0)
        const avgPrice = Number(closedKey.avgPrice || 0)
        const curPrice = Number(closedKey.curPrice || 0)

        if (totalBought > 0) {
          const roi = realizedPnl / totalBought
          profit = actualInvested * roi
          won = profit > 0
        } else if (avgPrice > 0 && curPrice > 0) {
          const roi = (curPrice - avgPrice) / avgPrice
          profit = actualInvested * roi
          won = profit > 0
        } else {
          return
        }
      }
      // PRIORITY 2: Market resolution data (held to resolution)
      else if (buyTrade.slug && marketStatuses[buyTrade.slug]) {
        const marketData = marketStatuses[buyTrade.slug]

        let clobTokenIds = marketData.clobTokenIds
        let outcomePrices = marketData.outcomePrices

        if (typeof clobTokenIds === 'string') {
          try {
            clobTokenIds = JSON.parse(clobTokenIds)
          } catch (e) {
            clobTokenIds = []
          }
        }

        if (typeof outcomePrices === 'string') {
          try {
            outcomePrices = JSON.parse(outcomePrices)
          } catch (e) {
            outcomePrices = []
          }
        }

        const assetIndex = Array.isArray(clobTokenIds) ? clobTokenIds.findIndex((id: string) => id === asset) : -1
        if (assetIndex === -1 || !Array.isArray(outcomePrices)) {
          return
        }

        const payout = Number(outcomePrices[assetIndex])
        if (Number.isNaN(payout)) {
          return
        }

        // If market is closed, payout reflects resolution (1/0). If open, payout is current price.
        const returned = (actualInvested / buyPrice) * payout
        profit = returned - actualInvested
        won = profit > 0
      } else {
        return
      }

      // Update stats
      totalTrades++
      totalProfit += profit
      currentBalance += profit

      // Track streaks
      if (profit > 0) {
        profitableTrades++
        tempLossStreak = 0
        tempWinStreak++
        if (tempWinStreak > longestWinStreak) {
          longestWinStreak = tempWinStreak
        }
      } else {
        tempLossStreak++
        tempWinStreak = 0
        if (tempLossStreak > longestLossStreak) {
          longestLossStreak = tempLossStreak
        }
      }

      if (currentBalance > maxBalance) maxBalance = currentBalance
      if (currentBalance < minBalance) minBalance = currentBalance

      if (currentBalance <= 0) {
        wentBroke = true
      }
  })

  const roi = portfolioSize > 0 ? ((currentBalance - portfolioSize) / portfolioSize) * 100 : 0
  const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0
  const maxDrawdown = maxBalance - minBalance

  console.log(`📊 Final Stats: ${totalTrades} trades, ${profitableTrades} wins, Win Streak: ${longestWinStreak}, Loss Streak: ${longestLossStreak}`)

  return {
    traderAddress,
    traderRank,
    portfolioSize,
    fixedTradeSize,
    minTradeSize,
    totalTrades,
    profitableTrades,
    totalProfit,
    roi,
    winRate,
    maxDrawdown,
    longestLossStreak,
    longestWinStreak,
    finalBalance: currentBalance,
    wentBroke
  }
}
