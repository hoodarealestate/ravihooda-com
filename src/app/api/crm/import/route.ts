// api/crm/import/route.ts
// POST: bulk import contacts from CSV data (up to 2000 rows)
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { supabase } from '@/lib/supabase'

const CRM_SECRET = new TextEncoder().encode(
  process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026'
)

async function authCheck(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return false
  try { await jwtVerify(token, CRM_SECRET); return true } catch { return false }
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contacts } = await req.json()

  if (!Array.isArray(contacts) || !contacts.length) {
    return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
  }
  if (contacts.length > 2000) {
    return NextResponse.json({ error: 'Maximum 2000 contacts per import' }, { status: 400 })
  }

  // Normalize and validate
  const rows = contacts
    .filter(c => c.email && c.email.includes('@'))
    .map(c => ({
      name:   (c.name  || c.Name  || c.fullName || c.full_name || '').trim() || c.email.split('@')[0],
      email:  (c.email || c.Email || '').toLowerCase().trim(),
      phone:  (c.phone || c.Phone || c.mobile || c.Mobile || '').trim() || null,
      status: (c.status || c.Status || c.type || c.Type || 'Lead').trim(),
      source: 'CSV Import',
      notes:  (c.notes || c.Notes || c.comment || c.Comment || '').trim() || null,
    }))

  if (!rows.length) {
    return NextResponse.json({ error: 'No valid contacts with emails found' }, { status: 400 })
  }

  // Upsert on email (update existing, insert new) in batches of 100
  let inserted = 0, updated = 0, failed = 0
  const BATCH = 100

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('contacts')
      .upsert(batch, {
        onConflict: 'email',
        ignoreDuplicates: false  // update existing contacts
      })
      .select()

    if (error) {
      failed += batch.length
      console.error('Import batch error:', error)
    } else {
      inserted += (data || []).length
    }
  }

  return NextResponse.json({
    success: true,
    imported: inserted,
    failed,
    total: rows.length,
    skipped: contacts.length - rows.length  // rows without valid email
  })
}
