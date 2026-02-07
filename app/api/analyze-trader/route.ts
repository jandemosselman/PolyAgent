import { NextRequest, NextResponse } from 'next/server'

export interface PriceRangeStats {
  range: string
  minPrice: number
  maxPrice: number
  winRate: number
  avgROI: number
  totalTrades: number
  wins: number
  losses: number
}

export interface StreakAnalysis {
  longestWinStreak: number
  longestLossStreak: number
  currentStreak: number
  currentStreakType: 'win' | 'loss' | 'none'
  avgWinStreak: number
  avgLossStreak: number
  streakStability: number // 0-100, higher = fewer long loss streaks
}

export interface TraderAnalysis {
  address: string
  username?: string
  profileImage?: string
  
  // Core metrics
  winRate: number
  avgROI: number
  totalPnl: number
  avgBuyPrice: number
  tradesPerDay: number
  biggestWin: number
  totalMarkets: number
  
  // Consistency score (0-100)
  consistencyScore: number
  
  // Streak analysis
  streakAnalysis: StreakAnalysis
  
  // Data quality
  closedPositionsAnalyzed: number
  activitiesAnalyzed: number
  
  // Recent activity
  lastTradeTimestamp: number | null
  daysSinceLastTrade: number | null
  
  // Status
  isActive: boolean
  
