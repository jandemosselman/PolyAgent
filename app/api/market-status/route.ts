import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { slugs } = await request.json()
    
    if (!slugs || !Array.isArray(slugs)) {
      return NextResponse.json({ error: 'Invalid slugs array' }, { status: 400 })
    }

    console.log(`🔍 Fetching market status for ${slugs.length} slugs`)
    
    const results: Record<string, any> = {}
    const batchSize = 10
    
    for (let i = 0; i < slugs.length; i += batchSize) {
      const batch = slugs.slice(i, i + batchSize)
      
      const promises = batch.map(async (slug: string) => {
        try {
          const res = await fetch(`https://gamma-api.polymarket.com/markets/slug/${slug}`)
          if (res.ok) {
            const data = await res.json()
            return { slug, data }
          } else {
            console.warn(`Failed to fetch ${slug}: ${res.status}`)
            return { slug, data: null }
          }
        } catch (err) {
          console.error(`Error fetching ${slug}:`, err)
          return { slug, data: null }
        }
      })
      
      const batchResults = await Promise.all(promises)
      batchResults.forEach(({ slug, data }) => {
        if (data) results[slug] = data
      })
      
      // Small delay between batches
      if (i + batchSize < slugs.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    console.log(`✅ Successfully fetched ${Object.keys(results).length} market statuses`)
    
    return NextResponse.json({ markets: results })
  } catch (error) {
    console.error('Market status API error:', error)
    return NextResponse.json({ error: 'Failed to fetch market status' }, { status: 500 })
  }
}
