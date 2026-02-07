import { NextRequest, NextResponse } from 'next/server'

export interface BatchAnalysisRequest {
  addresses: string[]
  closedLimit?: number
  activityLimit?: number
}

export interface BatchAnalysisProgress {
  total: number
  completed: number
  current: string
  results: any[]
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchAnalysisRequest = await request.json()
    const { addresses, closedLimit = 500, activityLimit = 200 } = body

    if (!addresses || addresses.length === 0) {
      return NextResponse.json(
        { error: 'Addresses array is required' },
        { status: 400 }
      )
    }

    console.log(`\n🚀 Starting batch analysis for ${addresses.length} traders`)
    console.log(`📊 Config: ${closedLimit} closed positions, ${activityLimit} activities per trader`)

    const results = []
    const errors = []

    // Process traders in parallel batches of 5 to respect rate limits
    const batchSize = 5
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize)
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)}`)
      
      const batchPromises = batch.map(async (address) => {
        try {
          console.log(`   ⏳ Analyzing: ${address}`)
          const response = await fetch(`${request.nextUrl.origin}/api/analyze-trader`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, closedLimit, activityLimit })
          })

          if (!response.ok) {
            throw new Error(`Failed to analyze ${address}`)
          }

          const analysis = await response.json()
          console.log(`   ✅ Complete: ${analysis.username || address} (Score: ${analysis.consistencyScore.toFixed(0)})`)
          return analysis
        } catch (error) {
          console.error(`   ❌ Error analyzing ${address}:`, error)
          return {
            address,
            error: error instanceof Error ? error.message : 'Analysis failed'
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(r => !r.error))
      errors.push(...batchResults.filter(r => r.error))

      // Small delay between batches to respect rate limits
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Sort by consistency score
    const sortedResults = results.sort((a, b) => b.consistencyScore - a.consistencyScore)

    console.log(`\n🎉 Batch analysis complete!`)
    console.log(`✅ Successfully analyzed: ${results.length}`)
    console.log(`❌ Errors: ${errors.length}`)
    if (sortedResults.length > 0) {
      console.log(`🏆 Top trader: ${sortedResults[0].username || sortedResults[0].address} (Score: ${sortedResults[0].consistencyScore.toFixed(0)})`)
    }

    return NextResponse.json({
      success: true,
      total: addresses.length,
      analyzed: results.length,
      errors: errors.length,
      results: sortedResults,
      errorDetails: errors
    })
  } catch (error) {
    console.error('Error in batch analysis:', error)
    return NextResponse.json(
      { error: 'Failed to perform batch analysis' },
      { status: 500 }
    )
  }
}
