'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Activity {
  id: string
  user: string
  type: string
  side: string
  asset: string
  conditionId: string
  title: string
  outcome: string
  outcomeIndex: number
  price: number
  size: number
  usdcSize: number
  timestamp: number
  transactionHash: string
  slug?: string
  eventSlug?: string
  icon?: string
  proxyWallet?: string
  name?: string
  pseudonym?: string
  profileImage?: string
  // Legacy fields (keeping for backwards compatibility)
  marketId?: string
  assetId?: string
  marketQuestion?: string
  outcomeTitle?: string
  value?: number
  feeAmount?: number
}

interface ClosedPosition {
  id?: string
  asset: string
  conditionId: string
  title: string
  outcome: string
  outcomeIndex: number
  avgPrice: number
  totalBought: number
  totalSold?: number
  realizedPnl: number
  timestamp: number
  closedAt?: number
  slug?: string
  eventSlug?: string
  curPrice?: number
  oppositeAsset?: string
  oppositeOutcome?: string
  proxyWallet?: string
  // Legacy fields
  marketId?: string
  assetId?: string
  marketQuestion?: string
  outcomeTitle?: string
}

interface SimulationResult {
  totalTrades: number
  copiedTrades: number
  totalInvested: number
  totalReturned: number
  netProfit: number
  roi: number
  winRate: number
  wins: number
  losses: number
  avgWin: number
  avgLoss: number
  biggestWin: number
  biggestLoss: number
  oldestTradeDate: number
  newestTradeDate: number
  startingBalance: number
  endingBalance: number
  maxBalance: number
  minBalance: number
  wentBroke: boolean
  brokeAtTrade: number | null
  portfolioHistory: Array<{
    tradeIndex: number
    timestamp: number
    balance: number
    tradeProfit: number
    tradeName: string
  }>
  trades: Array<{
    activity: Activity
    closedPosition: ClosedPosition | null
    buyPrice: number
    avgExitPrice: number | null
    invested: number
    returned: number
    profit: number
    roi: number
    status: 'win' | 'loss' | 'open'
    balanceAfter: number
    couldNotAfford: boolean
  }>
}

