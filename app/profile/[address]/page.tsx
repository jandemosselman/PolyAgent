'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

interface UserPosition {
  proxyWallet: string
  asset: string
  conditionId: string
  size: number
  avgPrice: number
  initialValue: number
  currentValue: number
  cashPnl: number
  percentPnl: number
  totalBought: number
  realizedPnl: number
  percentRealizedPnl: number
  curPrice: number
  redeemable: boolean
  mergeable: boolean
  title: string
  slug: string
  icon: string
  eventSlug: string
  outcome: string
  outcomeIndex: number
  oppositeOutcome: string
  oppositeAsset: string
  endDate: string
  negativeRisk: boolean
}

interface Trade {
  proxyWallet: string
  side: 'BUY' | 'SELL'
  asset: string
  conditionId: string
  size: number
  price: number
  timestamp: number
  title: string
  slug: string
  icon: string
  eventSlug: string
  outcome: string
  outcomeIndex: number
  name: string
  pseudonym: string
  bio: string
  profileImage: string
  profileImageOptimized: string
  transactionHash: string
}

interface UserActivity {
  proxyWallet: string
  timestamp: number
  conditionId: string
  type: 'TRADE' | 'SPLIT' | 'MERGE' | 'REDEEM' | 'REWARD' | 'CONVERSION' | 'MAKER_REBATE'
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
  name: string
  pseudonym: string
  bio: string
  profileImage: string
  profileImageOptimized: string
}

