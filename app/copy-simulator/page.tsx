'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// IndexedDB utilities for unlimited storage
const DB_NAME = 'PolyAgentDB'
const DB_VERSION = 1
const STORE_NAME = 'copyTrades'

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

const saveToIndexedDB = async (key: string, value: any): Promise<void> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(value, key)
    
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

const loadFromIndexedDB = async (key: string): Promise<any> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(key)
    
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

interface CopyTrade {
  id: string
  name: string
  traderAddress: string
  initialBudget: number
  currentBudget: number
  fixedBetAmount: number
  minTriggerAmount: number
  minPrice: number
  maxPrice: number
  isActive: boolean
  createdAt: number
  lastChecked: number
  trades: SimulatedTrade[]
  isArchived?: boolean // New field for archived runs
  autoRefresh?: boolean // Auto-refresh enabled
  autoRefreshInterval?: number // Interval in minutes
}

interface SimulatedTrade {
  id: string
  originalTrade: any // The trader's original trade
  timestamp: number
  market: string
  outcome: string
  price: number
  amount: number // Our fixed bet amount
  asset: string // Asset ID for resolution tracking
  conditionId: string // Condition ID for resolution tracking
  slug?: string // Slug for matching
  transactionHash: string // Transaction hash for deduplication
  icon?: string // Market icon
  status: 'open' | 'won' | 'lost'
  pnl?: number
  roi?: number
}

