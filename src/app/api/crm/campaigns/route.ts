import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')
const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM   = `${process.env.RESEND_FROM_NAME || 'The Hooda Team'} <${process.env.RESEND_FROM_EMAIL || 'ravi@ravihooda.com'}>`
const SITE   = process.env.NEXT_PUBLIC_SITE_URL || 'https://ravihooda.com'

async function authCheck(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return false
  try { await jwtVerify(token, CRM_SECRET); return true } catch { return false }
}

export async function GET(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, body, segment, specificEmails } = await req.json()
  if (!subject || !body) return NextResponse.json({ error: 'Subject and body required' }, { status: 400 })

  // Get unsubscribed emails
  const { data: unsubs } = await supabase.from('unsubscribes').select('email')
  const unsubEmails = new Set((unsubs || []).map((u: any) => u.email.toLowerCase()))

  let recipients: Array<{name: string, email: string}> = []

  if (specificEmails && specificEmails.length > 0) {
    // Send to specific email addresses only
    const emailList = specificEmails.map((e: string) => e.toLowerCase().trim()).filter(Boolean)
    const { data: found } = await supabase
      .from('contacts')
      .select('name, email')
      .in('email', emailList)
    // For emails not in DB, still send with email as name
    const foundEmails = new Set((found || []).map((c: any) => c.email))
    const notInDB = emailList
      .filter((e: string) => !foundEmails.has(e))
      .map((e: string) => ({ name: e.split('@')[0], email: e }))
    recipients = [...(found || []), ...notInDB]
      .filter((c: any) => !unsubEmails.has(c.email.toLowerCase()))
  } else {
    // Segment-based send
    const STATUSES     = ['Lead','Client','Past Client','Prospect','VOW Lead','POS Lead']
    const CATEGORIES   = ['Buyer','Seller','Investor','Renter','Referral Partner']
    const TEMPERATURES = ['Hot','Warm','Cold']

    let query = supabase.from('contacts').select('name, email').neq('status', 'Unsubscribed')

    if (segment && segment !== 'all') {
      if (STATUSES.includes(segment))     query = query.eq('status', segment)
      else if (CATEGORIES.includes(segment)) query = query.eq('category', segment)
      else if (TEMPERATURES.includes(segment)) query = query.eq('temperature', segment)
    }

    const { data: contacts, error: cErr } = await query
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    recipients = (contacts || []).filter((c: any) =>
      c.email && c.email.includes('@') && !unsubEmails.has(c.email.toLowerCase())
    )
  }

  if (!recipients.length) {
    return NextResponse.json({ error: specificEmails ? 'No valid recipients found.' : `No contacts in segment "${segment}".` }, { status: 400 })
  }

  // Send in batches of 100
  const BATCH = 100
  let sent = 0, failed = 0

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    const emails = batch.map((r: any) => ({
      from: FROM,
      to:   [r.email],
      replyTo: process.env.RESEND_FROM_EMAIL || 'ravi@ravihooda.com',
      subject,
      html: buildEmailHtml(
        subject,
        body
          .replace(/\{\{firstName\}\}/g, (r.name || '').split(' ')[0] || 'there')
          .replace(/\{\{fullName\}\}/g,  r.name || ''),
        r.email
      )
    }))

    try {
      await resend.batch.send(emails)
      sent += batch.length
    } catch (e: any) {
      console.error('Resend batch error:', e?.message || e)
      // Try individual sends if batch fails
      for (const email of emails) {
        try {
          await resend.emails.send(email)
          sent++
        } catch {
          failed++
        }
      }
    }

    if (i + BATCH < recipients.length) await new Promise(r => setTimeout(r, 500))
  }

  // Save campaign record
  await supabase.from('campaigns').insert({
    subject,
    body,
    segment:         segment || 'all',
    recipient_count: sent,
    failed_count:    failed,
  })

  return NextResponse.json({ success: true, sent, failed, total: recipients.length })
}

function buildEmailHtml(subject: string, body: string, email: string): string {
  const unsubUrl = `${SITE}/api/crm/unsubscribe?email=${encodeURIComponent(email)}`

  // Render [IMG:base64] placeholders inline where they appear in the text
  // Split body on image placeholders and rebuild as HTML with images inline
  function renderBodyWithImages(rawBody: string): string {
    const parts = rawBody.split(/(\[IMG:[^\]]+\])/g)
    return parts.map(part => {
      if (part.startsWith('[IMG:') && part.endsWith(']')) {
        const base64 = part.slice(5, -1)
        return `</div><div style="padding:0 32px 16px;text-align:center"><img src="${base64}" style="max-width:100%;border-radius:8px;display:block;margin:0 auto" alt=""/></div><div style="padding:0 32px;color:#1A1F2E;line-height:1.75;font-size:.95rem;white-space:pre-wrap">`
      }
      return part
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }).join('')
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
  <div style="background:#1C3557;padding:24px 32px">
    <div style="color:#D4B97A;font-family:Georgia,serif;font-size:1.2rem;font-weight:700">The Hooda Team</div>
    <div style="color:rgba(255,255,255,.6);font-size:.75rem;margin-top:2px">Century 21 Red Star Realty Inc. · ravihooda.com</div>
  </div>
  <div style="padding:32px;color:#1A1F2E;line-height:1.75;font-size:.95rem;white-space:pre-wrap">${renderBodyWithImages(body)}</div>
  <div style="padding:20px 32px;background:#F8F6F2;border-top:1px solid #E2E4E8">
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
      <tr>
        <td style="padding-right:32px;vertical-align:top">
          <div style="font-size:.85rem;font-weight:700;color:#1A1F2E;white-space:nowrap">Ravi Hooda</div>
          <div style="font-size:.75rem;color:#6B7280;white-space:nowrap">Broker &nbsp;·&nbsp; 416-825-5032</div>
        </td>
        <td style="border-left:1px solid #E2E4E8;padding-left:32px;vertical-align:top">
          <div style="font-size:.85rem;font-weight:700;color:#1A1F2E;white-space:nowrap">Rashmi Hooda</div>
          <div style="font-size:.75rem;color:#6B7280;white-space:nowrap">Broker &nbsp;·&nbsp; 647-766-5040</div>
        </td>
      </tr>
    </table>
    <div style="font-size:.7rem;color:#9CA3AF;line-height:1.8">
      Century 21 Red Star Realty Inc., Brokerage &nbsp;·&nbsp; ravihooda.com<br/>
      <a href="mailto:ravi@ravihooda.com" style="color:#A8894A;text-decoration:none">ravi@ravihooda.com</a><br/>
      <a href="${unsubUrl}" style="color:#A8894A">Unsubscribe</a> from future emails.
    </div>
  </div>
</div>
</body></html>`
}
