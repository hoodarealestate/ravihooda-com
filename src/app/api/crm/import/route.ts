import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { supabase } from '@/lib/supabase'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')

async function authCheck(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return false
  try { await jwtVerify(token, CRM_SECRET); return true } catch { return false }
}

// Smart column name detector
function detectField(headers: string[], ...candidates: string[]): number {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const c of candidates) {
    const idx = lower.findIndex(h => h.includes(c.toLowerCase()))
    if (idx >= 0) return idx
  }
  return -1
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { contacts, preview } = await req.json()

  if (!Array.isArray(contacts) || !contacts.length) return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
  if (contacts.length > 2000) return NextResponse.json({ error: 'Maximum 2000 contacts per import' }, { status: 400 })

  // If preview mode — just return detected mapping and stats
  if (preview) {
    const valid = contacts.filter((c: any) => c.email && c.email.includes('@')).length
    return NextResponse.json({ total: contacts.length, valid, invalid: contacts.length - valid, sample: contacts.slice(0, 3) })
  }

  // Normalize rows
  const rows = contacts
    .filter((c: any) => c.email && String(c.email).includes('@'))
    .map((c: any) => {
      const get = (...keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(c).find(key => key.toLowerCase().trim() === k.toLowerCase())
          if (found && c[found]) return String(c[found]).trim()
        }
        return null
      }
      return {
        name:        get('name','full name','fullname','contact name','client name') || get('email','e-mail')!.split('@')[0],
        email:       String(c.email || c.Email || c['E-mail'] || c['e-mail'] || '').toLowerCase().trim(),
        phone:       get('phone','mobile','cell','telephone','tel','phone number','mobile number'),
        status:      get('status','type','lead type') || 'Lead',
        category:    get('category','client type','buyer/seller') || 'Prospect',
        temperature: get('temperature','temp','priority','urgency') || 'Warm',
        source:      get('source','lead source','referred by','how did you hear') || 'CSV Import',
        notes:       get('notes','note','comment','comments','description'),
        tags:        get('tags','tag','keywords'),
        address:     get('address','street','location','property address'),
        birthday:    get('birthday','dob','date of birth'),
        referred_by: get('referred by','referral','referred','referrer'),
      }
    })

  if (!rows.length) return NextResponse.json({ error: 'No valid contacts with emails found' }, { status: 400 })

  // Check for duplicates in DB
  const emails = rows.map((r: any) => r.email)
  const { data: existing } = await supabase.from('contacts').select('email').in('email', emails)
  const existingEmails = new Set((existing || []).map((e: any) => e.email))

  const toInsert = rows.filter((r: any) => !existingEmails.has(r.email))
  const toUpdate = rows.filter((r: any) => existingEmails.has(r.email))

  let inserted = 0, updated = 0, failed = 0
  const BATCH = 100

  // Insert new contacts
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from('contacts').insert(toInsert.slice(i, i + BATCH))
    if (error) { failed += Math.min(BATCH, toInsert.length - i); console.error(error) }
    else inserted += Math.min(BATCH, toInsert.length - i)
  }

  // Update existing contacts (merge notes, keep existing status unless blank)
  for (const contact of toUpdate) {
    const { error } = await supabase.from('contacts')
      .update({ phone: contact.phone, notes: contact.notes, tags: contact.tags, updated_at: new Date().toISOString() })
      .eq('email', contact.email)
    if (error) failed++; else updated++
  }

  return NextResponse.json({ success: true, inserted, updated, failed, duplicates: toUpdate.length, total: rows.length, skipped: contacts.length - rows.length })
}
