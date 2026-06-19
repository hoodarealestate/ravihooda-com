import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT = 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

const AUTH = {
  'Authorization': `Bearer ${IDX_TOKEN}`,
  'Accept': 'application/json',
  'OData-Version': '4.0'
}

// Keywords that indicate Power of Sale / distressed / estate properties. These
// appear in PublicRemarks since PropertyCondition is not a reliable queryable
// field across all TRREB listings. Each maps to a canonical human-written casing
// (the form actually used in remarks, e.g. "Power of Sale" — note the lowercase
// "of", which .title() would wrongly capitalise).
const POS_KEYWORDS: Record<string, string> = {
  'power of sale':   'Power of Sale',
  'court order':     'Court Order',
  'estate sale':     'Estate Sale',
  'sold as is':      'Sold As Is',
  'as-is where-is':  'As-Is Where-Is',
  'as is where is':  'As Is Where Is',
  'judicial sale':   'Judicial Sale',
  'mortgagee sale':  'Mortgagee Sale'
}

export const maxDuration = 30
export const dynamic = 'force-dynamic' // reads query params; never prerender at build

// TRREB splits Toronto into ~35 districts ('Toronto C01', ...), so
// `City eq 'Toronto'` matches nothing. Prefix-match Toronto; other GTA cities
// are exact single values.
function cityFilter(city: string): string {
  return city === 'Toronto'
    ? "startswith(City,'Toronto')"
    : `City eq '${city}'`
}

// --- Photo helper (same approach as /api/listings) -------------------------
// Primary photo (Order 0), 'Medium' watermarked variant only. The
// 'LargestNoWatermark' variant must never be served (compliance). PropTx drops
// the trailing condition in an `and` chain against an `in (...)` list, so
// 'Medium' must precede 'Order eq 0'; we also re-validate in code.
async function fetchPrimaryPhotos(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
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
      // best-effort
    }
  }
  return out
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')
    const maxPrice = searchParams.get('maxPrice')
    const minPrice = searchParams.get('minPrice')

    const baseFilters: string[] = ["StandardStatus eq 'Active'"]
    if (city) baseFilters.push(cityFilter(city))
    if (maxPrice) baseFilters.push(`ListPrice le ${maxPrice}`)
    if (minPrice) baseFilters.push(`ListPrice ge ${minPrice}`)

    const select = [
      'ListingKey', 'ListPrice', 'StreetNumber', 'StreetName', 'StreetSuffix',
      'City', 'StateOrProvince', 'PostalCode',
      'BedroomsTotal', 'BathroomsTotalInteger', 'BuildingAreaTotal',
      'PropertySubType', 'ListOfficeName', 'ListingContractDate', 'PublicRemarks'
    ].join(',')

    // PropTx OData does NOT implement tolower(), and a single query OR-ing every
    // keyword/casing times out (60s) scanning PublicRemarks board-wide. So we
    // fire one query per keyword (each a small case-variant OR that returns
    // quickly) IN PARALLEL, then merge. Wall time ≈ the slowest single query.
    const queries = Object.entries(POS_KEYWORDS).map(([lower, canon]) => {
      const forms = Array.from(new Set([lower, lower.toUpperCase(), canon]))
      const clause = forms.map(f => `contains(PublicRemarks,'${f}')`).join(' or ')
      const fullFilter = `(${baseFilters.join(' and ')}) and (${clause})`
      const url = `${ENDPOINT}Property?$filter=${encodeURIComponent(fullFilter)}&$top=100&$select=${select}`
      return fetch(url, { headers: AUTH, cache: 'no-store' })
        .then(r => r.ok ? r.json() : { value: [] })
        .then(d => d.value || [])
        .catch(() => [])
    })

    const results = await Promise.all(queries)

    // Merge + dedupe by ListingKey
    const byKey = new Map<string, any>()
    for (const rows of results) {
      for (const l of rows) if (l?.ListingKey) byKey.set(l.ListingKey, l)
    }

    // Authority filter: confirm a keyword match in-memory (case-insensitive),
    // independent of however PropTx's case-sensitive `contains` behaved.
    const keywords = Object.keys(POS_KEYWORDS)
    const lower = (s: string) => (s || '').toLowerCase()
    const matched = Array.from(byKey.values())
      .filter((l: any) => keywords.some(k => lower(l.PublicRemarks).includes(k)))
      .sort((a: any, b: any) => (a.ListPrice || 0) - (b.ListPrice || 0))

    const photos = await fetchPrimaryPhotos(matched.map((l: any) => l.ListingKey).filter(Boolean))

    // Strip PublicRemarks from the response (no need to expose raw remarks text)
    const value = matched.map((l: any) => ({
      ListingKey: l.ListingKey,
      ListPrice: l.ListPrice,
      StreetNumber: l.StreetNumber,
      StreetName: l.StreetName,
      StreetSuffix: l.StreetSuffix,
      City: l.City,
      StateOrProvince: l.StateOrProvince,
      PostalCode: l.PostalCode,
      BedroomsTotal: l.BedroomsTotal,
      BathroomsTotalInteger: l.BathroomsTotalInteger,
      LivingArea: l.BuildingAreaTotal,
      PropertySubType: l.PropertySubType,
      ListOfficeName: l.ListOfficeName,
      ListingContractDate: l.ListingContractDate,
      PhotoURL: photos[l.ListingKey] || null
    }))

    return NextResponse.json({
      value,
      count: value.length,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC. "Power of Sale" classification is based on automated keyword detection in listing remarks and should be independently verified.'
    }, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (err: any) {
    console.error('Power of Sale API error:', err)
    return NextResponse.json({ error: err.message || 'Failed', value: [] }, { status: 500 })
  }
}
