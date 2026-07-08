import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT = 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

export const maxDuration = 30 // 30 second timeout

const AUTH = {
  'Authorization': `Bearer ${IDX_TOKEN}`,
  'Accept': 'application/json',
  'OData-Version': '4.0'
}

// Only show residential properties on the homepage grid by default (not land,
// commercial, or international listings, which otherwise dominate when no
// specific property type is requested).
const RESIDENTIAL = "(PropertyType eq 'Residential Freehold' or PropertyType eq 'Residential Condo & Other')"

// TRREB splits Toronto into ~35 districts ('Toronto C01', 'Toronto E05', ...),
// so `City eq 'Toronto'` matches nothing. Use a prefix match for Toronto; all
// other GTA cities in the dropdown are exact, single values.
function cityFilter(city: string): string {
  return city === 'Toronto'
    ? "startswith(City,'Toronto')"
    : `City eq '${city}'`
}

// Map the website's friendly filter-button labels to real PropTx field filters.
// PropTx PropertySubType values are specific strings (e.g. 'Condo Apartment',
// 'Att/Row/Townhouse'), so a plain `PropertySubType eq 'Condo'` matches nothing.
function typeFilter(t: string): string {
  switch (t) {
    case 'Detached':      return "PropertySubType eq 'Detached'"
    case 'Semi-Detached': return "PropertySubType eq 'Semi-Detached'"
    case 'Townhouse':     return "(PropertySubType eq 'Att/Row/Townhouse' or PropertySubType eq 'Condo Townhouse')"
    case 'Condo':         return "(PropertySubType eq 'Condo Apartment' or PropertySubType eq 'Condo Townhouse')"
    case 'Commercial':    return "(PropertyType eq 'Commercial' or PropertyType eq 'Commercial & Industrial')"
    default:              return `PropertySubType eq '${t}'`
  }
}

// Fetch the primary photo (Order 0) for a batch of listings in one shot.
// PropTx exposes photos via the separate Media resource. We request the 'Medium'
// size variant, which is watermarked with the listing brokerage — required for
// compliance; the 'LargestNoWatermark' variant must NEVER be served.
//
// PropTx OData quirk: the trailing condition in a multi-`and` filter against an
// `in (...)` list is silently dropped, so `ImageSizeDescription eq 'Medium'` must
// come BEFORE `Order eq 0` or the size filter is ignored and every variant comes
// back. We additionally re-validate every row in code (Medium + Order 0 + no
// 'NoWatermark') so correctness never depends on the server-side filter holding.
// Returns { ListingKey: photoUrl }.
async function fetchPrimaryPhotos(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  // Batch the `in (...)` filter to keep each request URL a sane length.
  for (let i = 0; i < keys.length; i += 40) {
    const chunk = keys.slice(i, i + 40)
    if (!chunk.length) continue
    const keyList = chunk.map(k => `'${k}'`).join(',')
    const filter = `ResourceRecordKey in (${keyList}) and MediaCategory eq 'Photo' and ImageSizeDescription eq 'Medium' and Order eq 0`
    const url = `${ENDPOINT}Media?$filter=${encodeURIComponent(filter)}&$select=ResourceRecordKey,MediaURL,ImageSizeDescription,Order&$top=500`
    try {
      const res = await fetch(url, { headers: AUTH, cache: 'no-store' })
      if (!res.ok) continue
      const data = await res.json()
      for (const m of (data.value || [])) {
        const key = m.ResourceRecordKey
        const mediaUrl = m.MediaURL
        if (!key || !mediaUrl || out[key]) continue
        if (m.ImageSizeDescription !== 'Medium' || m.Order !== 0) continue
        if (mediaUrl.includes('NoWatermark')) continue
        out[key] = mediaUrl
      }
    } catch {
      // best-effort: a missing photo just falls back to the placeholder card
    }
  }
  return out
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city         = searchParams.get('city')
    const propertyType = searchParams.get('type')
    const maxPrice     = searchParams.get('maxPrice')
    const minPrice     = searchParams.get('minPrice')
    const beds         = searchParams.get('beds')
    const swLat        = searchParams.get('swLat')
    const swLng        = searchParams.get('swLng')
    const neLat        = searchParams.get('neLat')
    const neLng        = searchParams.get('neLng')

    const filters: string[] = [
      "StandardStatus eq 'Active'",
      "TransactionType eq 'For Sale'"
    ]
    if (city)         filters.push(cityFilter(city))
    if (propertyType) filters.push(typeFilter(propertyType))
    else              filters.push(RESIDENTIAL)
    if (maxPrice)     filters.push(`ListPrice le ${maxPrice}`)
    if (minPrice)     filters.push(`ListPrice ge ${minPrice}`)
    if (beds)         filters.push(`BedroomsTotal ge ${beds}`)
    // Bounding box filter for map pan/zoom queries
    if (swLat && swLng && neLat && neLng) {
      filters.push(`Latitude ge ${swLat} and Latitude le ${neLat}`)
      filters.push(`Longitude ge ${swLng} and Longitude le ${neLng}`)
    }

    const select = [
      'ListingKey', 'ListPrice', 'StreetNumber', 'StreetName', 'StreetSuffix',
      'City', 'StateOrProvince', 'PostalCode', 'Latitude', 'Longitude',
      'BedroomsTotal', 'BathroomsTotalInteger', 'BuildingAreaTotal',
      'PropertySubType', 'ListOfficeName', 'StandardStatus', 'ListingContractDate'
    ].join(',')

    // Newest-first so the grid shows current listings, not the most expensive
    // (which surfaced land/commercial/erroneous mega-priced entries).
    const url = `${ENDPOINT}Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=100&$orderby=ModificationTimestamp desc&$select=${select}`

    const res = await fetch(url, { headers: AUTH, cache: 'no-store' })

    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json({ error: `PropTx ${res.status}`, detail: detail.substring(0,200), value: [] }, { status: 500 })
    }

    const data = await res.json()
    const raw = (data.value || []) as any[]

    const photos = await fetchPrimaryPhotos(raw.map(l => l.ListingKey).filter(Boolean))

    const listings = raw.map((l: any) => ({
      ...l,
      LivingArea: l.BuildingAreaTotal,
      PhotoURL: photos[l.ListingKey] || null
    }))

    return NextResponse.json(
      { value: listings, count: listings.length, disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC.' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message, value: [] }, { status: 500 })
  }
}
