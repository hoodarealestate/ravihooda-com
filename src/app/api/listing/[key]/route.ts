import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT  = 'https://query.ampre.ca/odata/'
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2ZW5kb3IvdHJyZWIvMTE0MTYiLCJhdWQiOiJBbXBVc2Vyc1ByZCIsInJvbGVzIjpbIkFtcFZlbmRvciJdLCJpc3MiOiJwcm9kLmFtcHJlLmNhIiwiZXhwIjoyNTM0MDIzMDA3OTksImlhdCI6MTc4MTMwMjgxMCwic3ViamVjdFR5cGUiOiJ2ZW5kb3IiLCJzdWJqZWN0S2V5IjoiMTE0MTYiLCJqdGkiOiI0NzBmN2M4NjIzZjUwODM4IiwiY3VzdG9tZXJOYW1lIjoidHJyZWIifQ.XsTeE7dq7S5oCTWVdgiXuQfV63t2uEvR01-hgXYIJSE'

const AUTH = {
  'Authorization': `Bearer ${IDX_TOKEN}`,
  'Accept': 'application/json',
  'OData-Version': '4.0'
}

// Only fields confirmed present in the TRREB IDX feed (301-field debug verified)
const SELECT = [
  'ListingKey',
  'ListPrice',
  'StreetNumber', 'StreetName', 'StreetSuffix',
  'City', 'StateOrProvince', 'PostalCode',
  'BedroomsTotal', 'BedroomsAboveGrade', 'BedroomsBelowGrade',
  'BathroomsTotalInteger', 'KitchensTotal',
  'BuildingAreaTotal', 'LotDepth', 'LotWidth',
  'PropertySubType', 'PropertyType', 'TransactionType',
  'ListOfficeName',
  'OriginalEntryTimestamp', 'ModificationTimestamp',
  'StandardStatus',
  'PublicRemarks', 'PublicRemarksExtras',
  'TaxAnnualAmount', 'TaxYear',
  'ParkingTotal', 'GarageType',
  'Basement', 'Cooling', 'HeatType', 'HeatSource',
  'ApproximateAge',
  'AssociationFee', 'AssociationFeeIncludes',
  'Exposure', 'BalconyType',
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
      const detail = await propRes.text().catch(() => '')
      console.error('PropTx listing detail error:', propRes.status, detail.substring(0, 200))
      return NextResponse.json({ error: `PropTx error ${propRes.status}`, detail: detail.substring(0,200) }, { status: 502 })
    }
    const propData = await propRes.json()
    const l = (propData.value || [])[0]
    if (!l) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    // Fetch all Medium watermarked photos ordered by position
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
        ListingKey:            l.ListingKey,
        ListPrice:             l.ListPrice,
        StreetNumber:          l.StreetNumber,
        StreetName:            l.StreetName,
        StreetSuffix:          l.StreetSuffix,
        City:                  l.City,
        StateOrProvince:       l.StateOrProvince,
        PostalCode:            l.PostalCode,
        BedroomsTotal:         l.BedroomsTotal,
        BedroomsAboveGrade:    l.BedroomsAboveGrade,
        BedroomsBelowGrade:    l.BedroomsBelowGrade,
        BathroomsTotalInteger: l.BathroomsTotalInteger,
        KitchensTotal:         l.KitchensTotal,
        BuildingAreaTotal:     l.BuildingAreaTotal,
        LotDepth:              l.LotDepth,
        LotWidth:              l.LotWidth,
        LotSizeArea:           l.LotSizeArea,
        PropertySubType:       l.PropertySubType,
        PropertyType:          l.PropertyType,
        ListOfficeName:        l.ListOfficeName,
        ListingDate:           l.OriginalEntryTimestamp,
        PublicRemarks:         l.PublicRemarks,
        PublicRemarksExtras:   l.PublicRemarksExtras,
        TaxAnnualAmount:       l.TaxAnnualAmount,
        TaxYear:               l.TaxYear,
        ParkingTotal:          l.ParkingTotal,
        GarageType:            l.GarageType,
        Basement:              l.Basement,
        Cooling:               l.Cooling,
        HeatType:              l.HeatType,
        HeatSource:            l.HeatSource,
        ApproximateAge:        l.ApproximateAge,
        AssociationFee:        l.AssociationFee,
        AssociationFeeIncludes:l.AssociationFeeIncludes,
        Exposure:              l.Exposure,
        BalconyType:           l.BalconyType,
      },
      photos,
      disclaimer: 'Data deemed reliable but not guaranteed accurate by PROPTX INNOVATIONS INC.'
    })
  } catch (err: any) {
    console.error('Listing detail API error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
