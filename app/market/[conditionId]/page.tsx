'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

interface TopHolder {
  proxyWallet: string
  bio?: string
  asset: string
  pseudonym?: string
  amount: number
  displayUsernamePublic?: boolean
  outcomeIndex: number
  name?: string
  profileImage?: string
  profileImageOptimized?: string
}

interface HoldersData {
  token: string
  holders: TopHolder[]
}

export default function MarketDetailsPage({ params }: { params: Promise<{ conditionId: string }> }) {
  const router = useRouter()
  const { conditionId } = use(params)
  const [holdersData, setHoldersData] = useState<HoldersData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTopHolders()
  }, [conditionId])

  const fetchTopHolders = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/holders?market=${conditionId}&limit=20&minBalance=10`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setHoldersData(data)
    } catch (err) {
      console.error('Failed to load top holders:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/markets')}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              ← Back to Markets
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-200">Top Holders</h1>
              <p className="text-slate-400 mt-1 text-sm font-mono">Market: {conditionId.slice(0, 10)}...</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : holdersData.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-lg">No holders data available</p>
          </div>
        ) : (
          <div className="space-y-8">
            {holdersData.map((tokenData, idx) => (
              <div key={tokenData.token || idx}>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-slate-200">
                    Outcome #{idx} Holders
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">Token: {tokenData.token}</p>
                </div>

                <div className="space-y-3">
                  {tokenData.holders.map((holder, holderIdx) => (
                    <div
                      key={holder.proxyWallet}
                      className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-5 hover:border-slate-700/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/profile/${holder.proxyWallet}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold">
                            #{holderIdx + 1}
                          </div>
                          
                          {holder.profileImageOptimized && (
                            <img 
                              src={holder.profileImageOptimized} 
                              alt={holder.name || 'Holder'}
                              className="w-10 h-10 rounded-full bg-slate-800"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}

                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-slate-200 font-medium">
                                {holder.name || holder.pseudonym || 'Anonymous Trader'}
                              </h3>
                              {holder.displayUsernamePublic && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Public
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-sm font-mono">{holder.proxyWallet.slice(0, 10)}...{holder.proxyWallet.slice(-8)}</p>
                            {holder.bio && (
                              <p className="text-slate-500 text-sm mt-2">{holder.bio}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-indigo-400">
                            {formatNumber(holder.amount)}
                          </div>
                          <div className="text-slate-500 text-sm">
                            tokens held
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
