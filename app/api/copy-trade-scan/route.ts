import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      traderAddress,
      lastCheckedTimestamp,
      createdAtTimestamp,
      minTriggerAmount,
      minPrice,
      maxPrice,
      currentBudget,
      fixedBetAmount,
      existingTradeIds = [] // Add this to track what we already have
    } = body

    console.log('🚀 COPY TRADE SCAN API CALLED')
    console.log('📋 Request params:', {
      traderAddress,
      lastCheckedTimestamp: new Date(lastCheckedTimestamp).toLocaleString(),
      createdAtTimestamp: new Date(createdAtTimestamp).toLocaleString(),
      minTriggerAmount,
      minPrice,
      maxPrice,
      currentBudget,
      fixedBetAmount
    })

    // Calculate how long the copy trade has been active
    const now = Date.now()
    const activeTimeMs = now - createdAtTimestamp
    const activeTimeDays = activeTimeMs / (1000 * 60 * 60 * 24)
    
    // Scan deeper for longer-running copy trades
    // But cap at 10,000 to avoid API limits
    let scanLimit = 1000
    if (activeTimeDays > 7) {
      scanLimit = 10000
    } else if (activeTimeDays > 3) {
      scanLimit = 5000
    } else if (activeTimeDays > 1) {
      scanLimit = 2000
    }

    console.log(`Copy trade active for ${activeTimeDays.toFixed(2)} days, scanning ${scanLimit} activities`)

    // Fetch recent activity from the trader
    const activityUrl = `https://data-api.polymarket.com/activity?user=${traderAddress}&limit=${scanLimit}&sortBy=TIMESTAMP&sortDirection=DESC`
    console.log(`📡 Fetching from: ${activityUrl}`)
    
    const activityResponse = await fetch(activityUrl)
    
    if (!activityResponse.ok) {
      throw new Error('Failed to fetch trader activity')
    }

    const allActivity = await activityResponse.json()
    
    console.log(`✅ API RESPONSE:`)
    console.log(`  - Requested limit: ${scanLimit}`)
    console.log(`  - Actually received: ${allActivity.length} activities`)
    console.log(`  - API limit effective? ${allActivity.length < scanLimit ? 'NO (got less than requested)' : 'YES (got full amount)'}`)
    
    if (allActivity.length > 0) {
      console.log(`  - Oldest activity timestamp: ${new Date(allActivity[allActivity.length - 1].timestamp * 1000).toLocaleString()}`)
      console.log(`  - Newest activity timestamp: ${new Date(allActivity[0].timestamp * 1000).toLocaleString()}`)
    }

    // CRITICAL: Filter to only BUY trades that happened AFTER the copy trade was created
    // AND after the last time we checked (to avoid duplicates)
    const createdAtSeconds = createdAtTimestamp / 1000 // Convert to seconds
    const lastCheckedSeconds = lastCheckedTimestamp / 1000 // Convert to seconds
    
    console.log('🔍 FILTERING DEBUG:')
    console.log('  - Total activities fetched:', allActivity.length)
    console.log('  - createdAtSeconds:', createdAtSeconds, new Date(createdAtSeconds * 1000).toLocaleString())
    console.log('  - Existing trade IDs to skip:', existingTradeIds.length)
    
    let filteredByType = 0
    let filteredByCreatedTime = 0
    let filteredByDuplicate = 0
    let filteredByAmount = 0
    let filteredByPrice = 0
    
    // Create a Set of existing trade transaction hashes for quick lookup
    const existingTxHashes = new Set(existingTradeIds)
    
    const newBuyTrades = allActivity.filter((activity: any) => {
      if (activity.type !== 'TRADE' || activity.side !== 'BUY') {
        filteredByType++
        return false
      }
      
      // Must be newer than when the copy trade was created
      if (activity.timestamp <= createdAtSeconds) {
        filteredByCreatedTime++
        return false
      }
      
      // FIXED: Check if we already have this trade (by transaction hash)
      // Instead of relying on lastChecked timestamp
      if (existingTxHashes.has(activity.transactionHash)) {
        filteredByDuplicate++
        return false
      }
      
      const tradeAmount = activity.size * activity.price
      
      // Apply filters
      if (tradeAmount < minTriggerAmount) {
        filteredByAmount++
        return false
      }
      if (activity.price < minPrice || activity.price > maxPrice) {
        filteredByPrice++
        return false
      }
      
      return true
    })
    
    console.log('🔍 FILTER RESULTS:')
    console.log('  - Filtered by type (not BUY):', filteredByType)
    console.log('  - Filtered by createdAt time:', filteredByCreatedTime)
    console.log('  - Filtered by duplicate (already have):', filteredByDuplicate)
    console.log('  - Filtered by min amount:', filteredByAmount)
    console.log('  - Filtered by price range:', filteredByPrice)
    console.log('  - NEW MATCHING TRADES:', newBuyTrades.length)
    console.log(`  - Percentage that passed filters: ${((newBuyTrades.length / allActivity.length) * 100).toFixed(2)}%`)
    
    // Log breakdown by filter reason
    const totalFiltered = filteredByType + filteredByCreatedTime + filteredByDuplicate + filteredByAmount + filteredByPrice
    console.log(`\n📉 FILTER BREAKDOWN:`)
    console.log(`  - Total activities: ${allActivity.length}`)
    console.log(`  - Total filtered out: ${totalFiltered}`)
    console.log(`  - Passed all filters: ${newBuyTrades.length}`)
    console.log(`  Why filtered:`)
    console.log(`    • Wrong type/side: ${filteredByType} (${((filteredByType/allActivity.length)*100).toFixed(1)}%)`)
    console.log(`    • Before start time: ${filteredByCreatedTime} (${((filteredByCreatedTime/allActivity.length)*100).toFixed(1)}%)`)
    console.log(`    • Duplicate: ${filteredByDuplicate} (${((filteredByDuplicate/allActivity.length)*100).toFixed(1)}%)`)
    console.log(`    • Below min amount: ${filteredByAmount} (${((filteredByAmount/allActivity.length)*100).toFixed(1)}%)`)
    console.log(`    • Outside price range: ${filteredByPrice} (${((filteredByPrice/allActivity.length)*100).toFixed(1)}%)`)
    
    if (newBuyTrades.length > 0) {
      console.log('  - Sample new trade timestamps:', newBuyTrades.slice(0, 3).map((t: any) => ({
        timestamp: new Date(t.timestamp * 1000).toLocaleString(),
        market: t.market || t.title,
        price: t.price,
        amount: (t.size * t.price).toFixed(2)
      })))
    }

    console.log('📊 Scan Results:', {
      totalActivities: allActivity.length,
      newMatchingTrades: newBuyTrades.length,
      createdAt: new Date(createdAtTimestamp).toLocaleString(),
      lastChecked: new Date(lastCheckedTimestamp).toLocaleString(),
      sampleNewTrades: newBuyTrades.slice(0, 3).map((t: any) => ({
        timestamp: new Date(t.timestamp * 1000).toLocaleString(),
        asset: t.asset,
        conditionId: t.conditionId,
        tokenId: t.tokenId,
        market: t.market,
        title: t.title,
        slug: t.slug,
        price: t.price,
        amount: (t.size * t.price).toFixed(2)
      }))
    })

    // Calculate how many trades we can afford
    const maxTrades = Math.floor(currentBudget / fixedBetAmount)
    
    console.log('💰 BUDGET CHECK:', {
      currentBudget,
      fixedBetAmount,
      maxTrades,
      newMatchingTrades: newBuyTrades.length,
      willCopy: Math.min(maxTrades, newBuyTrades.length)
    })
    
    // SAFETY: If maxTrades is 0 or negative, return no trades
    if (maxTrades <= 0) {
      console.log('⛔ NO BUDGET AVAILABLE - Returning 0 trades')
      return NextResponse.json({
        success: true,
        newTrades: [],
        budgetUsed: 0,
        totalNewMatches: newBuyTrades.length,
        copiedCount: 0
      })
    }
    
    const tradesToCopy = newBuyTrades.slice(0, maxTrades)

    // Create simulated trades - use market info from activity data directly!
    const baseTimestamp = Date.now()
    const simulatedTrades = tradesToCopy.map((trade: any, index: number) => ({
      id: `${trade.transactionHash}-${trade.asset}-${baseTimestamp}-${index}-${Math.random().toString(36).substring(7)}`,
      originalTrade: trade,
      timestamp: trade.timestamp * 1000, // Convert to milliseconds
      market: trade.market || trade.title || `Market ${trade.asset.substring(0, 8)}...`, // Use from activity!
      outcome: trade.outcome || trade.outcomeName || 'Unknown outcome',
      price: trade.price,
      amount: fixedBetAmount,
      asset: trade.asset,
      conditionId: trade.conditionId,
      slug: trade.slug, // Include slug for matching!
      transactionHash: trade.transactionHash,
      status: 'open' as const,
      icon: trade.icon || null
    }))

    console.log('✅ Created simulated trades:', {
      totalMatching: newBuyTrades.length,
      affordable: simulatedTrades.length,
      budgetAvailable: currentBudget,
      budgetUsed: simulatedTrades.length * fixedBetAmount,
      trades: simulatedTrades.map((t: any) => ({
        market: t.market,
        outcome: t.outcome,
        price: t.price
      }))
    })

    return NextResponse.json({
      success: true,
      newTrades: simulatedTrades,
      budgetUsed: simulatedTrades.length * fixedBetAmount,
      totalNewMatches: newBuyTrades.length,
      copiedCount: simulatedTrades.length
    })
  } catch (error) {
    console.error('Error scanning for copy trades:', error)
    return NextResponse.json(
      { error: 'Failed to scan for copy trades' },
      { status: 500 }
    )
  }
}
