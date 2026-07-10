import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { supabase } from '@/lib/supabase'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')

async function authCheck(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return false
  try { await jwtVerify(token, CRM_SECRET); return true } catch { return false }
}

export async function GET(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') || ''
  const status   = searchParams.get('status') || ''
  const category = searchParams.get('category') || ''
  const temp     = searchParams.get('temperature') || ''
  const sort     = searchParams.get('sort') || 'created_at'
  const dir      = searchParams.get('dir') || 'desc'
  const page     = parseInt(searchParams.get('page') || '1')
  const limit    = parseInt(searchParams.get('limit') || '20')
  const offset   = (page - 1) * limit

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .order(sort, { ascending: dir === 'asc' })
    .range(offset, offset + limit - 1)

  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,tags.ilike.%${search}%`)
  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (temp) query = query.eq('temperature', temp)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data, total: count, page, limit })
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { name, email, phone, status, category, temperature, source, notes, tags, birthday, address, referred_by } = body

  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  const { data: existing } = await supabase.from('contacts').select('id').eq('email', email.toLowerCase().trim()).single()
  if (existing) return NextResponse.json({ error: 'Contact with this email already exists', id: existing.id }, { status: 409 })

  const { data, error } = await supabase.from('contacts').insert({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || null,
    status: status || 'Lead',
    category: category || 'Prospect',
    temperature: temperature || 'Warm',
    source: source || 'Manual Entry',
    notes: notes?.trim() || null,
    tags: tags?.trim() || null,
    birthday: birthday || null,
    address: address?.trim() || null,
    referred_by: referred_by?.trim() || null,
    last_contacted: null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contact: data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data, error } = await supabase.from('contacts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contact: data })
}

export async function DELETE(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
