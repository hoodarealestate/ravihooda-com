// lib/proptx.ts
// SERVER SIDE ONLY — never import this in client components
// PropTx IDX Agreement §6.2(d) — tokens must never be exposed client-side

const ENDPOINT = process.env.PROPTX_ENDPOINT!
const IDX_TOKEN = process.env.PROPTX_IDX_TOKEN!
const VOW_TOKEN = process.env.PROPTX_VOW_TOKEN!

export interface Listing {
  ListingKey: string
  ListPrice: number
  StreetNumber: string
  StreetName: string
  StreetSuffix: string
  City: string
  StateOrProvince: string
  PostalCode: string
  Latitude: number
  Longitude: number
  BedroomsTotal: number
  BathroomsTotalInteger: number
  LivingArea: number
  PropertySubType: string
  ListOfficeName: string
  PublicRemarks: string
  MlsStatus: string
  ListingContractDate: string
  CloseDate?: string
  ClosePrice?: number
  DaysOnMarket?: number
  Media?: Array<{ MediaURL: string; Order: number }>
}

// IDX — Active listings (public)
export async function fetchActiveListings(params: {
  city?: string
  propertyType?: string
  maxPrice?: number
  minPrice?: number
  beds?: number
  top?: number
}): Promise<Listing[]> {
  const filters: string[] = ["MlsStatus eq 'Active'"]

  if (params.city) filters.push(`City eq '${params.city}'`)
  if (params.propertyType) filters.push(`PropertySubType eq '${params.propertyType}'`)
  if (params.maxPrice) filters.push(`ListPrice le ${params.maxPrice}`)
  if (params.minPrice) filters.push(`ListPrice ge ${params.minPrice}`)
  if (params.beds) filters.push(`BedroomsTotal ge ${params.beds}`)

  // Hard cap at 100 per IDX Agreement §6.3(b)
  const top = Math.min(params.top || 100, 100)

  const select = [
    'ListingKey', 'ListPrice', 'StreetNumber', 'StreetName', 'StreetSuffix',
    'City', 'StateOrProvince', 'PostalCode', 'Latitude', 'Longitude',
    'BedroomsTotal', 'BathroomsTotalInteger', 'LivingArea', 'PropertySubType',
    'ListOfficeName', 'PublicRemarks', 'MlsStatus', 'ListingContractDate', 'Media'
  ].join(',')

  const query = `Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}&$orderby=ListPrice desc&$select=${select}&$expand=Media($orderby=Order;$top=1)`

  const res = await fetch(`${ENDPOINT}${query}`, {
    headers: {
      'Authorization': `Bearer ${IDX_TOKEN}`,
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 } // Cache 1 hour — refresh within 24h per §6.3(h)
  })

  if (!res.ok) throw new Error(`PropTx IDX error: ${res.status}`)
  const data = await res.json()
  return data.value || []
}

// VOW — Sold listings (registered users only)
export async function fetchSoldListings(params: {
  city?: string
  propertyType?: string
  top?: number
}): Promise<Listing[]> {
  const filters: string[] = ["MlsStatus eq 'Closed'"]

  if (params.city) filters.push(`City eq '${params.city}'`)
  if (params.propertyType) filters.push(`PropertySubType eq '${params.propertyType}'`)

  const top = Math.min(params.top || 100, 100)

  const select = [
    'ListingKey', 'ListPrice', 'ClosePrice', 'CloseDate', 'DaysOnMarket',
    'StreetNumber', 'StreetName', 'StreetSuffix', 'City', 'StateOrProvince',
    'PostalCode', 'Latitude', 'Longitude', 'BedroomsTotal', 'BathroomsTotalInteger',
    'LivingArea', 'PropertySubType', 'ListOfficeName', 'MlsStatus', 'Media'
  ].join(',')

  const query = `Property?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}&$orderby=CloseDate desc&$select=${select}&$expand=Media($orderby=Order;$top=1)`

  const res = await fetch(`${ENDPOINT}${query}`, {
    headers: {
      'Authorization': `Bearer ${VOW_TOKEN}`,
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 }
  })

  if (!res.ok) throw new Error(`PropTx VOW error: ${res.status}`)
  const data = await res.json()
  return data.value || []
}

// Single listing detail
export async function fetchListingById(id: string, isVowUser: boolean): Promise<Listing | null> {
  const token = isVowUser ? VOW_TOKEN : IDX_TOKEN
  const query = `Property('${id}')?$expand=Media($orderby=Order)`

  const res = await fetch(`${ENDPOINT}${query}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    next: { revalidate: 1800 }
  })

  if (!res.ok) return null
  return await res.json()
}