export default function SimulatorPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [priceMin, setPriceMin] = useState(0.01)
  const [priceMax, setPriceMax] = useState(1.00)
  const [investmentPerTrade, setInvestmentPerTrade] = useState(100)
  const [closedLimit, setClosedLimit] = useState(1000)
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d' | '30d' | '90d' | '1y'>('all')
  const [minTradeSize, setMinTradeSize] = useState(0)
  const [portfolioMode, setPortfolioMode] = useState(false)
  const [startingBalance, setStartingBalance] = useState(100)
  const [result, setResult] = useState<SimulationResult | null>(null)

  const runSimulation = async () => {
    if (!address) {
      alert('Please enter a trader address')
      return
    }

    setLoading(true)
    setResult(null)
    setLoadingStatus('Fetching trader data...')

    try {
      console.log(`🎮 Running simulation for ${address}`)
      console.log(`📊 Price range: $${priceMin} - $${priceMax}`)
      console.log(`💰 Investment per trade: $${investmentPerTrade}`)
      console.log(`📈 Fetching data...`)

      // Fetch both activity feed AND closed positions in parallel
      const [activityRes, closedRes] = await Promise.all([
        fetch(`/api/activity?user=${address}&limit=${closedLimit}`),
        fetch(`/api/closed-positions?user=${address}&limit=${closedLimit}`)
      ])

      if (!activityRes.ok || !closedRes.ok) throw new Error('Failed to fetch data')

      const allActivity: Activity[] = await activityRes.json()
      const closedPositions: ClosedPosition[] = await closedRes.json()
      
      console.log(`✅ Fetched ${allActivity.length} activity items and ${closedPositions.length} closed positions`)
      
      // Log sample data to see structure
      if (allActivity.length > 0) {
        console.log('Sample activity fields:', Object.keys(allActivity[0]))
        console.log('Sample activity data:', JSON.stringify(allActivity[0], null, 2))
      }
      if (closedPositions.length > 0) {
        console.log('Sample closed position fields:', Object.keys(closedPositions[0]))
        console.log('Sample closed position data:', JSON.stringify(closedPositions[0], null, 2))
      }

      // Filter for BUY trades only (these are what we'd copy)
      const buyTrades = allActivity.filter((a) => a.type === 'TRADE' && a.side === 'BUY')
      console.log(`✅ Found ${buyTrades.length} BUY trades`)

      // Calculate time filter cutoff
      const now = Date.now() / 1000 // Convert to seconds
      let timeFilterCutoff = 0
      
      switch (timeFilter) {
        case '24h':
          timeFilterCutoff = now - (24 * 60 * 60)
          break
        case '7d':
          timeFilterCutoff = now - (7 * 24 * 60 * 60)
          break
        case '30d':
          timeFilterCutoff = now - (30 * 24 * 60 * 60)
          break
        case '90d':
          timeFilterCutoff = now - (90 * 24 * 60 * 60)
          break
        case '1y':
          timeFilterCutoff = now - (365 * 24 * 60 * 60)
          break
        default:
          timeFilterCutoff = 0
      }

      console.log(`⏰ Time filter: ${timeFilter} (cutoff: ${timeFilterCutoff > 0 ? new Date(timeFilterCutoff * 1000).toISOString() : 'none'})`)

      // Filter BUY trades by price range, time, AND minimum trade size
      const filteredBuyTrades = buyTrades.filter((trade) => {
        const tradeValue = trade.size * trade.price // Total $ value of the trade
        return trade.price >= priceMin && 
               trade.price <= priceMax && 
               (timeFilterCutoff === 0 || trade.timestamp >= timeFilterCutoff) &&
               tradeValue >= minTradeSize
      })
      console.log(`✅ ${filteredBuyTrades.length} BUY trades match all filters (price, time, min size: $${minTradeSize})`)

      if (filteredBuyTrades.length === 0) {
        alert(`No BUY trades found in price range $${priceMin}-$${priceMax} for selected time period`)
        setLoading(false)
        return
      }

      // Sort trades chronologically for portfolio simulation
      const sortedBuyTrades = [...filteredBuyTrades].sort((a, b) => a.timestamp - b.timestamp)

      // Fetch market statuses from our backend API (to avoid CORS)
      console.log('🔍 Fetching market statuses via backend API...')
      
      // Check how many trades have slugs
      const tradesWithSlugs = sortedBuyTrades.filter(t => t.slug || t.eventSlug)
      const tradesWithoutSlugs = sortedBuyTrades.filter(t => !t.slug && !t.eventSlug)
      console.log(`📊 ${tradesWithSlugs.length} trades have slugs, ${tradesWithoutSlugs.length} missing slugs`)
      
      if (tradesWithoutSlugs.length > 0) {
        console.log('⚠️ Sample trade without slug:', {
          title: tradesWithoutSlugs[0].title,
          asset: tradesWithoutSlugs[0].asset,
          conditionId: tradesWithoutSlugs[0].conditionId,
          allFields: Object.keys(tradesWithoutSlugs[0])
        })
      }
      
      // Group by slug (multiple trades can be on same market)
      const uniqueSlugs = [...new Set(sortedBuyTrades.map(t => t.slug || t.eventSlug).filter(Boolean))] as string[]
      setLoadingStatus(`Checking ${uniqueSlugs.length} market statuses...`)
      
      // Call our backend API to fetch market data (avoids CORS issues)
      const marketStatusResponse = await fetch('/api/market-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: uniqueSlugs })
      })
      
      if (!marketStatusResponse.ok) {
        console.error('Failed to fetch market statuses from backend')
        throw new Error('Market status fetch failed')
      }
      
      const { markets } = await marketStatusResponse.json()
      const marketStatusMap = new Map<string, any>(Object.entries(markets))
      
      // Also create conditionId lookup map
      const conditionIdToSlugMap = new Map<string, string>()
      Object.entries(markets).forEach(([slug, data]: [string, any]) => {
        if (data?.conditionId) {
          conditionIdToSlugMap.set(data.conditionId, slug)
        }
      })
      
      console.log(`✅ Fetched ${marketStatusMap.size} market statuses from ${uniqueSlugs.length} unique slugs`)

      // Portfolio simulation variables
      let currentBalance = portfolioMode ? startingBalance : Infinity
      let maxBalance = currentBalance
      let minBalance = currentBalance
      let wentBroke = false
      let brokeAtTrade: number | null = null
      const portfolioHistory: Array<{
        tradeIndex: number
        timestamp: number
        balance: number
        tradeProfit: number
        tradeName: string
      }> = []

      // For each filtered BUY trade, find the corresponding closed position OR check market status
      const simulatedTrades = sortedBuyTrades.map((buyTrade, index) => {
        // Find closed position by matching the asset token ID
        const closedPosition = closedPositions.find((cp: any) => {
          return cp.asset === buyTrade.asset
        })

        // Get market data from Gamma API using slug or conditionId
        const tradeSlug = buyTrade.slug || buyTrade.eventSlug
        let marketData = tradeSlug ? marketStatusMap.get(tradeSlug) : null
        
        // If no slug or no data found, try looking up by conditionId
        if (!marketData && buyTrade.conditionId) {
          const slugFromConditionId = conditionIdToSlugMap.get(buyTrade.conditionId)
          if (slugFromConditionId) {
            marketData = marketStatusMap.get(slugFromConditionId)
          }
        }
        
        const isMarketClosed = marketData?.closed === true || marketData?.active === false

        if (closedPosition) {
          console.log(`✅ Matched BUY trade to closed position:`, {
            asset: buyTrade.asset,
            slug: tradeSlug,
            market: buyTrade.title?.substring(0, 50),
            outcome: buyTrade.outcome
          })
        } else if (isMarketClosed) {
          console.log(`⚠️ Market is closed but no position data found (trader held to end):`, {
            asset: buyTrade.asset,
            slug: tradeSlug,
            market: buyTrade.title?.substring(0, 50),
            closed: marketData?.closed,
            active: marketData?.active
          })
        } else if (!tradeSlug) {
          console.log(`❌ Trade has NO SLUG - cannot verify market status:`, {
            asset: buyTrade.asset,
            conditionId: buyTrade.conditionId,
            market: buyTrade.title?.substring(0, 50),
            hasMarketData: !!marketData
          })
        } else if (!marketData) {
          console.log(`❌ Could not fetch market data for slug:`, {
            slug: tradeSlug,
            market: buyTrade.title?.substring(0, 50)
          })
        }

        const buyPrice = buyTrade.price
        let invested = investmentPerTrade
        
        let avgExitPrice: number | null = null
        let returned = 0
        let profit = 0
        let roi = 0
        let status: 'win' | 'loss' | 'open' = 'open'
        let couldNotAfford = false
        let balanceAfter = currentBalance

        // Determine if this position is truly open or closed
        const isTrulyOpen = !closedPosition && !isMarketClosed

        // Portfolio mode: check if we can afford this trade
        if (portfolioMode) {
          if (currentBalance >= invested && !wentBroke) {
            // Can afford this trade
            couldNotAfford = false
          } else {
            // Cannot afford
            couldNotAfford = true
            if (!wentBroke) {
              wentBroke = true
              brokeAtTrade = index
            }
          }
        }

        // Calculate trade results if we could afford it
        if (!couldNotAfford) {
          if (closedPosition) {
            // Position was closed - calculate based on actual results
            const originalInvestment = closedPosition.totalBought * closedPosition.avgPrice
            const originalROI = originalInvestment > 0 
              ? (closedPosition.realizedPnl / originalInvestment) * 100 
              : 0

            // Calculate average exit price from the closed position data
            if (closedPosition.totalSold && closedPosition.totalSold > 0) {
              avgExitPrice = (originalInvestment + closedPosition.realizedPnl) / closedPosition.totalSold
            }

            // Apply the trader's actual ROI to our investment
            roi = originalROI
            profit = (invested * roi) / 100
            returned = invested + profit
            status = profit > 0 ? 'win' : 'loss'

            // Update portfolio balance
            if (portfolioMode) {
              currentBalance = currentBalance - invested + returned
              balanceAfter = currentBalance
              
              // Track max/min
              if (currentBalance > maxBalance) maxBalance = currentBalance
              if (currentBalance < minBalance) minBalance = currentBalance

              // Add to portfolio history
              portfolioHistory.push({
                tradeIndex: index,
                timestamp: buyTrade.timestamp,
                balance: currentBalance,
                tradeProfit: profit,
                tradeName: buyTrade.title || 'Unknown Market'
              })

              // Check if broke after this trade
              if (currentBalance < invested && !wentBroke) {
                wentBroke = true
                brokeAtTrade = index + 1
              }
            }
          } else if (isMarketClosed && marketData) {
            // Market is closed but trader didn't sell - they held to resolution
            // Parse outcomes if it's a JSON string
            let outcomes = marketData.outcomes
            if (typeof outcomes === 'string') {
              try {
                outcomes = JSON.parse(outcomes)
              } catch (e) {
                console.warn('Failed to parse outcomes:', outcomes)
                outcomes = []
              }
            }
            
            // Check the winning outcome from market data
            const winningOutcome = Array.isArray(outcomes) 
              ? outcomes.find((o: any) => o.winner === true)
              : null
            
            if (winningOutcome) {
              // Did the trader buy the winning outcome?
              const traderWon = buyTrade.outcome === winningOutcome.outcome || 
                                buyTrade.outcome === winningOutcome.title
              
              if (traderWon) {
                // Trader held winning position - gets $1 per share
                avgExitPrice = 1.00
                returned = (invested / buyPrice) * 1.00 // Shares bought * $1
                profit = returned - invested
                roi = (profit / invested) * 100
                status = 'win'
              } else {
                // Trader held losing position - gets $0
                avgExitPrice = 0.00
                returned = 0
                profit = -invested
                roi = -100
                status = 'loss'
              }

              // Update portfolio balance
              if (portfolioMode) {
                currentBalance = currentBalance - invested + returned
                balanceAfter = currentBalance
                
                if (currentBalance > maxBalance) maxBalance = currentBalance
                if (currentBalance < minBalance) minBalance = currentBalance

                portfolioHistory.push({
                  tradeIndex: index,
                  timestamp: buyTrade.timestamp,
                  balance: currentBalance,
                  tradeProfit: profit,
                  tradeName: buyTrade.title || 'Unknown Market'
                })

                if (currentBalance < invested && !wentBroke) {
                  wentBroke = true
                  brokeAtTrade = index + 1
                }
              }
            } else {
              // Market closed but can't determine winner - mark as unknown loss
              status = 'loss'
              profit = -invested
              roi = -100
              returned = 0
              
              // Update portfolio balance for this loss
              if (portfolioMode) {
                currentBalance = currentBalance - invested + returned // returned is 0, so just lose investment
                balanceAfter = currentBalance
                
                if (currentBalance < minBalance) minBalance = currentBalance

                portfolioHistory.push({
                  tradeIndex: index,
                  timestamp: buyTrade.timestamp,
                  balance: currentBalance,
                  tradeProfit: profit,
                  tradeName: buyTrade.title || 'Unknown Market'
                })

                if (currentBalance < invested && !wentBroke) {
                  wentBroke = true
                  brokeAtTrade = index + 1
                }
              }
            }
          } else if (isTrulyOpen) {
            // Truly open position - in portfolio mode, still deduct investment
            if (portfolioMode) {
              currentBalance = currentBalance - invested
              balanceAfter = currentBalance
              
              if (currentBalance < minBalance) minBalance = currentBalance

              portfolioHistory.push({
                tradeIndex: index,
                timestamp: buyTrade.timestamp,
                balance: currentBalance,
                tradeProfit: 0,
                tradeName: buyTrade.title || 'Unknown Market'
              })
            }
          }
        } else {
          // Couldn't afford this trade - zero out all values
          invested = 0
          returned = 0
          profit = 0
          roi = 0
        }

        return {
          activity: buyTrade,
          closedPosition: closedPosition || null,
          buyPrice,
          avgExitPrice,
          invested,
          returned,
          profit,
          roi,
          status,
          balanceAfter,
          couldNotAfford
        }
      })

      // Filter out open positions for stats (only count closed trades)
      // In portfolio mode, also filter out trades we couldn't afford
      const affordableTrades = portfolioMode 
        ? simulatedTrades.filter(t => !t.couldNotAfford)
        : simulatedTrades
      
      const closedTrades = affordableTrades.filter(t => t.status !== 'open')
      const openTrades = affordableTrades.filter(t => t.status === 'open')

      console.log(`📊 Simulation summary:`)
      console.log(`   Total BUY trades in filters: ${filteredBuyTrades.length}`)
      console.log(`   Matched to closed positions: ${closedTrades.length}`)
      console.log(`   Still open (no match): ${openTrades.length}`)
      if (portfolioMode) {
        const couldntAfford = simulatedTrades.filter(t => t.couldNotAfford).length
        console.log(`   Couldn't afford: ${couldntAfford}`)
      }
      if (openTrades.length > 0) {
        console.log(`   Sample open trade:`, {
          market: openTrades[0].activity.marketQuestion?.substring(0, 50),
          outcome: openTrades[0].activity.outcomeTitle,
          marketId: openTrades[0].activity.marketId,
          assetId: openTrades[0].activity.assetId
        })
      }

      // Calculate aggregate results - only from trades we could afford
      const totalInvested = closedTrades.reduce((sum, t) => sum + t.invested, 0)
      const totalReturned = closedTrades.reduce((sum, t) => sum + t.returned, 0)
      const netProfit = totalReturned - totalInvested
      const overallROI = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0

      const wins = closedTrades.filter((t) => t.profit > 0)
      const losses = closedTrades.filter((t) => t.profit <= 0)
      const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0

      const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length : 0
      const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.profit, 0) / losses.length : 0

      const biggestWin = closedTrades.length > 0 ? Math.max(...closedTrades.map((t) => t.profit)) : 0
      const biggestLoss = closedTrades.length > 0 ? Math.min(...closedTrades.map((t) => t.profit)) : 0

      // Get date range of simulated trades
      const oldestTradeDate = filteredBuyTrades.length > 0 
        ? Math.min(...filteredBuyTrades.map(t => t.timestamp))
        : now
      const newestTradeDate = filteredBuyTrades.length > 0 
        ? Math.max(...filteredBuyTrades.map(t => t.timestamp))
        : now

      const simulationResult: SimulationResult = {
        totalTrades: buyTrades.length,
        copiedTrades: portfolioMode 
          ? affordableTrades.length // In portfolio mode, show how many we could actually afford
          : filteredBuyTrades.length, // In regular mode, show all filtered trades
        totalInvested,
        totalReturned,
        netProfit,
        roi: overallROI,
        winRate,
        wins: wins.length,
        losses: losses.length,
        avgWin,
        avgLoss,
        biggestWin,
        biggestLoss,
        oldestTradeDate,
        newestTradeDate,
        startingBalance: portfolioMode ? startingBalance : 0,
        endingBalance: portfolioMode ? currentBalance : 0,
        maxBalance: portfolioMode ? maxBalance : 0,
        minBalance: portfolioMode ? minBalance : 0,
        wentBroke,
        brokeAtTrade,
        portfolioHistory,
        trades: portfolioMode 
          ? simulatedTrades // Keep chronological order in portfolio mode
          : simulatedTrades.sort((a, b) => b.profit - a.profit) // Sort by profit in regular mode
      }

      setResult(simulationResult)
      console.log('✅ Simulation complete:', simulationResult)
    } catch (error) {
      console.error('Simulation error:', error)
      alert('Failed to run simulation. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                🎮 Copy Trading Simulator
              </h1>
              <p className="text-slate-400 mt-1 text-sm">Backtest your copy trading strategy with historical data</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 rounded-lg text-slate-300 transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Panel */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Simulation Parameters</h2>

          {/* Trader Address */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Trader Address to Simulate
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x1234567890abcdef..."
              className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Minimum Price (Copy Only Above)
              </label>
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(Number(e.target.value))}
                min="0.01"
                max="1.00"
                step="0.01"
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Maximum Price (Copy Only Below)
              </label>
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                min="0.01"
                max="1.00"
                step="0.01"
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Investment & Data Size */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Investment Per Trade ($)
              </label>
              <input
                type="number"
                value={investmentPerTrade}
                onChange={(e) => setInvestmentPerTrade(Number(e.target.value))}
                min="1"
                step="10"
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Min Trade Size ($)
              </label>
              <input
                type="number"
                value={minTradeSize}
                onChange={(e) => setMinTradeSize(Number(e.target.value))}
                min="0"
                step="50"
                placeholder="0 = All trades"
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">Skip small test trades</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Historical Trades to Analyze
              </label>
              <select
                value={closedLimit}
                onChange={(e) => setClosedLimit(Number(e.target.value))}
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={5000}>5000</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Time Period Filter
              </label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>
            </div>
          </div>

          {/* Portfolio Mode Toggle */}
          <div className="mb-6 bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
                  <span>💰 Portfolio Mode</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Realistic Simulation</span>
                </label>
                <p className="text-xs text-slate-500 mt-1">Simulate with limited starting capital - see how your portfolio would perform</p>
              </div>
              <button
                onClick={() => setPortfolioMode(!portfolioMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  portfolioMode ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    portfolioMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {portfolioMode && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Starting Balance ($)
                </label>
                <input
                  type="number"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(Number(e.target.value))}
                  min="1"
                  step="10"
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="How much capital do you start with?"
                />
                <p className="text-xs text-slate-500 mt-2">
                  ⚠️ Portfolio mode simulates sequential trading with limited capital. 
                  You may not be able to copy all trades if your balance runs low.
                </p>
              </div>
            )}
          </div>

          {/* Min Trade Size Presets */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-3">Quick Min Trade Size Presets</label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { label: 'All Trades', value: 0 },
                { label: '$50+', value: 50 },
                { label: '$100+', value: 100 },
                { label: '$250+', value: 250 },
                { label: '$500+', value: 500 },
                { label: '$1000+', value: 1000 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setMinTradeSize(preset.value)}
                  className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                    minTradeSize === preset.value
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50 text-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Price Range Presets */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-3">Quick Price Range Presets</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { label: '$0.01-$0.10', min: 0.01, max: 0.10 },
                { label: '$0.11-$0.20', min: 0.11, max: 0.20 },
                { label: '$0.21-$0.30', min: 0.21, max: 0.30 },
                { label: '$0.31-$0.50', min: 0.31, max: 0.50 },
                { label: '$0.51-$0.70', min: 0.51, max: 0.70 },
                { label: '$0.71-$0.90', min: 0.71, max: 0.90 },
                { label: '$0.40-$0.60', min: 0.40, max: 0.60 },
                { label: '$0.50-$0.50', min: 0.50, max: 0.50 },
                { label: 'All Prices', min: 0.01, max: 1.00 },
                { label: 'Underdogs', min: 0.01, max: 0.30 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setPriceMin(preset.min)
                    setPriceMax(preset.max)
                  }}
                  className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg text-slate-300 text-sm transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={runSimulation}
            disabled={loading || !address}
            className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? `⏳ ${loadingStatus || 'Running Simulation...'}` : '🎮 Run Simulation'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Date Range Info Banner */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-slate-300 font-medium mb-1">📅 Simulation Data Range</p>
                  <p className="text-slate-400 text-sm">
                    {formatDate(result.oldestTradeDate)} → {formatDate(result.newestTradeDate)}
                    {' '}
                    <span className="text-cyan-400">
                      ({Math.ceil((result.newestTradeDate - result.oldestTradeDate) / (24 * 60 * 60))} days of trading history)
                    </span>
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Price Range</p>
                    <p className="text-slate-200 font-mono font-semibold">${priceMin.toFixed(2)} - ${priceMax.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Min Trade Size</p>
                    <p className="text-slate-200 font-semibold">{minTradeSize === 0 ? 'All' : `$${minTradeSize}+`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Time Filter</p>
                    <p className="text-slate-200 font-semibold">
                      {timeFilter === 'all' ? 'All Time' :
                       timeFilter === '24h' ? 'Last 24h' :
                       timeFilter === '7d' ? 'Last 7 Days' :
                       timeFilter === '30d' ? 'Last 30 Days' :
                       timeFilter === '90d' ? 'Last 90 Days' : 'Last Year'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Per Trade</p>
                    <p className="text-emerald-400 font-semibold">${investmentPerTrade}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Portfolio Mode Alert */}
            {result.wentBroke && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💥</span>
                  <div>
                    <p className="text-red-400 font-semibold mb-1">Portfolio Went Broke!</p>
                    <p className="text-slate-300 text-sm">
                      Your portfolio ran out of money at trade #{result.brokeAtTrade} and couldn't afford to continue copy trading.
                    </p>
                    <p className="text-slate-400 text-xs mt-2">
                      Try increasing your starting balance or reducing your investment per trade.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Portfolio Mode Stats */}
            {portfolioMode && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                  💰 Portfolio Performance
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Realistic Simulation</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Starting Balance</p>
                    <p className="text-xl font-bold text-slate-200">{formatNumber(result.startingBalance)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Ending Balance</p>
                    <p className={`text-xl font-bold ${result.endingBalance >= result.startingBalance ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatNumber(result.endingBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Peak Balance</p>
                    <p className="text-xl font-bold text-emerald-400">{formatNumber(result.maxBalance)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Lowest Balance</p>
                    <p className="text-xl font-bold text-red-400">{formatNumber(result.minBalance)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Portfolio Growth</p>
                    <p className={`text-xl font-bold ${result.endingBalance >= result.startingBalance ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.startingBalance > 0 ? (
                        <>
                          {((result.endingBalance - result.startingBalance) / result.startingBalance * 100).toFixed(1)}%
                        </>
                      ) : '0%'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
                <p className="text-slate-400 text-sm mb-2">Net Profit/Loss</p>
                <p className={`text-3xl font-bold ${result.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.netProfit >= 0 ? '+' : ''}{formatNumber(result.netProfit)}
                </p>
              </div>
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
                <p className="text-slate-400 text-sm mb-2">Overall ROI</p>
                <p className={`text-3xl font-bold ${result.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.roi >= 0 ? '+' : ''}{result.roi.toFixed(2)}%
                </p>
              </div>
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
                <p className="text-slate-400 text-sm mb-2">Win Rate</p>
                <p className={`text-3xl font-bold ${result.winRate >= 60 ? 'text-emerald-400' : result.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {result.winRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
                <p className="text-slate-400 text-sm mb-2">
                  {portfolioMode ? 'Trades Actually Copied' : 'Trades Copied'}
                </p>
                <p className="text-3xl font-bold text-slate-200">
                  {result.copiedTrades}
                </p>
                {portfolioMode && (
                  <p className="text-slate-500 text-xs mt-1">
                    {result.trades.filter(t => t.couldNotAfford).length} couldn't afford
                  </p>
                )}
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Detailed Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Total Invested</p>
                  <p className="text-xl font-bold text-slate-200">{formatNumber(result.totalInvested)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Total Returned</p>
                  <p className="text-xl font-bold text-slate-200">{formatNumber(result.totalReturned)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Wins / Losses</p>
                  <p className="text-xl font-bold text-slate-200">{result.wins} / {result.losses}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Biggest Win</p>
                  <p className="text-xl font-bold text-emerald-400">{formatNumber(result.biggestWin)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Avg Win</p>
                  <p className="text-xl font-bold text-emerald-400">{formatNumber(result.avgWin)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Avg Loss</p>
                  <p className="text-xl font-bold text-red-400">{formatNumber(result.avgLoss)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Biggest Loss</p>
                  <p className="text-xl font-bold text-red-400">{formatNumber(result.biggestLoss)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Profit Factor</p>
                  <p className="text-xl font-bold text-slate-200">
                    {result.avgLoss !== 0 ? Math.abs(result.avgWin / result.avgLoss).toFixed(2) : '∞'}
                  </p>
                </div>
              </div>
            </div>

            {/* Portfolio History Chart */}
            {portfolioMode && result.portfolioHistory.length > 0 && (
              <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Portfolio Balance Over Time</h3>
                <div className="space-y-1 font-mono text-xs">
                  {(() => {
                    const history = result.portfolioHistory
                    const maxVal = Math.max(...history.map(h => h.balance))
                    const minVal = Math.min(...history.map(h => h.balance))
                    const range = maxVal - minVal
                    const chartHeight = 20
                    
                    // Sample points if too many
                    const maxPoints = 50
                    const sampleRate = Math.ceil(history.length / maxPoints)
                    const sampledHistory = history.filter((_, i) => i % sampleRate === 0)
                    
                    return (
                      <>
                        {/* Y-axis labels and chart */}
                        <div className="flex gap-2">
                          <div className="flex flex-col justify-between text-slate-500 pr-2 border-r border-slate-700/50">
                            <div>${formatNumber(maxVal)}</div>
                            <div>${formatNumber((maxVal + minVal) / 2)}</div>
                            <div>${formatNumber(minVal)}</div>
                          </div>
                          <div className="flex-1 relative" style={{ height: `${chartHeight * 8}px` }}>
                            {sampledHistory.map((point, i) => {
                              const heightPercent = range > 0 ? ((point.balance - minVal) / range) * 100 : 50
                              const color = point.balance >= result.startingBalance 
                                ? 'bg-emerald-500' 
                                : 'bg-red-500'
                              return (
                                <div
                                  key={i}
                                  className={`absolute ${color} w-1.5 rounded-t`}
                                  style={{
                                    left: `${(i / (sampledHistory.length - 1)) * 100}%`,
                                    bottom: 0,
                                    height: `${heightPercent}%`,
                                  }}
                                  title={`Trade ${point.tradeIndex}: ${formatNumber(point.balance)} (${point.tradeProfit >= 0 ? '+' : ''}${formatNumber(point.tradeProfit)})`}
                                />
                              )
                            })}
                            {/* Starting balance reference line */}
                            {range > 0 && (
                              <div
                                className="absolute w-full border-t border-dashed border-slate-600"
                                style={{
                                  bottom: `${((result.startingBalance - minVal) / range) * 100}%`,
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="text-center text-slate-500 mt-2">
                          Trade Progress (Showing {sampledHistory.length} of {history.length} trades)
                        </div>
                        <div className="flex items-center justify-center gap-4 mt-2">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                            <span className="text-slate-400">Above Starting</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-500 rounded"></div>
                            <span className="text-slate-400">Below Starting</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-0.5 border-t border-dashed border-slate-600"></div>
                            <span className="text-slate-400">Starting Balance</span>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Trade List */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-800/50">
                <h3 className="text-lg font-semibold text-slate-200">All Simulated Trades{portfolioMode ? ' (Chronological Order)' : ' (Sorted by Profit)'}</h3>
                <p className="text-slate-400 text-sm mt-1">
                  {portfolioMode 
                    ? 'Trades shown in the order they were executed with running balance'
                    : 'Showing how each copied trade would have performed'}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50 border-b border-slate-700/50">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Market</th>
                      <th className="text-center px-4 py-4 text-sm font-semibold text-slate-300">Buy Price</th>
                      <th className="text-center px-4 py-4 text-sm font-semibold text-slate-300">Sell Price</th>
                      <th className="text-right px-4 py-4 text-sm font-semibold text-slate-300">Invested</th>
                      <th className="text-right px-4 py-4 text-sm font-semibold text-slate-300">Returned</th>
                      <th className="text-right px-4 py-4 text-sm font-semibold text-slate-300">Profit</th>
                      <th className="text-right px-4 py-4 text-sm font-semibold text-slate-300">ROI</th>
                      {portfolioMode && (
                        <th className="text-right px-4 py-4 text-sm font-semibold text-slate-300">Balance After</th>
                      )}
                      <th className="text-center px-4 py-4 text-sm font-semibold text-slate-300">Status</th>
                      <th className="text-center px-4 py-4 text-sm font-semibold text-slate-300">Buy Time</th>
                      <th className="text-center px-4 py-4 text-sm font-semibold text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {result.trades.map((trade, index) => (
                      <tr key={trade.activity.id || index} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-slate-200 text-sm font-medium max-w-md truncate">
                            {trade.activity.title || trade.activity.marketQuestion}
                          </p>
                          <p className="text-slate-500 text-xs mt-1">
                            {trade.activity.outcome || trade.activity.outcomeTitle}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 text-sm font-mono font-bold">
                            ${trade.buyPrice.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {trade.avgExitPrice !== null ? (
                            <span className={`px-2 py-1 rounded text-sm font-mono font-bold ${
                              trade.avgExitPrice > trade.buyPrice 
                                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
                                : 'bg-red-500/20 border border-red-500/30 text-red-400'
                            }`}>
                              ${trade.avgExitPrice.toFixed(2)}
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-700/30 rounded text-slate-500 text-xs">
                              Not Closed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-200 font-mono">
                          {formatNumber(trade.invested)}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-200 font-mono">
                          {trade.status === 'open' ? (
                            <span className="text-slate-500 text-xs">-</span>
                          ) : (
                            formatNumber(trade.returned)
                          )}
                        </td>
                        <td className={`px-4 py-4 text-right font-bold font-mono ${
                          trade.status === 'open' ? 'text-slate-500' :
                          trade.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {trade.status === 'open' ? (
                            <span className="text-xs">Open</span>
                          ) : (
                            <>{trade.profit >= 0 ? '+' : ''}{formatNumber(trade.profit)}</>
                          )}
                        </td>
                        <td className={`px-4 py-4 text-right font-bold font-mono ${
                          trade.status === 'open' ? 'text-slate-500' :
                          trade.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {trade.status === 'open' ? (
                            <span className="text-xs">-</span>
                          ) : (
                            <>{trade.roi >= 0 ? '+' : ''}{trade.roi.toFixed(1)}%</>
                          )}
                        </td>
                        {portfolioMode && (
                          <td className="px-4 py-4 text-right">
                            {trade.couldNotAfford ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">
                                💸 Couldn't Afford
                              </span>
                            ) : (
                              <span className={`font-mono font-bold ${
                                trade.balanceAfter >= result.startingBalance ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {formatNumber(trade.balanceAfter)}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-4 text-center">
                          {trade.status === 'open' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-600/20 text-slate-400">
                              ⏳ Open
                            </span>
                          ) : trade.status === 'win' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                              ✅ Win
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                              ❌ Loss
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center text-slate-400 text-sm">
                          {formatDate(trade.activity.timestamp)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {/* Copy Market Slug */}
                            {(trade.activity.slug || trade.activity.eventSlug) && (
                              <button
                                onClick={() => {
                                  const slug = trade.activity.slug || trade.activity.eventSlug
                                  const url = `https://polymarket.com/event/${slug}`
                                  navigator.clipboard.writeText(url)
                                  alert('Market URL copied to clipboard!')
                                }}
                                className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded text-indigo-400 text-xs font-medium transition-colors"
                                title="Copy market URL"
                              >
                                📋 URL
                              </button>
                            )}
                            {/* Copy Transaction Hash */}
                            {trade.activity.transactionHash && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(trade.activity.transactionHash || '')
                                  alert('Transaction hash copied!')
                                }}
                                className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded text-cyan-400 text-xs font-medium transition-colors"
                                title="Copy transaction hash"
                              >
                                🔗 Hash
                              </button>
                            )}
                            {/* Copy Market Name */}
                            <button
                              onClick={() => {
                                const marketName = trade.activity.title || trade.activity.marketQuestion || ''
                                navigator.clipboard.writeText(marketName)
                                alert('Market name copied!')
                              }}
                              className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded text-emerald-400 text-xs font-medium transition-colors"
                              title="Copy market name"
                            >
                              📝 Name
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
