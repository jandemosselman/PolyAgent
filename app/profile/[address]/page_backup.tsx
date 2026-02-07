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

interface UserProfile {
  username?: string
  bio?: string
  profile_picture?: string
  optimized_profile_picture?: string
}

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const router = useRouter()
  const { address } = use(params)
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tradesLoading, setTradesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'positions' | 'trades'>('positions')

  useEffect(() => {
    fetchProfile()
    fetchPositions()
  }, [address])

  useEffect(() => {
    if (activeTab === 'trades' && trades.length === 0) {
      fetchTrades()
    }
  }, [activeTab])

  const fetchProfile = async () => {
    try {
      const response = await fetch(`https://gamma-api.polymarket.com/public-profile?address=${address}`)
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

  const fetchTrades = async () => {
    setTradesLoading(true)
    try {
      const queryParams = new URLSearchParams({
        user: address,
        limit: '50',
        takerOnly: 'true'
      })
      
      const response = await fetch(`/api/trades?${queryParams}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      setTrades(data)
    } catch (err) {
      console.error('Failed to load trades:', err)
    } finally {
      setTradesLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const formatPercent = (num: number) => {
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
              />
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 border border-indigo-500/20 rounded-xl p-6">
            <p className="text-indigo-400 text-sm font-medium">Active Positions</p>
            <p className="text-3xl font-bold text-white mt-2">{positions.length}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-6">
            <p className="text-emerald-400 text-sm font-medium">Total PNL</p>
            <p className={`text-3xl font-bold mt-2 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatNumber(totalPnl)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6">
            <p className="text-purple-400 text-sm font-medium">Total Value</p>
            <p className="text-3xl font-bold text-white mt-2">
              {formatNumber(totalValue)}
            </p>
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
            Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'trades'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Trade History
          </button>
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
              onClick={fetchPositions}
              className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : positions.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-lg">No active positions found for this trader</p>
          </div>
        ) : (
          <>
            {activeTab === 'positions' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-200 mb-4">Active Positions</h2>
            
            {/* Positions List */}
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
                            Size: {position.size.toFixed(2)} tokens
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
                      <p className="text-slate-200 font-medium">${position.avgPrice.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Current Price</p>
                      <p className="text-slate-200 font-medium">${position.curPrice.toFixed(3)}</p>
                    </div>
                  </div>

                  {/* Additional Info */}
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
          </div>
            )}

            {activeTab === 'trades' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-200 mb-4">Recent Trades</h2>
                
                {tradesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
                  </div>
                ) : trades.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                    <p className="text-slate-400 text-lg">No trades found for this trader</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trades.map((trade, index) => (
                      <div 
                        key={`${trade.transactionHash}-${index}`}
                        className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-5 hover:border-slate-700/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1">
                            {trade.icon && (
                              <img 
                                src={trade.icon} 
                                alt={trade.title}
                                className="w-10 h-10 rounded-lg bg-slate-800"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="text-slate-200 font-medium mb-1">
                                {trade.title}
                              </h3>
                              <div className="flex items-center space-x-3 text-sm">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                  trade.side === 'BUY' 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                  {trade.side}
                                </span>
                                <span className="text-slate-400">
                                  {trade.outcome}
                                </span>
                                <span className="text-slate-500 text-xs">
                                  {new Date(trade.timestamp * 1000).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right ml-4">
                            <div className="text-slate-200 font-semibold">
                              {trade.size.toFixed(2)} @ ${trade.price.toFixed(3)}
                            </div>
                            <div className="text-slate-400 text-sm">
                              {formatNumber(trade.size * trade.price)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
