import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT  = 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

export const maxDuration = 30
export const dynamic = 'force-dynamic'
const REVALIDATE = 300

const AUTH = {
  'Authorization': `Bearer ${IDX_TOKEN}`,
  'Accept': 'application/json',
  'OData-Version': '4.0'
}

const RESIDENTIAL = "(PropertyType eq 'Residential Freehold' or PropertyType eq 'Residential Condo & Other')"

function cityFilter(city: string): string {
  return city === 'Toronto'
    ? "startswith(City,'Toronto')"
    : `City eq '${city}'`
}

async function fetchPrimaryPhotos(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (let i = 0; i < keys.length; i += 40) {
    const chunk = keys.slice(i, i + 40)
    if (!chunk.length) continue
    const keyList = chunk.map(k => `'${k}'`).join(',')
    const filter = `ResourceRecordKey in (${keyList}) and MediaCategory eq 'Photo' and ImageSizeDescription eq 'Medium' and Order eq 0`
    const url = `${ENDPOINT}Media?$filter=${encodeURIComponent(filter)}&$select=ResourceRecordKey,MediaURL,ImageSizeDescription,Order&$top=500`
    try {
      const res = await fetch(url, { headers: AUTH, next: { revalidate: REVALIDATE } })
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
    } catch { /* best-effort */ }
  }
  return out
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')
    const maxPrice = searchParams.get('maxPrice')
    const minPrice = searchParams.get('minPrice')

    const filters: string[] = [
      "StandardStatus eq 'Active'",
      "TransactionType eq 'For Sale'",
      // Only fetch listings that have an OriginalListPrice set
      'OriginalListPrice gt 0',
      RESIDENTIAL
    ]
    if (city) filters.push(cityFilter(city))
    if (maxPrice) filters.push(`ListPrice le ${maxPrice}`)
    if (minPrice) filters.push(`ListPrice ge ${minPrice}`)

    const select = [
      'ListingKey', 'ListPrice', 'OriginalListPrice',
      'StreetNumber', 'StreetName', 'StreetSuffix',
      'City', 'StateOrProvince', 'PostalCode',
      'BedroomsTotal', 'BathroomsTotalInteger', 'BuildingAreaTotal',
      'PropertySubType', 'ListOfficeName', 'ListingContractDate', 'DaysOnMarket'
    ].join(',')

    const url = `${ENDPOINT}Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=200&$orderby=ModificationTimestamp desc&$select=${select}`

    const res = await fetch(url, { headers: AUTH, next: { revalidate: REVALIDATE } })
    if (!res.ok) {
      return NextResponse.json({ error: `PropTx ${res.status}`, value: [] }, { status: 500 })
    }

    const data = await res.json()
    const raw = (data.value || []) as any[]

    // Filter in code: only listings where price was genuinely reduced (not just data quirks)
    // Minimum $5,000 drop and minimum 0.5% reduction to avoid noise
    const dropped = raw
      .filter((l: any) => {
        const orig = Number(l.OriginalListPrice)
        const curr = Number(l.ListPrice)
        if (!orig || !curr || orig <= curr) return false
        const drop = orig - curr
        const pct = (drop / orig) * 100
        return drop >= 5000 && pct >= 0.5
      })
      .sort((a: any, b: any) => {
        const dropA = (Number(a.OriginalListPrice) - Number(a.ListPrice)) / Number(a.OriginalListPrice)
        const dropB = (Number(b.OriginalListPrice) - Number(b.ListPrice)) / Number(b.OriginalListPrice)
        return dropB - dropA  // highest % drop first
      })

    const photos = await fetchPrimaryPhotos(dropped.map((l: any) => l.ListingKey).filter(Boolean))

    const value = dropped.map((l: any) => ({
      ListingKey:        l.ListingKey,
      ListPrice:         l.ListPrice,
      OriginalListPrice: l.OriginalListPrice,
      DropAmount:        Number(l.OriginalListPrice) - Number(l.ListPrice),
      DropPercent:       Math.round(((Number(l.OriginalListPrice) - Number(l.ListPrice)) / Number(l.OriginalListPrice)) * 100 * 10) / 10,
      StreetNumber:      l.StreetNumber,
      StreetName:        l.StreetName,
      StreetSuffix:      l.StreetSuffix,
      City:              l.City,
      StateOrProvince:   l.StateOrProvince,
      PostalCode:        l.PostalCode,
      BedroomsTotal:     l.BedroomsTotal,
      BathroomsTotalInteger: l.BathroomsTotalInteger,
      LivingArea:        l.BuildingAreaTotal,
      PropertySubType:   l.PropertySubType,
      ListOfficeName:    l.ListOfficeName,
      ListingContractDate: l.ListingContractDate,
      DaysOnMarket:      l.DaysOnMarket,
      PhotoURL:          photos[l.ListingKey] || null
    }))

    return NextResponse.json({
      value,
      count: value.length,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC. Price reduction information is based on MLS® data and should be independently verified.'
    }, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (err: any) {
    console.error('Price drops API error:', err)
    return NextResponse.json({ error: err.message || 'Failed', value: [] }, { status: 500 })
  }
}
