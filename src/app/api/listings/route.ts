import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT = 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city         = searchParams.get('city')
    const propertyType = searchParams.get('type')
    const maxPrice     = searchParams.get('maxPrice')
    const minPrice     = searchParams.get('minPrice')
    const beds         = searchParams.get('beds')

    // Build OData filter
    const filters: string[] = ["StandardStatus eq 'Active'"]
    if (city)         filters.push(`City eq '${city}'`)
    if (propertyType) filters.push(`PropertySubType eq '${propertyType}'`)
    if (maxPrice)     filters.push(`ListPrice le ${maxPrice}`)
    if (minPrice)     filters.push(`ListPrice ge ${minPrice}`)
    if (beds)         filters.push(`BedroomsTotal ge ${beds}`)

    // Minimal select — only guaranteed PropTx fields
    const select = 'ListingKey,ListPrice,StreetNumber,StreetName,City,BedroomsTotal,BathroomsTotalInteger,PropertySubType,ListOfficeName,Latitude,Longitude,LivingArea'

    // Use $top max 100 per IDX agreement
    const url = `${ENDPOINT}Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=100&$orderby=ListPrice desc&$select=${select}`

    console.log('PropTx URL:', url)

    const res = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${IDX_TOKEN}`, 
        'Accept': 'application/json',
        'OData-Version': '4.0'
      },
      cache: 'no-store'
    })

    const responseText = await res.text()
    console.log('PropTx status:', res.status)
    console.log('PropTx response:', responseText.substring(0, 500))

    if (!res.ok) {
      return NextResponse.json({ 
        error: `PropTx error: ${res.status}`, 
        detail: responseText.substring(0, 200),
        value: [] 
      }, { status: 500 })
    }
    
    const data = JSON.parse(responseText)
    return NextResponse.json({
      value: data.value || [],
      count: (data.value || []).length,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC.'
    })
  } catch (err: any) {
    console.error('Listings API error:', err)
    return NextResponse.json({ 
      error: err.message || 'Failed to fetch listings', 
      value: [] 
    }, { status: 500 })
  }
}
