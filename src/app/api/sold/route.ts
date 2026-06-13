import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const ENDPOINT  = process.env.PROPTX_ENDPOINT || 'https://query.ampre.ca/odata/'
const VOW_TOKEN = process.env.PROPTX_VOW_TOKEN || ''
const VOW_SECRET = new TextEncoder().encode(process.env.VOW_JWT_SECRET || 'hooda-vow-jwt-secret-2026')

export async function GET(req: NextRequest) {
  const token = req.cookies.get('vow_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'VOW registration required', requiresAuth: true }, { status: 401 })
  }
  try {
    await jwtVerify(token, VOW_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid session', requiresAuth: true }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const city         = searchParams.get('city')
    const propertyType = searchParams.get('type')

    const filters: string[] = ["MlsStatus eq 'Closed'"]
    if (city)         filters.push(`City eq '${city}'`)
    if (propertyType) filters.push(`PropertySubType eq '${propertyType}'`)

    const select = [
      'ListingKey','ListPrice','ClosePrice','CloseDate','DaysOnMarket',
      'StreetNumber','StreetName','StreetSuffix','City','Latitude','Longitude',
      'BedroomsTotal','BathroomsTotalInteger','LivingArea','PropertySubType','ListOfficeName'
    ].join(',')

    const query = `Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=100&$orderby=CloseDate desc&$select=${select}`

    const res = await fetch(`${ENDPOINT}${query}`, {
      headers: { 'Authorization': `Bearer ${VOW_TOKEN}`, 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    })

    if (!res.ok) throw new Error(`PropTx VOW error: ${res.status}`)
    const data = await res.json()

    return NextResponse.json({
      value: data.value || [],
      disclaimer: 'Sold data under VOW agreement. Deemed reliable but not guaranteed by PROPTX.'
    })
  } catch (err) {
    console.error('Sold API error:', err)
    return NextResponse.json({ error: 'Failed to fetch sold listings', value: [] }, { status: 500 })
  }
}
