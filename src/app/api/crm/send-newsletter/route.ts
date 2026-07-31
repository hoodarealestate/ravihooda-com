import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { sendBatch } from '@/lib/email'
import { supabase } from '@/lib/supabase'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://ravihooda.com'

async function authCheck(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return false
  try { await jwtVerify(token, CRM_SECRET); return true } catch { return false }
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, html, segment, specificEmails } = await req.json()
  if (!subject || !html) return NextResponse.json({ error: 'Subject and HTML required' }, { status: 400 })

  // Get unsubscribed list
  const { data: unsubs } = await supabase.from('unsubscribes').select('email')
  const unsubEmails = new Set((unsubs || []).map((u: any) => u.email.toLowerCase()))

  let recipients: Array<{ name: string; email: string }> = []

  if (specificEmails && specificEmails.length > 0) {
    const emailList = specificEmails.map((e: string) => e.toLowerCase().trim()).filter(Boolean)
    const { data: found } = await supabase.from('contacts').select('name, email').in('email', emailList)
    const foundEmails = new Set((found || []).map((c: any) => c.email))
    const notInDB = emailList
      .filter((e: string) => !foundEmails.has(e))
      .map((e: string) => ({ name: e.split('@')[0], email: e }))
    recipients = [...(found || []), ...notInDB].filter((c: any) => !unsubEmails.has(c.email.toLowerCase()))
  } else {
    const STATUSES   = ['Lead','Client','Past Client','Prospect','VOW Lead','POS Lead']
    const CATEGORIES = ['Buyer','Seller','Investor','Renter','Referral Partner']
    const TEMPS      = ['Hot','Warm','Cold']
    let query = supabase.from('contacts').select('name, email').neq('status', 'Unsubscribed')
    if (segment && segment !== 'all') {
      if (STATUSES.includes(segment))     query = query.eq('status', segment)
      else if (CATEGORIES.includes(segment)) query = query.eq('category', segment)
      else if (TEMPS.includes(segment))   query = query.eq('temperature', segment)
    }
    const { data: contacts, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    recipients = (contacts || []).filter((c: any) =>
      c.email && c.email.includes('@') && !unsubEmails.has(c.email.toLowerCase())
    )
  }

  if (!recipients.length) return NextResponse.json({ error: 'No recipients found.' }, { status: 400 })

  // Send via Brevo with per-contact personalisation
  const { sent, failed } = await sendBatch(recipients, (r) => {
    const firstName   = r.name.split(' ')[0] || 'there'
    const fullName    = r.name
    const unsubUrl    = `${SITE}/api/crm/unsubscribe?email=${encodeURIComponent(r.email)}`
    const personalisedSubject = subject
      .replace(/{{firstName}}/g, firstName)
      .replace(/{{fullName}}/g, fullName)
    const personalisedHtml = html
      .replace(/{{firstName}}/g, firstName)
      .replace(/{{fullName}}/g, fullName)
      .replace(/{{email}}/g, r.email)
      .replace(/https:\/\/ravihooda\.com\/api\/crm\/unsubscribe\?email={{email}}/g, unsubUrl)
      .replace(/{{unsubscribeUrl}}/g, unsubUrl)
    return { subject: personalisedSubject, html: personalisedHtml }
  })

  // Log campaign
  await supabase.from('campaigns').insert({
    subject, body: '[HTML Newsletter]',
    segment: segment || 'all',
    recipient_count: sent, failed_count: failed,
  })

  return NextResponse.json({ success: true, sent, failed, total: recipients.length })
}
