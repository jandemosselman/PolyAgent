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
      // Fetch activity in batches
      setFetchStatus('Fetching trade activity...')
      const allActivity = []
      const batchSize = 5000
      const batches = Math.ceil(numTrades / batchSize)

      for (let i = 0; i < batches; i++) {
        const offset = i * batchSize
        const limit = Math.min(batchSize, numTrades - offset)
        
        setFetchStatus(`Fetching trades... ${offset + limit} / ${numTrades}`)
        setFetchProgress(((offset + limit) / numTrades) * 50) // 0-50% for activity

        const response = await fetch(
          `https://clob.polymarket.com/events?trader=${traderAddress}&offset=${offset}&limit=${limit}`
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch activity: ${response.status}`)
        }

        const data = await response.json()
        if (data.data && Array.isArray(data.data)) {
          allActivity.push(...data.data)
        }

        if (data.data.length < limit) {
          break // No more data available
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      console.log(`✅ Fetched ${allActivity.length} trades`)

      // Fetch closed positions for resolution checking
      setFetchStatus('Fetching closed positions for resolution...')
      const closedPositions = []
      const closedBatches = Math.ceil(numTrades / batchSize)

      for (let i = 0; i < closedBatches; i++) {
        const offset = i * batchSize
        const limit = Math.min(batchSize, numTrades - offset)
        
        setFetchStatus(`Checking resolutions... ${offset + limit} / ${numTrades}`)
        setFetchProgress(50 + ((offset + limit) / numTrades) * 50) // 50-100%

        const response = await fetch(
          `https://clob.polymarket.com/positions?account=${traderAddress}&limit=${limit}&offset=${offset}`
        )

        if (!response.ok) {
          console.warn(`Failed to fetch closed positions batch ${i}: ${response.status}`)
          continue
        }

        const data = await response.json()
        if (data.data && Array.isArray(data.data)) {
          closedPositions.push(...data.data)
        }

        if (data.data.length < limit) {
          break
        }

        await new Promise(resolve => setTimeout(resolve, 200))
      }

      console.log(`✅ Fetched ${closedPositions.length} closed positions`)

      // Match trades with resolutions
      setFetchStatus('Processing trades and resolutions...')
      const trades: HistoricalTrade[] = allActivity.map((activity: any) => {
        // Find matching closed position
        const closedPos = closedPositions.find((pos: any) => 
          pos.asset_id === activity.asset_id
        )

        let status: 'open' | 'won' | 'lost' = 'open'
        let pnl = 0

        if (closedPos && closedPos.pnl !== undefined) {
          pnl = parseFloat(closedPos.pnl) || 0
          status = pnl > 0 ? 'won' : pnl < 0 ? 'lost' : 'open'
        }

        return {
          id: activity.id || `${activity.asset_id}_${activity.timestamp}`,
          timestamp: new Date(activity.timestamp).getTime(),
          market: activity.market || activity.question || 'Unknown Market',
          outcome: activity.outcome || activity.title || 'Unknown',
          price: parseFloat(activity.price) || 0,
          amount: parseFloat(activity.size || activity.amount) || 0,
          asset: activity.asset_id || activity.token_id || '',
          conditionId: activity.condition_id || '',
          slug: activity.slug || '',
          transactionHash: activity.transaction_hash || activity.hash || '',
          icon: activity.icon || '',
          status,
          pnl
        }
      })

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
            <label className="block text-sm text-slate-400 mb-2">Number of Trades (max 50,000)</label>
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
