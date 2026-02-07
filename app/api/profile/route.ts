import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')

  if (!address) {
    return NextResponse.json(
      { error: 'Address is required' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/public-profile?address=${address}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 300 } // Cache for 5 minutes
      }
    )

    if (!response.ok) {
      // Profile not found is okay, just return null
      if (response.status === 404) {
        return NextResponse.json(null)
      }
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching profile:', error)
    // Return null instead of error for profiles that don't exist
    return NextResponse.json(null)
  }
}
