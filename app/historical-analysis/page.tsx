'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface HistoricalTrade {
  id: string
  timestamp: number
  market: string
  outcome: string
  price: number
  amount: number
  asset: string
  conditionId: string
  slug?: string
  transactionHash: string
  icon?: string
  status: 'open' | 'won' | 'lost'
  pnl?: number
}

interface HistoricalDataset {
  id: string
  traderAddress: string
  fetchedAt: number
  totalTrades: number
  trades: HistoricalTrade[]
  closedTrades: number
  openTrades: number
  wonTrades: number
  lostTrades: number
  winRate: number
  totalPnL: number
}

export default function HistoricalAnalysisPage() {
  const [traderAddress, setTraderAddress] = useState('')
  const [numTrades, setNumTrades] = useState(10000)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState(0)
  const [fetchStatus, setFetchStatus] = useState('')
  const [datasets, setDatasets] = useState<HistoricalDataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<HistoricalDataset | null>(null)
  const [displayedTrades, setDisplayedTrades] = useState(100)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)

  // Load datasets from IndexedDB on mount
  useEffect(() => {
    loadDatasets()
  }, [])

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // IndexedDB operations
  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PolyAgentHistorical', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('datasets')) {
          db.createObjectStore('datasets', { keyPath: 'id' })
        }
      }
    })
  }

  const loadDatasets = async () => {
    try {
      const db = await openDB()
      const transaction = db.transaction(['datasets'], 'readonly')
      const store = transaction.objectStore('datasets')
      const request = store.getAll()
      
      request.onsuccess = () => {
        setDatasets(request.result || [])
      }
    } catch (error) {
      console.error('Error loading datasets:', error)
    }
  }

  const saveDataset = async (dataset: HistoricalDataset) => {
    try {
      const db = await openDB()
      const transaction = db.transaction(['datasets'], 'readwrite')
      const store = transaction.objectStore('datasets')
      store.put(dataset)
      
      transaction.oncomplete = () => {
        loadDatasets()
      }
    } catch (error) {
      console.error('Error saving dataset:', error)
      throw error
    }
  }

  const deleteDataset = async (id: string) => {
    try {
      const db = await openDB()
      const transaction = db.transaction(['datasets'], 'readwrite')
      const store = transaction.objectStore('datasets')
      store.delete(id)
      
      transaction.oncomplete = () => {
        loadDatasets()
        if (selectedDataset?.id === id) {
          setSelectedDataset(null)
        }
        setNotification({ message: '✅ Dataset deleted', type: 'success' })
      }
    } catch (error) {
      console.error('Error deleting dataset:', error)
      setNotification({ message: '❌ Error deleting dataset', type: 'error' })
    }
  }

  const startFetching = async () => {
    if (!traderAddress.trim()) {
      setNotification({ message: '❌ Please enter a trader address', type: 'error' })
      return
    }

    if (numTrades < 100 || numTrades > 50000) {
      setNotification({ message: '❌ Number of trades must be between 100 and 50,000', type: 'error' })
      return
    }

    setIsFetching(true)
    setFetchProgress(0)
    setFetchStatus('Starting fetch...')

    try {
      // Fetch from Polymarket REST API using TIMESTAMP-BASED PAGINATION
      // This allows us to fetch way more than 3,000 trades by using the oldest timestamp as anchor
      setFetchStatus('Fetching trades from Polymarket API...')
      const allActivity = []
      const batchSize = 3000 // Fetch 3k at a time
      let oldestTimestamp: number | null = null
      let consecutiveEmptyBatches = 0

      while (allActivity.length < numTrades) {
        const limit = Math.min(batchSize, numTrades - allActivity.length)
        
        setFetchStatus(`Fetching trades... ${allActivity.length} / ${numTrades}`)
        setFetchProgress((allActivity.length / numTrades) * 50) // 0-50% for activity

        // Build URL with timestamp anchor if we have one
        let url = `/api/activity?user=${traderAddress}&limit=${limit}`
        if (oldestTimestamp) {
          // Fetch trades BEFORE the oldest timestamp we've seen
          url += `&end=${oldestTimestamp - 1}` // -1 to exclude the last trade we already have
          console.log(`📅 Using timestamp anchor: fetching trades before ${new Date(oldestTimestamp).toISOString()}`)
        }

        const response = await fetch(url)

        if (!response.ok) {
          // If we've already got some trades, continue with what we have
          if (allActivity.length > 0) {
            console.warn(`⚠️ API error, stopping with ${allActivity.length} trades`)
            setNotification({ 
              message: `⚠️ API error. Fetched ${allActivity.length} trades`, 
              type: 'warning' 
            })
            break
          }
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }

        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          allActivity.push(...data)
          consecutiveEmptyBatches = 0
          
          // Update oldest timestamp for next batch
          const timestamps = data.map((d: any) => d.timestamp).filter((t: number) => t)
          if (timestamps.length > 0) {
            oldestTimestamp = Math.min(...timestamps)
            console.log(`📊 Batch complete: ${data.length} trades. Oldest: ${new Date(oldestTimestamp).toISOString()}`)
          }
        } else {
          consecutiveEmptyBatches++
          console.log(`⚠️ Empty batch received (${consecutiveEmptyBatches}/2)`)
          // If we get 2 empty batches in a row, we've reached the end
          if (consecutiveEmptyBatches >= 2) {
            console.log(`📊 Reached end of available data at ${allActivity.length} trades`)
            break
          }
        }

        // If we got fewer results than requested, we've likely reached the end
        if (data.length < batchSize) {
          console.log(`📊 Received ${data.length} trades (less than ${batchSize}), likely at end`)
          break
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      if (allActivity.length === 0) {
        throw new Error('No activity found for this trader')
      }

      console.log(`✅ Fetched ${allActivity.length} trades using timestamp-based pagination`)

      // Fetch closed positions for resolution checking
      // Note: Fetch ALL closed positions available (not limited by numTrades)
      setFetchStatus('Fetching closed positions for resolution...')
      const closedPositions: any[] = []
      const maxClosedPositions = 10000 // Fetch up to 10k closed positions
      let closedBatchSize = 1000 // Larger batches for closed positions
      let closedOffset = 0
      let hasMoreClosedPositions = true

      while (hasMoreClosedPositions && closedPositions.length < maxClosedPositions) {
        const limit = Math.min(closedBatchSize, maxClosedPositions - closedPositions.length)
        
        setFetchStatus(`Fetching closed positions... ${closedPositions.length}`)
        setFetchProgress(50 + (closedPositions.length / Math.min(allActivity.length, maxClosedPositions)) * 50)

        const response = await fetch(
          `/api/closed-positions?user=${traderAddress}&limit=${limit}&offset=${closedOffset}`
        )

        if (!response.ok) {
          console.warn(`⚠️ Failed to fetch closed positions at offset ${closedOffset}: ${response.status}`)
          break
        }

        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          closedPositions.push(...data)
          closedOffset += data.length
          
          // If we got fewer than requested, we've reached the end
          if (data.length < limit) {
            hasMoreClosedPositions = false
            console.log(`📊 Reached end of closed positions at ${closedPositions.length}`)
          }
        } else {
          hasMoreClosedPositions = false
        }

        await new Promise(resolve => setTimeout(resolve, 200))
      }

      console.log(`✅ Fetched ${closedPositions.length} closed positions`)
      
      // AUTO-FETCH MORE TRADES if we have closed positions but haven't fetched enough trades yet
      // This handles ultra-fast traders who have hundreds of open trades but closed positions just 10-20 min ago
      if (closedPositions.length > 0 && allActivity.length < 5000) {
        const oldestClosedTimestamp = Math.min(...closedPositions.map(p => p.timestamp))
        const oldestActivityTimestamp = Math.min(...allActivity.map(a => a.timestamp))
        
        console.log(`📅 Oldest activity fetched: ${new Date(oldestActivityTimestamp * 1000).toISOString()}`)
        console.log(`📅 Oldest closed position: ${new Date(oldestClosedTimestamp * 1000).toISOString()}`)
        
        // If our oldest activity is still NEWER than the oldest closed position,
        // we need to fetch MORE trades to reach the resolved ones
        if (oldestActivityTimestamp > oldestClosedTimestamp) {
          const timeDiffMinutes = Math.floor((oldestActivityTimestamp - oldestClosedTimestamp) / 60)
          console.warn(`⚠️ Gap detected: Oldest trade fetched is ${timeDiffMinutes} minutes newer than oldest closed position`)
          console.log(`🔄 Auto-fetching more trades to reach resolved positions...`)
          
          setFetchStatus('Fetching older trades to find resolved positions...')
          
          // Fetch additional batches until we reach the closed positions timeframe
          let additionalBatches = 0
          const maxAdditionalBatches = 5 // Fetch up to 5 more batches (15k more trades)
          
          while (additionalBatches < maxAdditionalBatches && oldestTimestamp && oldestTimestamp > oldestClosedTimestamp) {
            const limit = 3000
            const url = `/api/activity?user=${traderAddress}&limit=${limit}&end=${oldestTimestamp - 1}`
            
            console.log(`📥 Additional batch ${additionalBatches + 1}: fetching 3000 trades before ${new Date(oldestTimestamp * 1000).toISOString()}`)
            
            const response = await fetch(url)
            if (!response.ok) break
            
            const data = await response.json()
            if (Array.isArray(data) && data.length > 0) {
              allActivity.push(...data)
              additionalBatches++
              
              // Update oldest timestamp
              const timestamps = data.map((d: any) => d.timestamp).filter((t: number) => t)
              if (timestamps.length > 0) {
                oldestTimestamp = Math.min(...timestamps)
                console.log(`📊 Total trades now: ${allActivity.length}. Oldest: ${new Date(oldestTimestamp * 1000).toISOString()}`)
              }
              
              // If we've reached the closed positions timeframe, stop
              if (oldestTimestamp <= oldestClosedTimestamp) {
                console.log(`✅ Reached closed positions timeframe! Should have matches now.`)
                break
              }
            } else {
              break
            }
            
            await new Promise(resolve => setTimeout(resolve, 300))
          }
          
          console.log(`✅ Finished auto-fetch: ${allActivity.length} total trades`)
        }
      }

      console.log(`✅ Fetched ${closedPositions.length} closed positions`)

      // Match trades with resolutions
      setFetchStatus('Processing trades and resolutions...')
      
      // Deduplicate by transaction hash
      const uniqueActivity = Array.from(
        new Map(allActivity.map(a => [
          a.transactionHash || a.id || `${a.asset}_${a.timestamp}`,
          a
        ])).values()
      )
      
      console.log(`📊 Unique trades after deduplication: ${uniqueActivity.length} (from ${allActivity.length})`)
      console.log(`📊 Total closed positions available: ${closedPositions.length}`)
      
      // Create a map of conditionId -> closed position for faster lookup
      const closedPosMap = new Map<string, any>()
      closedPositions.forEach(pos => {
        if (pos.conditionId) {
          closedPosMap.set(pos.conditionId, pos)
        }
        // Also index by asset as fallback
        if (pos.asset) {
          closedPosMap.set(pos.asset, pos)
        }
      })
      
      console.log(`📊 Closed positions indexed by ${closedPosMap.size} keys`)
      
      let matchedCount = 0
      let unmatchedCount = 0
      
      const trades: HistoricalTrade[] = uniqueActivity.map((activity: any, index: number) => {
        // Try to find matching closed position
        let closedPos = null
        
        // Strategy 1: Match by conditionId (most reliable)
        if (activity.conditionId) {
          closedPos = closedPosMap.get(activity.conditionId)
        }
        
        // Strategy 2: Match by asset
        if (!closedPos && activity.asset) {
          closedPos = closedPosMap.get(activity.asset)
        }

        let status: 'open' | 'won' | 'lost' = 'open'
        let pnl = 0

        if (closedPos) {
          matchedCount++
          // Check for realizedPnl or pnl field
          pnl = parseFloat(closedPos.realizedPnl || closedPos.pnl) || 0
          
          // Determine status based on PnL
          if (pnl > 0) {
            status = 'won'
          } else if (pnl < 0) {
            status = 'lost'
          }
          
          if (matchedCount <= 5) { // Only log first 5 matches to avoid spam
            console.log(`✅ Match #${matchedCount}: ${activity.title} → ${status} (PnL: $${pnl.toFixed(2)})`)
          }
        } else {
          unmatchedCount++
          if (unmatchedCount <= 3) { // Only log first 3 unmatched to avoid spam
            console.log(`⚠️ Unmatched #${unmatchedCount}: ${activity.title} (conditionId: ${activity.conditionId?.slice(0, 10)}...)`)
          }
        }

        // Generate unique ID with fallback to index
        const txHash = activity.transactionHash || activity.id
        const uniqueId = txHash ? `${txHash}_${index}` : `trade_${index}_${Date.now()}`

        return {
          id: uniqueId,
          timestamp: activity.timestamp * 1000,
          market: activity.title || activity.name || 'Unknown Market',
          outcome: activity.outcome || 'Unknown',
          price: parseFloat(activity.price) || 0,
          amount: parseFloat(activity.usdcSize || activity.size) || 0,
          asset: activity.asset || '',
          conditionId: activity.conditionId || '',
          slug: activity.slug || '',
          transactionHash: activity.transactionHash || activity.id || '',
          icon: activity.icon || '',
          status,
          pnl
        }
      })

      // Log matching summary
      console.log(`\n📊 RESOLUTION MATCHING SUMMARY:`)
      console.log(`   Total trades: ${trades.length}`)
      console.log(`   Matched to closed positions: ${matchedCount} (${(matchedCount/trades.length*100).toFixed(1)}%)`)
      console.log(`   Still open/unmatched: ${unmatchedCount} (${(unmatchedCount/trades.length*100).toFixed(1)}%)`)
      console.log(`   Closed positions available: ${closedPositions.length}\n`)

      // Calculate stats
      const closedTrades = trades.filter(t => t.status !== 'open')
      const openTrades = trades.filter(t => t.status === 'open')
      const wonTrades = trades.filter(t => t.status === 'won')
      const lostTrades = trades.filter(t => t.status === 'lost')
      const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      const winRate = closedTrades.length > 0 ? (wonTrades.length / closedTrades.length) * 100 : 0

      const dataset: HistoricalDataset = {
        id: Date.now().toString(),
        traderAddress,
        fetchedAt: Date.now(),
        totalTrades: trades.length,
        trades,
        closedTrades: closedTrades.length,
        openTrades: openTrades.length,
        wonTrades: wonTrades.length,
        lostTrades: lostTrades.length,
        winRate,
        totalPnL
      }

      await saveDataset(dataset)
      setSelectedDataset(dataset)
      setDisplayedTrades(100)
      
      setNotification({ 
        message: `✅ Successfully fetched ${trades.length} trades!`, 
        type: 'success' 
      })

    } catch (error: any) {
      console.error('Error fetching trades:', error)
      setNotification({ 
        message: `❌ Error: ${error.message}`, 
        type: 'error' 
      })
    } finally {
      setIsFetching(false)
      setFetchProgress(0)
      setFetchStatus('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/copy-simulator" className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all">
          ← Back to Copy Simulator
        </Link>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          📊 Historical Trade Analysis
        </h1>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-500/20 border border-green-500/50' :
          notification.type === 'error' ? 'bg-red-500/20 border border-red-500/50' :
          'bg-yellow-500/20 border border-yellow-500/50'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Fetch Form */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">🔍 Fetch Historical Trades</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Trader Address</label>
            <input
              type="text"
              value={traderAddress}
              onChange={(e) => setTraderAddress(e.target.value)}
              placeholder="0x1234..."
              disabled={isFetching}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Number of Trades (up to 50,000 with timestamp pagination)
            </label>
            <input
              type="number"
              value={numTrades}
              onChange={(e) => setNumTrades(parseInt(e.target.value) || 0)}
              min="100"
              max="50000"
              step="1000"
              disabled={isFetching}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              💡 Uses timestamp-based pagination to fetch beyond the 3k offset limit
            </p>
          </div>
        </div>

        <button
          onClick={startFetching}
          disabled={isFetching}
          className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFetching ? '🔄 Fetching...' : '🚀 Start Fetching'}
        </button>

        {/* Progress Bar */}
        {isFetching && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>{fetchStatus}</span>
              <span>{fetchProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-300"
                style={{ width: `${fetchProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Saved Datasets */}
      {datasets.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">💾 Saved Datasets ({datasets.length})</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map(dataset => (
              <div 
                key={dataset.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedDataset?.id === dataset.id 
                    ? 'bg-cyan-500/20 border-cyan-500' 
                    : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
                }`}
                onClick={() => {
                  setSelectedDataset(dataset)
                  setDisplayedTrades(100)
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm text-slate-400">
                    {new Date(dataset.fetchedAt).toLocaleDateString()}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this dataset?')) {
                        deleteDataset(dataset.id)
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    🗑️
                  </button>
                </div>
                
                <div className="text-xs text-slate-500 mb-2 font-mono break-all">
                  {dataset.traderAddress.substring(0, 10)}...
                </div>
                
                <div className="text-2xl font-bold mb-2">
                  {dataset.totalTrades.toLocaleString()} trades
                </div>
                
                <div className="text-sm space-y-1">
                  <div>Win Rate: <span className="font-semibold text-cyan-400">{dataset.winRate.toFixed(1)}%</span></div>
                  <div>P&L: <span className={`font-semibold ${dataset.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${dataset.totalPnL.toFixed(2)}
                  </span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Dataset Details */}
      {selectedDataset && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">📈 Dataset Analysis</h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg transition-all">
                🎯 Find Best Strategy
              </button>
              <button className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-lg transition-all">
                💾 Export Data
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">Total Trades</div>
              <div className="text-2xl font-bold">{selectedDataset.totalTrades.toLocaleString()}</div>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-cyan-400">{selectedDataset.winRate.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">Total P&L</div>
              <div className={`text-2xl font-bold ${selectedDataset.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${selectedDataset.totalPnL.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">Closed / Open</div>
              <div className="text-2xl font-bold">{selectedDataset.closedTrades} / {selectedDataset.openTrades}</div>
            </div>
          </div>

          {/* Trade List */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-3">
              Trade History (showing {Math.min(displayedTrades, selectedDataset.trades.length)} of {selectedDataset.trades.length})
            </h3>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {selectedDataset.trades.slice(0, displayedTrades).map((trade, index) => (
                <div key={trade.id} className="bg-slate-700/30 p-3 rounded-lg flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1">{trade.market}</div>
                    <div className="text-xs text-slate-400">
                      {trade.outcome} • ${trade.amount.toFixed(2)} @ {(trade.price * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(trade.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded text-xs font-semibold ${
                      trade.status === 'won' ? 'bg-green-500/20 text-green-400' :
                      trade.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {trade.status.toUpperCase()}
                    </div>
                    {trade.status !== 'open' && (
                      <div className={`text-sm font-semibold mt-1 ${trade.pnl! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.pnl! >= 0 ? '+' : ''}${trade.pnl!.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {displayedTrades < selectedDataset.trades.length && (
              <button
                onClick={() => setDisplayedTrades(prev => prev + 100)}
                className="w-full mt-4 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg transition-all"
              >
                📥 Load More ({Math.min(100, selectedDataset.trades.length - displayedTrades)} more)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {datasets.length === 0 && !isFetching && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-xl mb-2">No historical data yet</div>
          <div className="text-sm">Enter a trader address above to fetch historical trades</div>
        </div>
      )}
    </div>
  )
}
