import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT  = 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

const AUTH = {
  'Authorization': `Bearer ${IDX_TOKEN}`,
  'Accept': 'application/json',
  'OData-Version': '4.0'
}

const SELECT = [
  'ListingKey', 'ListingId', 'ListPrice', 'OriginalListPrice',
  'StreetNumber', 'StreetName', 'StreetSuffix', 'City', 'StateOrProvince', 'PostalCode',
  'Latitude', 'Longitude',
  'BedroomsTotal', 'BathroomsTotalInteger', 'BuildingAreaTotal',
  'PropertySubType', 'PropertyType', 'TransactionType',
  'ListOfficeName', 'ListAgentFullName',
  'ListingContractDate', 'StandardStatus',
  'PublicRemarks',
  'YearBuilt', 'TaxAnnualAmount', 'TaxYear',
  'LotFrontage', 'LotDepth', 'LotSizeArea',
  'DaysOnMarket', 'CumulativeDaysOnMarket',
].join(',')

export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  const key = params.key
  if (!key) return NextResponse.json({ error: 'Missing listing key' }, { status: 400 })

  try {
    // Fetch property details
    const propUrl = `${ENDPOINT}Property?$filter=${encodeURIComponent(`ListingKey eq '${key}'`)}&$select=${SELECT}&$top=1`
    const propRes = await fetch(propUrl, { headers: AUTH, cache: 'no-store' })
    if (!propRes.ok) {
      return NextResponse.json({ error: `PropTx error ${propRes.status}` }, { status: 502 })
    }
    const propData = await propRes.json()
    const listing = (propData.value || [])[0]
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    // Fetch all Medium watermarked photos — Medium MUST precede Order in filter (PropTx quirk)
    const photoFilter = `ResourceRecordKey eq '${key}' and MediaCategory eq 'Photo' and ImageSizeDescription eq 'Medium'`
    const photoUrl = `${ENDPOINT}Media?$filter=${encodeURIComponent(photoFilter)}&$select=ResourceRecordKey,MediaURL,ImageSizeDescription,Order&$orderby=Order asc&$top=50`
    const photoRes = await fetch(photoUrl, { headers: AUTH, cache: 'no-store' })
    let photos: string[] = []
    if (photoRes.ok) {
      const photoData = await photoRes.json()
      photos = (photoData.value || [])
        .filter((m: any) => m.ImageSizeDescription === 'Medium' && !m.MediaURL?.includes('NoWatermark'))
        .sort((a: any, b: any) => (a.Order ?? 99) - (b.Order ?? 99))
        .map((m: any) => m.MediaURL)
        .filter(Boolean)
    }

    return NextResponse.json({
      listing: {
        ListingKey:           listing.ListingKey,
        ListingId:            listing.ListingId,
        ListPrice:            listing.ListPrice,
        OriginalListPrice:    listing.OriginalListPrice,
        StreetNumber:         listing.StreetNumber,
        StreetName:           listing.StreetName,
        StreetSuffix:         listing.StreetSuffix,
        City:                 listing.City,
        StateOrProvince:      listing.StateOrProvince,
        PostalCode:           listing.PostalCode,
        Latitude:             listing.Latitude,
        Longitude:            listing.Longitude,
        BedroomsTotal:        listing.BedroomsTotal,
        BathroomsTotalInteger:listing.BathroomsTotalInteger,
        BuildingAreaTotal:    listing.BuildingAreaTotal,
        PropertySubType:      listing.PropertySubType,
        PropertyType:         listing.PropertyType,
        ListOfficeName:       listing.ListOfficeName,
        ListAgentFullName:    listing.ListAgentFullName,
        ListingContractDate:  listing.ListingContractDate,
        PublicRemarks:        listing.PublicRemarks,
        YearBuilt:            listing.YearBuilt,
        TaxAnnualAmount:      listing.TaxAnnualAmount,
        TaxYear:              listing.TaxYear,
        LotFrontage:          listing.LotFrontage,
        LotDepth:             listing.LotDepth,
        LotSizeArea:          listing.LotSizeArea,
        DaysOnMarket:         listing.DaysOnMarket ?? listing.CumulativeDaysOnMarket,
      },
      photos,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC.'
    })
  } catch (err: any) {
    console.error('Listing detail API error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
