'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PriceRangeStats {
  range: string
  minPrice: number
  maxPrice: number
  winRate: number
  avgROI: number
  totalTrades: number
  wins: number
  losses: number
}

interface StreakAnalysis {
  longestWinStreak: number
  longestLossStreak: number
  currentStreak: number
  currentStreakType: 'win' | 'loss' | 'none'
  avgWinStreak: number
  avgLossStreak: number
  streakStability: number
}

interface TraderAnalysis {
  address: string
  username?: string
  profileImage?: string
  winRate: number
  avgROI: number
  totalPnl: number
  avgBuyPrice: number
  tradesPerDay: number
  biggestWin: number
  totalMarkets: number
  consistencyScore: number
  streakAnalysis: StreakAnalysis
  closedPositionsAnalyzed: number
  activitiesAnalyzed: number
  lastTradeTimestamp: number | null
  daysSinceLastTrade: number | null
  isActive: boolean
  priceRangeStats?: PriceRangeStats[]
}

export default function ResearchPage() {
  const router = useRouter()
  const [source, setSource] = useState<'leaderboard' | 'custom'>('leaderboard')
  const [category, setCategory] = useState('OVERALL')
  const [timePeriod, setTimePeriod] = useState('WEEK')
  const [customAddresses, setCustomAddresses] = useState('')
  const [closedLimit, setClosedLimit] = useState(500)
  const [activityLimit, setActivityLimit] = useState(200)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<TraderAnalysis[]>([])
  const [sortBy, setSortBy] = useState<keyof TraderAnalysis>('consistencyScore')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedTrader, setSelectedTrader] = useState<TraderAnalysis | null>(null)

  const fetchLeaderboardAddresses = async () => {
    const response = await fetch(`/api/leaderboard?category=${category}&timePeriod=${timePeriod}&limit=25`)
    if (!response.ok) throw new Error('Failed to fetch leaderboard')
    const traders = await response.json()
    return traders.map((t: any) => t.proxyWallet)
  }

  const startAnalysis = async () => {
    setAnalyzing(true)
    setResults([])
    setProgress({ current: 0, total: 0 })

    try {
      let addresses: string[] = []

      if (source === 'leaderboard') {
        addresses = await fetchLeaderboardAddresses()
      } else {
        addresses = customAddresses
          .split('\n')
          .map(addr => addr.trim())
          .filter(addr => addr.length > 0)
      }

      if (addresses.length === 0) {
        alert('No addresses to analyze')
        return
      }

      setProgress({ current: 0, total: addresses.length })

      const response = await fetch('/api/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses,
          closedLimit,
          activityLimit
        })
      })

      if (!response.ok) throw new Error('Batch analysis failed')

      const data = await response.json()
      setResults(data.results)
      setProgress({ current: data.analyzed, total: addresses.length })
    } catch (error) {
      console.error('Analysis error:', error)
      alert('Failed to analyze traders. Check console for details.')
    } finally {
      setAnalyzing(false)
    }
  }

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) return '$0.00'
    if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const handleSort = (column: keyof TraderAnalysis) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  const sortedResults = [...results].sort((a, b) => {
    const aVal = a[sortBy] ?? 0
    const bVal = b[sortBy] ?? 0
    return sortDirection === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1)
  })

  const exportToCSV = () => {
    if (results.length === 0) return

    const headers = [
      'Rank',
      'Username',
      'Address',
      'Consistency Score',
      'Win Rate %',
      'Avg ROI %',
      'Total PNL',
      'Avg Buy Price',
      'Trades/Day',
      'Biggest Win',
      'Total Markets',
      'Active',
      'Days Since Last Trade',
      'Closed Positions Analyzed',
      'Activities Analyzed'
    ]

    const rows = sortedResults.map((trader, index) => [
      index + 1,
      trader.username || 'Anonymous',
      trader.address,
      trader.consistencyScore.toFixed(2),
      trader.winRate.toFixed(2),
      trader.avgROI.toFixed(2),
      trader.totalPnl.toFixed(2),
      trader.avgBuyPrice.toFixed(4),
      trader.tradesPerDay.toFixed(2),
      trader.biggestWin.toFixed(2),
      trader.totalMarkets,
      trader.isActive ? 'Yes' : 'No',
      trader.daysSinceLastTrade ?? 'N/A',
      trader.closedPositionsAnalyzed,
      trader.activitiesAnalyzed
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `polyagent_research_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                🔬 Trader Research Lab
              </h1>
              <p className="text-slate-400 mt-1 text-sm">Deep analysis to find the best traders to copy</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 rounded-lg text-slate-300 transition-colors"
            >
              ← Back to Leaderboard
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Panel */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Analysis Configuration</h2>

          {/* Source Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-3">Data Source</label>
            <div className="flex space-x-4">
              <button
                onClick={() => setSource('leaderboard')}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  source === 'leaderboard'
                    ? 'bg-indigo-500/20 text-indigo-400 border-2 border-indigo-500/50'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800/70'
                }`}
              >
                📊 Top 25 from Leaderboard
              </button>
              <button
                onClick={() => setSource('custom')}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  source === 'custom'
                    ? 'bg-indigo-500/20 text-indigo-400 border-2 border-indigo-500/50'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800/70'
                }`}
              >
                ✏️ Custom Addresses
              </button>
            </div>
          </div>

          {/* Leaderboard Options */}
          {source === 'leaderboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="OVERALL">Overall</option>
                  <option value="POLITICS">Politics</option>
                  <option value="SPORTS">Sports</option>
                  <option value="CRYPTO">Crypto</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Time Period</label>
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="DAY">Today</option>
                  <option value="WEEK">This Week</option>
                  <option value="MONTH">This Month</option>
                  <option value="ALL">All Time</option>
                </select>
              </div>
            </div>
          )}

          {/* Custom Addresses */}
          {source === 'custom' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Wallet Addresses (one per line)
              </label>
              <textarea
                value={customAddresses}
                onChange={(e) => setCustomAddresses(e.target.value)}
                placeholder="0x1234...&#10;0x5678...&#10;0x9abc..."
                rows={6}
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
            </div>
          )}

          {/* Analysis Depth */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Closed Positions to Analyze
              </label>
              <select
                value={closedLimit}
                onChange={(e) => setClosedLimit(Number(e.target.value))}
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={100}>100 (Fast)</option>
                <option value={200}>200 (Balanced)</option>
                <option value={500}>500 (Recommended)</option>
                <option value={1000}>1000 (Deep)</option>
                <option value={5000}>5000 (Ultra Deep 🔥)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Activity Items to Analyze
              </label>
              <select
                value={activityLimit}
                onChange={(e) => setActivityLimit(Number(e.target.value))}
                className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={100}>100 (Fast)</option>
                <option value={200}>200 (Recommended)</option>
                <option value={500}>500 (Deep)</option>
                <option value={1000}>1000 (Very Deep)</option>
                <option value={5000}>5000 (Ultra Deep 🔥)</option>
              </select>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={startAnalysis}
            disabled={analyzing || (source === 'custom' && customAddresses.trim() === '')}
            className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {analyzing ? '🔍 Analyzing...' : '🚀 Start Deep Analysis'}
          </button>
        </div>

        {/* Progress */}
        {analyzing && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-indigo-400 font-medium">
                Analyzing traders...
              </span>
              <span className="text-indigo-400 font-mono">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <>
            {/* Streak Filter Banner */}
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-5 mb-6">
              <h3 className="text-lg font-semibold text-indigo-400 mb-3">🎯 Find Stable Traders (Low Loss Streaks)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-slate-400 text-sm mb-2">Max Loss Streak Filter</p>
                  <div className="flex gap-2">
                    {[
                      { label: 'Any', max: 999 },
                      { label: '≤5', max: 5 },
                      { label: '≤3', max: 3 },
                      { label: '≤2', max: 2 }
                    ].map((filter) => {
                      const count = results.filter(t => t.streakAnalysis.longestLossStreak <= filter.max).length
                      return (
                        <button
                          key={filter.label}
                          className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg text-slate-300 text-sm transition-colors"
                          onClick={() => {
                            const filtered = results.filter(t => t.streakAnalysis.longestLossStreak <= filter.max)
                            alert(`${count} traders with max ${filter.max} loss streak`)
                          }}
                        >
                          {filter.label} <span className="text-indigo-400">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-2">Min Win Streak Filter</p>
                  <div className="flex gap-2">
                    {[
                      { label: 'Any', min: 0 },
                      { label: '≥5', min: 5 },
                      { label: '≥10', min: 10 },
                      { label: '≥15', min: 15 }
                    ].map((filter) => {
                      const count = results.filter(t => t.streakAnalysis.longestWinStreak >= filter.min).length
                      return (
                        <button
                          key={filter.label}
                          className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg text-slate-300 text-sm transition-colors"
                          onClick={() => {
                            const filtered = results.filter(t => t.streakAnalysis.longestWinStreak >= filter.min)
                            alert(`${count} traders with min ${filter.min} win streak`)
                          }}
                        >
                          {filter.label} <span className="text-emerald-400">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-end">
                  <div className="w-full">
                    <p className="text-slate-400 text-sm mb-2">💡 Recommendation</p>
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <p className="text-emerald-400 text-sm font-medium">
                        {results.filter(t => 
                          t.streakAnalysis.longestLossStreak <= 3 && 
                          t.streakAnalysis.longestWinStreak >= 5
                        ).length} stable traders found
                      </p>
                      <p className="text-slate-500 text-xs mt-1">≤3 loss streak & ≥5 win streak</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-200">
                  Analysis Results ({results.length} traders)
                </h2>
                <p className="text-slate-400 text-sm mt-1">Click any column header to sort • Click trader for price range analysis</p>
              </div>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-emerald-400 font-medium transition-colors"
              >
                📥 Export to CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-300">Trader</th>
                    <th
                      onClick={() => handleSort('consistencyScore')}
                      className="text-center px-4 py-4 text-sm font-semibold text-slate-300 cursor-pointer hover:text-indigo-400"
                    >
                      Score {sortBy === 'consistencyScore' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="text-center px-4 py-4 text-sm font-semibold text-indigo-400">
                      Max Loss Streak
                    </th>
                    <th className="text-center px-4 py-4 text-sm font-semibold text-emerald-400">
                      Max Win Streak
                    </th>
                    <th className="text-center px-4 py-4 text-sm font-semibold text-slate-300">
                      Current Streak
                    </th>
                    <th
                      onClick={() => handleSort('winRate')}
                      className="text-right px-4 py-4 text-sm font-semibold text-slate-300 cursor-pointer hover:text-indigo-400"
                    >
                      Win Rate {sortBy === 'winRate' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th
                      onClick={() => handleSort('avgROI')}
                      className="text-right px-4 py-4 text-sm font-semibold text-slate-300 cursor-pointer hover:text-indigo-400"
                    >
                      Avg ROI {sortBy === 'avgROI' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th
                      onClick={() => handleSort('totalPnl')}
                      className="text-right px-4 py-4 text-sm font-semibold text-slate-300 cursor-pointer hover:text-indigo-400"
                    >
                      Total PNL {sortBy === 'totalPnl' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th
                      onClick={() => handleSort('tradesPerDay')}
                      className="text-right px-4 py-4 text-sm font-semibold text-slate-300 cursor-pointer hover:text-indigo-400"
                    >
                      Trades/Day {sortBy === 'tradesPerDay' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th
                      onClick={() => handleSort('totalMarkets')}
                      className="text-right px-4 py-4 text-sm font-semibold text-slate-300 cursor-pointer hover:text-indigo-400"
                    >
                      Markets {sortBy === 'totalMarkets' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="text-center px-4 py-4 text-sm font-semibold text-slate-300">Status</th>
                    <th className="text-center px-6 py-4 text-sm font-semibold text-slate-300">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sortedResults.map((trader) => (
                    <tr key={trader.address} className="hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => setSelectedTrader(trader)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {trader.profileImage && (
                            <img
                              src={trader.profileImage}
                              alt={trader.username || 'Trader'}
                              className="w-10 h-10 rounded-full"
                              onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                          )}
                          <div>
                            <p className="text-slate-200 font-medium">
                              {trader.username || 'Anonymous'}
                            </p>
                            <p className="text-slate-500 text-xs font-mono">
                              {trader.address.slice(0, 6)}...{trader.address.slice(-4)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                          trader.consistencyScore >= 70
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : trader.consistencyScore >= 50
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trader.consistencyScore.toFixed(0)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-sm font-mono font-bold ${
                          trader.streakAnalysis.longestLossStreak > 10 
                            ? 'bg-red-500/20 text-red-400'
                            : trader.streakAnalysis.longestLossStreak > 5
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {trader.streakAnalysis.longestLossStreak}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-sm font-mono font-bold">
                          {trader.streakAnalysis.longestWinStreak}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {trader.streakAnalysis.currentStreak > 0 ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            trader.streakAnalysis.currentStreakType === 'win'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trader.streakAnalysis.currentStreakType === 'win' ? '🔥' : '❄️'} {trader.streakAnalysis.currentStreak}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-200">
                        {trader.winRate.toFixed(1)}%
                      </td>
                      <td className={`px-4 py-4 text-right font-medium ${
                        trader.avgROI >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {trader.avgROI >= 0 ? '+' : ''}{trader.avgROI.toFixed(1)}%
                      </td>
                      <td className={`px-4 py-4 text-right font-medium ${
                        trader.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {formatNumber(trader.totalPnl)}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-200">
                        {trader.tradesPerDay.toFixed(1)}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-200">
                        {trader.totalMarkets}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {trader.isActive ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            🟢 Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400">
                            ⚪ Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex space-x-2 justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTrader(trader)
                            }}
                            className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-sm font-medium transition-colors"
                          >
                            📊 Price Analysis
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/profile/${trader.address}`)
                            }}
                            className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg text-indigo-400 text-sm font-medium transition-colors"
                          >
                            View Profile
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

        {/* Price Range Analysis Modal */}
        {selectedTrader && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedTrader(null)}>
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
                <div className="flex items-center space-x-3">
                  {selectedTrader.profileImage && (
                    <img
                      src={selectedTrader.profileImage}
                      alt={selectedTrader.username || 'Trader'}
                      className="w-12 h-12 rounded-full"
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  )}
                  <div>
                    <h3 className="text-2xl font-bold text-slate-200">
                      {selectedTrader.username || 'Anonymous Trader'}
                    </h3>
                    <p className="text-slate-400 text-sm font-mono">
                      {selectedTrader.address.slice(0, 8)}...{selectedTrader.address.slice(-6)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTrader(null)}
                  className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 rounded-lg text-slate-300 transition-colors"
                >
                  ✕ Close
                </button>
              </div>

              {/* Overall Stats */}
              <div className="p-6 border-b border-slate-800">
                <h4 className="text-lg font-semibold text-slate-300 mb-4">Overall Performance</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800/30 rounded-lg p-4">
                    <p className="text-slate-400 text-xs mb-1">Consistency Score</p>
                    <p className={`text-2xl font-bold ${
                      selectedTrader.consistencyScore >= 70 ? 'text-emerald-400' :
                      selectedTrader.consistencyScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {selectedTrader.consistencyScore.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-4">
                    <p className="text-slate-400 text-xs mb-1">Overall Win Rate</p>
                    <p className="text-2xl font-bold text-slate-200">
                      {selectedTrader.winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-4">
                    <p className="text-slate-400 text-xs mb-1">Overall Avg ROI</p>
                    <p className={`text-2xl font-bold ${selectedTrader.avgROI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {selectedTrader.avgROI >= 0 ? '+' : ''}{selectedTrader.avgROI.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-4">
                    <p className="text-slate-400 text-xs mb-1">Total Positions</p>
                    <p className="text-2xl font-bold text-slate-200">
                      {selectedTrader.closedPositionsAnalyzed}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Range Breakdown */}
              <div className="p-6">
                <h4 className="text-lg font-semibold text-slate-300 mb-4">
                  📊 Performance by Price Range
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    (Find the sweet spot for copy trading!)
                  </span>
                </h4>
                
                <div className="space-y-3">
                  {selectedTrader.priceRangeStats?.map((stat) => (
                    <div
                      key={stat.range}
                      className={`bg-slate-800/30 rounded-lg p-4 border-2 transition-all ${
                        stat.totalTrades > 0 && stat.winRate >= 60 && stat.avgROI >= 10
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : stat.totalTrades > 0 && stat.winRate >= 50
                          ? 'border-yellow-500/30 bg-yellow-500/5'
                          : 'border-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-bold text-slate-200">{stat.range}</span>
                          {stat.totalTrades > 0 && stat.winRate >= 60 && stat.avgROI >= 10 && (
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
                              🔥 HOT ZONE
                            </span>
                          )}
                          {stat.totalTrades === 0 && (
                            <span className="px-2 py-1 bg-slate-600/20 text-slate-500 text-xs font-medium rounded-full">
                              No Data
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-400">
                          {stat.totalTrades} trade{stat.totalTrades !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {stat.totalTrades > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Win Rate</p>
                            <p className={`text-lg font-bold ${
                              stat.winRate >= 60 ? 'text-emerald-400' :
                              stat.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {stat.winRate.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Avg ROI</p>
                            <p className={`text-lg font-bold ${stat.avgROI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {stat.avgROI >= 0 ? '+' : ''}{stat.avgROI.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Wins</p>
                            <p className="text-lg font-bold text-emerald-400">{stat.wins}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Losses</p>
                            <p className="text-lg font-bold text-red-400">{stat.losses}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic">
                          Trader has no closed positions in this price range
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Recommendations */}
                {selectedTrader.priceRangeStats && selectedTrader.priceRangeStats.some(s => s.totalTrades > 0) && (
                  <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <h5 className="text-sm font-semibold text-indigo-400 mb-2">💡 Copy Trading Tip</h5>
                    <p className="text-sm text-slate-300">
                      Look for "HOT ZONE" price ranges with high win rates (60%+) and positive ROI (10%+). 
                      These are the sweet spots where this trader performs best. Consider only copying trades 
                      in these price ranges for maximum success probability!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
