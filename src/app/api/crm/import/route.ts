import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { supabase } from '@/lib/supabase'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')

async function authCheck(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return false
  try { await jwtVerify(token, CRM_SECRET); return true } catch { return false }
}

// Smart field finder — checks multiple possible column name variants
function getField(row: Record<string, string>, ...keys: string[]): string {
  const rowLower: Record<string, string> = {}
  for (const k of Object.keys(row)) {
    rowLower[k.toLowerCase().trim().replace(/[\s_-]+/g, ' ')] = row[k]
  }
  for (const key of keys) {
    const val = rowLower[key.toLowerCase().trim()]
    if (val && val.trim()) return val.trim()
  }
  return ''
}

// Map Lead Category / Lead Status to our system values
function mapCategory(val: string): string {
  const v = val.toLowerCase()
  if (v.includes('buyer') || v.includes('buy'))         return 'Buyer'
  if (v.includes('seller') || v.includes('sell'))       return 'Seller'
  if (v.includes('invest'))                             return 'Investor'
  if (v.includes('rent') || v.includes('tenant'))       return 'Renter'
  if (v.includes('referral') || v.includes('partner'))  return 'Referral Partner'
  if (val.trim())                                       return 'Prospect'
  return 'Prospect'
}

function mapStatus(val: string): string {
  const v = val.toLowerCase()
  if (v.includes('client') || v.includes('active'))     return 'Client'
  if (v.includes('past') || v.includes('closed'))       return 'Past Client'
  if (v.includes('lead'))                               return 'Lead'
  if (v.includes('prospect'))                           return 'Prospect'
  if (v.includes('vow'))                               return 'VOW Lead'
  if (v.includes('unsubscrib') || v.includes('opt out'))return 'Unsubscribed'
  if (val.trim())                                       return 'Lead'
  return 'Lead'
}

function mapTemperature(val: string): string {
  const v = val.toLowerCase()
  if (v.includes('hot') || v.includes('urgent') || v.includes('high')) return 'Hot'
  if (v.includes('cold') || v.includes('low') || v.includes('inactive')) return 'Cold'
  return 'Warm'
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contacts } = await req.json()
  if (!Array.isArray(contacts) || !contacts.length) return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
  if (contacts.length > 2000) return NextResponse.json({ error: 'Maximum 2000 contacts per import' }, { status: 400 })

  // Map every row to our contact schema
  // Handles your exact columns: First Name, Last Name, Email, Phone, Cell, Fax,
  // Address, City, Postal Code, Province, Country, Company, Birthdate,
  // Lead Category, User Submissions, Source, Lead Status, Important Dates
  const rows = contacts
    .map((c: Record<string, string>) => {
      const firstName  = getField(c, 'first name', 'firstname', 'first')
      const lastName   = getField(c, 'last name', 'lastname', 'last')
      const email      = getField(c, 'email', 'email address', 'e-mail', 'e mail')
      const phone      = getField(c, 'phone', 'phone number', 'telephone', 'home phone', 'work phone') ||
                         getField(c, 'cell', 'cell phone', 'mobile', 'mobile number')
      const address    = [
        getField(c, 'address', 'street', 'street address'),
        getField(c, 'city'),
        getField(c, 'province', 'state'),
        getField(c, 'postal code', 'postalcode', 'zip', 'postal'),
        getField(c, 'country'),
      ].filter(Boolean).join(', ')

      const leadCategory = getField(c, 'lead category', 'category', 'client type', 'buyer/seller', 'type')
      const leadStatus   = getField(c, 'lead status', 'status', 'client status')
      const source       = getField(c, 'source', 'lead source', 'how did you hear', 'referred by', 'user submissions')
      const birthday     = getField(c, 'birthdate', 'birthday', 'dob', 'date of birth', 'birth date')
      const company      = getField(c, 'company', 'company name', 'organization', 'brokerage')
      const importantDates = getField(c, 'important dates', 'important date', 'key dates', 'anniversary')
      const notes = [
        company      ? `Company: ${company}` : '',
        importantDates ? `Important Dates: ${importantDates}` : '',
        getField(c, 'notes', 'note', 'comments', 'description', 'user submissions'),
      ].filter(Boolean).join('\n')

      const name = [firstName, lastName].filter(Boolean).join(' ') || (email ? email.split('@')[0] : '')

      // Parse birthday — handle formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY
      let birthdayParsed: string | null = null
      if (birthday) {
        const clean = birthday.trim()
        if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
          birthdayParsed = clean.substring(0, 10)
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(clean)) {
          const [m, d, y] = clean.split('/')
          birthdayParsed = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
        } else if (/^\d{1,2}-\d{1,2}-\d{4}/.test(clean)) {
          const [m, d, y] = clean.split('-')
          birthdayParsed = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
        }
      }

      return {
        name,
        email:       email.toLowerCase().trim(),
        phone:       phone || null,
        address:     address || null,
        category:    mapCategory(leadCategory),
        status:      mapStatus(leadStatus),
        temperature: 'Warm',
        source:      source || 'CSV Import',
        notes:       notes || null,
        birthday:    birthdayParsed,
        tags:        company ? company : null,
      }
    })
    .filter((r: any) => r.email && r.email.includes('@') && r.name)

  if (!rows.length) return NextResponse.json({ error: 'No valid contacts found. Make sure your file has Email and First Name/Last Name columns.' }, { status: 400 })

  // Split into new vs existing (dedup on email)
  const emails = rows.map((r: any) => r.email)
  const { data: existing } = await supabase.from('contacts').select('email').in('email', emails)
  const existingSet = new Set((existing || []).map((e: any) => e.email))

  const toInsert = rows.filter((r: any) => !existingSet.has(r.email))
  const toUpdate = rows.filter((r: any) =>  existingSet.has(r.email))

  let inserted = 0, updated = 0, failed = 0
  const BATCH = 100

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from('contacts').insert(toInsert.slice(i, i + BATCH))
    if (error) { failed += Math.min(BATCH, toInsert.length - i); console.error('Insert error:', error.message) }
    else inserted += Math.min(BATCH, toInsert.length - i)
  }

  for (const contact of toUpdate) {
    const { error } = await supabase.from('contacts')
      .update({
        phone:    contact.phone    || undefined,
        address:  contact.address  || undefined,
        notes:    contact.notes    || undefined,
        birthday: contact.birthday || undefined,
        tags:     contact.tags     || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('email', contact.email)
    if (error) failed++; else updated++
  }

  return NextResponse.json({
    success: true,
    inserted,
    updated,
    failed,
    duplicates: toUpdate.length,
    total: rows.length,
    skipped: contacts.length - rows.length,
  })
}