export default function CopySimulatorPage() {
  const router = useRouter()
  const [copyTrades, setCopyTrades] = useState<CopyTrade[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [checkingResolutionsId, setCheckingResolutionsId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info' | 'warning'} | null>(null)
  const [activeView, setActiveView] = useState<'list' | 'analysis'>('list')
  const [showArchived, setShowArchived] = useState(false)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [configNames, setConfigNames] = useState<{[key: string]: string}>({})
  const [showOptimizationModal, setShowOptimizationModal] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizationResults, setOptimizationResults] = useState<{
    configKey: string
    configName: string
    currentStats: {
      totalTrades: number
      winRate: number
      avgPnl: number
    }
    suggestions: Array<{
      type: 'price' | 'minTrigger'
      current: string
      suggested: string
      improvement: {
        trades: number
        winRate: number
        avgPnl: number
        totalPnlDiff: number
      }
    }>
  } | null>(null)
  const [manualTestTrigger, setManualTestTrigger] = useState<string>('')
  const [manualTestResults, setManualTestResults] = useState<{
    trades: number
    winRate: number
    avgPnl: number
    totalPnl: number
  } | null>(null)
  const [autoFindingTrigger, setAutoFindingTrigger] = useState(false)
  const [minTradesForTrigger, setMinTradesForTrigger] = useState<number>(50)
  const [autoTriggerResults, setAutoTriggerResults] = useState<Array<{
    trigger: number
    trades: number
    winRate: number
    avgPnl: number
    totalPnl: number
  }> | null>(null)
  const [autoFindingPriceRange, setAutoFindingPriceRange] = useState(false)
  const [minTradesForPriceRange, setMinTradesForPriceRange] = useState<number>(50)
  const [autoPriceRangeResults, setAutoPriceRangeResults] = useState<Array<{
    minPrice: number
    maxPrice: number
    rangeLabel: string
    trades: number
    winRate: number
    avgPnl: number
    totalPnl: number
  }> | null>(null)
  const [combinedOptimizationResult, setCombinedOptimizationResult] = useState<{
    trades: number
    winRate: number
    avgPnl: number
    totalPnl: number
    trigger: number
    minPrice: number
    maxPrice: number
    rangeLabel: string
  } | null>(null)
  const [showSuperOptimizerModal, setShowSuperOptimizerModal] = useState(false)
  const [superOptimizing, setSuperOptimizing] = useState(false)
  const [selectedTraderForSuper, setSelectedTraderForSuper] = useState<string>('')
  const [superOptimizerResults, setSuperOptimizerResults] = useState<{
    traderAddress: string
    analyzedConfigs: number
    totalRuns: number
    totalTrades: number
    optimalStrategy: {
      initialBudget: number
      fixedBetAmount: number
      minPrice: number
      maxPrice: number
      minTriggerAmount: number
      expectedWinRate: number
      expectedAvgPnl: number
      bankruptcyRisk: number
      reasoning: {
        budget: string
        fixedBet: string
        priceRange: string
        minTrigger: string
      }
    }
    configComparison: Array<{
      configKey: string
      configName: string
      settings: {
        initialBudget: number
        fixedBetAmount: number
        minPrice: number
        maxPrice: number
        minTriggerAmount: number
      }
      stats: {
        runs: number
        totalTrades: number
        winRate: number
        avgPnl: number
        bankruptcyRate: number
        totalPnl: number
      }
    }>
  } | null>(null)
  const [showChartModal, setShowChartModal] = useState(false)
  const [chartData, setChartData] = useState<{
    runName: string
    runId: string
    dataPoints: Array<{ tradeNumber: number, cumulativePnl: number, timestamp: number }>
    projectedSlope: number
    individualRuns?: Array<{
      runName: string
      runId: string
      dataPoints: Array<{ tradeNumber: number, cumulativePnl: number, timestamp: number }>
      color: string
    }>
  } | null>(null)
  const [autoRefreshTimers, setAutoRefreshTimers] = useState<{[key: string]: NodeJS.Timeout}>({})
  const [showPriceAnalysisModal, setShowPriceAnalysisModal] = useState(false)
  const [priceAnalysisData, setPriceAnalysisData] = useState<{
    configName: string
    ranges: Array<{
      rangeLabel: string
      minPrice: number
      maxPrice: number
      totalTrades: number
      wonTrades: number
      winRate: number
    }>
  } | null>(null)
  const [autoBacktesting, setAutoBacktesting] = useState(false)
  const [autoBacktestProgress, setAutoBacktestProgress] = useState<{
    current: number
    total: number
    currentConfig: string
  } | null>(null)
  
  // Pagination for trades display
  const [visibleTradesPerRun, setVisibleTradesPerRun] = useState<Map<string, number>>(new Map())
  const TRADES_PER_PAGE = 100
  
  const [showAutoBacktestModal, setShowAutoBacktestModal] = useState(false)
  const [autoBacktestResults, setAutoBacktestResults] = useState<{
    traderAddress: string
    totalSimulations: number
    bestStrategy: {
      initialBudget: number
      fixedBetAmount: number
      minPrice: number
      maxPrice: number
      minTriggerAmount: number
      avgPnl: number
      winRate: number
      bankruptcyRate: number
      totalTrades: number
      totalPnl: number
      runs: number
    }
    allResults: Array<{
      config: string
      initialBudget: number
      fixedBetAmount: number
      minPrice: number
      maxPrice: number
      minTriggerAmount: number
      avgPnl: number
      winRate: number
      bankruptcyRate: number
      totalTrades: number
      totalPnl: number
      runs: number
    }>
  } | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [traderAddress, setTraderAddress] = useState('')
  const [initialBudget, setInitialBudget] = useState(100)
  const [fixedBetAmount, setFixedBetAmount] = useState(10)
  const [minTriggerAmount, setMinTriggerAmount] = useState(10)
  const [minPrice, setMinPrice] = useState(0.5)
  const [maxPrice, setMaxPrice] = useState(0.66)

  // Load copy trades from IndexedDB (with localStorage fallback for migration)
  useEffect(() => {
    const loadData = async () => {
      try {
        // Try IndexedDB first
        const indexedData = await loadFromIndexedDB('copyTrades')
        if (indexedData) {
          console.log('✅ Loaded data from IndexedDB')
          setCopyTrades(indexedData)
          return
        }
        
        // Fallback to localStorage for migration
        const saved = localStorage.getItem('copyTrades')
        if (saved) {
          console.log('📦 Migrating data from localStorage to IndexedDB...')
          const parsed = JSON.parse(saved)
          
          // Migration: Clean up old trades with duplicate IDs and fix timestamps
          const cleaned = parsed.map((ct: CopyTrade) => {
            // Remove duplicate trades based on transaction hash + asset
            const seenTrades = new Set<string>()
            const uniqueTrades = ct.trades.filter(trade => {
              const key = `${trade.originalTrade?.transactionHash || 'unknown'}-${trade.asset}`
              if (seenTrades.has(key)) {
                return false // Skip duplicate
              }
              seenTrades.add(key)
              return true
            })
            
            // Regenerate IDs and ensure proper timestamps
            const fixedTrades = uniqueTrades.map((trade, index) => ({
              ...trade,
              id: `${trade.asset}-${trade.timestamp}-${index}-${Math.random().toString(36).substring(7)}`,
              timestamp: typeof trade.timestamp === 'number' && trade.timestamp > 1000000000000 
                ? trade.timestamp 
                : trade.timestamp * 1000, // Convert seconds to milliseconds if needed
              market: trade.market || 'Unknown Market (old data)',
              outcome: trade.outcome || 'Unknown'
            }))
            
            console.log(`Cleaned ${ct.name}: ${ct.trades.length} → ${fixedTrades.length} trades`)
            
            return {
              ...ct,
              trades: fixedTrades
            }
          })
          
          // Log warning if any trades have missing market data
          const tradesWithoutMarket = cleaned.reduce((sum: number, ct: CopyTrade) => 
            sum + ct.trades.filter((t: any) => t.market === 'Unknown Market (old data)').length, 0
          )
          if (tradesWithoutMarket > 0) {
            console.warn(`⚠️ ${tradesWithoutMarket} trades have missing market data. Consider clearing old data.`)
          }
          
          setCopyTrades(cleaned)
          // Save to IndexedDB
          await saveToIndexedDB('copyTrades', cleaned)
          console.log('✅ Migration complete! Data saved to IndexedDB')
          // Clear localStorage after successful migration
          localStorage.removeItem('copyTrades')
        }
      } catch (error) {
        console.error('Failed to load copy trades:', error)
      }
    }
    
    loadData()
  }, [])

  // Load config names from IndexedDB (with localStorage fallback)
  useEffect(() => {
    const loadConfigNames = async () => {
      try {
        // Try IndexedDB first
        const indexedData = await loadFromIndexedDB('configNames')
        if (indexedData) {
          setConfigNames(indexedData)
          return
        }
        
        // Fallback to localStorage
        const saved = localStorage.getItem('configNames')
        if (saved) {
          const parsed = JSON.parse(saved)
          setConfigNames(parsed)
          // Migrate to IndexedDB
          await saveToIndexedDB('configNames', parsed)
          localStorage.removeItem('configNames')
        }
      } catch (error) {
        console.error('Failed to load config names:', error)
      }
    }
    
    loadConfigNames()
  }, [])

  // Save to IndexedDB whenever copyTrades changes
  useEffect(() => {
    if (copyTrades.length > 0) {
      saveToIndexedDB('copyTrades', copyTrades).catch(error => {
        console.error('Failed to save copy trades:', error)
        setNotification({
          type: 'warning',
          message: '⚠️ Failed to save data'
        })
      })
    }
  }, [copyTrades])

  // Save config names to IndexedDB
  useEffect(() => {
    if (Object.keys(configNames).length > 0) {
      saveToIndexedDB('configNames', configNames).catch(error => {
        console.error('Failed to save config names:', error)
      })
    }
  }, [configNames])

  // Auto-refresh management
  useEffect(() => {
    // Start timers for runs with auto-refresh enabled
    copyTrades.forEach(ct => {
      if (ct.autoRefresh && !ct.isArchived && !autoRefreshTimers[ct.id]) {
        const interval = (ct.autoRefreshInterval || 5) * 60 * 1000 // Convert minutes to ms
        console.log(`🔄 Starting auto-refresh for ${ct.name} every ${ct.autoRefreshInterval || 5} minutes`)
        
        const timer = setInterval(() => {
          console.log(`⏰ Auto-refreshing ${ct.name}...`)
          refreshCopyTrade(ct.id)
        }, interval)
        
        setAutoRefreshTimers(prev => ({ ...prev, [ct.id]: timer }))
      }
    })

    // Cleanup: clear timers for runs that no longer have auto-refresh
    Object.keys(autoRefreshTimers).forEach(id => {
      const run = copyTrades.find(ct => ct.id === id)
      if (!run || !run.autoRefresh || run.isArchived) {
        console.log(`🛑 Stopping auto-refresh for run ${id}`)
        clearInterval(autoRefreshTimers[id])
        setAutoRefreshTimers(prev => {
          const newTimers = { ...prev }
          delete newTimers[id]
          return newTimers
        })
      }
    })

    // Cleanup all timers on unmount
    return () => {
      Object.values(autoRefreshTimers).forEach(timer => clearInterval(timer))
    }
  }, [copyTrades])

  const showRunChart = (runId: string) => {
    const run = copyTrades.find(ct => ct.id === runId)
    if (!run) return

    // Get closed trades sorted by timestamp
    const closedTrades = run.trades
      .filter(t => t.status !== 'open')
      .sort((a, b) => a.timestamp - b.timestamp)

    if (closedTrades.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No closed trades to chart'
      })
      setTimeout(() => setNotification(null), 2000)
      return
    }

    // Calculate cumulative P&L for each trade
    let cumulativePnl = 0
    const dataPoints = closedTrades.map((trade, index) => {
      cumulativePnl += (trade.pnl || 0)
      return {
        tradeNumber: index + 1,
        cumulativePnl,
        timestamp: trade.timestamp
      }
    })

    // Calculate linear regression for projection line
    const n = dataPoints.length
    const sumX = dataPoints.reduce((sum, p) => sum + p.tradeNumber, 0)
    const sumY = dataPoints.reduce((sum, p) => sum + p.cumulativePnl, 0)
    const sumXY = dataPoints.reduce((sum, p) => sum + p.tradeNumber * p.cumulativePnl, 0)
    const sumX2 = dataPoints.reduce((sum, p) => sum + p.tradeNumber * p.tradeNumber, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    setChartData({
      runName: run.name,
      runId: run.id,
      dataPoints,
      projectedSlope: slope
    })
    setShowChartModal(true)
  }

  const showConfigChart = (group: any) => {
    const configName = configNames[group.configKey] || `Configuration #${strategyGroups.indexOf(group) + 1}`
    
    // Get all runs for this configuration
    const runs = copyTrades.filter(ct => {
      const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
      return key === group.configKey
    })

    // Colors for individual runs
    const colors = [
      '#10b981', // emerald
      '#3b82f6', // blue
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316', // orange
      '#14b8a6', // teal
      '#a855f7', // purple
    ]

    // Generate data for each individual run
    const individualRuns = runs.map((run, idx) => {
      const closedTrades = run.trades
        .filter(t => t.status !== 'open')
        .sort((a, b) => a.timestamp - b.timestamp)
      
      let cumulativePnl = 0
      const dataPoints = closedTrades.map((trade, index) => {
        cumulativePnl += (trade.pnl || 0)
        return {
          tradeNumber: index + 1,
          cumulativePnl,
          timestamp: trade.timestamp
        }
      })
      
      return {
        runName: run.name,
        runId: run.id,
        dataPoints,
        color: colors[idx % colors.length]
      }
    }).filter(run => run.dataPoints.length > 0)

    if (individualRuns.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No closed trades to chart'
      })
      setTimeout(() => setNotification(null), 2000)
      return
    }

    // Collect all trades from all runs for combined view
    const allTrades: Array<{ trade: SimulatedTrade, runName: string }> = []
    runs.forEach(run => {
      run.trades
        .filter(t => t.status !== 'open')
        .forEach(trade => {
          allTrades.push({ trade, runName: run.name })
        })
    })

    // Sort by timestamp
    allTrades.sort((a, b) => a.trade.timestamp - b.trade.timestamp)

    // Calculate cumulative P&L across all runs (combined)
    let cumulativePnl = 0
    const dataPoints = allTrades.map((item, index) => {
      cumulativePnl += (item.trade.pnl || 0)
      return {
        tradeNumber: index + 1,
        cumulativePnl,
        timestamp: item.trade.timestamp
      }
    })

    // Calculate linear regression for projection line based on ALL data
    const n = dataPoints.length
    const sumX = dataPoints.reduce((sum, p) => sum + p.tradeNumber, 0)
    const sumY = dataPoints.reduce((sum, p) => sum + p.cumulativePnl, 0)
    const sumXY = dataPoints.reduce((sum, p) => sum + p.tradeNumber * p.cumulativePnl, 0)
    const sumX2 = dataPoints.reduce((sum, p) => sum + p.tradeNumber * p.tradeNumber, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    setChartData({
      runName: `${configName} (${runs.length} run${runs.length !== 1 ? 's' : ''})`,
      runId: group.configKey,
      dataPoints,
      projectedSlope: slope,
      individualRuns
    })
    setShowChartModal(true)
  }

  const createCopyTrade = () => {
    if (!name || !traderAddress) {
      alert('Please fill in name and trader address')
      return
    }

    const newCopyTrade: CopyTrade = {
      id: Date.now().toString(),
      name,
      traderAddress: traderAddress.toLowerCase(),
      initialBudget,
      currentBudget: initialBudget,
      fixedBetAmount,
      minTriggerAmount,
      minPrice,
      maxPrice,
      isActive: true,
      createdAt: Date.now(),
      lastChecked: Date.now(),
      trades: []
    }

    setCopyTrades([...copyTrades, newCopyTrade])
    setShowCreateModal(false)
    
    // Reset form
    setName('')
    setTraderAddress('')
    setInitialBudget(100)
    setFixedBetAmount(10)
    setMinTriggerAmount(10)
    setMinPrice(0.5)
    setMaxPrice(0.66)
  }

  const refreshCopyTrade = async (copyTradeId: string) => {
    const copyTrade = copyTrades.find(ct => ct.id === copyTradeId)
    if (!copyTrade) return

    setRefreshingId(copyTradeId)

    console.log('🔄 Refreshing copy trade:', {
      name: copyTrade.name,
      createdAt: new Date(copyTrade.createdAt).toLocaleString(),
      lastChecked: new Date(copyTrade.lastChecked).toLocaleString(),
      timeSinceCreation: `${((Date.now() - copyTrade.createdAt) / 1000 / 60).toFixed(1)} minutes`,
      timeSinceLastCheck: `${((Date.now() - copyTrade.lastChecked) / 1000 / 60).toFixed(1)} minutes`
    })

    try {
      // Step 1: Check for resolved trades
      const openTrades = copyTrade.trades.filter(t => t.status === 'open')
      
      let resolvedTrades: any[] = []
      if (openTrades.length > 0) {
        const resolveResponse = await fetch('/api/copy-trade-resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            traderAddress: copyTrade.traderAddress,
            openTrades: openTrades.map(t => ({
              id: t.id,
              asset: t.asset,
              conditionId: t.conditionId,
              slug: t.originalTrade.slug, // Include slug for matching
              amount: t.amount,
              price: t.price,
              // PRESERVE ALL DISPLAY DATA
              market: t.market,
              outcome: t.outcome,
              timestamp: t.timestamp,
              icon: t.icon,
              transactionHash: t.transactionHash,
              originalTrade: t.originalTrade
            }))
          })
        })

        const resolveData = await resolveResponse.json()
        resolvedTrades = resolveData.resolvedTrades || []

        // Update resolved trades and add budget back
        if (resolvedTrades.length > 0) {
          const updatedTrades = copyTrade.trades.map(trade => {
            const resolved = resolvedTrades.find((rt: any) => rt.id === trade.id)
            return resolved || trade
          })

          // Calculate budget return
          let budgetReturn = 0
          resolvedTrades.forEach((rt: any) => {
            if (rt.status === 'won') {
              // Return original bet + profit
              budgetReturn += rt.amount + rt.pnl
            }
            // If lost, we already deducted the bet, so no return
          })

          copyTrade.trades = updatedTrades
          copyTrade.currentBudget += budgetReturn
        }
      }

      // Step 2: Scan for new trades
      // Calculate the ACTUAL remaining budget
      // Formula: Initial Budget + Closed Trades P&L - Open Trades Cost
      const closedTrades = copyTrade.trades.filter(t => t.status !== 'open')
      const stillOpenTrades = copyTrade.trades.filter(t => t.status === 'open')
      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      const openTradesCost = stillOpenTrades.length * copyTrade.fixedBetAmount
      let actualRemainingBudget = copyTrade.initialBudget + totalPnl - openTradesCost
      
      // CRITICAL: If budget is negative or zero, don't allow any new trades
      if (actualRemainingBudget < copyTrade.fixedBetAmount) {
        actualRemainingBudget = 0
      }
      
      console.log('💰 Budget calculation:', {
        initialBudget: copyTrade.initialBudget,
        closedTradesPnl: totalPnl,
        openTradesCount: stillOpenTrades.length,
        openTradesCost,
        actualRemainingBudget,
        currentBudget: copyTrade.currentBudget,
        fixedBetAmount: copyTrade.fixedBetAmount,
        canAffordTrade: actualRemainingBudget >= copyTrade.fixedBetAmount,
        totalTradesCount: copyTrade.trades.length
      })
      
      const scanResponse = await fetch('/api/copy-trade-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traderAddress: copyTrade.traderAddress,
          lastCheckedTimestamp: copyTrade.lastChecked,
          createdAtTimestamp: copyTrade.createdAt,
          minTriggerAmount: copyTrade.minTriggerAmount,
          minPrice: copyTrade.minPrice,
          maxPrice: copyTrade.maxPrice,
          currentBudget: actualRemainingBudget, // Use actual remaining budget
          fixedBetAmount: copyTrade.fixedBetAmount,
          existingTradeIds: copyTrade.trades.map(t => t.transactionHash) // Pass existing trades
        })
      })

      const scanData = await scanResponse.json()
      const newTrades = scanData.newTrades || []
      const budgetUsed = scanData.budgetUsed || 0
      const totalNewMatches = scanData.totalNewMatches || 0

      console.log('📊 Scan completed:', {
        totalMatching: totalNewMatches,
        copied: newTrades.length,
        budgetUsed,
        budgetRemaining: copyTrade.currentBudget - budgetUsed
      })
      
      // Log the FULL scan response for debugging
      console.log('🔍 FULL SCAN RESPONSE:', JSON.stringify(scanData, null, 2))

      // Step 3: Add new simulated trades and update budget
      if (newTrades.length > 0) {
        copyTrade.trades = [...newTrades, ...copyTrade.trades]
        copyTrade.currentBudget = actualRemainingBudget - budgetUsed // Update to actual budget
        console.log(`✅ Added ${newTrades.length} new trades. Total trades now: ${copyTrade.trades.length}`)
        console.log(`💰 Budget after new trades: ${copyTrade.currentBudget}`)
        setNotification({
          message: `Found ${newTrades.length} new trade${newTrades.length > 1 ? 's' : ''} to copy!`,
          type: 'success'
        })
        setTimeout(() => setNotification(null), 5000)
      } else {
        // Even if no new trades, sync the current budget
        copyTrade.currentBudget = actualRemainingBudget
        console.log('ℹ️ No new trades found matching criteria')
        setNotification({
          message: 'No new trades found matching your criteria',
          type: 'info'
        })
        setTimeout(() => setNotification(null), 3000)
      }

      // Show notification for resolved trades
      if (resolvedTrades.length > 0) {
        const won = resolvedTrades.filter((t: any) => t.status === 'won').length
        const lost = resolvedTrades.filter((t: any) => t.status === 'lost').length
        setTimeout(() => {
          setNotification({
            message: `${resolvedTrades.length} trade${resolvedTrades.length > 1 ? 's' : ''} resolved: ${won} won, ${lost} lost`,
            type: won > lost ? 'success' : 'warning'
          })
          setTimeout(() => setNotification(null), 5000)
        }, 500)
      }

      // Update lastChecked timestamp
      copyTrade.lastChecked = Date.now()

      // Save updated copy trades
      const updatedCopyTrades = copyTrades.map(ct => 
        ct.id === copyTradeId ? copyTrade : ct
      )
      setCopyTrades(updatedCopyTrades)
      
      console.log(`Refreshed ${copyTrade.name}:`, {
        newTrades: newTrades.length,
        resolvedTrades: resolvedTrades.length,
        budgetUsed,
        currentBudget: copyTrade.currentBudget
      })
    } catch (error) {
      console.error('Error refreshing copy trade:', error)
    } finally {
      setRefreshingId(null)
    }
  }
  
  // Fast check for resolutions only - doesn't scan for new trades
  const checkResolutions = async (copyTradeId: string) => {
    const copyTrade = copyTrades.find(ct => ct.id === copyTradeId)
    if (!copyTrade) return

    setCheckingResolutionsId(copyTradeId)

    console.log('🔍 Checking resolutions for:', copyTrade.name)

    try {
      // Only check open trades for resolution
      const openTrades = copyTrade.trades.filter(t => t.status === 'open')
      
      if (openTrades.length === 0) {
        setNotification({
          message: 'No open trades to check',
          type: 'info'
        })
        setTimeout(() => setNotification(null), 2000)
        setCheckingResolutionsId(null)
        return
      }

      console.log(`📋 Checking ${openTrades.length} open trades for resolution...`)

      const resolveResponse = await fetch('/api/copy-trade-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traderAddress: copyTrade.traderAddress,
          openTrades: openTrades.map(t => ({
            id: t.id,
            asset: t.asset,
            conditionId: t.conditionId,
            slug: t.originalTrade.slug,
            amount: t.amount,
            price: t.price,
            market: t.market,
            outcome: t.outcome,
            timestamp: t.timestamp,
            icon: t.icon,
            transactionHash: t.transactionHash,
            originalTrade: t.originalTrade
          }))
        })
      })

      const resolveData = await resolveResponse.json()
      const resolvedTrades = resolveData.resolvedTrades || []

      if (resolvedTrades.length > 0) {
        console.log(`✅ Found ${resolvedTrades.length} resolved trades`)

        // Update trades with resolved status
        const resolvedIds = new Set(resolvedTrades.map((t: any) => t.id))
        copyTrade.trades = copyTrade.trades.map(trade => {
          const resolved = resolvedTrades.find((t: any) => t.id === trade.id)
          return resolved || trade
        })

        // Return funds from resolved trades
        const fundsReturned = resolvedTrades.reduce((sum: number, t: any) => {
          if (t.status === 'won') {
            return sum + t.amount + (t.pnl || 0)
          } else {
            return sum // Lost trades don't return funds
          }
        }, 0)

        copyTrade.currentBudget += fundsReturned

        const won = resolvedTrades.filter((t: any) => t.status === 'won').length
        const lost = resolvedTrades.filter((t: any) => t.status === 'lost').length

        // Calculate total P&L from resolved trades
        const totalPnL = resolvedTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0)

        setNotification({
          message: `${resolvedTrades.length} trade${resolvedTrades.length > 1 ? 's' : ''} resolved: ${won} won, ${lost} lost`,
          type: won > lost ? 'success' : 'warning'
        })
        setTimeout(() => setNotification(null), 5000)

        // Send Telegram notification
        try {
          await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `
🔔 *Manual Resolution Check*

Config: *${copyTrade.name}*
Resolved: *${resolvedTrades.length} trade${resolvedTrades.length > 1 ? 's' : ''}*
✅ Won: ${won}
❌ Lost: ${lost}
💰 Total P&L: $${totalPnL.toFixed(2)}
📊 Current Budget: $${copyTrade.currentBudget.toFixed(2)}
              `.trim()
            })
          })
          console.log('✅ Telegram notification sent')
        } catch (error) {
          console.error('Failed to send Telegram notification:', error)
          // Don't fail the whole operation if Telegram fails
        }

        // Save updated copy trades
        const updatedCopyTrades = copyTrades.map(ct => 
          ct.id === copyTradeId ? copyTrade : ct
        )
        setCopyTrades(updatedCopyTrades)
      } else {
        console.log('ℹ️ No trades have resolved yet')
        setNotification({
          message: 'No trades have resolved yet',
          type: 'info'
        })
        setTimeout(() => setNotification(null), 3000)
      }
    } catch (error) {
      console.error('Error checking resolutions:', error)
      setNotification({
        message: 'Error checking resolutions',
        type: 'warning'
      })
      setTimeout(() => setNotification(null), 3000)
    } finally {
      setCheckingResolutionsId(null)
    }
  }

  const toggleActive = (copyTradeId: string) => {
    setCopyTrades(copyTrades.map(ct => 
      ct.id === copyTradeId 
        ? { ...ct, isActive: !ct.isActive }
        : ct
    ))
  }

  const toggleAutoRefresh = (copyTradeId: string, interval: number = 5) => {
    setCopyTrades(copyTrades.map(ct => {
      if (ct.id === copyTradeId) {
        const newAutoRefresh = !ct.autoRefresh
        console.log(`${newAutoRefresh ? '✅ Enabling' : '❌ Disabling'} auto-refresh for ${ct.name}`)
        return { 
          ...ct, 
          autoRefresh: newAutoRefresh,
          autoRefreshInterval: interval 
        }
      }
      return ct
    }))
  }

  const showPriceAnalysis = (group: any) => {
    const configName = configNames[group.configKey] || `Configuration #${strategyGroups.indexOf(group) + 1}`
    
    // Get all runs for this configuration
    const runs = copyTrades.filter(ct => {
      const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
      return key === group.configKey
    })

    // Collect all closed trades from all runs
    const allClosedTrades = runs.flatMap(r => r.trades.filter(t => t.status !== 'open'))

    if (allClosedTrades.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No closed trades to analyze'
      })
      setTimeout(() => setNotification(null), 2000)
      return
    }

    // Define price ranges
    const priceRanges = [
      { min: 0.01, max: 0.10 },
      { min: 0.11, max: 0.20 },
      { min: 0.21, max: 0.30 },
      { min: 0.31, max: 0.40 },
      { min: 0.41, max: 0.50 },
      { min: 0.51, max: 0.60 },
      { min: 0.61, max: 0.70 },
      { min: 0.71, max: 0.80 },
      { min: 0.81, max: 0.90 },
      { min: 0.91, max: 0.99 }
    ]

    // Analyze each range
    const rangeAnalysis = priceRanges.map(range => {
      const tradesInRange = allClosedTrades.filter(t => 
        t.price >= range.min && t.price <= range.max
      )
      const wonInRange = tradesInRange.filter(t => t.status === 'won').length
      const winRate = tradesInRange.length > 0 ? (wonInRange / tradesInRange.length) * 100 : 0

      return {
        rangeLabel: `$${range.min.toFixed(2)} - $${range.max.toFixed(2)}`,
        minPrice: range.min,
        maxPrice: range.max,
        totalTrades: tradesInRange.length,
        wonTrades: wonInRange,
        winRate
      }
    })

    setPriceAnalysisData({
      configName,
      ranges: rangeAnalysis
    })
    setShowPriceAnalysisModal(true)
  }

  const quickAddRunFromConfig = (group: any) => {
    // Pre-fill form with configuration settings
    setTraderAddress(group.traderAddress)
    setInitialBudget(group.initialBudget)
    setFixedBetAmount(group.fixedBetAmount)
    setMinTriggerAmount(group.minTriggerAmount)
    setMinPrice(group.minPrice)
    setMaxPrice(group.maxPrice)
    setName('') // Leave name blank for user to fill
    
    // Open the create modal
    setShowCreateModal(true)
    
    setNotification({
      message: 'Configuration loaded! Just add a name and create.',
      type: 'info'
    })
    setTimeout(() => setNotification(null), 3000)
  }

  const deleteCopyTrade = (copyTradeId: string) => {
    if (confirm('Are you sure you want to delete this copy trade?')) {
      setCopyTrades(copyTrades.filter(ct => ct.id !== copyTradeId))
    }
  }

  const clearAllData = () => {
    if (confirm('⚠️ This will delete ALL copy trades and their history. Are you sure?')) {
      localStorage.removeItem('copyTrades')
      setCopyTrades([])
      setNotification({
        message: 'All data cleared successfully',
        type: 'success'
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const archiveBankruptRuns = () => {
    const bankruptRuns = copyTrades.filter(ct => {
      const closedTrades = ct.trades.filter(t => t.status !== 'open')
      const runPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      const remainingBudget = ct.initialBudget + runPnl
      return remainingBudget < ct.fixedBetAmount && !ct.isArchived
    })

    if (bankruptRuns.length === 0) {
      setNotification({
        message: 'No bankrupt runs to archive',
        type: 'info'
      })
      setTimeout(() => setNotification(null), 3000)
      return
    }

    if (confirm(`Archive ${bankruptRuns.length} bankrupt run${bankruptRuns.length !== 1 ? 's' : ''}?`)) {
      setCopyTrades(copyTrades.map(ct => {
        const closedTrades = ct.trades.filter(t => t.status !== 'open')
        const runPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
        const remainingBudget = ct.initialBudget + runPnl
        const isBankrupt = remainingBudget < ct.fixedBetAmount

        if (isBankrupt && !ct.isArchived) {
          return { ...ct, isArchived: true, isActive: false }
        }
        return ct
      }))

      setNotification({
        message: `Archived ${bankruptRuns.length} bankrupt run${bankruptRuns.length !== 1 ? 's' : ''}`,
        type: 'success'
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const unarchiveRun = (copyTradeId: string) => {
    setCopyTrades(copyTrades.map(ct => 
      ct.id === copyTradeId 
        ? { ...ct, isArchived: false }
        : ct
    ))
    setNotification({
      message: 'Run unarchived successfully',
      type: 'success'
    })
    setTimeout(() => setNotification(null), 3000)
  }

  const startEditingName = (copyTradeId: string, currentName: string) => {
    setEditingNameId(copyTradeId)
    setEditingName(currentName)
  }

  const saveEditedName = (copyTradeId: string) => {
    if (!editingName.trim()) {
      setNotification({
        message: 'Name cannot be empty',
        type: 'warning'
      })
      setTimeout(() => setNotification(null), 3000)
      return
    }

    setCopyTrades(copyTrades.map(ct => 
      ct.id === copyTradeId 
        ? { ...ct, name: editingName.trim() }
        : ct
    ))
    setEditingNameId(null)
    setEditingName('')
    setNotification({
      message: 'Name updated successfully',
      type: 'success'
    })
    setTimeout(() => setNotification(null), 3000)
  }

  const cancelEditingName = () => {
    setEditingNameId(null)
    setEditingName('')
  }

  const saveConfigName = (configKey: string, name: string) => {
    if (!name.trim()) {
      setNotification({
        message: 'Configuration name cannot be empty',
        type: 'warning'
      })
      setTimeout(() => setNotification(null), 3000)
      return
    }

    setConfigNames(prev => ({
      ...prev,
      [configKey]: name.trim()
    }))
    setEditingNameId(null)
    setEditingName('')
    setNotification({
      message: 'Configuration name updated',
      type: 'success'
    })
    setTimeout(() => setNotification(null), 3000)
  }

  // Filter active and archived runs
  const activeCopyTrades = copyTrades.filter(ct => !ct.isArchived)
  const archivedCopyTrades = copyTrades.filter(ct => ct.isArchived)

  // Helper functions for trade pagination
  const getVisibleTradesCount = (runId: string) => {
    return visibleTradesPerRun.get(runId) || TRADES_PER_PAGE
  }

  const showMoreTrades = (runId: string) => {
    setVisibleTradesPerRun(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(runId) || TRADES_PER_PAGE
      newMap.set(runId, current + TRADES_PER_PAGE)
      return newMap
    })
  }

  // Group copy trades by configuration (INCLUDE ALL - active + archived)
  const groupByStrategy = () => {
    const groups = new Map<string, CopyTrade[]>()
    
    // Group ALL runs (active + archived) for accurate analysis
    copyTrades.forEach(ct => {
      const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(ct)
    })
    
    // Calculate statistics for each group
    return Array.from(groups.entries()).map(([key, runs]) => {
      const allClosedTrades = runs.flatMap(r => r.trades.filter(t => t.status !== 'open'))
      const totalPnl = allClosedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      const wonTrades = allClosedTrades.filter(t => t.status === 'won').length
      // Average buy price when won / lost
      const wonPrices = allClosedTrades
        .filter(t => t.status === 'won' && typeof t.price === 'number')
        .map(t => t.price)
      const lostPrices = allClosedTrades
        .filter(t => t.status === 'lost' && typeof t.price === 'number')
        .map(t => t.price)
      const avgBuyPriceWhenWon = wonPrices.length > 0 ? (wonPrices.reduce((s, p) => s + p, 0) / wonPrices.length) : 0
      const avgBuyPriceWhenLost = lostPrices.length > 0 ? (lostPrices.reduce((s, p) => s + p, 0) / lostPrices.length) : 0
      // A run is bankrupt if remaining budget (initial + P&L) < fixed bet amount
      const bankruptcyCount = runs.filter(r => {
        const closedTrades = r.trades.filter(t => t.status !== 'open')
        const runPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
        const remainingBudget = r.initialBudget + runPnl
        return remainingBudget < r.fixedBetAmount
      }).length
      
      return {
        configKey: key, // Add the key for identification
        traderAddress: runs[0].traderAddress,
        initialBudget: runs[0].initialBudget,
        fixedBetAmount: runs[0].fixedBetAmount,
        minPrice: runs[0].minPrice,
        maxPrice: runs[0].maxPrice,
        minTriggerAmount: runs[0].minTriggerAmount,
        numberOfRuns: runs.length,
        bankruptcyCount,
        overallWinRate: allClosedTrades.length > 0 ? (wonTrades / allClosedTrades.length) * 100 : 0,
        totalPnl,
        avgPnlPerRun: runs.length > 0 ? totalPnl / runs.length : 0,
        totalClosedTrades: allClosedTrades.length,
        avgBuyPriceWhenWon,
        avgBuyPriceWhenLost,
        runs // Keep reference to individual runs
      }
    }).sort((a, b) => b.totalPnl - a.totalPnl) // Sort by total P&L descending
  }

  const exportConfigData = (group: any) => {
    try {
      const configName = configNames[group.configKey] || `Configuration #${strategyGroups.indexOf(group) + 1}`
      
      // Get all runs for this configuration
      const configRuns = copyTrades.filter(ct => {
        const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
        return key === group.configKey
      })

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        configurationName: configName,
        configuration: {
          traderAddress: group.traderAddress,
          initialBudget: group.initialBudget,
          fixedBetAmount: group.fixedBetAmount,
          minPrice: group.minPrice,
          maxPrice: group.maxPrice,
          minTriggerAmount: group.minTriggerAmount
        },
        statistics: {
          numberOfRuns: group.numberOfRuns,
          bankruptcyCount: group.bankruptcyCount,
          overallWinRate: group.overallWinRate,
          totalPnl: group.totalPnl,
          avgPnlPerRun: group.avgPnlPerRun,
          totalClosedTrades: group.totalClosedTrades,
          avgBuyPriceWhenWon: group.avgBuyPriceWhenWon,
          avgBuyPriceWhenLost: group.avgBuyPriceWhenLost
        },
        runs: configRuns
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      const sanitizedName = configName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      link.download = `config-${sanitizedName}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setNotification({
        message: `Configuration "${configName}" exported successfully!`,
        type: 'success'
      })
      setTimeout(() => setNotification(null), 3000)
    } catch (error) {
      console.error('Export failed:', error)
      setNotification({
        message: 'Export failed. Please try again.',
        type: 'warning'
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const deleteConfiguration = (group: any) => {
    const configName = configNames[group.configKey] || `Configuration #${strategyGroups.indexOf(group) + 1}`
    
    const confirmMsg = `Are you sure you want to delete "${configName}"?\n\nThis will delete all ${group.numberOfRuns} run(s) in this configuration. This action cannot be undone!`
    
    if (!confirm(confirmMsg)) {
      return
    }

    try {
      // Filter out all runs that belong to this configuration
      const updatedCopyTrades = copyTrades.filter(ct => {
        const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
        return key !== group.configKey
      })

      setCopyTrades(updatedCopyTrades)
      localStorage.setItem('copyTrades', JSON.stringify(updatedCopyTrades))

      // Also remove the config name
      const updatedConfigNames = { ...configNames }
      delete updatedConfigNames[group.configKey]
      setConfigNames(updatedConfigNames)
      localStorage.setItem('configNames', JSON.stringify(updatedConfigNames))

      setNotification({
        message: `Configuration "${configName}" and ${group.numberOfRuns} run(s) deleted successfully!`,
        type: 'success'
      })
      setTimeout(() => setNotification(null), 3000)
    } catch (error) {
      console.error('Delete failed:', error)
      setNotification({
        message: 'Delete failed. Please try again.',
        type: 'warning'
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const exportBotConfigurations = () => {
    try {
      // Create simplified configuration format for the bot
      const botConfigs = copyTrades.map(ct => ({
        id: ct.id,
        name: ct.name,
        traderAddress: ct.traderAddress,
        minTriggerAmount: ct.minTriggerAmount,
        minPrice: ct.minPrice,
        maxPrice: ct.maxPrice,
        initialBudget: ct.initialBudget,
        fixedBetAmount: ct.fixedBetAmount
      }))

      const dataStr = JSON.stringify(botConfigs, null, 2)
      
      // Copy to clipboard
      navigator.clipboard.writeText(dataStr).then(() => {
        setNotification({
          message: '📋 Bot configurations copied to clipboard! Paste this into Railway as CONFIGURATIONS environment variable.',
          type: 'success'
        })
        setTimeout(() => setNotification(null), 5000)
      }).catch(() => {
        // Fallback: download as file
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'bot-configurations.json'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        setNotification({
          message: '📥 Bot configurations downloaded! Upload this to Railway or paste contents into CONFIGURATIONS variable.',
          type: 'success'
        })
        setTimeout(() => setNotification(null), 5000)
      })
    } catch (error) {
      console.error('Export failed:', error)
      setNotification({
        message: 'Export failed. Please try again.',
        type: 'warning'
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const exportAllData = () => {
    try {
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        copyTrades,
        configNames,
        metadata: {
          totalRuns: copyTrades.length,
          activeRuns: activeCopyTrades.length,
          archivedRuns: archivedCopyTrades.length
        }
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `copy-trading-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setNotification({
        message: 'Data exported successfully!',
        type: 'success'
      })
      setTimeout(() => setNotification(null), 3000)
    } catch (error) {
      console.error('Export failed:', error)
      setNotification({
        message: 'Export failed. Please try again.',
        type: 'warning'
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importedData = JSON.parse(content)

        // Validate data structure
        if (!importedData.copyTrades || !Array.isArray(importedData.copyTrades)) {
          throw new Error('Invalid data format')
        }

        // Confirm import
        const confirmMsg = `Import ${importedData.copyTrades.length} copy trade(s) from ${
          importedData.exportDate ? new Date(importedData.exportDate).toLocaleString() : 'unknown date'
        }?\n\nThis will replace all current data!`

        if (!confirm(confirmMsg)) {
          event.target.value = '' // Reset file input
          return
        }

        // Import data
        setCopyTrades(importedData.copyTrades)
        if (importedData.configNames) {
          setConfigNames(importedData.configNames)
        }

        setNotification({
          message: `Successfully imported ${importedData.copyTrades.length} copy trade(s)!`,
          type: 'success'
        })
        setTimeout(() => setNotification(null), 3000)
      } catch (error) {
        console.error('Import failed:', error)
        setNotification({
          message: 'Import failed. Invalid file format.',
          type: 'warning'
        })
        setTimeout(() => setNotification(null), 3000)
      }
      event.target.value = '' // Reset file input
    }
    reader.readAsText(file)
  }

  const optimizeStrategy = (group: any) => {
    setOptimizing(true)
    
    console.log(`\n🔍 OPTIMIZING STRATEGY`)
    console.log(`Group configKey: ${group.configKey}`)
    
    // RECALCULATE FRESH: Find all runs with this exact configuration NOW
    const freshRuns = copyTrades.filter(ct => {
      const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
      return key === group.configKey
    })
    
    console.log(`Fresh runs count: ${freshRuns.length}`)
    
    // Aggregate all trades from all runs with FRESH data
    const allTrades = freshRuns.flatMap((run: CopyTrade) => {
      const closedTrades = run.trades.filter(t => t.status === 'won' || t.status === 'lost')
      console.log(`  Run "${run.name}": ${closedTrades.length} closed trades (total: ${run.trades.length})`)
      return closedTrades
    })
    
    console.log(`Total closed trades: ${allTrades.length}`)
    
    // Debug: Check first trade structure
    if (allTrades.length > 0) {
      const sampleTrade = allTrades[0]
      console.log(`Sample trade structure:`, {
        market: sampleTrade.market,
        price: sampleTrade.price,
        amount: sampleTrade.amount,
        hasOriginalTrade: !!sampleTrade.originalTrade,
        originalAmount: sampleTrade.originalTrade?.amount
      })
    }
    
    if (allTrades.length === 0) {
      setNotification({
        message: 'No closed trades to analyze yet!',
        type: 'warning'
      })
      setTimeout(() => setNotification(null), 3000)
      setOptimizing(false)
      return
    }
    
    const configName = configNames[group.configKey] || `Configuration`
    
    // Current stats
    const currentWins = allTrades.filter((t: SimulatedTrade) => t.status === 'won').length
    const currentWinRate = (currentWins / allTrades.length) * 100
    const currentTotalPnl = allTrades.reduce((sum: number, t: SimulatedTrade) => sum + (t.pnl || 0), 0)
    const currentAvgPnl = currentTotalPnl / allTrades.length
    
    console.log(`\n🔍 OPTIMIZING STRATEGY: ${configName}`)
    console.log(`Total trades analyzed: ${allTrades.length}`)
    console.log(`Current win rate: ${currentWinRate.toFixed(1)}%`)
    console.log(`Current avg P&L: $${currentAvgPnl.toFixed(2)}`)
    
    const suggestions: any[] = []
    
    // Test different price ranges
    const priceRanges = [
      { min: 0.3, max: 0.5, label: '0.30-0.50 (30%-50%)' },
      { min: 0.35, max: 0.55, label: '0.35-0.55 (35%-55%)' },
      { min: 0.4, max: 0.6, label: '0.40-0.60 (40%-60%)' },
      { min: 0.45, max: 0.65, label: '0.45-0.65 (45%-65%)' },
      { min: 0.5, max: 0.7, label: '0.50-0.70 (50%-70%)' },
      { min: 0.5, max: 0.75, label: '0.50-0.75 (50%-75%)' },
      { min: 0.55, max: 0.75, label: '0.55-0.75 (55%-75%)' },
      { min: 0.6, max: 0.8, label: '0.60-0.80 (60%-80%)' }
    ]
    
    let bestPriceRange: any = null
    let bestPriceImprovement = 0
    
    priceRanges.forEach(range => {
      const filteredTrades = allTrades.filter((t: SimulatedTrade) => 
        t.price >= range.min && t.price <= range.max
      )
      
      if (filteredTrades.length < 15) return // Need at least 15 trades for statistical significance
      
      const wins = filteredTrades.filter((t: SimulatedTrade) => t.status === 'won').length
      const winRate = (wins / filteredTrades.length) * 100
      const totalPnl = filteredTrades.reduce((sum: number, t: SimulatedTrade) => sum + (t.pnl || 0), 0)
      const avgPnl = totalPnl / filteredTrades.length
      const improvement = winRate - currentWinRate
      
      console.log(`  Price ${range.label}: ${filteredTrades.length} trades, ${winRate.toFixed(1)}% win rate, improvement: ${improvement.toFixed(1)}%`)
      
      if (improvement > bestPriceImprovement && improvement > 3) { // At least 3% improvement
        bestPriceImprovement = improvement
        bestPriceRange = {
          range,
          trades: filteredTrades.length,
          winRate,
          avgPnl,
          totalPnl
        }
      }
    })
    
    if (bestPriceRange) {
      const currentRange = `${(group.minPrice * 100).toFixed(0)}%-${(group.maxPrice * 100).toFixed(0)}%`
      suggestions.push({
        type: 'price',
        current: currentRange,
        suggested: bestPriceRange.range.label,
        improvement: {
          trades: bestPriceRange.trades,
          winRate: bestPriceRange.winRate,
          avgPnl: bestPriceRange.avgPnl,
          totalPnlDiff: bestPriceRange.totalPnl - currentTotalPnl
        }
      })
    }
    
    // Test different min trigger amounts
    const minTriggers = [0, 1, 5, 10, 15, 20, 30, 50, 100]
    
    console.log(`\n💰 TESTING MIN TRIGGER AMOUNTS:`)
    
    let bestMinTrigger: any = null
    let bestTriggerImprovement = 0
    
    minTriggers.forEach(trigger => {
      // Filter trades based on the original trader's bet amount
      const filteredTrades = allTrades.filter((t: SimulatedTrade) => {
        // Get the original trade amount from the trader
        const originalTrade = t.originalTrade
        if (!originalTrade) {
          console.log(`    ⚠️ Trade missing originalTrade:`, t.market)
          return false
        }
        
        // Calculate the original trader's bet amount
        // The original trade has 'size' (shares) and 'price'
        // Amount = size * price
        let tradeAmount = 0
        if (originalTrade.amount) {
          tradeAmount = parseFloat(originalTrade.amount)
        } else if (originalTrade.size && originalTrade.price) {
          tradeAmount = originalTrade.size * originalTrade.price
        } else {
          console.log(`    ⚠️ Trade missing size/price data:`, t.market, originalTrade)
          return false
        }
        
        return tradeAmount >= trigger
      })
      
      if (filteredTrades.length < 15) {
        console.log(`  Min Trigger $${trigger}: ${filteredTrades.length} trades (too few, need 15+)`)
        return
      }
      
      const wins = filteredTrades.filter((t: SimulatedTrade) => t.status === 'won').length
      const winRate = (wins / filteredTrades.length) * 100
      const totalPnl = filteredTrades.reduce((sum: number, t: SimulatedTrade) => sum + (t.pnl || 0), 0)
      const avgPnl = totalPnl / filteredTrades.length
      const improvement = winRate - currentWinRate
      
      console.log(`  Min Trigger $${trigger}: ${filteredTrades.length} trades, ${winRate.toFixed(1)}% win rate, ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}% improvement`)
      
      if (improvement > bestTriggerImprovement && improvement > 3) {
        console.log(`    ✅ NEW BEST! (previous: ${bestTriggerImprovement.toFixed(1)}%)`)
        bestTriggerImprovement = improvement
        bestMinTrigger = {
          trigger,
          trades: filteredTrades.length,
          winRate,
          avgPnl,
          totalPnl
        }
      }
    })
    
    console.log(`\nBest min trigger found: ${bestMinTrigger ? `$${bestMinTrigger.trigger} (+${bestTriggerImprovement.toFixed(1)}%)` : 'None'}`)
    
    if (bestMinTrigger) {
      suggestions.push({
        type: 'minTrigger',
        current: `$${group.minTriggerAmount}`,
        suggested: `$${bestMinTrigger.trigger}`,
        improvement: {
          trades: bestMinTrigger.trades,
          winRate: bestMinTrigger.winRate,
          avgPnl: bestMinTrigger.avgPnl,
          totalPnlDiff: bestMinTrigger.totalPnl - currentTotalPnl
        }
      })
    }
    
    console.log(`\n📊 FINAL SUGGESTIONS:`, suggestions)
    console.log(`Total suggestions: ${suggestions.length}`)
    
    setOptimizationResults({
      configKey: group.configKey,
      configName,
      currentStats: {
        totalTrades: allTrades.length,
        winRate: currentWinRate,
        avgPnl: currentAvgPnl
      },
      suggestions
    })
    
    console.log(`✅ Opening modal with results`)
    setShowOptimizationModal(true)
    setOptimizing(false)
  }

  const testManualTrigger = (group: any) => {
    if (!optimizationResults) return
    
    const triggerAmount = parseFloat(manualTestTrigger)
    if (isNaN(triggerAmount) || triggerAmount < 0) {
      setNotification({ type: 'warning', message: 'Please enter a valid trigger amount' })
      setTimeout(() => setNotification(null), 2000)
      return
    }

    console.log(`\n🧪 TESTING MANUAL TRIGGER: $${triggerAmount}`)
    
    // Get all trades from all runs in this configuration
    const configRuns = copyTrades.filter(ct => {
      const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
      return key === group.configKey
    })

    const allTrades = configRuns.flatMap(run => 
      run.trades.filter(t => t.status !== 'open')
    )

    // Filter trades by the manual trigger amount (same logic as optimizer)
    const filteredTrades = allTrades.filter(trade => {
      const originalTrade = trade.originalTrade
      
      // Calculate the original trader's bet amount
      let tradeAmount = 0
      if (originalTrade.amount) {
        tradeAmount = parseFloat(originalTrade.amount)
      } else if (originalTrade.size && originalTrade.price) {
        tradeAmount = originalTrade.size * originalTrade.price
      } else {
        return false
      }
      
      return tradeAmount >= triggerAmount
    })
    
    if (filteredTrades.length === 0) {
      setNotification({ type: 'warning', message: `No trades found with trigger ≥ $${triggerAmount}` })
      setTimeout(() => setNotification(null), 2000)
      return
    }

    const wonTrades = filteredTrades.filter(t => t.status === 'won').length
    const winRate = (wonTrades / filteredTrades.length) * 100
    const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const avgPnl = totalPnl / filteredTrades.length

    setManualTestResults({
      trades: filteredTrades.length,
      winRate,
      avgPnl,
      totalPnl
    })

    console.log(`Results: ${filteredTrades.length} trades, ${winRate.toFixed(1)}% WR, $${avgPnl.toFixed(2)} avg`)
  }

  const autoFindBestTrigger = (group: any) => {
    if (!optimizationResults) return
    
    setAutoFindingTrigger(true)
    console.log(`\n🎯 AUTO-FINDING BEST MIN TRIGGER with min ${minTradesForTrigger} trades requirement`)
    
    // Get all trades from all runs in this configuration
    const configRuns = copyTrades.filter(ct => {
      const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
      return key === group.configKey
    })

    const allTrades = configRuns.flatMap(run => 
      run.trades.filter(t => t.status !== 'open')
    )

    // Test different trigger amounts
    // $0-$20: every $1, $20-$100: every $10, $100+: specific milestones
    const triggerAmountsToTest: number[] = []
    
    // $0 to $20: test every $1
    for (let i = 0; i <= 20; i++) {
      triggerAmountsToTest.push(i)
    }
    
    // $20 to $100: test every $10
    for (let i = 30; i <= 100; i += 10) {
      triggerAmountsToTest.push(i)
    }
    
    // $100+: test larger milestones
    triggerAmountsToTest.push(150, 200, 300, 500, 1000)
    
    const results: Array<{
      trigger: number
      trades: number
      winRate: number
      avgPnl: number
      totalPnl: number
    }> = []

    triggerAmountsToTest.forEach(triggerAmount => {
      // Filter trades by this trigger amount
      const filteredTrades = allTrades.filter(trade => {
        const originalTrade = trade.originalTrade
        
        // Calculate the original trader's bet amount
        let tradeAmount = 0
        if (originalTrade.amount) {
          tradeAmount = parseFloat(originalTrade.amount)
        } else if (originalTrade.size && originalTrade.price) {
          tradeAmount = originalTrade.size * originalTrade.price
        } else {
          return false
        }
        
        return tradeAmount >= triggerAmount
      })
      
      // Only include if meets minimum trades requirement
      if (filteredTrades.length >= minTradesForTrigger) {
        const wonTrades = filteredTrades.filter(t => t.status === 'won').length
        const winRate = (wonTrades / filteredTrades.length) * 100
        const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
        const avgPnl = totalPnl / filteredTrades.length

        results.push({
          trigger: triggerAmount,
          trades: filteredTrades.length,
          winRate,
          avgPnl,
          totalPnl
        })

        console.log(`  $${triggerAmount}: ${filteredTrades.length} trades, ${winRate.toFixed(1)}% WR, $${avgPnl.toFixed(2)} avg`)
      } else {
        console.log(`  $${triggerAmount}: ${filteredTrades.length} trades (too few, need ${minTradesForTrigger}+)`)
      }
    })

    if (results.length === 0) {
      setNotification({ type: 'warning', message: `No trigger amounts found with at least ${minTradesForTrigger} trades` })
      setTimeout(() => setNotification(null), 3000)
      setAutoFindingTrigger(false)
      return
    }

    // Sort by win rate first, then by avg P&L
    results.sort((a, b) => {
      const winRateDiff = b.winRate - a.winRate
      if (Math.abs(winRateDiff) > 2) { // If win rate difference is significant (>2%)
        return winRateDiff
      }
      return b.avgPnl - a.avgPnl // Otherwise sort by avg P&L
    })

    console.log(`\n🏆 Best trigger: $${results[0].trigger} (${results[0].winRate.toFixed(1)}% WR, $${results[0].avgPnl.toFixed(2)} avg, ${results[0].trades} trades)`)

    setAutoTriggerResults(results)
    setAutoFindingTrigger(false)
    setNotification({ type: 'success', message: `Found best trigger: $${results[0].trigger}` })
    setTimeout(() => setNotification(null), 3000)
  }

  const autoFindBestPriceRange = (group: any) => {
    if (!optimizationResults) return
    
    setAutoFindingPriceRange(true)
    console.log(`\n🎯 AUTO-FINDING BEST PRICE RANGE with min ${minTradesForPriceRange} trades requirement`)
    
    // Get all trades from all runs in this configuration
    const configRuns = copyTrades.filter(ct => {
      const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
      return key === group.configKey
    })

    const allTrades = configRuns.flatMap(run => 
      run.trades.filter(t => t.status !== 'open')
    )

    // Determine the actual price range from traded data
    if (allTrades.length === 0) {
      setNotification({ type: 'warning', message: 'No trades found to analyze' })
      setAutoFindingPriceRange(false)
      return
    }

    const actualMinPrice = Math.min(...allTrades.map(t => t.price))
    const actualMaxPrice = Math.max(...allTrades.map(t => t.price))
    
    console.log(`Actual traded range: ${(actualMinPrice * 100).toFixed(1)}% - ${(actualMaxPrice * 100).toFixed(1)}%`)
    console.log(`Will only test sub-ranges within this boundary`)

    // Test different price ranges (0.01 increments for precision)
    const priceRangesToTest: Array<{min: number, max: number, label: string}> = []
    
    // Generate ranges within the actual traded bounds, using 0.01 (1%) increments
    // Start from actual min, go to actual max
    const step = 0.01 // 1% increments
    const minWidth = 0.10 // Minimum 10% range width
    const maxWidth = actualMaxPrice - actualMinPrice // Max width is the full range
    
    for (let minPrice = actualMinPrice; minPrice <= actualMaxPrice - minWidth; minPrice += step) {
      for (let maxPrice = minPrice + minWidth; maxPrice <= actualMaxPrice; maxPrice += step) {
        // Only test ranges with reasonable widths
        if (maxPrice - minPrice >= minWidth && maxPrice - minPrice <= maxWidth) {
          priceRangesToTest.push({
            min: Math.round(minPrice * 100) / 100, // Round to 2 decimals
            max: Math.round(maxPrice * 100) / 100,
            label: `${(Math.round(minPrice * 100))}%-${(Math.round(maxPrice * 100))}%`
          })
        }
      }
    }

    console.log(`Testing ${priceRangesToTest.length} price ranges within actual traded bounds...`)

    const results: Array<{
      minPrice: number
      maxPrice: number
      rangeLabel: string
      trades: number
      winRate: number
      avgPnl: number
      totalPnl: number
    }> = []

    priceRangesToTest.forEach(range => {
      // Filter trades by this price range
      const filteredTrades = allTrades.filter(trade => 
        trade.price >= range.min && trade.price <= range.max
      )
      
      // Only include if meets minimum trades requirement
      if (filteredTrades.length >= minTradesForPriceRange) {
        const wonTrades = filteredTrades.filter(t => t.status === 'won').length
        const winRate = (wonTrades / filteredTrades.length) * 100
        const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
        const avgPnl = totalPnl / filteredTrades.length

        results.push({
          minPrice: range.min,
          maxPrice: range.max,
          rangeLabel: range.label,
          trades: filteredTrades.length,
          winRate,
          avgPnl,
          totalPnl
        })

        console.log(`  ${range.label}: ${filteredTrades.length} trades, ${winRate.toFixed(1)}% WR, $${avgPnl.toFixed(2)} avg`)
      } else {
        console.log(`  ${range.label}: ${filteredTrades.length} trades (too few, need ${minTradesForPriceRange}+)`)
      }
    })

    if (results.length === 0) {
      setNotification({ type: 'warning', message: `No price ranges found with at least ${minTradesForPriceRange} trades` })
      setTimeout(() => setNotification(null), 3000)
      setAutoFindingPriceRange(false)
      return
    }

    // Sort by win rate first, then by avg P&L
    results.sort((a, b) => {
      const winRateDiff = b.winRate - a.winRate
      if (Math.abs(winRateDiff) > 2) { // If win rate difference is significant (>2%)
        return winRateDiff
      }
      return b.avgPnl - a.avgPnl // Otherwise sort by avg P&L
    })

    console.log(`\n🏆 Best range: ${results[0].rangeLabel} (${results[0].winRate.toFixed(1)}% WR, $${results[0].avgPnl.toFixed(2)} avg, ${results[0].trades} trades)`)

    setAutoPriceRangeResults(results)
    setAutoFindingPriceRange(false)
    setNotification({ type: 'success', message: `Found best range: ${results[0].rangeLabel}` })
    setTimeout(() => setNotification(null), 3000)
  }

  const testCombinedOptimization = (group: any) => {
    if (!autoTriggerResults || !autoPriceRangeResults) {
      setNotification({ type: 'warning', message: 'Run both optimizations first!' })
      setTimeout(() => setNotification(null), 2000)
      return
    }

    console.log(`\n🎯 TESTING COMBINED OPTIMIZATION`)

    // Get the best trigger and best price range
    const bestTrigger = autoTriggerResults[0].trigger
    const bestRange = autoPriceRangeResults[0]

    console.log(`Best trigger: $${bestTrigger}`)
    console.log(`Best range: ${bestRange.rangeLabel}`)

    // Get all trades from all runs in this configuration
    const configRuns = copyTrades.filter(ct => {
      const key = `${ct.traderAddress}-${ct.initialBudget}-${ct.fixedBetAmount}-${ct.minPrice}-${ct.maxPrice}-${ct.minTriggerAmount}`
      return key === group.configKey
    })

    const allTrades = configRuns.flatMap(run => 
      run.trades.filter(t => t.status !== 'open')
    )

    // Filter by BOTH trigger AND price range
    const filteredTrades = allTrades.filter(trade => {
      // Check price range
      if (trade.price < bestRange.minPrice || trade.price > bestRange.maxPrice) {
        return false
      }

      // Check trigger amount
      const originalTrade = trade.originalTrade
      let tradeAmount = 0
      if (originalTrade.amount) {
        tradeAmount = parseFloat(originalTrade.amount)
      } else if (originalTrade.size && originalTrade.price) {
        tradeAmount = originalTrade.size * originalTrade.price
      } else {
        return false
      }
      
      return tradeAmount >= bestTrigger
    })

    if (filteredTrades.length === 0) {
      setNotification({ type: 'warning', message: 'No trades match both criteria' })
      setTimeout(() => setNotification(null), 2000)
      return
    }

    const wonTrades = filteredTrades.filter(t => t.status === 'won').length
    const winRate = (wonTrades / filteredTrades.length) * 100
    const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const avgPnl = totalPnl / filteredTrades.length

    setCombinedOptimizationResult({
      trades: filteredTrades.length,
      winRate,
      avgPnl,
      totalPnl,
      trigger: bestTrigger,
      minPrice: bestRange.minPrice,
      maxPrice: bestRange.maxPrice,
      rangeLabel: bestRange.rangeLabel
    })

    console.log(`\n🎉 COMBINED RESULT:`)
    console.log(`  Trades: ${filteredTrades.length}`)
    console.log(`  Win Rate: ${winRate.toFixed(1)}%`)
    console.log(`  Avg P&L: $${avgPnl.toFixed(2)}`)
    
    setNotification({ type: 'success', message: 'Combined optimization calculated!' })
    setTimeout(() => setNotification(null), 2000)
  }

  const runSuperOptimizer = async (traderAddress: string) => {
    setSuperOptimizing(true)
    console.log(`\n🚀 SUPER OPTIMIZER STARTED for trader: ${traderAddress}`)
    
    // Get all configurations for this trader
    const groups = groupByStrategy()
    const traderConfigs = groups.filter(g => g.traderAddress === traderAddress)
    
    console.log(`Found ${traderConfigs.length} configurations for this trader`)
    
    if (traderConfigs.length < 2) {
      setNotification({ type: 'warning', message: 'Need at least 2 configurations to super optimize!' })
      setSuperOptimizing(false)
      return
    }
    
    // Analyze each configuration
    const configAnalysis = traderConfigs.map(group => {
      const bankruptcyRate = group.numberOfRuns > 0 ? (group.bankruptcyCount / group.numberOfRuns) * 100 : 0
      
      return {
        configKey: group.configKey,
        configName: configNames[group.configKey] || 'Unnamed Config',
        settings: {
          initialBudget: group.initialBudget,
          fixedBetAmount: group.fixedBetAmount,
          minPrice: group.minPrice,
          maxPrice: group.maxPrice,
          minTriggerAmount: group.minTriggerAmount
        },
        stats: {
          runs: group.numberOfRuns,
          totalTrades: group.totalClosedTrades,
          winRate: group.overallWinRate,
          avgPnl: group.avgPnlPerRun,
          bankruptcyRate,
          totalPnl: group.totalPnl
        }
      }
    })
    
    console.log('Config analysis:', configAnalysis)
    
    // Find optimal budget (highest budget with lowest bankruptcy rate)
    const sortedByBudget = [...configAnalysis].sort((a, b) => {
      if (Math.abs(a.stats.bankruptcyRate - b.stats.bankruptcyRate) < 5) {
        return b.settings.initialBudget - a.settings.initialBudget
      }
      return a.stats.bankruptcyRate - b.stats.bankruptcyRate
    })
    const optimalBudget = sortedByBudget[0].settings.initialBudget
    const budgetReasoning = `Chosen from config with ${sortedByBudget[0].stats.bankruptcyRate.toFixed(1)}% bankruptcy rate. Balances safety with sufficient capital.`
    
    // Find optimal fixed bet (best consistency - lowest variance in P&L)
    const sortedByPerformance = [...configAnalysis].sort((a, b) => {
      // Prefer higher win rate with reasonable bet size
      const scoreA = a.stats.winRate * (1 - (a.settings.fixedBetAmount / a.settings.initialBudget))
      const scoreB = b.stats.winRate * (1 - (b.settings.fixedBetAmount / b.settings.initialBudget))
      return scoreB - scoreA
    })
    const optimalFixedBet = sortedByPerformance[0].settings.fixedBetAmount
    const fixedBetReasoning = `Best performing size with ${sortedByPerformance[0].stats.winRate.toFixed(1)}% win rate. Optimal balance between aggression and sustainability.`
    
    // Find optimal price range by analyzing ALL trades across all configs
    const allTradesFromTrader: any[] = []
    copyTrades.forEach(ct => {
      if (ct.traderAddress === traderAddress) {
        ct.trades.forEach(trade => {
          if (trade.status !== 'open') {
            allTradesFromTrader.push(trade)
          }
        })
      }
    })
    
    console.log(`Analyzing ${allTradesFromTrader.length} total trades for price range optimization`)
    
    // Test different price ranges
    const priceRanges = [
      { min: 0.30, max: 0.50 },
      { min: 0.35, max: 0.55 },
      { min: 0.40, max: 0.60 },
      { min: 0.45, max: 0.65 },
      { min: 0.50, max: 0.70 },
      { min: 0.55, max: 0.75 },
      { min: 0.60, max: 0.80 }
    ]
    
    let bestPriceRange = { min: 0.45, max: 0.65, winRate: 0 }
    priceRanges.forEach(range => {
      const filtered = allTradesFromTrader.filter(t => 
        t.price >= range.min && t.price <= range.max
      )
      if (filtered.length >= 20) {
        const wins = filtered.filter(t => t.status === 'won').length
        const winRate = (wins / filtered.length) * 100
        if (winRate > bestPriceRange.winRate) {
          bestPriceRange = { ...range, winRate }
        }
      }
    })
    
    const priceRangeReasoning = `${bestPriceRange.winRate.toFixed(1)}% win rate in this range. Sweet spot between value and safety.`
    
    // Find optimal min trigger by analyzing trade amounts
    const minTriggerOptions = [0, 5, 10, 15, 20, 30, 50, 75, 100]
    let bestMinTrigger = { amount: 0, winRate: 0 }
    
    minTriggerOptions.forEach(trigger => {
      const filtered = allTradesFromTrader.filter(t => {
        const originalTrade = t.originalTrade
        if (!originalTrade) return false
        
        let tradeAmount = 0
        if (originalTrade.amount) {
          tradeAmount = parseFloat(originalTrade.amount)
        } else if (originalTrade.size && originalTrade.price) {
          tradeAmount = originalTrade.size * originalTrade.price
        }
        
        return tradeAmount >= trigger
      })
      
      if (filtered.length >= 20) {
        const wins = filtered.filter(t => t.status === 'won').length
        const winRate = (wins / filtered.length) * 100
        if (winRate > bestMinTrigger.winRate) {
          bestMinTrigger = { amount: trigger, winRate }
        }
      }
    })
    
    const minTriggerReasoning = `${bestMinTrigger.winRate.toFixed(1)}% win rate with $${bestMinTrigger.amount}+ trades. Filters out low-confidence bets.`
    
    // Calculate expected performance based on recent config performance
    const recentConfig = configAnalysis.reduce((best, curr) => 
      curr.stats.totalTrades > best.stats.totalTrades ? curr : best
    )
    
    const totalRuns = configAnalysis.reduce((sum, c) => sum + c.stats.runs, 0)
    const totalTrades = configAnalysis.reduce((sum, c) => sum + c.stats.totalTrades, 0)
    
    const results = {
      traderAddress,
      analyzedConfigs: traderConfigs.length,
      totalRuns,
      totalTrades,
      optimalStrategy: {
        initialBudget: optimalBudget,
        fixedBetAmount: optimalFixedBet,
        minPrice: bestPriceRange.min,
        maxPrice: bestPriceRange.max,
        minTriggerAmount: bestMinTrigger.amount,
        expectedWinRate: bestPriceRange.winRate,
        expectedAvgPnl: recentConfig.stats.avgPnl,
        bankruptcyRisk: sortedByBudget[0].stats.bankruptcyRate,
        reasoning: {
          budget: budgetReasoning,
          fixedBet: fixedBetReasoning,
          priceRange: priceRangeReasoning,
          minTrigger: minTriggerReasoning
        }
      },
      configComparison: configAnalysis
    }
    
    console.log('🎯 SUPER OPTIMIZER RESULTS:', results)
    
    setSuperOptimizerResults(results)
    setShowSuperOptimizerModal(true)
    setSuperOptimizing(false)
  }

  const runAutoBacktest = async (traderAddress: string, baseConfig: any) => {
    setAutoBacktesting(true)
    console.log(`\n🤖 AUTO BACKTEST STARTED for trader: ${traderAddress}`)
    console.log('Base config:', baseConfig)
    
    // Define parameter combinations to test
    const budgets = [500, 1000, 2000, 3000, 5000]
    const betAmounts = [10, 25, 50, 100, 200]
    const priceRanges = [
      { min: 0.40, max: 0.60 },
      { min: 0.45, max: 0.65 },
      { min: 0.50, max: 0.70 }
    ]
    
    // Use base config values for min trigger
    const minTrigger = baseConfig.minTriggerAmount
    
    // Calculate total combinations
    const combinations: Array<{budget: number, bet: number, priceRange: {min: number, max: number}}> = []
    budgets.forEach(budget => {
      betAmounts.forEach(bet => {
        // Only test if bet is reasonable for budget (less than 20%)
        if (bet / budget <= 0.2) {
          priceRanges.forEach(range => {
            combinations.push({ budget, bet, priceRange: range })
          })
        }
      })
    })
    
    console.log(`Testing ${combinations.length} combinations...`)
    
    // Get all existing trades from all runs with this trader
    setAutoBacktestProgress({ current: 0, total: combinations.length, currentConfig: 'Gathering existing trades...' })
    
    const traderRuns = copyTrades.filter(ct => ct.traderAddress === traderAddress)
    if (traderRuns.length === 0) {
      setNotification({ type: 'warning', message: 'No existing runs found for this trader' })
      setAutoBacktesting(false)
      setAutoBacktestProgress(null)
      return
    }
    
    // Collect all unique trades from all runs (use original trades)
    const allTrades = traderRuns.flatMap(run => run.trades.map(t => t.originalTrade))
    console.log(`Using ${allTrades.length} existing trades from ${traderRuns.length} runs`)
    
    // Run simulations for each combination
    const results = []
    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i]
      const configLabel = `$${combo.budget} budget, $${combo.bet} bet, ${(combo.priceRange.min * 100).toFixed(0)}-${(combo.priceRange.max * 100).toFixed(0)}% price`
      
      setAutoBacktestProgress({ 
        current: i + 1, 
        total: combinations.length, 
        currentConfig: configLabel 
      })
      
      console.log(`\n[${i + 1}/${combinations.length}] Testing: ${configLabel}`)
      
      // Run 3 simulations for this combo to get average
      const runs = []
      for (let runNum = 0; runNum < 3; runNum++) {
        const runResult = await simulateTrading({
          trades: allTrades,
          initialBudget: combo.budget,
          fixedBetAmount: combo.bet,
          minPrice: combo.priceRange.min,
          maxPrice: combo.priceRange.max,
          minTriggerAmount: minTrigger
        })
        runs.push(runResult)
        
        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Calculate aggregate stats
      const totalTrades = runs.reduce((sum, r) => sum + r.closedTrades, 0)
      const totalWins = runs.reduce((sum, r) => sum + r.wins, 0)
      const totalPnl = runs.reduce((sum, r) => sum + r.totalPnl, 0)
      const bankruptcies = runs.filter(r => r.bankrupt).length
      
      const avgWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0
      const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0
      const bankruptcyRate = (bankruptcies / runs.length) * 100
      
      results.push({
        config: configLabel,
        initialBudget: combo.budget,
        fixedBetAmount: combo.bet,
        minPrice: combo.priceRange.min,
        maxPrice: combo.priceRange.max,
        minTriggerAmount: minTrigger,
        avgPnl,
        winRate: avgWinRate,
        bankruptcyRate,
        totalTrades,
        totalPnl,
        runs: runs.length
      })
      
      console.log(`  Results: ${avgWinRate.toFixed(1)}% WR, $${avgPnl.toFixed(2)} avg, ${bankruptcyRate.toFixed(0)}% bankruptcy`)
    }
    
    // Find best strategy (lowest bankruptcy, then highest avg PnL)
    const sortedResults = [...results].sort((a, b) => {
      if (Math.abs(a.bankruptcyRate - b.bankruptcyRate) < 10) {
        return b.avgPnl - a.avgPnl
      }
      return a.bankruptcyRate - b.bankruptcyRate
    })
    
    const bestStrategy = sortedResults[0]
    
    console.log('\n🎯 BEST STRATEGY FOUND:')
    console.log(`  Budget: $${bestStrategy.initialBudget}, Bet: $${bestStrategy.fixedBetAmount}`)
    console.log(`  Win Rate: ${bestStrategy.winRate.toFixed(1)}%`)
    console.log(`  Avg P&L: $${bestStrategy.avgPnl.toFixed(2)}`)
    console.log(`  Bankruptcy Risk: ${bestStrategy.bankruptcyRate.toFixed(1)}%`)
    
    setAutoBacktestResults({
      traderAddress,
      totalSimulations: combinations.length * 3,
      bestStrategy,
      allResults: sortedResults
    })
    
    setAutoBacktesting(false)
    setAutoBacktestProgress(null)
    setShowAutoBacktestModal(true)
  }

  // Helper function to simulate trading
  const simulateTrading = async (params: {
    trades: any[]
    initialBudget: number
    fixedBetAmount: number
    minPrice: number
    maxPrice: number
    minTriggerAmount: number
  }) => {
    let budget = params.initialBudget
    const trades = []
    let wins = 0
    let bankrupt = false
    
    // Use the original trades (which are BUY trades)
    for (const trade of params.trades) {
      // Check if we have enough budget
      if (budget < params.fixedBetAmount) {
        bankrupt = true
        break
      }
      
      // Check price range
      if (trade.price < params.minPrice || trade.price > params.maxPrice) {
        continue
      }
      
      // Check min trigger
      let tradeAmount = 0
      if (trade.amount) {
        tradeAmount = parseFloat(trade.amount)
      } else if (trade.size && trade.price) {
        tradeAmount = trade.size * trade.price
      } else if (trade.usdcSize) {
        tradeAmount = trade.usdcSize
      }
      
      if (tradeAmount < params.minTriggerAmount) {
        continue
      }
      
      // Make the trade
      budget -= params.fixedBetAmount
      
      // Simulate outcome (simplified - using price as proxy for win probability)
      const winProb = trade.price
      const won = Math.random() < winProb
      
      let pnl = 0
      if (won) {
        pnl = params.fixedBetAmount * (1 - trade.price) - (params.fixedBetAmount * 0.02) // 2% fees
        wins++
      } else {
        pnl = -params.fixedBetAmount
      }
      
      budget += (params.fixedBetAmount + pnl)
      
      trades.push({
        price: trade.price,
        won,
        pnl
      })
    }
    
    const totalPnl = trades.reduce((sum: number, t: any) => sum + t.pnl, 0)
    
    return {
      closedTrades: trades.length,
      wins,
      totalPnl,
      bankrupt,
      finalBudget: budget
    }
  }

  const strategyGroups = groupByStrategy()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg border shadow-lg animate-slide-in-right ${
            notification.type === 'success' 
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : notification.type === 'warning'
              ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
              : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
          }`}>
            <p className="font-medium">{notification.message}</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">
              Copy Trading Simulator
            </h1>
            <p className="text-slate-400">
              Test your copy trading strategies with live market data
            </p>
          </div>
          <div className="flex items-center gap-3">
            {copyTrades.length > 0 && (
              <>
                <button
                  onClick={exportBotConfigurations}
                  className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 text-purple-400 font-medium rounded-lg transition-all"
                  title="Export configurations for Telegram bot"
                >
                  🤖 Export for Bot
                </button>
                <button
                  onClick={exportAllData}
                  className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-400 font-medium rounded-lg transition-all"
                  title="Export all data to JSON file"
                >
                  💾 Export Data
                </button>
                <label className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-400 font-medium rounded-lg transition-all cursor-pointer">
                  📥 Import Data
                  <input
                    type="file"
                    accept=".json"
                    onChange={importData}
                    className="hidden"
                  />
                </label>
              </>
            )}
            {activeCopyTrades.length > 0 && (
              <button
                onClick={archiveBankruptRuns}
                className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 hover:border-orange-500/50 text-orange-400 font-medium rounded-lg transition-all"
              >
                📦 Archive Bankrupt
              </button>
            )}
            {copyTrades.length > 0 && (
              <button
                onClick={clearAllData}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 font-medium rounded-lg transition-all"
              >
                🗑️ Clear All Data
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              + Add Copy Trade
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        {copyTrades.length > 0 && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveView('list')}
                className={`px-6 py-2.5 font-medium rounded-lg transition-all ${
                  activeView === 'list'
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                📋 List View
              </button>
              <button
                onClick={() => setActiveView('analysis')}
                className={`px-6 py-2.5 font-medium rounded-lg transition-all ${
                  activeView === 'analysis'
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                📊 Strategy Analysis
              </button>
            </div>
            
            {activeView === 'list' && archivedCopyTrades.length > 0 && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-4 py-2 font-medium rounded-lg transition-all ${
                  showArchived
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                📦 {showArchived ? 'Hide' : 'Show'} Archived ({archivedCopyTrades.length})
              </button>
            )}
          </div>
        )}

        {/* List View */}
        {activeView === 'list' && (
          <>
            {/* Copy Trades List */}
            {copyTrades.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-slate-200 mb-2">No Copy Trades Yet</h3>
                <p className="text-slate-400 mb-6">Create your first copy trade to start simulating!</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-lg hover:bg-indigo-500/30 transition-all"
                >
                  Get Started
                </button>
              </div>
            ) : (
              <>
                {/* Active Runs */}
                {!showArchived && activeCopyTrades.length === 0 && (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-8 text-center">
                    <p className="text-slate-400">All runs are archived. Click "Show Archived" to view them.</p>
                  </div>
                )}
                
                <div className="grid gap-6">
                  {(showArchived ? archivedCopyTrades : activeCopyTrades).map(copyTrade => {
                    const closedTrades = copyTrade.trades.filter(t => t.status !== 'open')
                    const runPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
                    const remainingBudget = copyTrade.initialBudget + runPnl
                    const isBankrupt = remainingBudget < copyTrade.fixedBetAmount

                    return (
                      <div
                        key={copyTrade.id}
                        className={`bg-slate-900/50 border rounded-xl p-6 hover:border-indigo-500/30 transition-all ${
                          copyTrade.isArchived 
                            ? 'border-slate-700/50 opacity-75' 
                            : 'border-slate-800/50'
                        }`}
                      >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {editingNameId === copyTrade.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditedName(copyTrade.id)
                              if (e.key === 'Escape') cancelEditingName()
                            }}
                            className="text-2xl font-bold text-slate-200 bg-slate-800/50 border border-indigo-500/50 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEditedName(copyTrade.id)}
                            className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/30 transition-all text-sm font-medium"
                          >
                            ✓ Save
                          </button>
                          <button
                            onClick={cancelEditingName}
                            className="px-3 py-1 bg-slate-700/50 text-slate-400 border border-slate-600/40 rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-2xl font-bold text-slate-200">{copyTrade.name}</h3>
                          <button
                            onClick={() => startEditingName(copyTrade.id, copyTrade.name)}
                            className="px-2 py-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 rounded transition-all"
                            title="Edit name"
                          >
                            ✏️
                          </button>
                        </>
                      )}
                      {editingNameId !== copyTrade.id && (
                        <>
                          {copyTrade.isArchived && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-600/20 text-slate-400 border border-slate-600/40">
                              📦 ARCHIVED
                            </span>
                          )}
                          {isBankrupt && !copyTrade.isArchived && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                              💀 BANKRUPT
                            </span>
                          )}
                          {copyTrade.autoRefresh && !copyTrade.isArchived && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/40 animate-pulse">
                              🔄 AUTO-REFRESH ({copyTrade.autoRefreshInterval || 5}min)
                            </span>
                          )}
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            copyTrade.isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-slate-500/20 text-slate-400 border border-slate-500/40'
                          }`}>
                            {copyTrade.isActive ? '● ACTIVE' : '○ PAUSED'}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm font-mono mb-1">
                      Trader: {copyTrade.traderAddress}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-slate-500">Created: </span>
                        <span className="text-emerald-400 font-medium">
                          {new Date(copyTrade.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Last checked: </span>
                        <span className="text-indigo-400 font-medium">
                          {new Date(copyTrade.lastChecked).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Active for: </span>
                        <span className="text-purple-400 font-medium">
                          {(() => {
                            const minutes = Math.floor((Date.now() - copyTrade.createdAt) / 1000 / 60)
                            if (minutes < 60) return `${minutes}m`
                            const hours = Math.floor(minutes / 60)
                            if (hours < 24) return `${hours}h ${minutes % 60}m`
                            const days = Math.floor(hours / 24)
                            return `${days}d ${hours % 24}h`
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAutoRefresh(copyTrade.id)}
                      disabled={copyTrade.isArchived}
                      className={`px-4 py-2 rounded-lg transition-all text-sm border ${
                        copyTrade.autoRefresh
                          ? 'bg-green-500/30 text-green-300 border-green-500/50'
                          : 'bg-slate-700/30 text-slate-400 border-slate-600/40 hover:bg-slate-600/30'
                      }`}
                      title={copyTrade.autoRefresh ? `Auto-refreshing every ${copyTrade.autoRefreshInterval || 5} min` : 'Enable auto-refresh'}
                    >
                      {copyTrade.autoRefresh ? '🔄 Auto ON' : '⏸️ Auto OFF'}
                    </button>
                    <button
                      onClick={() => refreshCopyTrade(copyTrade.id)}
                      disabled={refreshingId === copyTrade.id || checkingResolutionsId === copyTrade.id}
                      className={`px-4 py-2 rounded-lg transition-all text-sm border ${
                        refreshingId === copyTrade.id
                          ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/50 cursor-not-allowed'
                          : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/30'
                      }`}
                    >
                      {refreshingId === copyTrade.id ? '⏳ Scanning...' : '↻ Refresh'}
                    </button>
                    <button
                      onClick={() => checkResolutions(copyTrade.id)}
                      disabled={refreshingId === copyTrade.id || checkingResolutionsId === copyTrade.id}
                      className={`px-4 py-2 rounded-lg transition-all text-sm border ${
                        checkingResolutionsId === copyTrade.id
                          ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50 cursor-not-allowed'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                      }`}
                    >
                      {checkingResolutionsId === copyTrade.id ? '⏳ Checking...' : '✓ Check Resolutions'}
                    </button>
                    <button
                      onClick={() => showRunChart(copyTrade.id)}
                      className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-lg hover:bg-blue-500/30 transition-all text-sm"
                    >
                      📈 View Chart
                    </button>
                    <button
                      onClick={() => toggleActive(copyTrade.id)}
                      className="px-4 py-2 bg-slate-800/50 text-slate-300 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 transition-all text-sm"
                      disabled={copyTrade.isArchived}
                    >
                      {copyTrade.isActive ? 'Pause' : 'Resume'}
                    </button>
                    {copyTrade.isArchived ? (
                      <button
                        onClick={() => unarchiveRun(copyTrade.id)}
                        className="px-4 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-lg hover:bg-indigo-500/30 transition-all text-sm"
                      >
                        📦 Unarchive
                      </button>
                    ) : (
                      <button
                        onClick={() => deleteCopyTrade(copyTrade.id)}
                        className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/40 rounded-lg hover:bg-red-500/30 transition-all text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Bankruptcy Warning */}
                {isBankrupt && !copyTrade.isArchived && (
                  <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                    <span className="text-2xl">💀</span>
                    <div className="flex-1">
                      <p className="text-red-400 font-semibold text-sm">This run is bankrupt!</p>
                      <p className="text-red-400/80 text-xs">Remaining budget (${remainingBudget.toFixed(2)}) is less than fixed bet amount (${copyTrade.fixedBetAmount})</p>
                    </div>
                  </div>
                )}

                {/* Performance Metrics */}
                {(() => {
                  const wonTrades = copyTrade.trades.filter(t => t.status === 'won')
                  const lostTrades = copyTrade.trades.filter(t => t.status === 'lost')
                  const closedTrades = [...wonTrades, ...lostTrades]
                  const openTrades = copyTrade.trades.filter(t => t.status === 'open')
                  
                  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
                  const totalInvested = closedTrades.reduce((sum, t) => sum + t.amount, 0)
                  const overallRoi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
                  const winRate = closedTrades.length > 0 ? (wonTrades.length / closedTrades.length) * 100 : 0
                  const budgetChange = copyTrade.currentBudget - copyTrade.initialBudget
                  const budgetChangePercent = (budgetChange / copyTrade.initialBudget) * 100
                  
                  // NEW METRICS
                  const avgPnlPerTrade = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0
                  const expectedPnlAfter100 = avgPnlPerTrade * 100

                  return closedTrades.length > 0 ? (
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold text-indigo-300 mb-3">📈 Performance</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Total P&L</p>
                          <p className={`text-lg font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Win Rate</p>
                          <p className="text-lg font-bold text-white">
                            {winRate.toFixed(1)}%
                            <span className="text-xs text-slate-400 ml-1">
                              ({wonTrades.length}/{closedTrades.length})
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Overall ROI</p>
                          <p className={`text-lg font-bold ${overallRoi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {overallRoi >= 0 ? '+' : ''}{overallRoi.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Budget Change</p>
                          <p className={`text-lg font-bold ${budgetChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {budgetChange >= 0 ? '+' : ''}${budgetChange.toFixed(2)}
                            <span className="text-xs ml-1">
                              ({budgetChangePercent >= 0 ? '+' : ''}{budgetChangePercent.toFixed(1)}%)
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Avg P&L per Trade</p>
                          <p className={`text-lg font-bold ${avgPnlPerTrade >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {avgPnlPerTrade >= 0 ? '+' : ''}${avgPnlPerTrade.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Expected after 100 trades</p>
                          <p className={`text-lg font-bold ${expectedPnlAfter100 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {expectedPnlAfter100 >= 0 ? '+' : ''}${expectedPnlAfter100.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null
                })()}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Current Budget</p>
                    <p className="text-xl font-bold text-white">${copyTrade.currentBudget.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">of ${copyTrade.initialBudget}</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Fixed Bet</p>
                    <p className="text-xl font-bold text-indigo-400">${copyTrade.fixedBetAmount}</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Trades</p>
                    <p className="text-xl font-bold text-white">{copyTrade.trades.length}</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Price Range</p>
                    <p className="text-sm font-bold text-purple-400">
                      ${copyTrade.minPrice.toFixed(2)} - ${copyTrade.maxPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Min Trigger</p>
                    <p className="text-sm font-bold text-slate-300">${copyTrade.minTriggerAmount}</p>
                  </div>
                </div>

                {/* Trades */}
                {copyTrade.trades.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">
                      Simulated Trades ({copyTrade.trades.length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {(() => {
                        const visibleCount = getVisibleTradesCount(copyTrade.id)
                        const visibleTrades = copyTrade.trades.slice(0, visibleCount)
                        const hasMore = copyTrade.trades.length > visibleCount
                        
                        return (
                          <>
                            {visibleTrades.map(trade => (
                        <div
                          key={trade.id}
                          className={`p-3 rounded-lg border ${
                            trade.status === 'won'
                              ? 'bg-emerald-500/5 border-emerald-500/30'
                              : trade.status === 'lost'
                              ? 'bg-red-500/5 border-red-500/30'
                              : 'bg-slate-800/30 border-slate-700/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <p className="text-sm text-slate-300 truncate flex-1">
                                  {trade.market || 'Loading market...'}
                                </p>
                                <button
                                  onClick={() => {
                                    const txHash = trade.originalTrade?.transactionHash || trade.transactionHash
                                    if (txHash) {
                                      navigator.clipboard.writeText(txHash)
                                      setNotification({
                                        type: 'success',
                                        message: '📋 Transaction hash copied!'
                                      })
                                      setTimeout(() => setNotification(null), 2000)
                                    }
                                  }}
                                  title={`Copy TX Hash: ${(trade.originalTrade?.transactionHash || trade.transactionHash || '').slice(0, 10)}...`}
                                  className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 rounded text-xs text-purple-400 hover:text-purple-300 transition-all flex items-center gap-1 shrink-0"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span>TX</span>
                                </button>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(trade.conditionId)
                                    setNotification({
                                      type: 'success',
                                      message: '📋 Condition ID copied!'
                                    })
                                    setTimeout(() => setNotification(null), 2000)
                                  }}
                                  title="Copy Condition ID"
                                  className="px-2 py-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 rounded text-xs text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1 shrink-0"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span>ID</span>
                                </button>
                              </div>
                              {trade.outcome && (
                                <p className="text-xs text-indigo-400 mt-0.5">
                                  → {trade.outcome}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">
                                {trade.timestamp && !isNaN(trade.timestamp) 
                                  ? new Date(trade.timestamp).toLocaleString()
                                  : 'Unknown time'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-400">
                                ${trade.amount} @ ${trade.price.toFixed(3)}
                              </p>
                              <p className={`text-sm font-bold mt-1 ${
                                trade.status === 'won' ? 'text-emerald-400' :
                                trade.status === 'lost' ? 'text-red-400' :
                                'text-slate-400'
                              }`}>
                                {trade.status === 'open' ? 'OPEN' :
                                 trade.status === 'won' ? `+$${trade.pnl?.toFixed(2)}` :
                                 `-$${Math.abs(trade.pnl || 0).toFixed(2)}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Show More Button */}
                      {hasMore && (
                        <div className="flex justify-center pt-4">
                          <button
                            onClick={() => showMoreTrades(copyTrade.id)}
                            className="px-6 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 hover:border-indigo-500/50 rounded-lg transition-all font-medium flex items-center gap-2"
                          >
                            <span>↓</span>
                            <span>Show More Trades</span>
                            <span className="text-sm opacity-75">
                              (showing {visibleCount} of {copyTrade.trades.length})
                            </span>
                          </button>
                        </div>
                      )}
                    </>
                  )
                })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </>
        )}
      </>
    )}

    {/* Strategy Analysis View */}
    {activeView === 'analysis' && (
      <div className="space-y-6">
        {strategyGroups.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">No Strategies Found</h3>
            <p className="text-slate-400 mb-6">Create multiple copy trades with the same configuration to see aggregate statistics</p>
          </div>
        ) : (
          <>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-200 mb-1">Strategy Analysis</h2>
                  <p className="text-slate-400 text-sm">
                    Found {strategyGroups.length} unique configuration{strategyGroups.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Total Runs</p>
                  <p className="text-3xl font-bold text-indigo-400">
                    {copyTrades.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Super Optimizer Section */}
            <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-purple-300 mb-2 flex items-center gap-2">
                    🚀 Super Optimizer
                    <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full">BETA</span>
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Analyze all configurations for a trader and find the optimal strategy combination
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedTraderForSuper}
                      onChange={(e) => setSelectedTraderForSuper(e.target.value)}
                      className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 text-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">Select a trader...</option>
                      {Array.from(new Set(copyTrades.map(ct => ct.traderAddress))).map(address => {
                        const configCount = strategyGroups.filter(g => g.traderAddress === address).length
                        const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`
                        return (
                          <option key={address} value={address}>
                            {shortAddress} ({configCount} config{configCount !== 1 ? 's' : ''})
                          </option>
                        )
                      })}
                    </select>
                    
                    <button
                      onClick={() => selectedTraderForSuper && runSuperOptimizer(selectedTraderForSuper)}
                      disabled={!selectedTraderForSuper || superOptimizing || strategyGroups.filter(g => g.traderAddress === selectedTraderForSuper).length < 2}
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-purple-500/50"
                    >
                      {superOptimizing ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⚙️</span> Analyzing...
                        </span>
                      ) : (
                        '🎯 Find Optimal Strategy'
                      )}
                    </button>
                  </div>
                  
                  {selectedTraderForSuper && strategyGroups.filter(g => g.traderAddress === selectedTraderForSuper).length < 2 && (
                    <p className="text-orange-400 text-sm mt-2">
                      ⚠️ Need at least 2 configurations for this trader to super optimize
                    </p>
                  )}
                </div>
              </div>
            </div>

            {strategyGroups.map((group, index) => (
              <div
                key={index}
                className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 hover:border-indigo-500/30 transition-all"
              >
                {/* Configuration Header */}
                <div className="mb-6 pb-4 border-b border-slate-800/50">
                  <div className="flex items-center gap-3 mb-3">
                    {editingNameId === group.configKey ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveConfigName(group.configKey, editingName)
                            if (e.key === 'Escape') cancelEditingName()
                          }}
                          placeholder={`Configuration #${index + 1}`}
                          className="text-xl font-bold text-slate-200 bg-slate-800/50 border border-indigo-500/50 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => saveConfigName(group.configKey, editingName)}
                          className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/30 transition-all text-sm font-medium"
                        >
                          ✓ Save
                        </button>
                        <button
                          onClick={cancelEditingName}
                          className="px-3 py-1 bg-slate-700/50 text-slate-400 border border-slate-600/40 rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-bold text-slate-200">
                          {configNames[group.configKey] || `Configuration #${index + 1}`}
                        </h3>
                        <button
                          onClick={() => {
                            setEditingNameId(group.configKey)
                            setEditingName(configNames[group.configKey] || '')
                          }}
                          className="px-2 py-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 rounded transition-all"
                          title="Edit configuration name"
                        >
                          ✏️
                        </button>
                      </>
                    )}
                    {editingNameId !== group.configKey && (
                      <>
                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-full text-xs font-bold">
                          {group.numberOfRuns} {group.numberOfRuns === 1 ? 'RUN' : 'RUNS'}
                        </span>
                        {group.bankruptcyCount > 0 && (
                          <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full text-xs font-bold">
                            💀 {group.bankruptcyCount} BANKRUPT
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm font-mono mb-2">
                    Trader: {group.traderAddress}
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Budget: </span>
                      <span className="text-emerald-400 font-medium">${group.initialBudget}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Fixed Bet: </span>
                      <span className="text-indigo-400 font-medium">${group.fixedBetAmount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Price Range: </span>
                      <span className="text-purple-400 font-medium">
                        {(group.minPrice * 100).toFixed(0)}% - {(group.maxPrice * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Min Trigger: </span>
                      <span className="text-orange-400 font-medium">${group.minTriggerAmount}</span>
                    </div>
                  </div>
                  
                  {/* Optimize Button */}
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <button
                      onClick={() => quickAddRunFromConfig(group)}
                      className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 hover:border-emerald-500/50 text-emerald-400 font-medium rounded-lg transition-all"
                      title="Quick add a new run with this configuration"
                    >
                      ➕ Quick Add Run
                    </button>
                    <button
                      onClick={() => exportConfigData(group)}
                      className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 hover:border-cyan-500/50 text-cyan-400 font-medium rounded-lg transition-all"
                      title="Export this configuration and all its runs to JSON"
                    >
                      💾 Export Config
                    </button>
                    <button
                      onClick={() => showConfigChart(group)}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 hover:border-blue-500/50 text-blue-400 font-medium rounded-lg transition-all"
                      title="View combined P&L chart for all runs in this configuration"
                    >
                      📈 View Chart
                    </button>
                    <button
                      onClick={() => optimizeStrategy(group)}
                      disabled={optimizing || group.totalClosedTrades < 15}
                      className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 hover:border-purple-500/50 text-purple-400 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={group.totalClosedTrades < 15 ? "Need at least 15 closed trades to optimize" : "Analyze this configuration to find optimal settings"}
                    >
                      {optimizing ? '⏳ Analyzing...' : '🔍 Optimize Strategy'}
                    </button>
                    <button
                      onClick={() => runAutoBacktest(group.traderAddress, group)}
                      disabled={autoBacktesting}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 hover:border-amber-500/50 text-amber-400 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Automatically test many budget/bet combinations to find optimal strategy with lowest bankruptcy risk"
                    >
                      {autoBacktesting ? '🤖 Testing...' : '🤖 Auto Backtest'}
                    </button>
                    <button
                      onClick={() => deleteConfiguration(group)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 hover:border-red-500/50 text-red-400 font-medium rounded-lg transition-all"
                      title="Delete this configuration and all its runs"
                    >
                      �️ Delete Config
                    </button>
                    {group.totalClosedTrades < 15 && (
                      <p className="text-xs text-slate-500 mt-1">Need {15 - group.totalClosedTrades} more closed trades to optimize</p>
                    )}
                  </div>
                </div>

                {/* Aggregate Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Total P&L</p>
                    <p className={`text-2xl font-bold ${
                      group.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {group.totalPnl >= 0 ? '+' : ''}{group.totalPnl >= 0 ? '$' : '-$'}
                      {Math.abs(group.totalPnl).toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Avg P&L per Trade</p>
                    <p className={`text-2xl font-bold ${
                      group.totalPnl / group.totalClosedTrades >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {group.totalPnl / group.totalClosedTrades >= 0 ? '+' : ''}
                      ${(group.totalPnl / group.totalClosedTrades).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      ({((group.totalPnl / group.totalClosedTrades / group.fixedBetAmount) * 100).toFixed(1)}% ROI)
                    </p>
                  </div>

                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Overall Win Rate</p>
                    <p className="text-2xl font-bold text-indigo-400">
                      {group.overallWinRate.toFixed(1)}%
                    </p>
                  </div>

                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Bankruptcy Rate</p>
                    <p className={`text-2xl font-bold ${
                      group.bankruptcyCount === 0 ? 'text-emerald-400' : 
                      group.bankruptcyCount / group.numberOfRuns < 0.5 ? 'text-orange-400' : 'text-red-400'
                    }`}>
                      {((group.bankruptcyCount / group.numberOfRuns) * 100).toFixed(0)}%
                    </p>
                  </div>

                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {group.totalClosedTrades}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => showPriceAnalysis(group)}
                    className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all cursor-pointer w-full text-left"
                    title="Click to view detailed price range analysis"
                  >
                    <p className="text-slate-400 text-xs mb-1">Avg Buy Price (won)</p>
                    <p className="text-2xl font-bold text-emerald-400">{group.avgBuyPriceWhenWon > 0 ? `$${group.avgBuyPriceWhenWon.toFixed(2)}` : '—'}</p>
                    <p className="text-xs text-slate-500 mt-1">👁️ click for ranges</p>
                  </button>

                  <button
                    onClick={() => showPriceAnalysis(group)}
                    className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 hover:border-red-500/50 hover:bg-slate-800/50 transition-all cursor-pointer w-full text-left"
                    title="Click to view detailed price range analysis"
                  >
                    <p className="text-slate-400 text-xs mb-1">Avg Buy Price (lost)</p>
                    <p className="text-2xl font-bold text-red-400">{group.avgBuyPriceWhenLost > 0 ? `$${group.avgBuyPriceWhenLost.toFixed(2)}` : '—'}</p>
                    <p className="text-xs text-slate-500 mt-1">👁️ click for ranges</p>
                  </button>
                </div>

                {/* Individual Runs */}
                <details className="group">
                  <summary className="cursor-pointer text-indigo-400 hover:text-indigo-300 font-medium text-sm mb-2 flex items-center gap-2">
                    <span className="transform transition-transform group-open:rotate-90">▶</span>
                    View Individual Runs ({group.numberOfRuns})
                  </summary>
                  <div className="mt-4 space-y-2 pl-6">
                    {group.runs.map(run => {
                      const closedTrades = run.trades.filter(t => t.status !== 'open')
                      const wonTrades = closedTrades.filter(t => t.status === 'won').length
                      const runPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
                      const winRate = closedTrades.length > 0 ? (wonTrades / closedTrades.length) * 100 : 0
                      const remainingBudget = run.initialBudget + runPnl
                      const isBankrupt = remainingBudget < run.fixedBetAmount

                      return (
                        <div
                          key={run.id}
                          className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-3 hover:border-slate-600/50 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-slate-200">{run.name}</p>
                                {isBankrupt && (
                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-xs font-bold">
                                    💀 BANKRUPT
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-4 text-xs text-slate-400">
                                <span>Remaining: ${remainingBudget.toFixed(2)}</span>
                                <span>Trades: {closedTrades.length}</span>
                                <span>Win Rate: {winRate.toFixed(1)}%</span>
                                <span className={runPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  P&L: {runPnl >= 0 ? '+' : ''}{runPnl >= 0 ? '$' : '-$'}{Math.abs(runPnl).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteCopyTrade(run.id)}
                              className="ml-3 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 font-medium rounded-lg transition-all text-xs"
                              title="Delete this run"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              </div>
            ))}
          </>
        )}
      </div>
    )}

    {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-slate-200 mb-6">Create Copy Trade</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Top Trader Strategy"
                    className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Trader Address
                  </label>
                  <input
                    type="text"
                    value={traderAddress}
                    onChange={(e) => setTraderAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Initial Budget ($)
                    </label>
                    <input
                      type="number"
                      value={initialBudget}
                      onChange={(e) => setInitialBudget(Number(e.target.value))}
                      min="1"
                      className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Fixed Bet Amount ($)
                    </label>
                    <input
                      type="number"
                      value={fixedBetAmount}
                      onChange={(e) => setFixedBetAmount(Number(e.target.value))}
                      min="1"
                      className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Min Trigger Amount ($)
                  </label>
                  <input
                    type="number"
                    value={minTriggerAmount}
                    onChange={(e) => setMinTriggerAmount(Number(e.target.value))}
                    min="0"
                    className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    Only copy trades where the trader bets at least this amount
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Price Range
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => setMinPrice(Number(e.target.value))}
                        min="0"
                        max="1"
                        step="0.01"
                        placeholder="Min (e.g., 0.5)"
                        className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(Number(e.target.value))}
                        min="0"
                        max="1"
                        step="0.01"
                        placeholder="Max (e.g., 0.66)"
                        className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">
                    Only copy trades within this price range
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={createCopyTrade}
                  disabled={isCreating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  Create Copy Trade
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 bg-slate-800/50 text-slate-300 border border-slate-700/50 rounded-xl hover:bg-slate-700/50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Optimization Results Modal */}
        {showOptimizationModal && optimizationResults && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-200">
                  🔍 Strategy Optimization Results
                </h2>
                <button
                  onClick={() => {
                    setShowOptimizationModal(false)
                    setManualTestTrigger('')
                    setManualTestResults(null)
                    setAutoTriggerResults(null)
                    setAutoPriceRangeResults(null)
                    setCombinedOptimizationResult(null)
                  }}
                  className="px-3 py-1 text-slate-400 hover:text-slate-200 transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="mb-6 pb-4 border-b border-slate-800/50">
                <h3 className="text-lg font-semibold text-indigo-400 mb-2">
                  {optimizationResults.configName}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Total Trades</p>
                    <p className="text-xl font-bold text-slate-200">
                      {optimizationResults.currentStats.totalTrades}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Current Win Rate</p>
                    <p className="text-xl font-bold text-indigo-400">
                      {optimizationResults.currentStats.winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Current Avg P&L</p>
                    <p className={`text-xl font-bold ${
                      optimizationResults.currentStats.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {optimizationResults.currentStats.avgPnl >= 0 ? '+' : ''}
                      ${optimizationResults.currentStats.avgPnl.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Manual Min Trigger Amount Tester */}
              <div className="mb-6 pb-6 border-b border-slate-800/50">
                <h3 className="text-lg font-semibold text-purple-400 mb-3">
                  🧪 Test Custom Min Trigger Amount
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Enter a custom minimum trigger amount to see what the stats would be if you had used that threshold
                </p>
                
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Custom Min Trigger Amount ($)
                    </label>
                    <input
                      type="number"
                      value={manualTestTrigger}
                      onChange={(e) => setManualTestTrigger(e.target.value)}
                      min="0"
                      step="10"
                      placeholder="e.g., 50, 100, 200"
                      className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const group = strategyGroups.find(g => g.configKey === optimizationResults.configKey)
                      if (group) testManualTrigger(group)
                    }}
                    disabled={!manualTestTrigger || parseFloat(manualTestTrigger) < 0}
                    className="px-6 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 hover:border-purple-500/50 text-purple-400 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Test
                  </button>
                  {manualTestResults && (
                    <button
                      onClick={() => {
                        setManualTestResults(null)
                        setManualTestTrigger('')
                      }}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all"
                      title="Clear results"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Manual Test Results */}
                {manualTestResults && (
                  <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-purple-300">
                        Results with Min Trigger ≥ ${parseFloat(manualTestTrigger).toFixed(0)}
                      </h4>
                      <span className="text-xs text-slate-400">
                        {manualTestResults.trades} trades
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Win Rate</p>
                        <p className="text-lg font-bold text-purple-400">
                          {manualTestResults.winRate.toFixed(1)}%
                        </p>
                        <p className={`text-xs ${
                          manualTestResults.winRate >= optimizationResults.currentStats.winRate
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}>
                          {manualTestResults.winRate >= optimizationResults.currentStats.winRate ? '+' : ''}
                          {(manualTestResults.winRate - optimizationResults.currentStats.winRate).toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Avg P&L</p>
                        <p className={`text-lg font-bold ${
                          manualTestResults.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {manualTestResults.avgPnl >= 0 ? '+' : ''}${manualTestResults.avgPnl.toFixed(2)}
                        </p>
                        <p className={`text-xs ${
                          manualTestResults.avgPnl >= optimizationResults.currentStats.avgPnl
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}>
                          {manualTestResults.avgPnl >= optimizationResults.currentStats.avgPnl ? '+' : ''}
                          ${(manualTestResults.avgPnl - optimizationResults.currentStats.avgPnl).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Total P&L</p>
                        <p className={`text-lg font-bold ${
                          manualTestResults.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {manualTestResults.totalPnl >= 0 ? '+' : ''}${manualTestResults.totalPnl.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-400">
                          across all trades
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto Find Best Min Trigger */}
              <div className="mb-6 pb-6 border-b border-slate-800/50">
                <h3 className="text-lg font-semibold text-amber-400 mb-3">
                  🎯 Auto-Find Best Min Trigger Amount
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Automatically test multiple trigger amounts to find the best one. Set a minimum number of trades to avoid outliers.
                </p>
                
                <div className="flex items-end gap-3 mb-4">
                  <div className="flex-1">
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Minimum Trades Required
                    </label>
                    <input
                      type="number"
                      value={minTradesForTrigger}
                      onChange={(e) => setMinTradesForTrigger(Number(e.target.value))}
                      min="10"
                      step="10"
                      placeholder="e.g., 50, 100"
                      className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Only consider trigger amounts with at least this many trades
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const group = strategyGroups.find(g => g.configKey === optimizationResults.configKey)
                      if (group) autoFindBestTrigger(group)
                    }}
                    disabled={autoFindingTrigger || minTradesForTrigger < 10}
                    className="px-6 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 hover:border-amber-500/50 text-amber-400 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {autoFindingTrigger ? '🔍 Finding...' : '🎯 Find Best'}
                  </button>
                  {autoTriggerResults && (
                    <button
                      onClick={() => setAutoTriggerResults(null)}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all"
                      title="Clear results"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Auto Find Results */}
                {autoTriggerResults && autoTriggerResults.length > 0 && (
                  <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-b border-emerald-500/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                          🏆 Best: ${autoTriggerResults[0].trigger} Min Trigger
                        </h4>
                        <span className="text-xs text-slate-400">
                          {autoTriggerResults[0].trades} trades
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Win Rate</p>
                          <p className="text-lg font-bold text-emerald-400">
                            {autoTriggerResults[0].winRate.toFixed(1)}%
                          </p>
                          <p className={`text-xs ${
                            autoTriggerResults[0].winRate >= optimizationResults.currentStats.winRate
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}>
                            {autoTriggerResults[0].winRate >= optimizationResults.currentStats.winRate ? '+' : ''}
                            {(autoTriggerResults[0].winRate - optimizationResults.currentStats.winRate).toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Avg P&L</p>
                          <p className={`text-lg font-bold ${
                            autoTriggerResults[0].avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {autoTriggerResults[0].avgPnl >= 0 ? '+' : ''}${autoTriggerResults[0].avgPnl.toFixed(2)}
                          </p>
                          <p className={`text-xs ${
                            autoTriggerResults[0].avgPnl >= optimizationResults.currentStats.avgPnl
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}>
                            {autoTriggerResults[0].avgPnl >= optimizationResults.currentStats.avgPnl ? '+' : ''}
                            ${(autoTriggerResults[0].avgPnl - optimizationResults.currentStats.avgPnl).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Total P&L</p>
                          <p className={`text-lg font-bold ${
                            autoTriggerResults[0].totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {autoTriggerResults[0].totalPnl >= 0 ? '+' : ''}${autoTriggerResults[0].totalPnl.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Other Results Table */}
                    {autoTriggerResults.length > 1 && (
                      <div className="p-4">
                        <h5 className="text-xs font-semibold text-slate-400 mb-2 uppercase">All Tested Amounts</h5>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-slate-800/50 text-slate-400">
                              <tr>
                                <th className="text-left py-2 px-3">Trigger</th>
                                <th className="text-right py-2 px-3">Trades</th>
                                <th className="text-right py-2 px-3">Win Rate</th>
                                <th className="text-right py-2 px-3">Avg P&L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {autoTriggerResults.map((result, index) => (
                                <tr 
                                  key={index} 
                                  className={`border-t border-slate-700/30 ${
                                    index === 0 ? 'bg-emerald-500/10' : 'hover:bg-slate-800/30'
                                  }`}
                                >
                                  <td className="py-2 px-3 text-slate-300 font-medium">
                                    ${result.trigger}
                                    {index === 0 && <span className="ml-2 text-emerald-400">🏆</span>}
                                  </td>
                                  <td className="text-right py-2 px-3 text-slate-400">{result.trades}</td>
                                  <td className="text-right py-2 px-3 text-cyan-400 font-medium">
                                    {result.winRate.toFixed(1)}%
                                  </td>
                                  <td className={`text-right py-2 px-3 font-medium ${
                                    result.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    ${result.avgPnl.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Auto Find Best Price Range */}
              <div className="mb-6 pb-6 border-b border-slate-800/50">
                <h3 className="text-lg font-semibold text-cyan-400 mb-3">
                  📊 Auto-Find Best Price Range
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Automatically test multiple price ranges to find the one with best performance. Helps identify if specific price ranges are hurting your results.
                </p>
                
                <div className="flex items-end gap-3 mb-4">
                  <div className="flex-1">
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Minimum Trades Required
                    </label>
                    <input
                      type="number"
                      value={minTradesForPriceRange}
                      onChange={(e) => setMinTradesForPriceRange(Number(e.target.value))}
                      min="10"
                      step="10"
                      placeholder="e.g., 50, 100"
                      className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Only consider price ranges with at least this many trades
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const group = strategyGroups.find(g => g.configKey === optimizationResults.configKey)
                      if (group) autoFindBestPriceRange(group)
                    }}
                    disabled={autoFindingPriceRange || minTradesForPriceRange < 10}
                    className="px-6 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 hover:border-cyan-500/50 text-cyan-400 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {autoFindingPriceRange ? '🔍 Finding...' : '📊 Find Best'}
                  </button>
                  {autoPriceRangeResults && (
                    <button
                      onClick={() => setAutoPriceRangeResults(null)}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all"
                      title="Clear results"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Auto Find Price Range Results */}
                {autoPriceRangeResults && autoPriceRangeResults.length > 0 && (
                  <div className="mt-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-b border-emerald-500/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                          🏆 Best: {autoPriceRangeResults[0].rangeLabel} Price Range
                        </h4>
                        <span className="text-xs text-slate-400">
                          {autoPriceRangeResults[0].trades} trades
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Win Rate</p>
                          <p className="text-lg font-bold text-emerald-400">
                            {autoPriceRangeResults[0].winRate.toFixed(1)}%
                          </p>
                          <p className={`text-xs ${
                            autoPriceRangeResults[0].winRate >= optimizationResults.currentStats.winRate
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}>
                            {autoPriceRangeResults[0].winRate >= optimizationResults.currentStats.winRate ? '+' : ''}
                            {(autoPriceRangeResults[0].winRate - optimizationResults.currentStats.winRate).toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Avg P&L</p>
                          <p className={`text-lg font-bold ${
                            autoPriceRangeResults[0].avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {autoPriceRangeResults[0].avgPnl >= 0 ? '+' : ''}${autoPriceRangeResults[0].avgPnl.toFixed(2)}
                          </p>
                          <p className={`text-xs ${
                            autoPriceRangeResults[0].avgPnl >= optimizationResults.currentStats.avgPnl
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}>
                            {autoPriceRangeResults[0].avgPnl >= optimizationResults.currentStats.avgPnl ? '+' : ''}
                            ${(autoPriceRangeResults[0].avgPnl - optimizationResults.currentStats.avgPnl).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Total P&L</p>
                          <p className={`text-lg font-bold ${
                            autoPriceRangeResults[0].totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {autoPriceRangeResults[0].totalPnl >= 0 ? '+' : ''}${autoPriceRangeResults[0].totalPnl.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Other Results Table */}
                    {autoPriceRangeResults.length > 1 && (
                      <div className="p-4">
                        <h5 className="text-xs font-semibold text-slate-400 mb-2 uppercase">All Tested Ranges (Top 10)</h5>
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-slate-800/50 text-slate-400">
                              <tr>
                                <th className="text-left py-2 px-3">Range</th>
                                <th className="text-right py-2 px-3">Trades</th>
                                <th className="text-right py-2 px-3">Win Rate</th>
                                <th className="text-right py-2 px-3">Avg P&L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {autoPriceRangeResults.slice(0, 10).map((result, index) => (
                                <tr 
                                  key={index} 
                                  className={`border-t border-slate-700/30 ${
                                    index === 0 ? 'bg-emerald-500/10' : 'hover:bg-slate-800/30'
                                  }`}
                                >
                                  <td className="py-2 px-3 text-slate-300 font-medium">
                                    {result.rangeLabel}
                                    {index === 0 && <span className="ml-2 text-emerald-400">🏆</span>}
                                  </td>
                                  <td className="text-right py-2 px-3 text-slate-400">{result.trades}</td>
                                  <td className="text-right py-2 px-3 text-cyan-400 font-medium">
                                    {result.winRate.toFixed(1)}%
                                  </td>
                                  <td className={`text-right py-2 px-3 font-medium ${
                                    result.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    ${result.avgPnl.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Combined Optimization Test */}
              {autoTriggerResults && autoPriceRangeResults && (
                <div className="mb-6 pb-6 border-b border-slate-800/50">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3">
                    🎉 Test Combined Optimization
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    See what the results would be if you used BOTH the best trigger amount AND the best price range together
                  </p>

                  <button
                    onClick={() => {
                      const group = strategyGroups.find(g => g.configKey === optimizationResults.configKey)
                      if (group) testCombinedOptimization(group)
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30 border border-emerald-500/40 hover:border-emerald-500/50 text-emerald-400 font-bold rounded-lg transition-all"
                  >
                    🎯 Calculate Combined Result
                  </button>

                  {/* Combined Results */}
                  {combinedOptimizationResult && (
                    <div className="mt-4 bg-gradient-to-br from-emerald-900/30 to-green-900/20 border-2 border-emerald-500/50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-emerald-300 flex items-center gap-2">
                          🏆 Combined Optimization Results
                        </h4>
                        <button
                          onClick={() => setCombinedOptimizationResult(null)}
                          className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-all text-sm"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                        <p className="text-sm text-slate-400 mb-2">Using:</p>
                        <div className="flex gap-4 text-sm">
                          <span className="text-amber-400">Min Trigger: ${combinedOptimizationResult.trigger}</span>
                          <span className="text-cyan-400">Price Range: {combinedOptimizationResult.rangeLabel}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-slate-900/50 rounded-lg p-4">
                          <p className="text-xs text-slate-500 mb-1">Trades</p>
                          <p className="text-2xl font-bold text-slate-200">
                            {combinedOptimizationResult.trades}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4">
                          <p className="text-xs text-slate-500 mb-1">Win Rate</p>
                          <p className="text-2xl font-bold text-emerald-400">
                            {combinedOptimizationResult.winRate.toFixed(1)}%
                          </p>
                          <p className={`text-xs mt-1 ${
                            combinedOptimizationResult.winRate >= optimizationResults.currentStats.winRate
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}>
                            {combinedOptimizationResult.winRate >= optimizationResults.currentStats.winRate ? '+' : ''}
                            {(combinedOptimizationResult.winRate - optimizationResults.currentStats.winRate).toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4">
                          <p className="text-xs text-slate-500 mb-1">Avg P&L</p>
                          <p className={`text-2xl font-bold ${
                            combinedOptimizationResult.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {combinedOptimizationResult.avgPnl >= 0 ? '+' : ''}${combinedOptimizationResult.avgPnl.toFixed(2)}
                          </p>
                          <p className={`text-xs mt-1 ${
                            combinedOptimizationResult.avgPnl >= optimizationResults.currentStats.avgPnl
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}>
                            {combinedOptimizationResult.avgPnl >= optimizationResults.currentStats.avgPnl ? '+' : ''}
                            ${(combinedOptimizationResult.avgPnl - optimizationResults.currentStats.avgPnl).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4">
                          <p className="text-xs text-slate-500 mb-1">Total P&L</p>
                          <p className={`text-2xl font-bold ${
                            combinedOptimizationResult.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {combinedOptimizationResult.totalPnl >= 0 ? '+' : ''}${combinedOptimizationResult.totalPnl.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <p className="text-xs text-blue-400">
                          💡 This shows the performance if you had used both optimizations together. 
                          Compare this to using each optimization separately!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {optimizationResults.suggestions.length === 0 ? (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-8 text-center">
                  <div className="text-5xl mb-3">✅</div>
                  <h3 className="text-xl font-semibold text-slate-200 mb-2">
                    Already Optimized!
                  </h3>
                  <p className="text-slate-400">
                    No significant improvements found. Your current settings are performing well based on the available data.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-emerald-400 mb-3">
                    💡 Recommended Changes
                  </h3>
                  
                  {optimizationResults.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-base font-semibold text-slate-200 mb-1">
                            {suggestion.type === 'price' ? '📊 Price Range' : '💰 Min Trigger Amount'}
                          </h4>
                          <p className="text-sm text-slate-400">
                            Current: <span className="text-orange-400 font-medium">{suggestion.current}</span>
                            {' → '}
                            Suggested: <span className="text-emerald-400 font-medium">{suggestion.suggested}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Based on</p>
                          <p className="text-sm font-semibold text-indigo-400">
                            {suggestion.improvement.trades} trades
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Win Rate</p>
                          <p className="text-lg font-bold text-emerald-400">
                            {suggestion.improvement.winRate.toFixed(1)}%
                          </p>
                          <p className="text-xs text-emerald-400">
                            +{(suggestion.improvement.winRate - optimizationResults.currentStats.winRate).toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Avg P&L</p>
                          <p className={`text-lg font-bold ${
                            suggestion.improvement.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {suggestion.improvement.avgPnl >= 0 ? '+' : ''}${suggestion.improvement.avgPnl.toFixed(2)}
                          </p>
                          <p className="text-xs text-emerald-400">
                            +${(suggestion.improvement.avgPnl - optimizationResults.currentStats.avgPnl).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Total Impact</p>
                          <p className={`text-lg font-bold ${
                            suggestion.improvement.totalPnlDiff >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {suggestion.improvement.totalPnlDiff >= 0 ? '+' : ''}${suggestion.improvement.totalPnlDiff.toFixed(2)}
                          </p>
                          <p className="text-xs text-slate-400">on these trades</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                    <p className="text-sm text-blue-400">
                      <span className="font-semibold">💡 Note:</span> These suggestions are based on historical data from your runs. 
                      Results may vary with future trades. Consider testing with a new run using the suggested settings.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowOptimizationModal(false)
                    setManualTestTrigger('')
                    setManualTestResults(null)
                    setAutoTriggerResults(null)
                    setAutoPriceRangeResults(null)
                  }}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auto Backtest Progress Modal */}
        {autoBacktesting && autoBacktestProgress && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-amber-500/50 rounded-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                <span className="animate-spin">🤖</span> Auto Backtest Running
              </h3>
              <p className="text-slate-300 mb-4">
                Testing {autoBacktestProgress.total} combinations...
              </p>
              <div className="mb-4">
                <div className="flex justify-between text-sm text-slate-400 mb-2">
                  <span>Progress</span>
                  <span>{autoBacktestProgress.current} / {autoBacktestProgress.total}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                    style={{ width: `${(autoBacktestProgress.current / autoBacktestProgress.total) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 break-words">
                Current: {autoBacktestProgress.currentConfig}
              </p>
            </div>
          </div>
        )}

        {/* Auto Backtest Results Modal */}
        {showAutoBacktestModal && autoBacktestResults && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-amber-500/50 rounded-xl max-w-6xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  🤖 Auto Backtest Results
                </h2>
                <button
                  onClick={() => setShowAutoBacktestModal(false)}
                  className="px-3 py-1 text-slate-400 hover:text-slate-200 transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="mb-6 pb-4 border-b border-slate-800/50">
                <p className="text-slate-400 mb-2">
                  Tested <span className="text-amber-400 font-bold">{autoBacktestResults.totalSimulations}</span> simulations to find the optimal strategy
                </p>
              </div>

              {/* Best Strategy Card */}
              <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/20 border-2 border-emerald-500/50 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                  🏆 Recommended Strategy <span className="px-2 py-0.5 text-xs bg-emerald-500/20 rounded-full">BEST</span>
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Budget</p>
                    <p className="text-xl font-bold text-emerald-400">${autoBacktestResults.bestStrategy.initialBudget}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Fixed Bet</p>
                    <p className="text-xl font-bold text-indigo-400">${autoBacktestResults.bestStrategy.fixedBetAmount}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Price Range</p>
                    <p className="text-lg font-bold text-purple-400">
                      {(autoBacktestResults.bestStrategy.minPrice * 100).toFixed(0)}-{(autoBacktestResults.bestStrategy.maxPrice * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Win Rate</p>
                    <p className="text-xl font-bold text-cyan-400">{autoBacktestResults.bestStrategy.winRate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Avg P&L</p>
                    <p className={`text-xl font-bold ${autoBacktestResults.bestStrategy.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${autoBacktestResults.bestStrategy.avgPnl.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Bankruptcy Risk</p>
                    <p className={`text-2xl font-bold ${
                      autoBacktestResults.bestStrategy.bankruptcyRate === 0 ? 'text-emerald-400' : 
                      autoBacktestResults.bestStrategy.bankruptcyRate < 20 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {autoBacktestResults.bestStrategy.bankruptcyRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-slate-200">{autoBacktestResults.bestStrategy.totalTrades}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Total P&L</p>
                    <p className={`text-2xl font-bold ${autoBacktestResults.bestStrategy.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {autoBacktestResults.bestStrategy.totalPnl >= 0 ? '+' : ''}${autoBacktestResults.bestStrategy.totalPnl.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* All Results Table */}
              <div>
                <h3 className="text-lg font-semibold text-slate-300 mb-3">All Tested Combinations</h3>
                <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800/50 sticky top-0">
                        <tr className="text-left text-slate-400">
                          <th className="px-4 py-3">Budget</th>
                          <th className="px-4 py-3">Bet</th>
                          <th className="px-4 py-3">Price Range</th>
                          <th className="px-4 py-3">Win Rate</th>
                          <th className="px-4 py-3">Avg P&L</th>
                          <th className="px-4 py-3">Bankruptcy</th>
                          <th className="px-4 py-3">Trades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {autoBacktestResults.allResults.map((result, index) => (
                          <tr 
                            key={index} 
                            className={`border-t border-slate-700/30 hover:bg-slate-800/30 ${
                              index === 0 ? 'bg-emerald-500/10' : ''
                            }`}
                          >
                            <td className="px-4 py-3 text-slate-300">${result.initialBudget}</td>
                            <td className="px-4 py-3 text-slate-300">${result.fixedBetAmount}</td>
                            <td className="px-4 py-3 text-slate-300">
                              {(result.minPrice * 100).toFixed(0)}-{(result.maxPrice * 100).toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-cyan-400 font-medium">{result.winRate.toFixed(1)}%</td>
                            <td className={`px-4 py-3 font-medium ${result.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              ${result.avgPnl.toFixed(2)}
                            </td>
                            <td className={`px-4 py-3 font-medium ${
                              result.bankruptcyRate === 0 ? 'text-emerald-400' : 
                              result.bankruptcyRate < 20 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {result.bankruptcyRate.toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-slate-300">{result.totalTrades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowAutoBacktestModal(false)}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Super Optimizer Results Modal */}
        {showSuperOptimizerModal && superOptimizerResults && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-purple-500/50 rounded-xl max-w-5xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
                  🚀 Super Optimizer Results
                </h2>
                <button
                  onClick={() => setShowSuperOptimizerModal(false)}
                  className="px-3 py-1 text-slate-400 hover:text-slate-200 transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Analysis Overview */}
              <div className="mb-6 pb-4 border-b border-slate-800/50">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Configs Analyzed</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {superOptimizerResults.analyzedConfigs}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Total Runs</p>
                    <p className="text-2xl font-bold text-indigo-400">
                      {superOptimizerResults.totalRuns}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-slate-200">
                      {superOptimizerResults.totalTrades}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-slate-400 text-xs mb-1">Trader</p>
                    <p className="text-sm font-bold text-slate-200">
                      {superOptimizerResults.traderAddress.slice(0, 6)}...{superOptimizerResults.traderAddress.slice(-4)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Optimal Strategy */}
              <div className="mb-6 bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/30 rounded-xl p-6">
                <h3 className="text-xl font-bold text-purple-300 mb-4 flex items-center gap-2">
                  🎯 Optimal Strategy Recommendation
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-2">💰 Budget Settings</p>
                    <p className="text-lg font-bold text-slate-200 mb-1">
                      ${superOptimizerResults.optimalStrategy.initialBudget} initial / ${superOptimizerResults.optimalStrategy.fixedBetAmount} per trade
                    </p>
                    <p className="text-xs text-slate-400">{superOptimizerResults.optimalStrategy.reasoning.budget}</p>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-2">📊 Price Range</p>
                    <p className="text-lg font-bold text-slate-200 mb-1">
                      {superOptimizerResults.optimalStrategy.minPrice.toFixed(2)} - {superOptimizerResults.optimalStrategy.maxPrice.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-400">{superOptimizerResults.optimalStrategy.reasoning.priceRange}</p>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-2">💵 Min Trigger Amount</p>
                    <p className="text-lg font-bold text-slate-200 mb-1">
                      ${superOptimizerResults.optimalStrategy.minTriggerAmount}
                    </p>
                    <p className="text-xs text-slate-400">{superOptimizerResults.optimalStrategy.reasoning.minTrigger}</p>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                    <p className="text-slate-400 text-sm mb-2">🎯 Fixed Bet Amount</p>
                    <p className="text-lg font-bold text-slate-200 mb-1">
                      ${superOptimizerResults.optimalStrategy.fixedBetAmount}
                    </p>
                    <p className="text-xs text-slate-400">{superOptimizerResults.optimalStrategy.reasoning.fixedBet}</p>
                  </div>
                </div>

                {/* Expected Performance */}
                <div className="border-t border-purple-500/20 pt-4">
                  <p className="text-sm text-slate-400 mb-3">📈 Expected Performance</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Win Rate</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        {superOptimizerResults.optimalStrategy.expectedWinRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Avg P&L per Run</p>
                      <p className={`text-2xl font-bold ${
                        superOptimizerResults.optimalStrategy.expectedAvgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {superOptimizerResults.optimalStrategy.expectedAvgPnl >= 0 ? '+' : ''}
                        ${superOptimizerResults.optimalStrategy.expectedAvgPnl.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Bankruptcy Risk</p>
                      <p className={`text-2xl font-bold ${
                        superOptimizerResults.optimalStrategy.bankruptcyRisk < 20 ? 'text-emerald-400' :
                        superOptimizerResults.optimalStrategy.bankruptcyRisk < 50 ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {superOptimizerResults.optimalStrategy.bankruptcyRisk.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration Comparison */}
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-3">
                  📊 Configuration Comparison
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {superOptimizerResults.configComparison.map((config, index) => (
                    <div
                      key={index}
                      className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-200">{config.configName}</h4>
                          <p className="text-xs text-slate-400">
                            ${config.settings.initialBudget} / ${config.settings.fixedBetAmount} per trade / 
                            ${config.settings.minTriggerAmount} min / {config.settings.minPrice.toFixed(2)}-{config.settings.maxPrice.toFixed(2)} range
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">{config.stats.runs} runs</p>
                          <p className="text-xs text-slate-400">{config.stats.totalTrades} trades</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <p className="text-xs text-slate-500">Win Rate</p>
                          <p className="text-sm font-bold text-indigo-400">{config.stats.winRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Avg P&L</p>
                          <p className={`text-sm font-bold ${config.stats.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {config.stats.avgPnl >= 0 ? '+' : ''}${config.stats.avgPnl.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Total P&L</p>
                          <p className={`text-sm font-bold ${config.stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {config.stats.totalPnl >= 0 ? '+' : ''}${config.stats.totalPnl.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Bankruptcy</p>
                          <p className={`text-sm font-bold ${
                            config.stats.bankruptcyRate < 20 ? 'text-emerald-400' :
                            config.stats.bankruptcyRate < 50 ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {config.stats.bankruptcyRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                <p className="text-sm text-blue-400">
                  <span className="font-semibold">💡 Iterative Optimization:</span> Test this strategy with a new run, 
                  then run super optimize again to further refine your approach. Repeat this process to converge on the ultimate strategy.
                </p>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowSuperOptimizerModal(false)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* P&L Chart Modal */}
        {showChartModal && chartData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-blue-500/50 rounded-xl max-w-4xl w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-blue-400">
                  📈 P&L Chart: {chartData.runName}
                </h2>
                <button
                  onClick={() => setShowChartModal(false)}
                  className="px-3 py-1 text-slate-400 hover:text-slate-200 transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Chart Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-slate-400 text-xs mb-1">Total Trades</p>
                  <p className="text-2xl font-bold text-slate-200">
                    {chartData.dataPoints.length}
                  </p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-slate-400 text-xs mb-1">Final P&L</p>
                  <p className={`text-2xl font-bold ${
                    chartData.dataPoints[chartData.dataPoints.length - 1].cumulativePnl >= 0 
                      ? 'text-emerald-400' 
                      : 'text-red-400'
                  }`}>
                    {chartData.dataPoints[chartData.dataPoints.length - 1].cumulativePnl >= 0 ? '+' : ''}
                    ${chartData.dataPoints[chartData.dataPoints.length - 1].cumulativePnl.toFixed(2)}
                  </p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                  <p className="text-slate-400 text-xs mb-1">Trend</p>
                  <p className={`text-2xl font-bold ${
                    chartData.projectedSlope > 0 ? 'text-emerald-400' : 
                    chartData.projectedSlope < 0 ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {chartData.projectedSlope > 0 ? '📈 Growing' : 
                     chartData.projectedSlope < 0 ? '📉 Declining' : '➡️ Flat'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {chartData.projectedSlope >= 0 ? '+' : ''}${chartData.projectedSlope.toFixed(2)}/trade
                  </p>
                </div>
              </div>

              {/* Projections and Risk Analysis */}
              {(() => {
                const currentPnl = chartData.dataPoints[chartData.dataPoints.length - 1].cumulativePnl
                const currentTradeNum = chartData.dataPoints.length
                
                // Calculate bankruptcy risk based on budget volatility
                const pnlValues = chartData.dataPoints.map(p => p.cumulativePnl)
                const minPnl = Math.min(...pnlValues)
                const maxPnl = Math.max(...pnlValues)
                const pnlRange = maxPnl - minPnl
                const volatility = pnlRange / Math.max(currentTradeNum, 1)
                
                // Get initial budget from the run (approximate from first few trades)
                const run = copyTrades.find(ct => ct.id === chartData.runId || ct.name === chartData.runName.split(' (')[0])
                const budget = run ? run.initialBudget : 100
                const fixedBet = run ? run.fixedBetAmount : 10
                
                // Bankruptcy risk calculation
                // Higher risk if: 1) negative trend, 2) high volatility, 3) current budget is low
                const currentBudget = budget + currentPnl
                const budgetRatio = currentBudget / budget
                const safetyMargin = currentBudget / fixedBet // How many losing trades can we afford?
                
                let bankruptcyRisk = 0
                if (chartData.projectedSlope < 0) {
                  // Negative trend increases risk
                  const tradesUntilBankrupt = Math.abs(currentBudget / chartData.projectedSlope)
                  if (tradesUntilBankrupt < 100) {
                    bankruptcyRisk = Math.min(90, 100 - tradesUntilBankrupt)
                  } else {
                    bankruptcyRisk = 10
                  }
                } else if (chartData.projectedSlope > 0) {
                  // Positive trend but consider volatility
                  if (safetyMargin < 5) {
                    bankruptcyRisk = 40 // Low safety margin
                  } else if (safetyMargin < 10) {
                    bankruptcyRisk = 20
                  } else if (safetyMargin < 20) {
                    bankruptcyRisk = 10
                  } else {
                    bankruptcyRisk = 5 // Very safe
                  }
                } else {
                  // Flat trend - depends on budget
                  bankruptcyRisk = safetyMargin < 10 ? 30 : 15
                }
                
                // Adjust risk based on volatility
                if (volatility > fixedBet * 2) {
                  bankruptcyRisk = Math.min(95, bankruptcyRisk + 15)
                }
                
                // Calculate projections
                const targetPnls = [100, 250, 500, 1000]
                const projections = targetPnls.map(target => {
                  if (chartData.projectedSlope <= 0) return null
                  const tradesNeeded = Math.ceil((target - currentPnl) / chartData.projectedSlope)
                  return { target, tradesNeeded: tradesNeeded > 0 ? tradesNeeded : null }
                }).filter(p => p && p.tradesNeeded !== null && p.tradesNeeded > 0)
                
                return (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Projections */}
                    <div className="bg-gradient-to-br from-indigo-900/20 to-blue-900/20 border border-indigo-500/30 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                        🎯 Projected Milestones
                      </h3>
                      {chartData.projectedSlope > 0 ? (
                        projections.length > 0 ? (
                          <div className="space-y-2">
                            {projections.slice(0, 3).map((proj, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Hit ${proj!.target}:</span>
                                <span className="text-emerald-400 font-semibold">
                                  ~{proj!.tradesNeeded} trades
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Already surpassed major milestones! 🎉</p>
                        )
                      ) : chartData.projectedSlope < 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-red-400">⚠️ Negative trend detected</p>
                          {currentBudget > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-400">Bankruptcy risk:</span>
                              <span className="text-orange-400 font-semibold">
                                ~{Math.ceil(Math.abs(currentBudget / chartData.projectedSlope))} trades
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">Flat trend - no clear projections</p>
                      )}
                    </div>
                    
                    {/* Bankruptcy Risk */}
                    <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-500/30 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-orange-300 mb-3 flex items-center gap-2">
                        ⚠️ Bankruptcy Risk
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-slate-400">Risk Level</span>
                            <span className={`text-lg font-bold ${
                              bankruptcyRisk < 20 ? 'text-emerald-400' :
                              bankruptcyRisk < 50 ? 'text-yellow-400' :
                              bankruptcyRisk < 75 ? 'text-orange-400' : 'text-red-400'
                            }`}>
                              {bankruptcyRisk.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-700/50 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                bankruptcyRisk < 20 ? 'bg-emerald-500' :
                                bankruptcyRisk < 50 ? 'bg-yellow-500' :
                                bankruptcyRisk < 75 ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${bankruptcyRisk}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Current Budget:</span>
                            <span className={`font-semibold ${currentBudget > budget * 0.8 ? 'text-emerald-400' : 'text-orange-400'}`}>
                              ${currentBudget.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Safety Margin:</span>
                            <span className={`font-semibold ${safetyMargin >= 10 ? 'text-emerald-400' : 'text-orange-400'}`}>
                              {safetyMargin.toFixed(1)} bets
                            </span>
                          </div>
                          <p className="text-slate-500 mt-2">
                            {bankruptcyRisk < 20 ? '✅ Low risk - well capitalized' :
                             bankruptcyRisk < 50 ? '⚠️ Moderate risk - monitor closely' :
                             bankruptcyRisk < 75 ? '🚨 High risk - consider stopping' :
                             '💀 Critical - bankruptcy imminent'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* SVG Chart */}
              <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700/50">
                <svg viewBox="0 0 800 400" className="w-full h-auto">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map(i => (
                    <line
                      key={`grid-${i}`}
                      x1="50"
                      y1={50 + i * 80}
                      x2="750"
                      y2={50 + i * 80}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="5,5"
                    />
                  ))}
                  
                  {/* Axes */}
                  <line x1="50" y1="350" x2="750" y2="350" stroke="#64748b" strokeWidth="2" />
                  <line x1="50" y1="50" x2="50" y2="350" stroke="#64748b" strokeWidth="2" />
                  
                  {/* Calculate scales */}
                  {(() => {
                    // Get all P&L values from all runs for proper scaling
                    const allPnlValues = chartData.individualRuns 
                      ? chartData.individualRuns.flatMap(run => run.dataPoints.map(p => p.cumulativePnl))
                      : chartData.dataPoints.map(p => p.cumulativePnl)
                    
                    const maxPnl = Math.max(...allPnlValues, 0)
                    const minPnl = Math.min(...allPnlValues, 0)
                    const pnlRange = maxPnl - minPnl || 100
                    const padding = pnlRange * 0.1
                    
                    const scaleY = (pnl: number) => {
                      return 350 - ((pnl - (minPnl - padding)) / (pnlRange + 2 * padding)) * 300
                    }
                    
                    // Find max trade count across all runs for X scaling
                    const maxTrades = chartData.individualRuns
                      ? Math.max(...chartData.individualRuns.map(run => run.dataPoints.length))
                      : chartData.dataPoints.length
                    
                    const scaleX = (tradeNum: number) => {
                      return 50 + ((tradeNum - 1) / (maxTrades - 1 || 1)) * 700
                    }
                    
                    // Projected trend line based on all combined data
                    const firstPoint = chartData.dataPoints[0]
                    const projectedEnd = firstPoint.cumulativePnl + chartData.projectedSlope * chartData.dataPoints.length
                    
                    return (
                      <>
                        {/* Zero line */}
                        <line
                          x1="50"
                          y1={scaleY(0)}
                          x2="750"
                          y2={scaleY(0)}
                          stroke="#64748b"
                          strokeWidth="2"
                          strokeDasharray="10,5"
                        />
                        
                        {/* Individual run lines */}
                        {chartData.individualRuns && chartData.individualRuns.map((run, idx) => {
                          const pathData = run.dataPoints
                            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.tradeNumber)} ${scaleY(p.cumulativePnl)}`)
                            .join(' ')
                          
                          return (
                            <g key={run.runId}>
                              {/* Run line */}
                              <path
                                d={pathData}
                                fill="none"
                                stroke={run.color}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.7"
                              />
                              
                              {/* Data points for this run */}
                              {run.dataPoints.map((point, i) => (
                                <circle
                                  key={`${run.runId}-${i}`}
                                  cx={scaleX(point.tradeNumber)}
                                  cy={scaleY(point.cumulativePnl)}
                                  r="3"
                                  fill={run.color}
                                  stroke="#1e293b"
                                  strokeWidth="1.5"
                                  opacity="0.8"
                                />
                              ))}
                            </g>
                          )
                        })}
                        
                        {/* Projected trend line (dashed yellow) based on ALL data */}
                        <line
                          x1={scaleX(1)}
                          y1={scaleY(firstPoint.cumulativePnl)}
                          x2={scaleX(chartData.dataPoints.length)}
                          y2={scaleY(projectedEnd)}
                          stroke="#fbbf24"
                          strokeWidth="3"
                          strokeDasharray="8,4"
                          opacity="0.8"
                        />
                        
                        {/* Y-axis labels */}
                        <text x="35" y={scaleY(maxPnl)} fill="#94a3b8" fontSize="12" textAnchor="end">
                          ${maxPnl.toFixed(0)}
                        </text>
                        <text x="35" y={scaleY(0)} fill="#94a3b8" fontSize="12" textAnchor="end">
                          $0
                        </text>
                        <text x="35" y={scaleY(minPnl)} fill="#94a3b8" fontSize="12" textAnchor="end">
                          ${minPnl.toFixed(0)}
                        </text>
                        
                        {/* X-axis label */}
                        <text x="400" y="390" fill="#94a3b8" fontSize="14" textAnchor="middle">
                          Trade Number
                        </text>
                        
                        {/* Y-axis label */}
                        <text x="20" y="200" fill="#94a3b8" fontSize="14" textAnchor="middle" transform="rotate(-90, 20, 200)">
                          Cumulative P&L ($)
                        </text>
                      </>
                    )
                  })()}
                </svg>
              </div>

              {/* Legend */}
              {chartData.individualRuns && chartData.individualRuns.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-slate-400 mb-2 font-medium">Individual Runs:</p>
                  <div className="flex flex-wrap gap-3">
                    {chartData.individualRuns.map(run => (
                      <div key={run.runId} className="flex items-center gap-2">
                        <div 
                          className="w-6 h-0.5 rounded"
                          style={{ backgroundColor: run.color }}
                        ></div>
                        <span className="text-xs text-slate-400">{run.runName}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 ml-4">
                      <div className="w-6 h-0.5 bg-yellow-500 border-t-2 border-dashed"></div>
                      <span className="text-xs text-slate-400">Projected Trend</span>
                    </div>
                  </div>
                </div>
              )}

              {!chartData.individualRuns && (
                <div className="flex items-center gap-6 mt-4 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-blue-500"></div>
                    <span className="text-sm text-slate-400">Actual P&L</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-yellow-500 opacity-60" style={{ borderTop: '2px dashed' }}></div>
                    <span className="text-sm text-slate-400">Projected Trend</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowChartModal(false)}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Price Analysis Modal */}
        {showPriceAnalysisModal && priceAnalysisData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-indigo-500/50 rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-indigo-400">
                  📊 Price Range Analysis: {priceAnalysisData.configName}
                </h2>
                <button
                  onClick={() => setShowPriceAnalysisModal(false)}
                  className="px-3 py-1 text-slate-400 hover:text-slate-200 transition-all"
                >
                  ✕
                </button>
              </div>

              <p className="text-slate-400 text-sm mb-6">
                Win rates across different buy price ranges for all runs in this configuration
              </p>

              {/* Price Range Table */}
              <div className="space-y-3">
                {priceAnalysisData.ranges.map((range, idx) => {
                  const hasData = range.totalTrades > 0
                  const winRateColor = 
                    range.winRate >= 60 ? 'text-emerald-400' :
                    range.winRate >= 50 ? 'text-yellow-400' :
                    range.winRate >= 40 ? 'text-orange-400' : 'text-red-400'
                  
                  return (
                    <div
                      key={idx}
                      className={`bg-slate-800/30 border rounded-lg p-4 transition-all ${
                        hasData 
                          ? 'border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/50' 
                          : 'border-slate-800/30 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-slate-200 min-w-[140px]">
                              {range.rangeLabel}
                            </span>
                            <span className={`text-sm ${hasData ? 'text-slate-400' : 'text-slate-600'}`}>
                              {hasData ? `${range.totalTrades} trade${range.totalTrades !== 1 ? 's' : ''}` : 'No trades'}
                            </span>
                          </div>
                          {hasData && (
                            <div className="mt-2 flex items-center gap-4">
                              <div className="flex-1 bg-slate-700/30 rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    range.winRate >= 60 ? 'bg-emerald-500' :
                                    range.winRate >= 50 ? 'bg-yellow-500' :
                                    range.winRate >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${range.winRate}%` }}
                                />
                              </div>
                              <span className={`text-sm font-semibold min-w-[60px] ${winRateColor}`}>
                                {range.winRate.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        {hasData && (
                          <div className="text-right ml-4">
                            <p className="text-xs text-slate-500">Won / Total</p>
                            <p className="text-lg font-bold text-slate-300">
                              {range.wonTrades} / {range.totalTrades}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Summary Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4">
                  <p className="text-indigo-400 text-xs mb-1">Total Analyzed</p>
                  <p className="text-2xl font-bold text-indigo-300">
                    {priceAnalysisData.ranges.reduce((sum, r) => sum + r.totalTrades, 0)} trades
                  </p>
                </div>
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
                  <p className="text-emerald-400 text-xs mb-1">Best Range</p>
                  <p className="text-lg font-bold text-emerald-300">
                    {(() => {
                      const best = priceAnalysisData.ranges
                        .filter(r => r.totalTrades >= 3)
                        .sort((a, b) => b.winRate - a.winRate)[0]
                      return best ? best.rangeLabel : 'N/A'
                    })()}
                  </p>
                  <p className="text-xs text-emerald-500 mt-1">
                    {(() => {
                      const best = priceAnalysisData.ranges
                        .filter(r => r.totalTrades >= 3)
                        .sort((a, b) => b.winRate - a.winRate)[0]
                      return best ? `${best.winRate.toFixed(1)}% win rate` : ''
                    })()}
                  </p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-xs mb-1">Worst Range</p>
                  <p className="text-lg font-bold text-red-300">
                    {(() => {
                      const worst = priceAnalysisData.ranges
                        .filter(r => r.totalTrades >= 3)
                        .sort((a, b) => a.winRate - b.winRate)[0]
                      return worst ? worst.rangeLabel : 'N/A'
                    })()}
                  </p>
                  <p className="text-xs text-red-500 mt-1">
                    {(() => {
                      const worst = priceAnalysisData.ranges
                        .filter(r => r.totalTrades >= 3)
                        .sort((a, b) => a.winRate - b.winRate)[0]
                      return worst ? `${worst.winRate.toFixed(1)}% win rate` : ''
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowPriceAnalysisModal(false)}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
