'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface LeaderboardEntry {
  rank: string
  proxyWallet: string
  userName: string
  vol: number
  pnl: number
  profileImage: string
  xUsername: string
  verifiedBadge: boolean
}

export default function Home() {
  const router = useRouter()
  const [traders, setTraders] = useState<LeaderboardEntry[]>([])
  const [filteredTraders, setFilteredTraders] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('OVERALL')
  const [timePeriod, setTimePeriod] = useState('DAY')
  const [orderBy, setOrderBy] = useState('PNL')
  const [minTrades, setMinTrades] = useState<number>(0)
  const [minVolume, setMinVolume] = useState<number>(0)
  const [minPnl, setMinPnl] = useState<number | null>(null)
  const [loadingTradeData, setLoadingTradeData] = useState(false)

  useEffect(() => {
    fetchLeaderboard()
  }, [category, timePeriod, orderBy])

  // Apply filters whenever traders or filter values change
  useEffect(() => {
    applyFilters()
  }, [traders, minTrades, minVolume, minPnl])

  const applyFilters = () => {
    let filtered = [...traders]

    // Filter by minimum volume
    if (minVolume > 0) {
      filtered = filtered.filter(trader => trader.vol >= minVolume)
    }

    // Filter by minimum PNL
    if (minPnl !== null && minPnl !== 0) {
      filtered = filtered.filter(trader => trader.pnl >= minPnl)
    }

    setFilteredTraders(filtered)

    // If minTrades filter is set, fetch trade counts for remaining traders
    if (minTrades > 0 && filtered.length > 0) {
      fetchTradeCountsAndFilter(filtered)
    }
  }

  const fetchTradeCountsAndFilter = async (tradersToCheck: LeaderboardEntry[]) => {
    setLoadingTradeData(true)
    try {
      // Fetch trade counts for all traders
      const tradeCountPromises = tradersToCheck.map(async (trader) => {
        try {
          const response = await fetch(`/api/traded?user=${trader.proxyWallet}`)
          if (response.ok) {
            const data = await response.json()
            return { ...trader, traded: data.traded || 0 }
          }
          return { ...trader, traded: 0 }
        } catch {
          return { ...trader, traded: 0 }
        }
      })

      const tradersWithCounts = await Promise.all(tradeCountPromises)
      
      // Filter by minimum trades
      const finalFiltered = tradersWithCounts.filter(trader => trader.traded >= minTrades)
      setFilteredTraders(finalFiltered)
    } catch (err) {
      console.error('Failed to fetch trade counts:', err)
    } finally {
      setLoadingTradeData(false)
    }
  }

  const fetchLeaderboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        category,
        timePeriod,
        orderBy,
        limit: '50'
      })
      
      const response = await fetch(`/api/leaderboard?${params}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      setTraders(data)
    } catch (err) {
      setError('Failed to load leaderboard. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                PolyAgent
              </h1>
              <p className="text-slate-400 mt-1 text-sm">Your Polymarket Trading Cheatcode</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/copy-simulator')}
                className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg text-cyan-400 font-medium transition-colors"
              >
                📊 Copy Simulator
              </button>
              <button
                onClick={() => router.push('/simulator')}
                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg text-emerald-400 font-medium transition-colors"
              >
                🎮 Simulator
              </button>
              <button
                onClick={() => router.push('/advanced-simulator')}
                className="px-4 py-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 hover:border-pink-500/40 rounded-lg text-pink-400 font-medium transition-colors"
              >
                🚀 Advanced Simulator
              </button>
              <button
                onClick={() => router.push('/research')}
                className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-purple-400 font-medium transition-colors"
              >
                🔬 Research Lab
              </button>
              <button
                onClick={() => router.push('/markets')}
                className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg text-indigo-400 font-medium transition-colors"
              >
                🔍 Browse Markets
              </button>
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-emerald-400 text-sm font-medium">🎯 Copy Trading Mode</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Filter Top Traders</h2>
          
          {/* Primary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="OVERALL">Overall</option>
                <option value="POLITICS">Politics</option>
                <option value="SPORTS">Sports</option>
                <option value="CRYPTO">Crypto</option>
                <option value="CULTURE">Culture</option>
                <option value="TECH">Tech</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>

            {/* Time Period */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Time Period</label>
              <select 
                value={timePeriod} 
                onChange={(e) => setTimePeriod(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="DAY">Today</option>
                <option value="WEEK">This Week</option>
                <option value="MONTH">This Month</option>
                <option value="ALL">All Time</option>
              </select>
            </div>

            {/* Order By */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Sort By</label>
              <select 
                value={orderBy} 
                onChange={(e) => setOrderBy(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="PNL">Profit & Loss</option>
                <option value="VOL">Volume</option>
              </select>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="border-t border-slate-800/50 pt-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              🎯 Quality Filters <span className="text-slate-500 font-normal">(Separate skilled traders from lucky ones)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Min Trades */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Min Total Markets Traded
                  <span className="text-slate-500 text-xs ml-2">(All-time experience)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={minTrades}
                  onChange={(e) => setMinTrades(Number(e.target.value))}
                  placeholder="e.g., 50"
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Higher = more experienced trader</p>
              </div>

              {/* Min Volume */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Min Volume ({timePeriod === 'DAY' ? 'Today' : timePeriod === 'WEEK' ? 'This Week' : timePeriod === 'MONTH' ? 'This Month' : 'All Time'})
                </label>
                <input
                  type="number"
                  min="0"
                  value={minVolume}
                  onChange={(e) => setMinVolume(Number(e.target.value))}
                  placeholder="e.g., 1000"
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Recent trading activity</p>
              </div>

              {/* Min PNL */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Min PNL ({timePeriod === 'DAY' ? 'Today' : timePeriod === 'WEEK' ? 'This Week' : timePeriod === 'MONTH' ? 'This Month' : 'All Time'})
                </label>
                <input
                  type="number"
                  value={minPnl || ''}
                  onChange={(e) => setMinPnl(e.target.value ? Number(e.target.value) : null)}
                  placeholder="e.g., 100"
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Recent profitability</p>
              </div>
            </div>

            {/* Active Filters Display */}
            {(minTrades > 0 || minVolume > 0 || (minPnl !== null && minPnl !== 0)) && (
              <div className="mt-4 flex items-center flex-wrap gap-2">
                <span className="text-slate-400 text-sm">Active filters:</span>
                {minTrades > 0 && (
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-sm">
                    Min {minTrades} markets traded
                  </span>
                )}
                {minVolume > 0 && (
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-sm">
                    Min ${minVolume.toLocaleString()} volume
                  </span>
                )}
                {minPnl !== null && minPnl !== 0 && (
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-sm">
                    Min ${minPnl.toLocaleString()} PNL
                  </span>
                )}
                <button
                  onClick={() => {
                    setMinTrades(0)
                    setMinVolume(0)
                    setMinPnl(null)
                  }}
                  className="px-3 py-1 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={fetchLeaderboard}
              className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Loading overlay for trade data filtering */}
            {loadingTradeData && (
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-4 flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                <p className="text-indigo-400 text-sm">Fetching trade counts for quality filtering...</p>
              </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 border border-indigo-500/20 rounded-xl p-6">
                <p className="text-indigo-400 text-sm font-medium">
                  {minTrades > 0 || minVolume > 0 || (minPnl !== null && minPnl !== 0) ? 'Filtered Traders' : 'Top Traders'}
                </p>
                <p className="text-3xl font-bold text-white mt-2">
                  {filteredTraders.length}
                  {(minTrades > 0 || minVolume > 0 || (minPnl !== null && minPnl !== 0)) && (
                    <span className="text-slate-400 text-lg ml-2">/ {traders.length}</span>
                  )}
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-6">
                <p className="text-emerald-400 text-sm font-medium">Avg PNL</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {formatNumber(filteredTraders.reduce((acc, t) => acc + t.pnl, 0) / filteredTraders.length || 0)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6">
                <p className="text-purple-400 text-sm font-medium">Total Volume</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {formatNumber(filteredTraders.reduce((acc, t) => acc + t.vol, 0))}
                </p>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50 border-b border-slate-700/50">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Rank</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Trader</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-slate-300">PNL</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-slate-300">Volume</th>
                      <th className="text-center px-6 py-4 text-sm font-semibold text-slate-300">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredTraders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <p className="text-slate-400 text-lg">
                            {minTrades > 0 || minVolume > 0 || (minPnl !== null && minPnl !== 0)
                              ? 'No traders match your filters. Try adjusting the criteria.'
                              : 'No traders found.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredTraders.map((trader) => (
                      <tr key={trader.proxyWallet} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {parseInt(trader.rank) <= 3 ? (
                              <span className="text-2xl">
                                {parseInt(trader.rank) === 1 && '🥇'}
                                {parseInt(trader.rank) === 2 && '🥈'}
                                {parseInt(trader.rank) === 3 && '🥉'}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">#{trader.rank}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <img 
                              src={trader.profileImage || '/default-avatar.png'} 
                              alt={trader.userName}
                              className="w-10 h-10 rounded-full bg-slate-700"
                              onError={(e) => {
                                e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${trader.userName}`
                              }}
                            />
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-slate-200 font-medium">{trader.userName || 'Anonymous'}</span>
                                {trader.verifiedBadge && (
                                  <span className="text-blue-400">✓</span>
                                )}
                              </div>
                              {trader.xUsername && (
                                <a 
                                  href={`https://twitter.com/${trader.xUsername}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                                >
                                  @{trader.xUsername}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-semibold ${trader.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trader.pnl >= 0 ? '+' : ''}{formatNumber(trader.pnl)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-slate-300 font-medium">{formatNumber(trader.vol)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-2">
                            <button className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg text-indigo-400 text-sm font-medium transition-colors">
                              Copy Trade
                            </button>
                            <a 
                              href={`/profile/${trader.proxyWallet}`}
                              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 rounded-lg text-slate-300 text-sm font-medium transition-colors inline-block"
                            >
                              View Profile
                            </a>
                          </div>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-500 text-sm">
            PolyAgent - Built for traders, by traders 🚀
          </p>
        </div>
      </footer>
    </div>
  )
}
