// api/crm/contacts/route.ts
// GET: list/search contacts  POST: create contact
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

export async function GET(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search  = searchParams.get('search') || ''
  const status  = searchParams.get('status') || ''
  const page    = parseInt(searchParams.get('page') || '1')
  const limit   = parseInt(searchParams.get('limit') || '20')
  const offset  = (page - 1) * limit

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contacts: data, total: count, page, limit })
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, email, phone, status, source, notes } = body

  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  // Check for existing email to avoid duplicates
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Contact with this email already exists', id: existing.id }, { status: 409 })
  }

  const { data, error } = await supabase.from('contacts').insert({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || null,
    status: status || 'Lead',
    source: source || 'Manual Entry',
    notes: notes?.trim() || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contact: data }, { status: 201 })
}
