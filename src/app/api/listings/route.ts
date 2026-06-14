import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT = 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

export const maxDuration = 30 // 30 second timeout

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city         = searchParams.get('city')
    const propertyType = searchParams.get('type')
    const maxPrice     = searchParams.get('maxPrice')
    const minPrice     = searchParams.get('minPrice')
    const beds         = searchParams.get('beds')

    const filters: string[] = ["StandardStatus eq 'Active'"]
    if (city)         filters.push(`City eq '${city}'`)
    if (propertyType) filters.push(`PropertySubType eq '${propertyType}'`)
    if (maxPrice)     filters.push(`ListPrice le ${maxPrice}`)
    if (minPrice)     filters.push(`ListPrice ge ${minPrice}`)
    if (beds)         filters.push(`BedroomsTotal ge ${beds}`)

    const select = [
      'ListingKey', 'ListPrice', 'StreetNumber', 'StreetName', 'StreetSuffix',
      'City', 'StateOrProvince', 'PostalCode', 'Latitude', 'Longitude',
      'BedroomsTotal', 'BathroomsTotalInteger', 'BuildingAreaTotal',
      'PropertySubType', 'ListOfficeName', 'StandardStatus', 'ListingContractDate'
    ].join(',')

    const url = `${ENDPOINT}Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=100&$orderby=ListPrice desc&$select=${select}`

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${IDX_TOKEN}`,
        'Accept': 'application/json',
        'OData-Version': '4.0'
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json({ error: `PropTx ${res.status}`, detail: detail.substring(0,200), value: [] }, { status: 500 })
    }

    const data = await res.json()
    const listings = (data.value || []).map((l: any) => ({
      ...l,
      LivingArea: l.BuildingAreaTotal
    }))

    return NextResponse.json(
      { value: listings, count: listings.length, disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC.' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message, value: [] }, { status: 500 })
  }
}
