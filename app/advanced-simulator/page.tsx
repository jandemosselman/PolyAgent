'use client'

import { useState, Fragment } from 'react'
import Link from 'next/link'

interface Trader {
  address: string
  realized_pnl: number
  volume: number
  rank: number
  userName?: string
  xUsername?: string
}

interface SimulationConfig {
  portfolioSize: number
  fixedTradeSize: number
  minTradeSize: number
  tradeLimit: number
  leaderboardPeriod: 'DAY' | 'WEEK' | 'MONTH'
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

export default function AdvancedSimulator() {
  const [traders, setTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' })
  const [results, setResults] = useState<SimulationResult[]>([])
  const [sortBy, setSortBy] = useState<keyof SimulationResult>('roi')
  const [sortDesc, setSortDesc] = useState(true)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const [config, setConfig] = useState<SimulationConfig>({
    portfolioSize: 10,
    fixedTradeSize: 1,
    minTradeSize: 0,
    tradeLimit: 5000,
    leaderboardPeriod: 'MONTH'
  })

  const fetchTopTraders = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/top-traders?limit=50&period=${config.leaderboardPeriod}`)
      const data = await response.json()
      
      if (data.traders) {
        setTraders(data.traders)
      } else {
        alert('Failed to fetch traders')
      }
    } catch (error) {
      console.error('Error fetching traders:', error)
      alert('Error fetching top traders')
    } finally {
      setLoading(false)
    }
  }

  const runAdvancedSimulation = async () => {
    if (traders.length === 0) {
      alert('Please fetch top traders first')
      return
    }

    setSimulating(true)
    setResults([])
    
    const totalSimulations = traders.length
    
    setProgress({ current: 0, total: totalSimulations, stage: 'Starting...' })

    const allResults: SimulationResult[] = []
    let completed = 0

    // Process traders in batches to avoid overwhelming the API
    const batchSize = 5
    
    for (let i = 0; i < traders.length; i += batchSize) {
      const traderBatch = traders.slice(i, i + batchSize)
      
      // Process batch in parallel
      const batchPromises = traderBatch.map(async (trader) => {
        setProgress(prev => ({ 
          ...prev, 
          stage: `Analyzing trader ${i + traderBatch.indexOf(trader) + 1}/${traders.length}` 
        }))

        try {
          const response = await fetch('/api/simulate-advanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              traderAddress: trader.address,
              traderRank: trader.rank,
              portfolioSize: config.portfolioSize,
              fixedTradeSize: config.fixedTradeSize,
              minTradeSize: config.minTradeSize,
              tradeLimit: config.tradeLimit
            })
          })

          const data = await response.json()
          
          if (data.result) {
            completed++
            setProgress(prev => ({ ...prev, current: completed }))
            allResults.push(data.result)
          }
        } catch (error) {
          console.error(`Error simulating trader ${trader.address}:`, error)
        }
      })

      await Promise.all(batchPromises)
    }

    setResults(allResults)
    setSimulating(false)
    setProgress({ current: 0, total: 0, stage: 'Complete!' })
  }

  const sortedResults = [...results].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDesc ? bVal - aVal : aVal - bVal
    }
    
    return 0
  })

  const getBestConfigForPortfolio = (portfolioSize: number) => {
    const filtered = results.filter(r => 
      r.portfolioSize === portfolioSize && 
      !r.wentBroke &&
      r.totalTrades >= 10
    )
    
    if (filtered.length === 0) return null
    
    return filtered.sort((a, b) => b.roi - a.roi)[0]
  }

  const getBestOverall = () => {
    const filtered = results.filter(r => !r.wentBroke && r.totalTrades >= 10)
    if (filtered.length === 0) return null
    return filtered.sort((a, b) => b.roi - a.roi)[0]
  }

  const getTraderInfo = (address: string) => {
    return traders.find(t => t.address === address)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/"
            className="text-purple-400 hover:text-purple-300 mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">
            🚀 Advanced Strategy Simulator
          </h1>
          <p className="text-purple-300">
            Multi-dimensional analysis: Find the perfect trader, portfolio size, and price range combination
          </p>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-purple-500/20">
          <h2 className="text-xl font-bold text-white mb-4">Simulation Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="text-purple-300 text-sm mb-2 block">
                Leaderboard Period
              </label>
              <select
                value={config.leaderboardPeriod}
                onChange={(e) => setConfig({
                  ...config,
                  leaderboardPeriod: e.target.value as 'DAY' | 'WEEK' | 'MONTH'
                })}
                className="w-full px-4 py-2 bg-white/5 border border-purple-500/30 rounded-lg text-white"
              >
                <option value="DAY">Daily</option>
                <option value="WEEK">Weekly</option>
                <option value="MONTH">Monthly</option>
              </select>
            </div>

            <div>
              <label className="text-purple-300 text-sm mb-2 block">
                Portfolio Size ($) - Your total capital
              </label>
              <input
                type="number"
                value={config.portfolioSize}
                onChange={(e) => setConfig({
                  ...config,
                  portfolioSize: parseFloat(e.target.value) || 10
                })}
                className="w-full px-4 py-2 bg-white/5 border border-purple-500/30 rounded-lg text-white"
                placeholder="10"
              />
            </div>

            <div>
              <label className="text-purple-300 text-sm mb-2 block">
                Fixed Trade Size ($) - Amount per copied trade
              </label>
              <input
                type="number"
                value={config.fixedTradeSize}
                onChange={(e) => setConfig({
                  ...config,
                  fixedTradeSize: parseFloat(e.target.value) || 1
                })}
                className="w-full px-4 py-2 bg-white/5 border border-purple-500/30 rounded-lg text-white"
                placeholder="1"
              />
            </div>

            <div>
              <label className="text-purple-300 text-sm mb-2 block">
                Min Trade Size Filter ($) - Only copy trades above this size
              </label>
              <input
                type="number"
                value={config.minTradeSize}
                onChange={(e) => setConfig({
                  ...config,
                  minTradeSize: parseFloat(e.target.value) || 0
                })}
                className="w-full px-4 py-2 bg-white/5 border border-purple-500/30 rounded-lg text-white"
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-purple-300 text-sm mb-2 block">Trade History Limit</label>
              <input
                type="number"
                value={config.tradeLimit}
                onChange={(e) => setConfig({ ...config, tradeLimit: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-white/5 border border-purple-500/30 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={fetchTopTraders}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Loading...' : `Fetch Top 50 Traders (${config.leaderboardPeriod})`}
            </button>

            {traders.length > 0 && (
              <button
                onClick={runAdvancedSimulation}
                disabled={simulating}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
              >
                {simulating ? 'Simulating...' : `Run Simulations (${traders.length} traders)`}
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        {simulating && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-purple-500/20">
            <div className="flex justify-between text-white mb-2">
              <span>{progress.stage}</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Traders Loaded */}
        {traders.length > 0 && !simulating && results.length === 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-green-500/20">
            <p className="text-white">
              ✅ Loaded {traders.length} top traders by net profit ({config.leaderboardPeriod.toLowerCase()})
            </p>
            <div className="mt-3 p-3 bg-white/5 rounded-lg">
              <p className="text-white font-semibold mb-1">Your Settings:</p>
              <p className="text-gray-300 text-sm">Portfolio: ${config.portfolioSize} | Trade Size: ${config.fixedTradeSize} | Min Filter: ${config.minTradeSize}</p>
            </div>
          </div>
        )}

        {/* Best Strategies Summary */}
        {results.length > 0 && (
          <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-md rounded-xl p-6 mb-6 border border-green-500/30">
            <h3 className="text-xl font-bold text-white mb-4">🎯 Best Traders Found</h3>
            {(() => {
              const best = getBestOverall()
              if (!best) return <p className="text-gray-300">No profitable traders found with 10+ trades</p>
              
              return (
                <div className="bg-white/10 rounded-lg p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-purple-300 text-sm mb-1">Trader Rank</div>
                      <div className="text-white font-bold text-xl">#{best.traderRank}</div>
                    </div>
                    <div>
                      <div className="text-purple-300 text-sm mb-1">ROI</div>
                      <div className="text-green-400 font-bold text-xl">{(best.roi || 0).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-purple-300 text-sm mb-1">Win Rate</div>
                      <div className="text-white font-bold text-xl">{(best.winRate || 0).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-purple-300 text-sm mb-1">Final Balance</div>
                      <div className="text-white font-bold text-xl">${(best.finalBalance || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-gray-300 text-sm">
                      <span className="text-purple-400 font-semibold">Best Strategy:</span> Copy trader #{best.traderRank}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">
                      Total Trades: {best.totalTrades} | Wins: {best.profitableTrades} | Losses: {best.totalTrades - best.profitableTrades} | Max Win Streak: {best.longestWinStreak} | Max Loss Streak: {best.longestLossStreak}
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-purple-500/20">
            <div className="p-6 border-b border-purple-500/20">
              <h3 className="text-xl font-bold text-white">
                📊 All Simulation Results ({results.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    {[
                      { key: 'traderRank', label: 'Rank' },
                      { key: 'portfolioSize', label: 'Portfolio' },
                      { key: 'fixedTradeSize', label: 'Trade Size' },
                      { key: 'minTradeSize', label: 'Min Filter' },
                      { key: 'winRate', label: 'Win Rate %' },
                      { key: 'roi', label: 'ROI %' },
                      { key: 'totalProfit', label: 'Profit' },
                      { key: 'totalTrades', label: 'Trades' },
                      { key: 'longestWinStreak', label: 'Max Win Streak' },
                      { key: 'longestLossStreak', label: 'Max Loss Streak' },
                      { key: 'finalBalance', label: 'Final Balance' },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => {
                          if (sortBy === key) {
                            setSortDesc(!sortDesc)
                          } else {
                            setSortBy(key as keyof SimulationResult)
                            setSortDesc(true)
                          }
                        }}
                        className="px-4 py-3 text-left text-purple-300 font-semibold cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        {label} {sortBy === key && (sortDesc ? '↓' : '↑')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-white">
                  {sortedResults.slice(0, 100).map((result, idx) => {
                    const traderInfo = getTraderInfo(result.traderAddress)
                    const isExpanded = expandedRow === idx
                    
                    return (
                      <Fragment key={`${result.traderAddress}-${idx}`}>
                        <tr 
                          onClick={() => setExpandedRow(isExpanded ? null : idx)}
                          className="border-t border-purple-500/10 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{isExpanded ? '▼' : '▶'}</span>
                              <span>#{result.traderRank}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">${result.portfolioSize}</td>
                          <td className="px-4 py-3">${result.fixedTradeSize}</td>
                          <td className="px-4 py-3">${result.minTradeSize}</td>
                          <td className="px-4 py-3 font-semibold">{(result.winRate || 0).toFixed(1)}%</td>
                          <td className={`px-4 py-3 font-bold ${result.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(result.roi || 0).toFixed(1)}%
                          </td>
                          <td className={`px-4 py-3 ${result.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${(result.totalProfit || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">{result.totalTrades}</td>
                          <td className="px-4 py-3 text-green-400">{result.longestWinStreak}</td>
                          <td className={`px-4 py-3 ${result.longestLossStreak <= 3 ? 'text-green-400' : result.longestLossStreak <= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {result.longestLossStreak}
                          </td>
                          <td className="px-4 py-3">
                            ${(result.finalBalance || 0).toFixed(2)}
                            {result.wentBroke && <span className="text-red-400 ml-2">💀</span>}
                          </td>
                        </tr>
                        
                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr className="bg-purple-500/10">
                            <td colSpan={11} className="px-4 py-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column - Trader Info */}
                                <div className="space-y-4">
                                  <div className="bg-white/5 rounded-lg p-4">
                                    <h4 className="text-lg font-bold text-purple-300 mb-3">👤 Trader Information</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Rank:</span>
                                        <span className="text-white font-semibold">#{result.traderRank}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Address:</span>
                                        <span className="text-white font-mono text-xs">{result.traderAddress.slice(0, 6)}...{result.traderAddress.slice(-4)}</span>
                                      </div>
                                      {traderInfo && (
                                        <>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Name:</span>
                                            <span className="text-white">{traderInfo.userName || 'Unknown'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Total Volume:</span>
                                            <span className="text-white">${traderInfo.volume.toFixed(2)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-400">Total PnL:</span>
                                            <span className={traderInfo.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                              ${traderInfo.realized_pnl.toFixed(2)}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    
                                    <a
                                      href={`/simulator?address=${result.traderAddress}`}
                                      target="_blank"
                                      className="mt-4 block w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-center text-sm font-semibold transition-colors"
                                    >
                                      🎮 Open in Simulator
                                    </a>
                                  </div>
                                </div>

                                {/* Right Column - Strategy Performance */}
                                <div className="space-y-4">
                                  <div className="bg-white/5 rounded-lg p-4">
                                    <h4 className="text-lg font-bold text-purple-300 mb-3">📊 Strategy Performance</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Min Trade Filter:</span>
                                        <span className="text-white">${result.minTradeSize}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Total Trades Copied:</span>
                                        <span className="text-white font-semibold">{result.totalTrades}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Profitable Trades:</span>
                                        <span className="text-green-400">{result.profitableTrades}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Losing Trades:</span>
                                        <span className="text-red-400">{result.totalTrades - result.profitableTrades}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Win Rate:</span>
                                        <span className="text-white font-semibold">{(result.winRate || 0).toFixed(1)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Max Win Streak:</span>
                                        <span className="text-green-400 font-semibold">
                                          {result.longestWinStreak} trades 🔥
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Max Loss Streak:</span>
                                        <span className={result.longestLossStreak <= 3 ? 'text-green-400' : result.longestLossStreak <= 5 ? 'text-yellow-400' : 'text-red-400'}>
                                          {result.longestLossStreak} trades
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Max Drawdown:</span>
                                        <span className="text-red-400">${(result.maxDrawdown || 0).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-white/5 rounded-lg p-4">
                                    <h4 className="text-lg font-bold text-purple-300 mb-3">💰 Financial Summary</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Starting Balance:</span>
                                        <span className="text-white">${(result.portfolioSize || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Trade Size:</span>
                                        <span className="text-white">${(result.fixedTradeSize || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Total Profit/Loss:</span>
                                        <span className={result.totalProfit >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                          ${(result.totalProfit || 0).toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">ROI:</span>
                                        <span className={`font-bold text-lg ${result.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                          {(result.roi || 0).toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                                        <span className="text-gray-400 font-semibold">Final Balance:</span>
                                        <span className="text-white font-bold text-lg">
                                          ${(result.finalBalance || 0).toFixed(2)}
                                          {result.wentBroke && <span className="text-red-400 ml-2">💀 BROKE</span>}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Strategy Summary Banner */}
                              <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                                <p className="text-white text-center">
                                  <span className="font-semibold">Strategy:</span> Copy ALL of Trader #{result.traderRank}'s trades with <span className="text-yellow-400">${result.fixedTradeSize}</span> per trade
                                  {result.minTradeSize > 0 && <>, filtering trades ≥ <span className="text-yellow-400">${result.minTradeSize}</span></>}
                                  {result.totalTrades > 0 && <> → Would have made <span className={result.totalProfit >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>${result.totalProfit.toFixed(2)}</span> ({result.roi.toFixed(1)}% ROI)</>}
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
