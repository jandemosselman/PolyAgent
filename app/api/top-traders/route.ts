import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') || '50'
    const period = searchParams.get('period') || 'DAY' // DAY, WEEK, MONTH

    // Use the working leaderboard endpoint from your proxy API
    const leaderboardUrl = new URL(`${request.nextUrl.origin}/api/leaderboard`)
    leaderboardUrl.searchParams.set('category', 'OVERALL')
    leaderboardUrl.searchParams.set('time_period', period.toUpperCase())
    leaderboardUrl.searchParams.set('order_by', 'PNL')

    const response = await fetch(leaderboardUrl.toString())

    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.status}`)
    }

    const leaderboardData = await response.json()
    
    // Sort by PNL and take top N
    const sortedTraders = leaderboardData
      .sort((a: any, b: any) => {
        const pnlA = a.pnl || 0
        const pnlB = b.pnl || 0
        return pnlB - pnlA
      })
      .slice(0, parseInt(limit))
      .map((trader: any, index: number) => ({
        address: trader.proxyWallet,
        realized_pnl: trader.pnl || 0,
        volume: trader.vol || 0,
        rank: index + 1,
        userName: trader.userName || 'Unknown',
        xUsername: trader.xUsername || ''
      }))

    return NextResponse.json({
      traders: sortedTraders,
      period,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Error fetching top traders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch top traders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
