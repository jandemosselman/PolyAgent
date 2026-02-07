'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Market {
  id: string
  question: string
  conditionId: string
  slug: string
  image?: string
  icon?: string
  category?: string
  volume: string
  liquidity: string
  active: boolean
  closed: boolean
  endDate: string
  outcomes: string
  outcomePrices: string
  volume24hr?: number
  volumeNum?: number
  liquidityNum?: number
}

export default function MarketsPage() {
  const router = useRouter()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)

  useEffect(() => {
    fetchMarkets()
  }, [])

  const fetchMarkets = async () => {
    setLoading(true)
    try {
      // Get active markets (closed=false) sorted by volume
      const response = await fetch('/api/markets?limit=50&closed=false&order=volume24hr&ascending=false')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setMarkets(data)
    } catch (err) {
      console.error('Failed to load markets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }

    setSearching(true)
    try {
      // Search with events_status=active to get active markets
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&events_status=active&limit_per_type=20`)
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Search API error:', errorText)
        throw new Error('Failed to search')
      }
      const data = await response.json()
      console.log('Search results:', data)
      setSearchResults(data)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const parseOutcomes = (outcomes: string) => {
    try {
      return JSON.parse(outcomes)
    } catch {
      return ['Yes', 'No']
    }
  }

  const parseOutcomePrices = (prices: string) => {
    try {
      return JSON.parse(prices)
    } catch {
      return ['0.5', '0.5']
    }
  }

  const formatNumber = (num: number | string | null | undefined) => {
    if (!num) return '$0'
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(n)) return '$0'
    if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`
    return `$${n.toFixed(2)}`
  }

  // Extract markets from search results
  const getDisplayMarkets = () => {
    if (searchResults) {
      // Search returns events with nested markets
      const allMarkets: Market[] = []
      if (searchResults.events) {
        searchResults.events.forEach((event: any) => {
          if (event.markets && Array.isArray(event.markets)) {
            allMarkets.push(...event.markets)
          }
        })
      }
      return allMarkets
    }
    return markets
  }

  const displayMarkets = getDisplayMarkets()
  const hasSearchResults = searchQuery && searchResults

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/')}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back to Leaderboard
              </button>
              <h1 className="text-3xl font-bold text-slate-200">Markets</h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search markets, events, and profiles..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleSearch(e.target.value)
              }}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
            />
            {searching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Results Summary */}
        {hasSearchResults && (
          <div className="mb-6 flex items-center space-x-4">
            <button
              onClick={() => {
                setSearchQuery('')
                setSearchResults(null)
              }}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-slate-300 transition-colors"
            >
              Clear Search
            </button>
            <span className="text-slate-400">
              Found {displayMarkets.length} markets from {searchResults.events?.length || 0} events
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayMarkets.map((market: Market) => {
              const outcomes = parseOutcomes(market.outcomes)
              const prices = parseOutcomePrices(market.outcomePrices)
              
              return (
                <div
                  key={market.id}
                  onClick={() => router.push(`/market/${market.conditionId}`)}
                  className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-5 hover:border-slate-700/50 transition-all hover:transform hover:scale-[1.02] cursor-pointer"
                >
                  <div className="flex items-start space-x-3 mb-4">
                    {market.icon && (
                      <img 
                        src={market.icon} 
                        alt=""
                        className="w-12 h-12 rounded-lg bg-slate-800"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-slate-200 font-medium mb-1 line-clamp-2">
                        {market.question}
                      </h3>
                      {market.category && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          {market.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Outcome Prices */}
                  <div className="flex items-center space-x-2 mb-4">
                    {outcomes.map((outcome: string, idx: number) => {
                      const price = prices[idx] ? (parseFloat(prices[idx]) * 100).toFixed(0) : '50'
                      return (
                        <div key={idx} className="flex-1 bg-slate-800/50 rounded-lg p-2">
                          <p className="text-slate-400 text-xs mb-1">{outcome}</p>
                          <p className="text-slate-200 font-semibold">{price}¢</p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Volume 24h</p>
                      <p className="text-slate-300 font-medium">{formatNumber(market.volume24hr || market.volumeNum)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Liquidity</p>
                      <p className="text-slate-300 font-medium">{formatNumber(market.liquidityNum || market.liquidity)}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-3 pt-3 border-t border-slate-800/50">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      market.closed 
                        ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {market.closed ? 'Closed' : 'Active'}
                    </span>
                    {market.endDate && (
                      <span className="ml-2 text-slate-500 text-xs">
                        Ends: {new Date(market.endDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && displayMarkets.length === 0 && (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-lg">No markets found</p>
          </div>
        )}
      </div>
    </div>
  )
}
