// app/api/listings/route.ts
// Server-side proxy — PropTx token stays here, never sent to browser
import { NextRequest, NextResponse } from 'next/server'
import { fetchActiveListings } from '@/lib/proptx'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const listings = await fetchActiveListings({
      city:         searchParams.get('city')         || undefined,
      propertyType: searchParams.get('type')         || undefined,
      maxPrice:     searchParams.get('maxPrice')     ? Number(searchParams.get('maxPrice'))  : undefined,
      minPrice:     searchParams.get('minPrice')     ? Number(searchParams.get('minPrice'))  : undefined,
      beds:         searchParams.get('beds')         ? Number(searchParams.get('beds'))       : undefined,
      top:          searchParams.get('top')          ? Number(searchParams.get('top'))        : 100,
    })

    return NextResponse.json({
      value: listings,
      count: listings.length,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC.'
    })
  } catch (err) {
    console.error('Listings API error:', err)
    return NextResponse.json({ error: 'Failed to fetch listings', value: [] }, { status: 500 })
  }
}