interface UserProfile {
  username?: string
  bio?: string
  profile_picture?: string
  optimized_profile_picture?: string
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
  oppositeOutcome: string
  oppositeAsset: string
  endDate: string
}

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const router = useRouter()
  const { address } = use(params)
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([])
  const [activity, setActivity] = useState<UserActivity[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null)
  const [totalMarkets, setTotalMarkets] = useState<number | null>(null)
  const [biggestWin, setBiggestWin] = useState<number | null>(null)
  const [winRate, setWinRate] = useState<number | null>(null)
  const [avgTradesPerDay, setAvgTradesPerDay] = useState<number | null>(null)
  const [avgBuyPrice, setAvgBuyPrice] = useState<number | null>(null)
  const [avgRoi, setAvgRoi] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)
  const [closedLoading, setClosedLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'positions' | 'activity' | 'resolved'>('positions')
  const [positionsTab, setPositionsTab] = useState<'active' | 'closed'>('active')
  const [closedPositionsLimit, setClosedPositionsLimit] = useState<number>(10000)
  const [activityLimit, setActivityLimit] = useState<number>(5000)
  const [resolvedLimit, setResolvedLimit] = useState<number>(5000)
  const [showResolvedOnly, setShowResolvedOnly] = useState(false)
  const [resolvedBuysLoading, setResolvedBuysLoading] = useState(false)
  const [minBetAmount, setMinBetAmount] = useState<number>(0)
  const [resolvedBuysLimit, setResolvedBuysLimit] = useState<number>(5000)
  const [fetchStartTime, setFetchStartTime] = useState<number | null>(null)
  const [fetchElapsed, setFetchElapsed] = useState<number>(0)
  const [minBuyPrice, setMinBuyPrice] = useState<number>(0)
  const [maxBuyPrice, setMaxBuyPrice] = useState<number>(1)
  const [statTestResult, setStatTestResult] = useState<{pValue: number, isSignificant: boolean, sampleSize: number, winRate?: number, zScore?: number, error?: string} | null>(null)
  
  // Backtest simulation state
  const [showBacktestModal, setShowBacktestModal] = useState(false)
  const [backtestBudget, setBacktestBudget] = useState<number>(10)
  const [backtestFixedBet, setBacktestFixedBet] = useState<number>(1)
  const [backtestRunning, setBacktestRunning] = useState(false)
  const [backtestResults, setBacktestResults] = useState<any>(null)
  
  // Auto backtest state
  const [showAutoBacktestModal, setShowAutoBacktestModal] = useState(false)
  const [autoBacktestRunning, setAutoBacktestRunning] = useState(false)
  const [autoBacktestResults, setAutoBacktestResults] = useState<any[]>([])
  const [autoBacktestMinResolvedBuys, setAutoBacktestMinResolvedBuys] = useState<number>(50)
  const [autoBacktestProgress, setAutoBacktestProgress] = useState<{current: number, total: number}>({current: 0, total: 0})

  // Binomial test for statistical significance
  const calculateStatSignificance = (wins: number, total: number) => {
    if (total < 50) {
      return { error: 'Sample size too small', sampleSize: total, pValue: 0, isSignificant: false } // Need at least 50 samples for reliable test
    }
    
    const winRate = wins / total
    const nullHypothesis = 0.5 // 50% win rate (random chance)
    
    // Calculate z-score for binomial proportion test
    const standardError = Math.sqrt((nullHypothesis * (1 - nullHypothesis)) / total)
    const zScore = (winRate - nullHypothesis) / standardError
    
    // Two-tailed p-value
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)))
    
    console.log('Statistical Test:', {
      wins,
      total,
      winRate: (winRate * 100).toFixed(1) + '%',
      nullHypothesis: '50%',
      standardError: standardError.toFixed(4),
      zScore: zScore.toFixed(4),
      pValue: pValue.toFixed(6)
    })
    
    return {
      pValue,
      isSignificant: pValue < 0.05, // 95% confidence level
      sampleSize: total,
      winRate: winRate * 100,
      zScore
    }
  }

  // Standard normal cumulative distribution function approximation
  const normalCDF = (x: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x))
    const d = 0.3989423 * Math.exp(-x * x / 2)
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return x > 0 ? 1 - prob : prob
  }

  useEffect(() => {
    fetchProfile()
    fetchPositions()
    fetchTotalMarkets()
    fetchClosedPositions() // Fetch early to calculate stats
    fetchActivity() // Fetch activity early for avg trades/day
  }, [address])

  useEffect(() => {
    if (activeTab === 'activity' && activity.length === 0) {
      fetchActivity()
    }
  }, [activeTab])

  // Refetch closed positions when limit changes OR when switching to closed tab OR when resolved filter is toggled
  useEffect(() => {
    console.log('🔥 CLOSED POSITIONS EFFECT TRIGGERED')
    console.log('  - positionsTab:', positionsTab)
    console.log('  - closedPositionsLimit:', closedPositionsLimit)
    console.log('  - activeTab:', activeTab)
    console.log('  - showResolvedOnly:', showResolvedOnly)
    
    if (positionsTab === 'closed' || (activeTab === 'activity' && showResolvedOnly)) {
      console.log('✅ Conditions met - fetching closed positions')
      fetchClosedPositions()
    } else {
      console.log('❌ Conditions NOT met - skipping closed positions fetch')
    }
  }, [positionsTab, closedPositionsLimit, showResolvedOnly])

  // Refetch activity when limit changes
  useEffect(() => {
    console.log('🔥 ACTIVITY LIMIT CHANGED EFFECT TRIGGERED')
    console.log('  - activityLimit:', activityLimit)
    console.log('  - showResolvedOnly:', showResolvedOnly)
    console.log('  - closedPositionsLimit:', closedPositionsLimit)
    console.log('  - activeTab:', activeTab)
    
    fetchActivity()
    
    // CRITICAL FIX: If showing resolved buys, also increase closed positions limit to match
    // so we have enough closed positions to match against the new activities
    if (showResolvedOnly) {
      console.log('✅ showResolvedOnly is TRUE - will auto-scale closed positions')
      // Automatically scale closed positions to at least match activity limit
      if (closedPositionsLimit < activityLimit) {
        console.log(`📈 Increasing closed positions limit from ${closedPositionsLimit} to ${activityLimit}`)
        setClosedPositionsLimit(activityLimit)
        // The useEffect watching closedPositionsLimit will trigger the refetch
      } else {
        console.log(`✅ Closed positions limit (${closedPositionsLimit}) already >= activity limit (${activityLimit}), just refetching`)
        fetchClosedPositions()
      }
    } else {
      console.log('❌ showResolvedOnly is FALSE - NOT auto-scaling closed positions')
    }
  }, [activityLimit])

  // Calculate stats when closed positions are loaded
  useEffect(() => {
    if (closedPositions.length > 0) {
      // Calculate biggest win
      const maxWin = Math.max(...closedPositions.map(p => p.realizedPnl || 0))
      setBiggestWin(maxWin)

      // Calculate win rate (positions with positive PNL / total closed positions)
      const wins = closedPositions.filter(p => (p.realizedPnl || 0) > 0).length
      const rate = (wins / closedPositions.length) * 100
      setWinRate(rate)

      // Calculate average ROI from closed positions
      const rois = closedPositions.map(p => {
        const investment = (p.totalBought || 0) * (p.avgPrice || 0)
        if (!investment || investment === 0) return 0
        return ((p.realizedPnl || 0) / investment) * 100
      }).filter(roi => !isNaN(roi) && isFinite(roi))
      
      if (rois.length > 0) {
        const avgRoiValue = rois.reduce((acc, roi) => acc + roi, 0) / rois.length
        setAvgRoi(avgRoiValue)
      }
    }
  }, [closedPositions])

  // Calculate portfolio value from active positions
  useEffect(() => {
    if (positions.length > 0) {
      const totalValue = positions.reduce((acc, pos) => acc + (pos.currentValue || 0), 0)
      setPortfolioValue(totalValue)
    } else if (!loading) {
      // If no positions and not loading, set to 0
      setPortfolioValue(0)
    }
  }, [positions, loading])

  // Calculate avg trades per day from activity
  useEffect(() => {
    if (activity.length > 0) {
      // Get only TRADE type activities with timestamps
      const trades = activity.filter(a => a.type === 'TRADE' && a.timestamp)
      
      if (trades.length > 1) {
        // Sort by timestamp
        const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp)
        const firstTimestamp = sortedTrades[0].timestamp
        const lastTimestamp = sortedTrades[sortedTrades.length - 1].timestamp
        
        // Calculate days of activity
        const daysDiff = (lastTimestamp - firstTimestamp) / (60 * 60 * 24)
        
        // Only calculate if there's meaningful time range (at least 0.1 day to avoid division issues)
        if (daysDiff >= 0.1) {
          const avgPerDay = trades.length / daysDiff
          setAvgTradesPerDay(avgPerDay)
        } else if (trades.length > 0) {
          // If all trades are on same day, just show the count
          setAvgTradesPerDay(trades.length)
        }
      } else if (trades.length === 1) {
        // Single trade
        setAvgTradesPerDay(1)
      }

      // Calculate average buy price from BUY trades
      const buyTrades = activity.filter(a => a.type === 'TRADE' && a.side === 'BUY' && a.price)
      if (buyTrades.length > 0) {
        const avgPrice = buyTrades.reduce((acc, trade) => acc + (trade.price || 0), 0) / buyTrades.length
        setAvgBuyPrice(avgPrice)
      }
    }
  }, [activity])

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/profile?address=${address}`)
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    }
  }

  const fetchPositions = async () => {
    setLoading(true)
    setError(null)
    try {
      const queryParams = new URLSearchParams({
        user: address,
        sizeThreshold: '1',
        limit: '100',
        sortBy: 'CASHPNL',
        sortDirection: 'DESC'
      })
      
      const response = await fetch(`/api/positions?${queryParams}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      setPositions(data)
    } catch (err) {
      setError('Failed to load user positions. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchActivity = async () => {
    setActivityLoading(true)
    setFetchStartTime(Date.now())
    setFetchElapsed(0)

    // Start timer
    const timer = setInterval(() => {
      setFetchElapsed(prev => prev + 1)
    }, 1000)

    try {
      console.log('🚀 FETCHING ACTIVITY with limit:', activityLimit)
      
      const queryParams = new URLSearchParams({
        user: address,
        limit: activityLimit.toString(),
        sortBy: 'TIMESTAMP',
        sortDirection: 'DESC'
      })
      
      const response = await fetch(`/api/activity?${queryParams}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      
      console.log('📦 RAW ACTIVITY DATA RECEIVED:')
      console.log('  - Total items:', data.length)
      console.log('  - Requested limit:', activityLimit)
      console.log('  - Got what we requested?', data.length === activityLimit ? 'YES ✅' : `NO ❌ (got ${data.length} instead)`)
      
      // Count by type
      const typeBreakdown = data.reduce((acc: any, item: any) => {
        acc[item.type] = (acc[item.type] || 0) + 1
        return acc
      }, {})
      console.log('  - Type breakdown:', typeBreakdown)
      
      // Count BUY trades
      const buyCount = data.filter((a: any) => a.type === 'TRADE' && a.side === 'BUY').length
      console.log('  - BUY trades (with duplicates):', buyCount)
      
      // Check for duplicates
      const txHashes = new Set()
      const duplicates = data.filter((a: any) => {
        if (txHashes.has(a.transactionHash)) return true
        txHashes.add(a.transactionHash)
        return false
      })
      console.log('  - Duplicate transaction hashes:', duplicates.length)
      console.log('  - Unique transactions:', txHashes.size)
      
      // Sort by timestamp descending (newest first) to ensure correct order
      const sortedData = data.sort((a: UserActivity, b: UserActivity) => b.timestamp - a.timestamp)
      setActivity(sortedData)
      
      console.log('✅ Activity data set successfully')
    } catch (err) {
      console.error('❌ Failed to load activity:', err)
    } finally {
      clearInterval(timer)
      setActivityLoading(false)
      setFetchStartTime(null)
      setFetchElapsed(0)
    }
  }

  const fetchPortfolioValue = async () => {
    try {
      const response = await fetch(`/api/value?user=${address}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      console.log('Portfolio value data:', data)
      // Handle both data.value and direct value, including 0
      const value = data.value !== undefined ? data.value : (typeof data === 'number' ? data : null)
      setPortfolioValue(value)
    } catch (err) {
      console.error('Failed to load portfolio value:', err)
      setPortfolioValue(0) // Set to 0 on error so it doesn't stay loading
    }
  }

  const fetchTotalMarkets = async () => {
    try {
      const response = await fetch(`/api/traded?user=${address}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      setTotalMarkets(data.traded)
    } catch (err) {
      console.error('Failed to load total markets:', err)
    }
  }

  const fetchClosedPositions = async () => {
    console.log('Fetching closed positions with limit:', closedPositionsLimit)
    setClosedLoading(true)
    try {
      const queryParams = new URLSearchParams({
        user: address,
        limit: closedPositionsLimit.toString(),
        sortBy: 'TIMESTAMP',
        sortDirection: 'DESC'
      })
      
      console.log('API URL:', `/api/closed-positions?${queryParams}`)
      const response = await fetch(`/api/closed-positions?${queryParams}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      console.log('Received closed positions:', data.length)
      setClosedPositions(data)
    } catch (err) {
      console.error('Failed to load closed positions:', err)
    } finally {
      setClosedLoading(false)
    }
  }

  const getResolvedBuysWithStreaks = () => {
    console.log('� getResolvedBuysWithStreaks - activity:', activity.length, 'closed:', closedPositions.length)
    
    // Get all BUY trades from activity
    const allBuyTrades = activity.filter(a => a.type === 'TRADE' && a.side === 'BUY')
    
    // CRITICAL FIX: Deduplicate BUY trades BEFORE matching with closed positions
    const seenTrades = new Set()
    const buyTrades = allBuyTrades.filter(trade => {
      const uniqueKey = `${trade.transactionHash}-${trade.asset}-${trade.outcomeIndex || 0}`
      if (seenTrades.has(uniqueKey)) {
        return false // Skip duplicate
      }
      seenTrades.add(uniqueKey)
      return true
    })
    
    console.log('  - Unique BUY trades:', buyTrades.length, '| Closed positions:', closedPositions.length)
    
    // Create a map of closed positions by asset, conditionId, AND slug
    const closedMap = new Map()
    closedPositions.forEach(pos => {
      if (pos.asset) closedMap.set(pos.asset, pos)
      if (pos.conditionId) closedMap.set(pos.conditionId, pos)
      if (pos.slug) closedMap.set(pos.slug, pos) // Add slug matching as fallback
    })
    
    // Get all unique conditionIds from closed positions
    const closedConditionIds = new Set(closedPositions.map(p => p.conditionId).filter(Boolean))
    const buyConditionIds = new Set(buyTrades.map(t => t.conditionId).filter(Boolean))
    
    // Check overlap
    const conditionOverlap = [...buyConditionIds].filter(id => closedConditionIds.has(id))
    console.log('  - Condition ID overlap:', conditionOverlap.length, 'of', buyConditionIds.size, 'buy trades match closed positions')

    // DEBUG: Check how many buys have assets that match closed positions
    let assetMatchCount = 0
    let conditionMatchCount = 0
    
    buyTrades.forEach(trade => {
      const hasAssetMatch = trade.asset && closedMap.has(trade.asset)
      const hasConditionMatch = trade.conditionId && closedMap.has(trade.conditionId)
      
      if (hasAssetMatch) assetMatchCount++
      else if (hasConditionMatch) conditionMatchCount++
    })
    
    console.log('  - Matching: asset =', assetMatchCount, '| conditionId =', conditionMatchCount, '| total =', assetMatchCount + conditionMatchCount)

    // Match buys with their outcomes
    let matchedCount = 0
    let filteredByMinBet = 0
    let filteredByPrice = 0
    
    const resolvedBuys = buyTrades
      .map(trade => {
        const closedPos = closedMap.get(trade.asset) || closedMap.get(trade.conditionId) || closedMap.get(trade.slug)
        if (!closedPos) return null

        matchedCount++
        const investment = trade.size * trade.price
        
        // Apply min bet filter
        if (minBetAmount > 0 && investment < minBetAmount) {
          filteredByMinBet++
          return null
        }

        // Apply buy price filter
        if (trade.price < minBuyPrice || trade.price > maxBuyPrice) {
          filteredByPrice++
          return null
        }

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

    console.log('  - Final resolved buys:', resolvedBuys.length)
    
    // Calculate streaks
    let currentWinStreak = 0
    let currentLossStreak = 0
    let maxWinStreak = 0
    let maxLossStreak = 0
    let totalWins = 0
    let totalLosses = 0
    let totalBuyPrice = 0
    let totalWinBuyPrice = 0
    let totalLossBuyPrice = 0

    resolvedBuys.forEach(trade => {
      totalBuyPrice += trade.price
      
      if (trade.won) {
        totalWins++
        totalWinBuyPrice += trade.price
        currentWinStreak++
        currentLossStreak = 0
        if (currentWinStreak > maxWinStreak) {
          maxWinStreak = currentWinStreak
        }
      } else {
        totalLosses++
        totalLossBuyPrice += trade.price
        currentLossStreak++
        currentWinStreak = 0
        if (currentLossStreak > maxLossStreak) {
          maxLossStreak = currentLossStreak
        }
      }
    })

    const avgBuyPrice = resolvedBuys.length > 0 ? totalBuyPrice / resolvedBuys.length : 0
    const avgWinBuyPrice = totalWins > 0 ? totalWinBuyPrice / totalWins : 0
    const avgLossBuyPrice = totalLosses > 0 ? totalLossBuyPrice / totalLosses : 0

    return {
      trades: resolvedBuys,
      stats: {
        maxWinStreak,
        maxLossStreak,
        totalWins,
        totalLosses,
        winRate: resolvedBuys.length > 0 ? (totalWins / resolvedBuys.length) * 100 : 0,
        avgBuyPrice,
        avgWinBuyPrice,
        avgLossBuyPrice
      }
    }
  }

  // Backtest survival simulation
  const runBacktestSimulation = () => {
    setBacktestRunning(true)
    
    // Get the filtered resolved buys
    const { trades: resolvedBuys } = getResolvedBuysWithStreaks()
    
    if (resolvedBuys.length < 10) {
      alert('Need at least 10 resolved buys to run backtest')
      setBacktestRunning(false)
      return
    }
    
    const results = {
      totalSimulations: 0,
      bankruptcies: 0,
      survivals: 0,
      doubled: 0,
      tripled: 0,
      finalBalances: [] as number[],
      worstDrawdown: 0,
      bestRun: 0,
      worstRun: Infinity,
      avgFinalBalance: 0
    }
    
    // Run simulation starting from each position (except last 10)
    const maxStartIndex = resolvedBuys.length - 10
    
    for (let startIndex = 0; startIndex < maxStartIndex; startIndex++) {
      let budget = backtestBudget
      let minBudget = budget
      let bankrupt = false
      
      // Simulate forward from this starting point
      for (let i = startIndex; i < resolvedBuys.length; i++) {
        const trade = resolvedBuys[i]
        
        // Check if we can afford to place a bet
        if (budget < backtestFixedBet) {
          bankrupt = true
          break
        }
        
        // Place bet
        budget -= backtestFixedBet
        
        // Calculate P&L based on trade outcome
        if (trade.won) {
          // Win: get back bet + profit based on price
          const shares = backtestFixedBet / trade.price
          const payout = shares * 1.0 // Winning outcome pays $1
          budget += payout
        }
        // If lost, we already deducted the bet, so nothing to add back
        
        // Track worst drawdown
        if (budget < minBudget) {
          minBudget = budget
        }
      }
      
      // Record results
      results.totalSimulations++
      results.finalBalances.push(budget)
      
      if (bankrupt || budget < backtestFixedBet) {
        results.bankruptcies++
      } else {
        results.survivals++
      }
      
      if (budget >= backtestBudget * 2) results.doubled++
      if (budget >= backtestBudget * 3) results.tripled++
      
      const drawdown = backtestBudget - minBudget
      if (drawdown > results.worstDrawdown) {
        results.worstDrawdown = drawdown
      }
      
      if (budget > results.bestRun) results.bestRun = budget
      if (budget < results.worstRun) results.worstRun = budget
    }
    
    // Calculate average
    results.avgFinalBalance = results.finalBalances.reduce((a, b) => a + b, 0) / results.finalBalances.length
    
    setBacktestResults(results)
    setBacktestRunning(false)
  }
  
  // Auto backtest - brute force all filter combinations
  const runAutoBacktest = async () => {
    setAutoBacktestRunning(true)
    setAutoBacktestResults([])
    
    // Define search space for filters
    const minBetOptions = [0, 1, 5, 10, 20, 50, 100] // Different min bet amounts
    const priceRanges = [
      { min: 0, max: 1, label: 'All' },
      { min: 0, max: 0.3, label: '0-0.3' },
      { min: 0, max: 0.5, label: '0-0.5' },
      { min: 0.3, max: 0.7, label: '0.3-0.7' },
      { min: 0.4, max: 0.6, label: '0.4-0.6' },
      { min: 0.5, max: 1, label: '0.5-1' },
      { min: 0.7, max: 1, label: '0.7-1' },
    ]
    
    const totalCombinations = minBetOptions.length * priceRanges.length
    setAutoBacktestProgress({ current: 0, total: totalCombinations })
    
    const results: any[] = []
    let combinationIndex = 0
    
    // Get ALL resolved buys without filters first
    const allActivity = activity.filter(a => a.type === 'TRADE' && a.side === 'BUY')
    const seenTrades = new Set()
    const allBuyTrades = allActivity.filter(trade => {
      const uniqueKey = `${trade.transactionHash}-${trade.asset}-${trade.outcomeIndex || 0}`
      if (seenTrades.has(uniqueKey)) return false
      seenTrades.add(uniqueKey)
      return true
    })
    
    const closedMap = new Map()
    closedPositions.forEach(pos => {
      if (pos.asset) closedMap.set(pos.asset, pos)
      if (pos.conditionId) closedMap.set(pos.conditionId, pos)
      if (pos.slug) closedMap.set(pos.slug, pos)
    })
    
    // Try each combination
    for (const minBet of minBetOptions) {
      for (const priceRange of priceRanges) {
        combinationIndex++
        setAutoBacktestProgress({ current: combinationIndex, total: totalCombinations })
        
        // Filter trades based on current combination
        const filteredTrades = allBuyTrades
          .map(trade => {
            const closedPos = closedMap.get(trade.asset) || closedMap.get(trade.conditionId) || closedMap.get(trade.slug)
            if (!closedPos) return null
            
            const investment = trade.size * trade.price
            
            // Apply filters
            if (minBet > 0 && investment < minBet) return null
            if (trade.price < priceRange.min || trade.price > priceRange.max) return null
            
            const roi = closedPos.totalBought > 0 
              ? (closedPos.realizedPnl / (closedPos.totalBought * closedPos.avgPrice)) * 100 
              : 0
            
            return {
              ...trade,
              resolved: true,
              won: closedPos.realizedPnl > 0,
              pnl: closedPos.realizedPnl,
              roi: roi,
              investment: investment,
              price: trade.price
            }
          })
          .filter(t => t !== null)
        
        // Skip if not enough trades
        if (filteredTrades.length < autoBacktestMinResolvedBuys) {
          continue
        }
        
        // Run backtest simulation on this filtered set
        const simResults = {
          totalSimulations: 0,
          bankruptcies: 0,
          survivals: 0,
          doubled: 0,
          finalBalances: [] as number[],
          worstDrawdown: 0,
          bestRun: 0,
          worstRun: Infinity,
          avgFinalBalance: 0
        }
        
        const maxStartIndex = filteredTrades.length - 10
        if (maxStartIndex <= 0) continue
        
        for (let startIndex = 0; startIndex < maxStartIndex; startIndex++) {
          let budget = backtestBudget
          let minBudget = budget
          let bankrupt = false
          
          for (let i = startIndex; i < filteredTrades.length; i++) {
            const trade = filteredTrades[i]
            
            if (budget < backtestFixedBet) {
              bankrupt = true
              break
            }
            
            budget -= backtestFixedBet
            
            if (trade.won) {
              const shares = backtestFixedBet / trade.price
              const payout = shares * 1.0
              budget += payout
            }
            
            if (budget < minBudget) {
              minBudget = budget
            }
          }
          
          simResults.totalSimulations++
          simResults.finalBalances.push(budget)
          
          if (bankrupt || budget < backtestFixedBet) {
            simResults.bankruptcies++
          } else {
            simResults.survivals++
          }
          
          if (budget >= backtestBudget * 2) simResults.doubled++
          
          const drawdown = backtestBudget - minBudget
          if (drawdown > simResults.worstDrawdown) {
            simResults.worstDrawdown = drawdown
          }
          
          if (budget > simResults.bestRun) simResults.bestRun = budget
          if (budget < simResults.worstRun) simResults.worstRun = budget
        }
        
        simResults.avgFinalBalance = simResults.finalBalances.reduce((a, b) => a + b, 0) / simResults.finalBalances.length
        
        const survivalRate = (simResults.survivals / simResults.totalSimulations) * 100
        const winRate = filteredTrades.filter(t => t.won).length / filteredTrades.length * 100
        
        results.push({
          minBet,
          priceRange: priceRange.label,
          priceMin: priceRange.min,
          priceMax: priceRange.max,
          resolvedBuysCount: filteredTrades.length,
          survivalRate,
          winRate,
          avgFinalBalance: simResults.avgFinalBalance,
          bankruptcies: simResults.bankruptcies,
          survivals: simResults.survivals,
          doubled: simResults.doubled,
          worstDrawdown: simResults.worstDrawdown,
          totalSimulations: simResults.totalSimulations
        })
        
        // Small delay to keep UI responsive
        if (combinationIndex % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    }
    
    // Sort by survival rate descending
    results.sort((a, b) => b.survivalRate - a.survivalRate)
    
    setAutoBacktestResults(results)
    setAutoBacktestRunning(false)
  }

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) return '$0.00'
    if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00%'
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
  }

  const totalPnl = positions.reduce((acc, pos) => acc + pos.cashPnl, 0)
  const totalValue = positions.reduce((acc, pos) => acc + pos.currentValue, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/')}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-slate-200">
                  {profile?.username || 'Trader Profile'}
                </h1>
                <p className="text-slate-400 mt-1 text-sm font-mono">{address}</p>
                {profile?.bio && (
                  <p className="text-slate-300 mt-2 text-sm">{profile.bio}</p>
                )}
              </div>
            </div>
            {profile?.optimized_profile_picture && (
              <img 
                src={profile.optimized_profile_picture} 
                alt="Profile"
                className="w-16 h-16 rounded-full border-2 border-slate-700"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        {/* Stats Overview - Two Rows */}
        <div className="space-y-4 mb-8">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Positions Value</p>
              <p className="text-3xl font-bold text-white">
                {portfolioValue !== null && portfolioValue !== undefined ? formatNumber(portfolioValue) : (
                  <span className="text-slate-400 text-xl">Loading...</span>
                )}
              </p>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Biggest Win</p>
              <p className="text-3xl font-bold text-emerald-400">
                {biggestWin !== null && biggestWin !== undefined
                  ? formatNumber(biggestWin)
                  : <span className="text-slate-400 text-xl">Loading...</span>
                }
              </p>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Win Rate</p>
              <p className="text-3xl font-bold text-indigo-400">
                {winRate !== null && winRate !== undefined
                  ? `${winRate.toFixed(1)}%`
                  : <span className="text-slate-400 text-xl">Loading...</span>
                }
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {closedPositions.length > 0 
                  ? `Based on ${closedPositions.length} positions`
                  : 'Loading positions...'
                }
              </p>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Avg ROI</p>
              <p className={`text-3xl font-bold ${(avgRoi || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {avgRoi !== null && avgRoi !== undefined
                  ? `${avgRoi >= 0 ? '+' : ''}${avgRoi.toFixed(1)}%`
                  : <span className="text-slate-400 text-xl">Loading...</span>
                }
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {closedPositions.length > 0 
                  ? `Per position (${closedPositions.length} closed)`
                  : 'Loading positions...'
                }
              </p>
            </div>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Total Predictions</p>
              <p className="text-3xl font-bold text-white">
                {totalMarkets !== null ? totalMarkets.toLocaleString() : (
                  <span className="text-slate-400 text-xl">Loading...</span>
                )}
              </p>
              <p className="text-slate-500 text-xs mt-1">Markets traded all-time</p>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Avg Trades/Day</p>
              <p className="text-3xl font-bold text-purple-400">
                {avgTradesPerDay !== null && avgTradesPerDay !== undefined
                  ? avgTradesPerDay.toFixed(1)
                  : <span className="text-slate-400 text-xl">Loading...</span>
                }
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {activity.length > 0 
                  ? (() => {
                      const tradeCount = activity.filter(a => a.type === 'TRADE').length
                      return `Based on ${tradeCount} trades`
                    })()
                  : 'Loading...'
                }
              </p>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6">
              <p className="text-slate-400 text-sm mb-2">Avg Buy Price</p>
              <p className="text-3xl font-bold text-cyan-400">
                {avgBuyPrice !== null && avgBuyPrice !== undefined
                  ? `$${avgBuyPrice.toFixed(3)}`
                  : <span className="text-slate-400 text-xl">Loading...</span>
                }
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {activity.length > 0 
                  ? (() => {
                      const buyCount = activity.filter(a => a.type === 'TRADE' && a.side === 'BUY').length
                      return `From ${buyCount} buy trades`
                    })()
                  : 'Loading...'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-slate-800/50">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'positions'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Positions
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'resolved'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Resolved Markets
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'activity'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Activity
          </button>
        </div>

        {/* Positions Sub-tabs (Active/Closed Toggle) */}
        {activeTab === 'positions' && (
          <div className="flex space-x-2 mb-6 items-center">
            <button
              onClick={() => setPositionsTab('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                positionsTab === 'active'
                  ? 'bg-slate-800/50 text-slate-200 border border-slate-700/50'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setPositionsTab('closed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                positionsTab === 'closed'
                  ? 'bg-slate-800/50 text-slate-200 border border-slate-700/50'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Closed
            </button>
            
            {/* Limit selector for closed positions */}
            {positionsTab === 'closed' && (
              <div className="flex items-center space-x-2 ml-4">
                <span className="text-slate-400 text-sm">Fetch:</span>
                <select
                  value={closedPositionsLimit}
                  onChange={(e) => {
                    const newLimit = Number(e.target.value)
                    setClosedPositionsLimit(newLimit)
                    setActivityLimit(newLimit)
                  }}
                  className="bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={300}>300</option>
                  <option value={500}>500</option>
                  <option value={750}>750</option>
                  <option value={1000}>1000</option>
                  <option value={2000}>2000</option>
                  <option value={5000}>5000</option>
                  <option value={10000}>10000</option>
                </select>
                <span className="text-slate-400 text-sm">positions</span>
              </div>
            )}
            
            <div className="flex-1"></div>
            <button className="px-4 py-2 rounded-lg font-medium text-slate-400 hover:text-slate-300 flex items-center space-x-2">
              <span>🔍</span>
              <span>Search positions</span>
            </button>
            <button className="px-4 py-2 rounded-lg font-medium bg-slate-800/50 text-slate-200 border border-slate-700/50 flex items-center space-x-2">
              <span>↕️</span>
              <span>Value</span>
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={fetchPositions}
              className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'positions' && positionsTab === 'active' && (
              <div className="space-y-4">
                {positions.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-lg">No active positions found for this trader</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {positions.map((position, index) => (
                        <div 
                          key={`${position.conditionId}-${index}`}
                          className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 hover:border-slate-700/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start space-x-4 flex-1">
                              {position.icon && (
                                <img 
                                  src={position.icon} 
                                  alt={position.title}
                                  className="w-12 h-12 rounded-lg bg-slate-800"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              )}
                              <div className="flex-1">
                                <h3 className="text-slate-200 font-semibold text-lg mb-1">
                                  {position.title}
                                </h3>
                                <div className="flex items-center space-x-3 text-sm">
                                  <span className={`px-3 py-1 rounded-full font-medium ${
                                    position.outcome === 'Yes' 
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}>
                                    {position.outcome}
                                  </span>
                                  <span className="text-slate-500">
                                    Size: {position.size?.toFixed(2) || '0.00'} tokens
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${
                                position.cashPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {position.cashPnl >= 0 ? '+' : ''}{formatNumber(position.cashPnl)}
                              </div>
                              <div className={`text-sm ${
                                position.percentPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {formatPercent(position.percentPnl)}
                              </div>
                            </div>
                          </div>

                          {/* Position Details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800/50">
                            <div>
                              <p className="text-slate-500 text-xs mb-1">Current Value</p>
                              <p className="text-slate-200 font-medium">{formatNumber(position.currentValue)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">Initial Value</p>
                              <p className="text-slate-200 font-medium">{formatNumber(position.initialValue)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">Avg Price</p>
                              <p className="text-slate-200 font-medium">${position.avgPrice?.toFixed(3) || '0.000'}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs mb-1">Current Price</p>
                              <p className="text-slate-200 font-medium">${position.curPrice?.toFixed(3) || '0.000'}</p>
                            </div>
                          </div>

                          {position.endDate && (
                            <div className="mt-3 pt-3 border-t border-slate-800/50">
                              <p className="text-slate-500 text-xs">
                                Ends: {new Date(position.endDate).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                )}
              </div>
            )}

            {activeTab === 'positions' && positionsTab === 'closed' && (
              <div className="space-y-4">
                {closedLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
                  </div>
                ) : closedPositions.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-lg">No closed positions found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {closedPositions.map((position, index) => (
                      <div 
                        key={`${position.conditionId}-${index}`}
                        className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-5 hover:border-slate-700/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1">
                            {position.icon && (
                              <img 
                                src={position.icon} 
                                alt={position.title}
                                className="w-12 h-12 rounded-lg bg-slate-800"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="text-slate-200 font-medium mb-2">
                                {position.title}
                              </h3>
                              <div className="flex items-center space-x-3 text-sm mb-3">
                                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
                                  {position.outcome}
                                </span>
                                <span className="text-slate-500 text-xs">
                                  Closed: {new Date(position.timestamp * 1000).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>

                              {/* Position Details */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-800/50">
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Avg Price</p>
                                  <p className="text-slate-200 font-medium">${position.avgPrice?.toFixed(3) || '0.000'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Exit Price</p>
                                  <p className="text-slate-200 font-medium">${position.curPrice?.toFixed(3) || '0.000'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Total Bought</p>
                                  <p className="text-slate-200 font-medium">{position.totalBought?.toFixed(2) || '0.00'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Realized PNL</p>
                                  <p className={`font-semibold ${
                                    position.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    {position.realizedPnl >= 0 ? '+' : ''}{formatNumber(position.realizedPnl)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right ml-4">
                            <div className={`text-2xl font-bold ${
                              position.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {position.realizedPnl >= 0 ? '+' : ''}{formatNumber(position.realizedPnl)}
                            </div>
                            <div className="text-slate-500 text-sm mt-1">
                              {(() => {
                                const investment = (position.totalBought || 0) * (position.avgPrice || 0)
                                if (!investment || investment === 0 || !position.realizedPnl) return '0.0% ROI'
                                const roi = ((position.realizedPnl / investment) * 100)
                                return `${roi?.toFixed(1) || '0.0'}% ROI`
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'resolved' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-200">Resolved Markets</h2>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-sm">Fetch:</span>
                    <select
                      value={resolvedLimit}
                      onChange={(e) => setResolvedLimit(Number(e.target.value))}
                      className="bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                    </select>
                    <span className="text-slate-400 text-sm">markets</span>
                  </div>
                </div>

                {closedLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
                  </div>
                ) : closedPositions.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-lg">No resolved markets found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {closedPositions.slice(0, resolvedLimit).map((position, index) => {
                      const investment = (position.totalBought || 0) * (position.avgPrice || 0)
                      const roi = investment > 0 ? ((position.realizedPnl / investment) * 100) : 0
                      const won = position.realizedPnl > 0

                      return (
                        <div 
                          key={`${position.conditionId}-${index}`}
                          className={`bg-slate-900/50 backdrop-blur-sm border rounded-xl p-5 transition-all hover:scale-[1.01] ${
                            won 
                              ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                              : 'border-red-500/30 hover:border-red-500/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-4 flex-1">
                              {position.icon && (
                                <img 
                                  src={position.icon} 
                                  alt={position.title}
                                  className="w-14 h-14 rounded-lg bg-slate-800 border border-slate-700/50"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-slate-200 font-semibold text-lg">
                                    {position.title}
                                  </h3>
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    won 
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                                  }`}>
                                    {won ? '✓ WIN' : '✗ LOSS'}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-4 text-sm mb-3">
                                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50">
                                    Bet: {position.outcome}
                                  </span>
                                  <span className="text-slate-500 text-xs">
                                    🕒 {new Date(position.timestamp * 1000).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-800/50">
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Bought At</p>
                                    <p className="text-slate-200 font-semibold">${position.avgPrice?.toFixed(3) || '0.000'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Exit Price</p>
                                    <p className="text-slate-200 font-semibold">${position.curPrice?.toFixed(3) || '0.000'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Size</p>
                                    <p className="text-slate-200 font-semibold">{position.totalBought?.toFixed(0) || '0'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Invested</p>
                                    <p className="text-slate-200 font-semibold">${investment.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">ROI</p>
                                    <p className={`font-bold ${won ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right ml-6">
                              <div className={`text-3xl font-bold ${won ? 'text-emerald-400' : 'text-red-400'}`}>
                                {position.realizedPnl >= 0 ? '+' : ''}{formatNumber(position.realizedPnl)}
                              </div>
                              <div className="text-slate-400 text-sm mt-1 font-medium">
                                P&L
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-slate-200">Activity Feed</h2>
                    <button
                      onClick={() => setShowResolvedOnly(!showResolvedOnly)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        showResolvedOnly
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/30'
                          : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-slate-300'
                      }`}
                    >
                      <span>{showResolvedOnly ? '✓' : '○'}</span>
                      <span>Resolved Buys Only</span>
                    </button>
                    {showResolvedOnly && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 text-sm font-medium">
                            Closed Positions: {closedPositions.length} loaded
                          </span>
                          <button
                            onClick={fetchClosedPositions}
                            disabled={closedLoading}
                            className="px-3 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg hover:bg-indigo-500/30 transition-all text-sm disabled:opacity-50"
                          >
                            {closedLoading ? '⟳' : '↻'} Refresh
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-slate-800/30 border border-slate-700/50 rounded-lg px-4 py-2">
                          <label className="text-slate-400 text-sm whitespace-nowrap">Min Bet:</label>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 text-sm font-medium min-w-[60px]">
                              ${minBetAmount.toLocaleString()}
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="10000"
                              step="10"
                              value={minBetAmount}
                              onChange={(e) => setMinBetAmount(Number(e.target.value))}
                              className="w-32 accent-indigo-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max="10000"
                              step="10"
                              value={minBetAmount}
                              onChange={(e) => setMinBetAmount(Math.max(0, Math.min(10000, Number(e.target.value))))}
                              className="bg-slate-900/50 border border-slate-700/50 text-slate-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-800/30 border border-slate-700/50 rounded-lg px-4 py-2">
                          <label className="text-slate-400 text-sm whitespace-nowrap">Buy Price:</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.01"
                              value={minBuyPrice}
                              onChange={(e) => setMinBuyPrice(Math.max(0, Math.min(1, Number(e.target.value))))}
                              className="bg-slate-900/50 border border-slate-700/50 text-slate-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={minBuyPrice}
                              onChange={(e) => setMinBuyPrice(Number(e.target.value))}
                              className="w-24 accent-indigo-500"
                            />
                          </div>
                          <span className="text-slate-400 text-sm">to</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.01"
                              value={maxBuyPrice}
                              onChange={(e) => setMaxBuyPrice(Math.max(0, Math.min(1, Number(e.target.value))))}
                              className="bg-slate-900/50 border border-slate-700/50 text-slate-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={maxBuyPrice}
                              onChange={(e) => setMaxBuyPrice(Number(e.target.value))}
                              className="w-24 accent-indigo-500"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-sm">Fetch:</span>
                    <select
                      value={activityLimit}
                      onChange={(e) => setActivityLimit(Number(e.target.value))}
                      className="bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={300}>300</option>
                      <option value={500}>500</option>
                      <option value={750}>750</option>
                      <option value={1000}>1000</option>
                      <option value={2500}>2500</option>
                      <option value={5000}>5000</option>
                      <option value={10000}>10000</option>
                      <option value={25000}>25000</option>
                      <option value={50000}>50000</option>
                    </select>
                    <span className="text-slate-400 text-sm">activities</span>
                  </div>
                </div>
                
                {showResolvedOnly && (() => {
                  const { trades: allTrades, stats } = getResolvedBuysWithStreaks()
                  
                  console.log('=== Deduplication Analysis ===')
                  console.log('Resolved buys before deduplication:', allTrades.length)
                  
                  // Deduplicate trades for accurate stats
                  const seen = new Set()
                  const duplicateKeys = new Map<string, number>()
                  
                  const uniqueTrades = allTrades.filter((item: any) => {
                    const uniqueKey = `${item.transactionHash}-${item.asset}-${item.outcomeIndex || 0}`
                    
                    // Track duplicates
                    duplicateKeys.set(uniqueKey, (duplicateKeys.get(uniqueKey) || 0) + 1)
                    
                    if (seen.has(uniqueKey)) {
                      return false
                    }
                    seen.add(uniqueKey)
                    return true
                  })
                  
                  console.log('Unique resolved buys after deduplication:', uniqueTrades.length)
                  console.log('Duplicates removed:', allTrades.length - uniqueTrades.length)
                  
                  // Log top duplicates
                  const sortedDuplicates = Array.from(duplicateKeys.entries())
                    .filter(([key, count]) => count > 1)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                  
                  console.log('Top 5 most duplicated trades:', sortedDuplicates.map(([key, count]) => 
                    `${key.slice(0, 20)}... (${count} times)`
                  ))
                  console.log('==============================')
                  
                  // Recalculate stats from deduplicated trades
                  let wins = 0
                  let losses = 0
                  let totalBuyPrice = 0
                  let totalWinPrice = 0
                  let totalLossPrice = 0
                  let currentWinStreak = 0
                  let currentLossStreak = 0
                  let maxWinStreak = 0
                  let maxLossStreak = 0
                  
                  uniqueTrades.forEach((trade: any) => {
                    totalBuyPrice += trade.price
                    if (trade.won) {
                      wins++
                      totalWinPrice += trade.price
                      currentWinStreak++
                      currentLossStreak = 0
                      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak
                    } else {
                      losses++
                      totalLossPrice += trade.price
                      currentLossStreak++
                      currentWinStreak = 0
                      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak
                    }
                  })
                  
                  const deduplicatedStats = {
                    totalResolved: uniqueTrades.length,
                    winRate: uniqueTrades.length > 0 ? (wins / uniqueTrades.length) * 100 : 0,
                    avgBuyPrice: uniqueTrades.length > 0 ? totalBuyPrice / uniqueTrades.length : 0,
                    avgWinBuyPrice: wins > 0 ? totalWinPrice / wins : 0,
                    avgLossBuyPrice: losses > 0 ? totalLossPrice / losses : 0,
                    totalWins: wins,
                    totalLosses: losses,
                    maxWinStreak,
                    maxLossStreak
                  }
                  
                  return (
                    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-6 mb-6">
                      <h3 className="text-lg font-bold text-indigo-300 mb-4">📊 Resolved Buys Stats</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Total Resolved</p>
                          <p className="text-2xl font-bold text-white">{deduplicatedStats.totalResolved}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Win Rate</p>
                          <p className="text-2xl font-bold text-indigo-400">{deduplicatedStats.winRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Avg Buy Price</p>
                          <p className="text-2xl font-bold text-blue-400">${deduplicatedStats.avgBuyPrice.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Avg Win Price</p>
                          <p className="text-2xl font-bold text-emerald-400">${deduplicatedStats.avgWinBuyPrice.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Avg Loss Price</p>
                          <p className="text-2xl font-bold text-red-400">${deduplicatedStats.avgLossBuyPrice.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Wins / Losses</p>
                          <p className="text-2xl font-bold text-white">
                            <span className="text-emerald-400">{deduplicatedStats.totalWins}</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-red-400">{deduplicatedStats.totalLosses}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Max Win Streak</p>
                          <p className="text-2xl font-bold text-emerald-400">🔥 {deduplicatedStats.maxWinStreak}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Max Loss Streak</p>
                          <p className="text-2xl font-bold text-red-400">❄️ {deduplicatedStats.maxLossStreak}</p>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
                        <button
                          onClick={() => {
                            const result = calculateStatSignificance(wins, uniqueTrades.length)
                            setStatTestResult(result)
                          }}
                          className="px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-lg hover:bg-purple-500/30 transition-all flex items-center gap-2 font-medium text-sm"
                        >
                          <span>🎲</span>
                          <span>Test Statistical Significance</span>
                        </button>
                        
                        <button
                          onClick={() => setShowBacktestModal(true)}
                          className="px-4 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg hover:bg-indigo-500/30 transition-all flex items-center gap-2 font-medium text-sm"
                        >
                          <span>📈</span>
                          <span>Run Backtest Simulation</span>
                        </button>
                        
                        <button
                          onClick={() => setShowAutoBacktestModal(true)}
                          className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg hover:bg-amber-500/30 transition-all flex items-center gap-2 font-medium text-sm"
                        >
                          <span>🤖</span>
                          <span>Auto Backtest (Brute Force)</span>
                        </button>
                        
                        {statTestResult && (
                          <div className={`px-4 py-2 rounded-lg border ${
                            statTestResult.error
                              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                              : statTestResult.isSignificant
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-red-500/10 border-red-500/30 text-red-300'
                          }`}>
                            {statTestResult.error ? (
                              <p className="text-sm">
                                ⚠️ {statTestResult.error} ({statTestResult.sampleSize} trades, need ≥50)
                              </p>
                            ) : statTestResult.isSignificant ? (
                              <p className="text-sm">
                                ✓ Statistically significant! (p={statTestResult.pValue.toFixed(4)}, z={statTestResult.zScore?.toFixed(2)})
                                <br />
                                <span className="text-xs opacity-75">Win rate: {statTestResult.winRate?.toFixed(1)}% - Pattern likely NOT random luck</span>
                              </p>
                            ) : (
                              <p className="text-sm">
                                ⚠️ Not statistically significant (p={statTestResult.pValue.toFixed(4)}, z={statTestResult.zScore?.toFixed(2)})
                                <br />
                                <span className="text-xs opacity-75">Win rate: {statTestResult.winRate?.toFixed(1)}% - Could be random chance</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {backtestResults && (
                        <div className="mt-6 bg-slate-800/30 border border-indigo-500/30 rounded-xl p-6">
                          <h4 className="text-lg font-bold text-indigo-300 mb-4 flex items-center gap-2">
                            <span>📊</span>
                            <span>Backtest Simulation Results</span>
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Simulations</p>
                              <p className="text-xl font-bold text-white">{backtestResults.totalSimulations}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Survived</p>
                              <p className="text-xl font-bold text-emerald-400">
                                {backtestResults.survivals} ({((backtestResults.survivals / backtestResults.totalSimulations) * 100).toFixed(1)}%)
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Bankrupted</p>
                              <p className="text-xl font-bold text-red-400">
                                {backtestResults.bankruptcies} ({((backtestResults.bankruptcies / backtestResults.totalSimulations) * 100).toFixed(1)}%)
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Doubled Money</p>
                              <p className="text-xl font-bold text-indigo-400">
                                {backtestResults.doubled} ({((backtestResults.doubled / backtestResults.totalSimulations) * 100).toFixed(1)}%)
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Avg Final Balance</p>
                              <p className="text-xl font-bold text-blue-400">${backtestResults.avgFinalBalance.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Worst Drawdown</p>
                              <p className="text-xl font-bold text-orange-400">${backtestResults.worstDrawdown.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Best Run</p>
                              <p className="text-lg font-bold text-emerald-400">${backtestResults.bestRun.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Worst Run</p>
                              <p className="text-lg font-bold text-red-400">${backtestResults.worstRun.toFixed(2)}</p>
                            </div>
                          </div>
                          <p className="mt-4 text-slate-400 text-sm">
                            Starting budget: ${backtestBudget.toFixed(2)} | Fixed bet: ${backtestFixedBet.toFixed(2)}
                          </p>
                        </div>
                      )}
                      
                      {autoBacktestResults.length > 0 && (
                        <div className="mt-6 bg-slate-800/30 border border-amber-500/30 rounded-xl p-6">
                          <h4 className="text-lg font-bold text-amber-300 mb-4 flex items-center gap-2">
                            <span>🤖</span>
                            <span>Auto Backtest Results</span>
                            <span className="text-sm font-normal text-slate-400">
                              ({autoBacktestResults.length} combinations tested)
                            </span>
                          </h4>
                          
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Rank</th>
                                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Min Bet</th>
                                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Price Range</th>
                                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Trades</th>
                                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Win Rate</th>
                                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Survival Rate</th>
                                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Avg Final $</th>
                                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Bankruptcies</th>
                                </tr>
                              </thead>
                              <tbody>
                                {autoBacktestResults.slice(0, 10).map((result, index) => (
                                  <tr key={index} className="border-b border-slate-800 hover:bg-slate-800/30">
                                    <td className="py-2 px-3 text-amber-400 font-bold">#{index + 1}</td>
                                    <td className="py-2 px-3 text-slate-200">${result.minBet}</td>
                                    <td className="py-2 px-3 text-slate-200">{result.priceRange}</td>
                                    <td className="py-2 px-3 text-right text-slate-200">{result.resolvedBuysCount}</td>
                                    <td className="py-2 px-3 text-right">
                                      <span className={result.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
                                        {result.winRate.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <span className={result.survivalRate >= 80 ? 'text-emerald-400' : result.survivalRate >= 50 ? 'text-amber-400' : 'text-red-400'}>
                                        {result.survivalRate.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <span className={result.avgFinalBalance >= backtestBudget ? 'text-emerald-400' : 'text-red-400'}>
                                        ${result.avgFinalBalance.toFixed(2)}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right text-red-400">
                                      {result.bankruptcies}/{result.totalSimulations}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          <p className="mt-4 text-slate-400 text-sm">
                            Budget: ${backtestBudget} | Bet: ${backtestFixedBet} | Min trades filter: {autoBacktestMinResolvedBuys}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {activityLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
                    <div className="text-slate-400 text-sm">
                      Fetching {activityLimit.toLocaleString()} activities...
                    </div>
                    <div className="text-indigo-400 font-mono text-lg">
                      {fetchElapsed}s
                    </div>
                  </div>
                ) : activity.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-lg">No activity found for this trader</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      let displayActivity = showResolvedOnly 
                        ? getResolvedBuysWithStreaks().trades
                        : activity
                      
                      // Deduplicate by creating unique identifier from transactionHash + asset + outcomeIndex
                      const seen = new Set()
                      displayActivity = displayActivity.filter((item: any) => {
                        const uniqueKey = `${item.transactionHash}-${item.asset}-${item.outcomeIndex || 0}`
                        if (seen.has(uniqueKey)) {
                          return false
                        }
                        seen.add(uniqueKey)
                        return true
                      })
                      
                      // Apply limit after deduplication
                      if (showResolvedOnly) {
                        displayActivity = displayActivity.slice(0, resolvedBuysLimit)
                      }
                      
                      return displayActivity.map((item: any, index: number) => {
                        const isResolved = 'won' in item
                        
                        return (
                      <div 
                        key={`${item.transactionHash}-${item.asset}-${item.outcomeIndex || 0}-${index}`}
                        className={`backdrop-blur-sm border rounded-xl p-5 transition-all ${
                          isResolved
                            ? item.won
                              ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50'
                              : 'bg-red-500/5 border-red-500/30 hover:border-red-500/50'
                            : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1">
                            {item.icon && (
                              <img 
                                src={item.icon} 
                                alt={item.title}
                                className="w-10 h-10 rounded-lg bg-slate-800"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-slate-200 font-medium">
                                  {item.title}
                                </h3>
                                {isResolved && (
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    item.won
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                                  }`}>
                                    {item.won ? '✓ WIN' : '✗ LOSS'}
                                  </span>
                                )}
                                {item.transactionHash && (
                                  <a
                                    href={`https://polygonscan.com/tx/${item.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 hover:border-purple-500/50 transition-all flex items-center gap-1"
                                    title="View on Polygonscan"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    TX
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center space-x-3 text-sm flex-wrap gap-y-1">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                  item.type === 'TRADE' 
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : item.type === 'SPLIT'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : item.type === 'MERGE'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : item.type === 'REDEEM'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : item.type === 'REWARD'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : item.type === 'MAKER_REBATE'
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                }`}>
                                  {item.type}
                                </span>
                                {item.side && (
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                    item.side === 'BUY' 
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}>
                                    {item.side}
                                  </span>
                                )}
                                {item.outcome && (
                                  <span className="text-slate-400">
                                    {item.outcome}
                                  </span>
                                )}
                                <span className="text-slate-500 text-xs">
                                  {new Date(item.timestamp * 1000).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right ml-4">
                            {isResolved && (
                              <div className="mb-2">
                                <div className={`text-xl font-bold ${item.won ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {item.pnl >= 0 ? '+' : ''}{formatNumber(item.pnl)}
                                </div>
                                <div className="text-slate-400 text-xs">
                                  {item.roi >= 0 ? '+' : ''}{item.roi.toFixed(1)}% ROI
                                </div>
                              </div>
                            )}
                            {item.size && item.price && (
                              <>
                                <div className="text-slate-200 font-semibold">
                                  {item.size?.toFixed(2) || '0.00'} @ ${item.price?.toFixed(3) || '0.000'}
                                </div>
                                <div className="text-slate-400 text-sm">
                                  {formatNumber((item.size || 0) * (item.price || 0))}
                                </div>
                              </>
                            )}
                            {item.usdcSize && !item.price && (
                              <div className="text-slate-200 font-semibold">
                                {formatNumber(item.usdcSize)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      )})
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Backtest Modal */}
      {showBacktestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-indigo-300 mb-6 flex items-center gap-3">
              <span>📈</span>
              <span>Backtest Simulation</span>
            </h3>
            
            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Starting Budget ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={backtestBudget}
                  onChange={(e) => setBacktestBudget(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={backtestRunning}
                />
                <p className="text-slate-400 text-sm mt-1">Initial budget for the simulation</p>
              </div>
              
              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Fixed Bet Amount ($)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={backtestFixedBet}
                  onChange={(e) => setBacktestFixedBet(Math.max(0.1, Number(e.target.value)))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={backtestRunning}
                />
                <p className="text-slate-400 text-sm mt-1">Amount to bet on each trade</p>
              </div>
              
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                <p className="text-slate-300 text-sm mb-2">
                  <span className="font-semibold">What this does:</span>
                </p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Simulates starting copy trading at every possible historical point with your filtered trades. 
                  Shows how often you would have survived vs gone bankrupt (budget &lt; bet amount).
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBacktestModal(false)
                  setBacktestResults(null)
                }}
                disabled={backtestRunning}
                className="flex-1 px-6 py-3 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700/70 transition-all font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowBacktestModal(false)
                  runBacktestSimulation()
                }}
                disabled={backtestRunning}
                className="flex-1 px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {backtestRunning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Run Simulation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Auto Backtest Modal */}
      {showAutoBacktestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-amber-300 mb-6 flex items-center gap-3">
              <span>🤖</span>
              <span>Auto Backtest (Brute Force)</span>
            </h3>
            
            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Starting Budget ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={backtestBudget}
                  onChange={(e) => setBacktestBudget(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  disabled={autoBacktestRunning}
                />
              </div>
              
              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Fixed Bet Amount ($)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={backtestFixedBet}
                  onChange={(e) => setBacktestFixedBet(Math.max(0.1, Number(e.target.value)))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  disabled={autoBacktestRunning}
                />
              </div>
              
              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Minimum Resolved Buys Required
                </label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={autoBacktestMinResolvedBuys}
                  onChange={(e) => setAutoBacktestMinResolvedBuys(Math.max(10, Number(e.target.value)))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  disabled={autoBacktestRunning}
                />
                <p className="text-slate-400 text-sm mt-1">Skip filter combinations with fewer trades than this</p>
              </div>
              
              {autoBacktestRunning && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <p className="text-amber-300 text-sm font-medium mb-2">
                    Testing combinations... {autoBacktestProgress.current}/{autoBacktestProgress.total}
                  </p>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(autoBacktestProgress.current / autoBacktestProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                <p className="text-slate-300 text-sm mb-2">
                  <span className="font-semibold">What this does:</span>
                </p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Tests ALL combinations of min bet filters (0, 1, 5, 10, 20, 50, 100) and price ranges 
                  (0-0.3, 0-0.5, 0.3-0.7, 0.4-0.6, 0.5-1, 0.7-1, All). 
                  Runs full backtest simulation for each and ranks them by survival rate.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAutoBacktestModal(false)
                  setAutoBacktestResults([])
                }}
                disabled={autoBacktestRunning}
                className="flex-1 px-6 py-3 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700/70 transition-all font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAutoBacktestModal(false)
                  runAutoBacktest()
                }}
                disabled={autoBacktestRunning}
                className="flex-1 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {autoBacktestRunning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <span>🤖</span>
                    <span>Run Auto Backtest</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
