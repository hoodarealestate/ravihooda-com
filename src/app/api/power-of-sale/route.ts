import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT = 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

// Keywords that indicate Power of Sale / distressed / estate properties
// These appear in PublicRemarks since PropertyCondition is not a reliable
// queryable field across all TRREB listings
const POS_KEYWORDS = [
  'power of sale',
  'court order',
  'estate sale',
  'sold as is',
  'as-is where-is',
  'as is where is',
  'judicial sale',
  'mortgagee sale'
]

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')
    const maxPrice = searchParams.get('maxPrice')
    const minPrice = searchParams.get('minPrice')

    // Pull a larger batch of active listings server-side, then filter
    // by remarks keywords. PropTx OData 'contains' on PublicRemarks works
    // but is case-sensitive and slow across the whole board, so we fetch
    // a reasonably wide active set and filter in-memory instead.
    const filters: string[] = ["StandardStatus eq 'Active'"]
    if (city) filters.push(`City eq '${city}'`)
    if (maxPrice) filters.push(`ListPrice le ${maxPrice}`)
    if (minPrice) filters.push(`ListPrice ge ${minPrice}`)

    const select = [
      'ListingKey', 'ListPrice', 'StreetNumber', 'StreetName', 'StreetSuffix',
      'City', 'StateOrProvince', 'PostalCode', 'Latitude', 'Longitude',
      'BedroomsTotal', 'BathroomsTotalInteger', 'BuildingAreaTotal',
      'PropertySubType', 'ListOfficeName', 'StandardStatus',
      'ListingContractDate', 'PublicRemarks'
    ].join(',')

    // Build an OR'd contains filter for the OData query itself as a first pass
    // (reduces payload), then double-check in-memory for safety/accuracy
    const remarkFilter = POS_KEYWORDS
      .map(k => `contains(tolower(PublicRemarks),'${k}')`)
      .join(' or ')

    const fullFilter = `(${filters.join(' and ')}) and (${remarkFilter})`

    const url = `${ENDPOINT}Property?$filter=${encodeURIComponent(fullFilter)}&$top=100&$orderby=ListPrice asc&$select=${select}`

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
      return NextResponse.json(
        { error: `PropTx ${res.status}`, detail: detail.substring(0, 300), value: [] },
        { status: 500 }
      )
    }

    const data = await res.json()
    const raw = data.value || []

    // Safety net: confirm keyword match in-memory in case OData 'contains'
    // behaves inconsistently, and strip remarks down before sending to client
    const lower = (s: string) => (s || '').toLowerCase()
    const filtered = raw
      .filter((l: any) => POS_KEYWORDS.some(k => lower(l.PublicRemarks).includes(k)))
      .map((l: any) => ({
        ListingKey: l.ListingKey,
        ListPrice: l.ListPrice,
        StreetNumber: l.StreetNumber,
        StreetName: l.StreetName,
        StreetSuffix: l.StreetSuffix,
        City: l.City,
        StateOrProvince: l.StateOrProvince,
        PostalCode: l.PostalCode,
        Latitude: l.Latitude,
        Longitude: l.Longitude,
        BedroomsTotal: l.BedroomsTotal,
        BathroomsTotalInteger: l.BathroomsTotalInteger,
        LivingArea: l.BuildingAreaTotal,
        PropertySubType: l.PropertySubType,
        ListOfficeName: l.ListOfficeName,
        ListingContractDate: l.ListingContractDate
        // PublicRemarks intentionally omitted from response —
        // no need to expose raw remarks text to the client
      }))

    return NextResponse.json({
      value: filtered,
      count: filtered.length,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC. "Power of Sale" classification is based on automated keyword detection in listing remarks and should be independently verified.'
    })
  } catch (err: any) {
    console.error('Power of Sale API error:', err)
    return NextResponse.json({ error: err.message || 'Failed', value: [] }, { status: 500 })
  }
}
