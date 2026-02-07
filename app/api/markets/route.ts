import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  try {
    // Pass all query parameters through to the Gamma API
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?${searchParams.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 60 } // Cache for 60 seconds
      }
    )

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching markets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    )
  }
}
