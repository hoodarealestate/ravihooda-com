// api/crm/campaigns/route.ts
// GET: campaign history  POST: send campaign
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase'

const CRM_SECRET = new TextEncoder().encode(
  process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026'
)
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

  const { subject, body, segment } = await req.json()
  if (!subject || !body) return NextResponse.json({ error: 'Subject and body required' }, { status: 400 })

  // Get recipients — filter out unsubscribed
  const { data: unsubs } = await supabase.from('unsubscribes').select('email')
  const unsubEmails = new Set((unsubs || []).map((u: any) => u.email.toLowerCase()))

  let query = supabase.from('contacts').select('name, email')
  if (segment && segment !== 'all') query = query.eq('status', segment)

  const { data: contacts, error: cErr } = await query
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  const recipients = (contacts || []).filter((c: any) =>
    c.email && !unsubEmails.has(c.email.toLowerCase())
  )

  if (!recipients.length) {
    return NextResponse.json({ error: 'No recipients in this segment' }, { status: 400 })
  }

  // Send in batches of 100 (Resend batch limit)
  const BATCH = 100
  let sent = 0, failed = 0

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    const emails = batch.map((r: any) => ({
      from: FROM,
      to:   [r.email],
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
    } catch (e) {
      console.error('Resend batch error:', e)
      failed += batch.length
    }

    // Rate-limit pause between batches
    if (i + BATCH < recipients.length) {
      await new Promise(r => setTimeout(r, 500))
    }
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
  const unsubUrl = `${SITE}/unsubscribe?email=${encodeURIComponent(email)}`
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
  <div style="background:#1C3557;padding:24px 32px">
    <div style="color:#D4B97A;font-family:Georgia,serif;font-size:1.2rem;font-weight:700">The Hooda Team</div>
    <div style="color:rgba(255,255,255,.6);font-size:.75rem;margin-top:2px">Century 21 Red Star Realty Inc. · ravihooda.com</div>
  </div>
  <div style="padding:32px;color:#1A1F2E;line-height:1.75;font-size:.95rem;white-space:pre-wrap">${body}</div>
  <div style="padding:20px 32px;background:#F8F6F2;border-top:1px solid #E2E4E8">
    <div style="display:flex;gap:24px;margin-bottom:12px">
      <div>
        <div style="font-size:.82rem;font-weight:700;color:#1A1F2E">Ravi Hooda</div>
        <div style="font-size:.75rem;color:#6B7280">Broker · 416-825-5032</div>
      </div>
      <div>
        <div style="font-size:.82rem;font-weight:700;color:#1A1F2E">Rashmi Hooda</div>
        <div style="font-size:.75rem;color:#6B7280">Broker · 647-766-5040</div>
      </div>
    </div>
    <div style="font-size:.7rem;color:#9CA3AF;line-height:1.6">
      Century 21 Red Star Realty Inc., Brokerage · 239 Queen St E, Unit 27, Brampton ON<br/>
      hoodarealestate@gmail.com · ravihooda.com<br/>
      You received this because you are a client or contact of The Hooda Team.<br/>
      <a href="${unsubUrl}" style="color:#A8894A">Unsubscribe</a> from future emails.
    </div>
  </div>
</div>
</body></html>`
}
