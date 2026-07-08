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

// Keywords in PublicRemarks that indicate a price reduction or motivated seller
const PRICE_DROP_KEYWORDS = [
  'price reduced', 'price reduction', 'price drop', 'reduced price',
  'motivated seller', 'motivated vendor', 'bring all offers', 'bring offers',
  'below market', 'below assessed', 'priced to sell', 'priced below',
  'drastically reduced', 'significantly reduced', 'must sell',
  'vendor motivated', 'seller motivated', 'adjusted price',
  'new price', 'improved price', 'price improvement',
  'quick sale', 'sell fast', 'submit all offers',
  'won\'t last', 'wont last', 'act fast', 'act now',
  'reduced for quick', 'reduction', 'motivated',
]

function isPriceDrop(remarks: string): boolean {
  if (!remarks) return false
  const lower = remarks.toLowerCase()
  return PRICE_DROP_KEYWORDS.some(kw => lower.includes(kw))
}

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
    const city     = searchParams.get('city')
    const maxPrice = searchParams.get('maxPrice')
    const minPrice = searchParams.get('minPrice')

    const filters: string[] = [
      "StandardStatus eq 'Active'",
      "TransactionType eq 'For Sale'",
      RESIDENTIAL,
    ]
    if (city)     filters.push(cityFilter(city))
    if (maxPrice) filters.push(`ListPrice le ${maxPrice}`)
    if (minPrice) filters.push(`ListPrice ge ${minPrice}`)

    const select = [
      'ListingKey', 'ListPrice',
      'StreetNumber', 'StreetName', 'StreetSuffix',
      'City', 'StateOrProvince', 'PostalCode',
      'BedroomsTotal', 'BathroomsTotalInteger', 'BuildingAreaTotal',
      'PropertySubType', 'ListOfficeName',
      'OriginalEntryTimestamp', 'ModificationTimestamp',
      'PublicRemarks', 'DaysOnMarket',
    ].join(',')

    // Fetch 300 most recently modified to maximise chances of finding price-drop language
    const url = `${ENDPOINT}Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=300&$orderby=ModificationTimestamp desc&$select=${select}`

    const res = await fetch(url, { headers: AUTH, next: { revalidate: REVALIDATE } })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('Price drops PropTx error:', res.status, detail.substring(0, 300))
      return NextResponse.json({ error: `PropTx ${res.status}`, value: [] }, { status: 500 })
    }

    const data = await res.json()
    const raw = (data.value || []) as any[]

    // Filter: remarks contain price-drop / motivated-seller keywords
    const dropped = raw.filter((l: any) => isPriceDrop(l.PublicRemarks || ''))

    const photos = await fetchPrimaryPhotos(dropped.map((l: any) => l.ListingKey).filter(Boolean))

    const value = dropped.map((l: any) => ({
      ListingKey:        l.ListingKey,
      ListPrice:         l.ListPrice,
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
      DaysOnMarket:      l.DaysOnMarket,
      // Surface the matched keyword so the card can show a reason label
      DropReason:        PRICE_DROP_KEYWORDS.find(kw => (l.PublicRemarks || '').toLowerCase().includes(kw)) || 'Motivated Seller',
      PhotoURL:          photos[l.ListingKey] || null
    }))

    return NextResponse.json({
      value,
      count: value.length,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC. "Motivated seller" classification is based on public listing remarks and has not been independently verified.'
    }, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (err: any) {
    console.error('Price drops API error:', err)
    return NextResponse.json({ error: err.message || 'Failed', value: [] }, { status: 500 })
  }
}
