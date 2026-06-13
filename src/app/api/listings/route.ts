import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT = process.env.PROPTX_ENDPOINT || 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || ''

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city         = searchParams.get('city')
    const propertyType = searchParams.get('type')
    const maxPrice     = searchParams.get('maxPrice')
    const minPrice     = searchParams.get('minPrice')
    const beds         = searchParams.get('beds')

    const filters: string[] = ["MlsStatus eq 'Active'"]
    if (city)         filters.push(`City eq '${city}'`)
    if (propertyType) filters.push(`PropertySubType eq '${propertyType}'`)
    if (maxPrice)     filters.push(`ListPrice le ${maxPrice}`)
    if (minPrice)     filters.push(`ListPrice ge ${minPrice}`)
    if (beds)         filters.push(`BedroomsTotal ge ${beds}`)

    const select = [
      'ListingKey','ListPrice','StreetNumber','StreetName','StreetSuffix',
      'City','StateOrProvince','PostalCode','Latitude','Longitude',
      'BedroomsTotal','BathroomsTotalInteger','LivingArea','PropertySubType',
      'ListOfficeName','PublicRemarks','MlsStatus','ListingContractDate'
    ].join(',')

    const query = `Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=100&$orderby=ListPrice desc&$select=${select}`

    const res = await fetch(`${ENDPOINT}${query}`, {
      headers: { 'Authorization': `Bearer ${IDX_TOKEN}`, 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    })

    if (!res.ok) throw new Error(`PropTx error: ${res.status}`)
    const data = await res.json()

    return NextResponse.json({
      value: data.value || [],
      count: (data.value || []).length,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC.'
    })
  } catch (err) {
    console.error('Listings API error:', err)
    return NextResponse.json({ error: 'Failed to fetch listings', value: [] }, { status: 500 })
  }
}
