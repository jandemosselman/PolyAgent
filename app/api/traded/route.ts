import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const user = searchParams.get('user')

  if (!user) {
    return NextResponse.json(
      { error: 'User address is required' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(
      `https://data-api.polymarket.com/traded?user=${user}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 300 } // Cache for 5 minutes
      }
    )

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching total markets traded:', error)
    return NextResponse.json(
      { error: 'Failed to fetch total markets traded' },
      { status: 500 }
    )
  }
}
