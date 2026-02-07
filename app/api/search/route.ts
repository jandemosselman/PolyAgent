import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || searchParams.get('query')
  
  if (!query) {
    return NextResponse.json(
      { error: 'Search query (q) is required' },
      { status: 400 }
    )
  }

  try {
    // Build params with 'q' as the search parameter
    const params = new URLSearchParams({ q: query })
    
    // Pass through optional parameters
    if (searchParams.get('limit_per_type')) params.set('limit_per_type', searchParams.get('limit_per_type')!)
    if (searchParams.get('events_status')) params.set('events_status', searchParams.get('events_status')!)
    if (searchParams.get('optimized')) params.set('optimized', searchParams.get('optimized')!)
    if (searchParams.get('keep_closed_markets')) params.set('keep_closed_markets', searchParams.get('keep_closed_markets')!)
    
    console.log('Searching with params:', params.toString())
    
    const response = await fetch(
      `https://gamma-api.polymarket.com/public-search?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 60 } // Cache for 60 seconds
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gamma API error:', response.status, errorText)
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    console.log('Search results:', data)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error searching:', error)
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    )
  }
}
