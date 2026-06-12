// app/api/sold/route.ts
// VOW data — only available to registered users
// PropTx VOW Agreement §6.3 — requires consumer registration
import { NextRequest, NextResponse } from 'next/server'
import { fetchSoldListings } from '@/lib/proptx'
import { verifyVowToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  // Verify VOW registration
  const token = req.cookies.get('vow_token')?.value
  if (!token) {
    return NextResponse.json(
      { error: 'VOW registration required to access sold data', requiresAuth: true },
      { status: 401 }
    )
  }

  const user = await verifyVowToken(token)
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid or expired session', requiresAuth: true },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const listings = await fetchSoldListings({
      city:         searchParams.get('city')  || undefined,
      propertyType: searchParams.get('type')  || undefined,
      top:          searchParams.get('top')   ? Number(searchParams.get('top')) : 100,
    })

    return NextResponse.json({
      value: listings,
      count: listings.length,
      disclaimer: 'Sold data provided under VOW agreement. Deemed reliable but not guaranteed by PROPTX.'
    })
  } catch (err) {
    console.error('Sold listings API error:', err)
    return NextResponse.json({ error: 'Failed to fetch sold listings', value: [] }, { status: 500 })
  }
}