  // Price range analysis
  priceRangeStats: PriceRangeStats[]
  
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, closedLimit = 500, activityLimit = 200 } = body

    if (!address) {
      return NextResponse.json(
        { error: 'Trader address is required' },
        { status: 400 }
      )
    }

    console.log(`\n🔍 Analyzing trader: ${address}`)
    console.log(`📊 Fetching ${closedLimit} closed positions and ${activityLimit} activities`)

    // Fetch all data in parallel
    const [profileRes, closedRes, activityRes, tradedRes] = await Promise.all([
      fetch(`${request.nextUrl.origin}/api/profile?address=${address}`),
      fetch(`${request.nextUrl.origin}/api/closed-positions?user=${address}&limit=${closedLimit}&sortBy=TIMESTAMP&sortDirection=DESC`),
      fetch(`${request.nextUrl.origin}/api/activity?user=${address}&limit=${activityLimit}&sortBy=TIMESTAMP&sortDirection=DESC`),
      fetch(`${request.nextUrl.origin}/api/traded?user=${address}`)
    ])

    const profile = profileRes.ok ? await profileRes.json() : null
    const closedPositions = closedRes.ok ? await closedRes.json() : []
    const activity = activityRes.ok ? await activityRes.json() : []
    const tradedData = tradedRes.ok ? await tradedRes.json() : { traded: 0 }

    console.log(`✅ Fetched: ${closedPositions.length} closed, ${activity.length} activities`)

    // Calculate Win Rate
    const wins = closedPositions.filter((p: any) => (p.realizedPnl || 0) > 0).length
    const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0

    // Calculate Avg ROI
    const rois = closedPositions.map((p: any) => {
      const investment = (p.totalBought || 0) * (p.avgPrice || 0)
      if (!investment || investment === 0) return 0
      return ((p.realizedPnl || 0) / investment) * 100
    }).filter((roi: number) => !isNaN(roi) && isFinite(roi))
    const avgROI = rois.length > 0 ? rois.reduce((a: number, b: number) => a + b, 0) / rois.length : 0

    // Calculate Total PNL
    const totalPnl = closedPositions.reduce((acc: number, p: any) => acc + (p.realizedPnl || 0), 0)

    // Calculate Biggest Win
    const biggestWin = closedPositions.length > 0
      ? Math.max(...closedPositions.map((p: any) => p.realizedPnl || 0))
      : 0

    // Calculate Avg Buy Price
    const buyTrades = activity.filter((a: any) => a.type === 'TRADE' && a.side === 'BUY' && a.price)
    const avgBuyPrice = buyTrades.length > 0
      ? buyTrades.reduce((acc: number, t: any) => acc + (t.price || 0), 0) / buyTrades.length
      : 0

    // Calculate Trades Per Day
    const trades = activity.filter((a: any) => a.type === 'TRADE' && a.timestamp)
    let tradesPerDay = 0
    if (trades.length > 1) {
      const sortedTrades = [...trades].sort((a: any, b: any) => a.timestamp - b.timestamp)
      const firstTimestamp = sortedTrades[0].timestamp
      const lastTimestamp = sortedTrades[sortedTrades.length - 1].timestamp
      const daysDiff = (lastTimestamp - firstTimestamp) / (60 * 60 * 24)
      if (daysDiff >= 0.1) {
        tradesPerDay = trades.length / daysDiff
      }
    }

    // Last Trade Info
    const lastTradeTimestamp = trades.length > 0 ? Math.max(...trades.map((t: any) => t.timestamp)) : null
    const daysSinceLastTrade = lastTradeTimestamp
      ? (Date.now() / 1000 - lastTradeTimestamp) / (60 * 60 * 24)
      : null

    // Is Active (traded in last 7 days)
    const isActive = daysSinceLastTrade !== null && daysSinceLastTrade <= 7

    // Calculate Streak Analysis
    // Sort closed positions chronologically
    const sortedPositions = [...closedPositions].sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0))
    
    let currentStreak = 0
    let currentStreakType: 'win' | 'loss' | 'none' = 'none'
    let longestWinStreak = 0
    let longestLossStreak = 0
    let tempWinStreak = 0
    let tempLossStreak = 0
    let winStreaks: number[] = []
    let lossStreaks: number[] = []

    sortedPositions.forEach((position: any, index: number) => {
      const pnl = position.realizedPnl || 0
      const isWin = pnl > 0

      if (isWin) {
        tempWinStreak++
        if (tempLossStreak > 0) {
          lossStreaks.push(tempLossStreak)
          longestLossStreak = Math.max(longestLossStreak, tempLossStreak)
          tempLossStreak = 0
        }
      } else {
        tempLossStreak++
        if (tempWinStreak > 0) {
          winStreaks.push(tempWinStreak)
          longestWinStreak = Math.max(longestWinStreak, tempWinStreak)
          tempWinStreak = 0
        }
      }

      // Update current streak (last position)
      if (index === sortedPositions.length - 1) {
        if (tempWinStreak > 0) {
          currentStreak = tempWinStreak
          currentStreakType = 'win'
          winStreaks.push(tempWinStreak)
          longestWinStreak = Math.max(longestWinStreak, tempWinStreak)
        } else if (tempLossStreak > 0) {
          currentStreak = tempLossStreak
          currentStreakType = 'loss'
          lossStreaks.push(tempLossStreak)
          longestLossStreak = Math.max(longestLossStreak, tempLossStreak)
        }
      }
    })

    const avgWinStreak = winStreaks.length > 0 
      ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length 
      : 0
    
    const avgLossStreak = lossStreaks.length > 0
      ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length
      : 0

    // Streak Stability Score (0-100)
    // Lower loss streaks and higher win streaks = better
    // Penalize long loss streaks heavily
    const maxLossStreakPenalty = longestLossStreak > 10 ? 0 : (1 - longestLossStreak / 10)
    const avgLossStreakBonus = avgLossStreak < 3 ? 1 : Math.max(0, 1 - (avgLossStreak - 3) / 7)
    const winStreakBonus = Math.min(avgWinStreak / 5, 1) // Cap at 5
    
    const streakStability = (
      (maxLossStreakPenalty * 0.5) + 
      (avgLossStreakBonus * 0.3) + 
      (winStreakBonus * 0.2)
    ) * 100

    const streakAnalysis: StreakAnalysis = {
      longestWinStreak,
      longestLossStreak,
      currentStreak,
      currentStreakType,
      avgWinStreak,
      avgLossStreak,
      streakStability
    }

    // Calculate Consistency Score (0-100)
    const normalizedWinRate = Math.min(winRate / 100, 1) // 0-1
    const normalizedROI = Math.min(Math.max(avgROI / 100, 0), 1) // 0-1 (cap at 100%)
    const normalizedTradesPerDay = Math.min(tradesPerDay / 10, 1) // 0-1 (10+ trades/day = max)
    const normalizedTotalMarkets = Math.min(tradedData.traded / 100, 1) // 0-1 (100+ markets = max)
    const normalizedRecency = isActive ? 1 : Math.max(1 - (daysSinceLastTrade || 30) / 30, 0) // 0-1

    const consistencyScore = (
      (normalizedWinRate * 0.3) +
      (normalizedROI * 0.3) +
      (normalizedTradesPerDay * 0.2) +
      (normalizedTotalMarkets * 0.1) +
      (normalizedRecency * 0.1)
    ) * 100

    // Calculate Price Range Statistics
    const priceRanges = [
      { range: '$0.01-$0.10', min: 0.01, max: 0.10 },
      { range: '$0.11-$0.20', min: 0.11, max: 0.20 },
      { range: '$0.21-$0.30', min: 0.21, max: 0.30 },
      { range: '$0.31-$0.40', min: 0.31, max: 0.40 },
      { range: '$0.41-$0.50', min: 0.41, max: 0.50 },
      { range: '$0.51-$0.60', min: 0.51, max: 0.60 },
      { range: '$0.61-$0.70', min: 0.61, max: 0.70 },
      { range: '$0.71-$0.80', min: 0.71, max: 0.80 },
      { range: '$0.81-$0.90', min: 0.81, max: 0.90 },
      { range: '$0.91-$1.00', min: 0.91, max: 1.00 }
    ]

    const priceRangeStats: PriceRangeStats[] = priceRanges.map(({ range, min, max }) => {
      const positionsInRange = closedPositions.filter((p: any) => {
        const price = p.avgPrice || 0
        return price >= min && price <= max
      })

      const winsInRange = positionsInRange.filter((p: any) => (p.realizedPnl || 0) > 0).length
      const lossesInRange = positionsInRange.filter((p: any) => (p.realizedPnl || 0) <= 0).length
      const winRateInRange = positionsInRange.length > 0 ? (winsInRange / positionsInRange.length) * 100 : 0

      const roisInRange = positionsInRange.map((p: any) => {
        const investment = (p.totalBought || 0) * (p.avgPrice || 0)
        if (!investment || investment === 0) return 0
        return ((p.realizedPnl || 0) / investment) * 100
      }).filter((roi: number) => !isNaN(roi) && isFinite(roi))

      const avgROIInRange = roisInRange.length > 0
        ? roisInRange.reduce((a: number, b: number) => a + b, 0) / roisInRange.length
        : 0

      return {
        range,
        minPrice: min,
        maxPrice: max,
        winRate: winRateInRange,
        avgROI: avgROIInRange,
        totalTrades: positionsInRange.length,
        wins: winsInRange,
        losses: lossesInRange
      }
    })

    const analysis: TraderAnalysis = {
      address,
      username: profile?.username,
      profileImage: profile?.optimized_profile_picture || profile?.profile_picture,
      
      winRate,
      avgROI,
      totalPnl,
      avgBuyPrice,
      tradesPerDay,
      biggestWin,
      totalMarkets: tradedData.traded,
      
      consistencyScore,
      streakAnalysis,
      
      closedPositionsAnalyzed: closedPositions.length,
      activitiesAnalyzed: activity.length,
      
      lastTradeTimestamp,
      daysSinceLastTrade,
      
      isActive,
      
      priceRangeStats
    }

    console.log(`✨ Analysis complete: ${analysis.username || address}`)
    console.log(`   Win Rate: ${winRate.toFixed(1)}% | Avg ROI: ${avgROI.toFixed(1)}% | Consistency: ${consistencyScore.toFixed(0)}`)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error analyzing trader:', error)
    return NextResponse.json(
      { error: 'Failed to analyze trader' },
      { status: 500 }
    )
  }
}
