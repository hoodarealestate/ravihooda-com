import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT = 'https://query.ampre.ca/odata/'
// Token hardcoded as fallback — also set as env var PROPTX_IDX_TOKEN in Vercel
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

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
      headers: { 
        'Authorization': `Bearer ${IDX_TOKEN}`, 
        'Accept': 'application/json'
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('PropTx error:', res.status, errText)
      return NextResponse.json({ error: `PropTx error: ${res.status}`, value: [] }, { status: 500 })
    }
    
    const data = await res.json()
    return NextResponse.json({
      value: data.value || [],
      count: (data.value || []).length,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC.'
    })
  } catch (err: any) {
    console.error('Listings API error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch listings', value: [] }, { status: 500 })
  }
}
