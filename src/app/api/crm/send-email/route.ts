import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { Resend } from 'resend'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')
const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM   = `${process.env.RESEND_FROM_NAME || 'The Hooda Team'} <${process.env.RESEND_FROM_EMAIL || 'ravi@ravihooda.com'}>`
const SITE   = process.env.NEXT_PUBLIC_SITE_URL || 'https://ravihooda.com'

async function authCheck(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return false
  try { await jwtVerify(token, CRM_SECRET); return true } catch { return false }
}

export async function POST(req: NextRequest) {
  if (!await authCheck(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, toName, subject, body } = await req.json()
  if (!to || !subject || !body) return NextResponse.json({ error: 'to, subject and body are required' }, { status: 400 })

  const firstName = (toName || '').split(' ')[0] || 'there'
  const unsubUrl  = `${SITE}/api/crm/unsubscribe?email=${encodeURIComponent(to)}`

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
  <div style="background:#1C3557;padding:24px 32px">
    <div style="color:#D4B97A;font-family:Georgia,serif;font-size:1.2rem;font-weight:700">The Hooda Team</div>
    <div style="color:rgba(255,255,255,.6);font-size:.75rem;margin-top:2px">Century 21 Red Star Realty Inc. · ravihooda.com</div>
  </div>
  <div style="padding:32px;color:#1A1F2E;line-height:1.75;font-size:.95rem;white-space:pre-wrap">${body
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{fullName\}\}/g, toName || firstName)
  }</div>
  <div style="padding:20px 32px;background:#F8F6F2;border-top:1px solid #E2E4E8">
    <div style="display:flex;gap:24px;margin-bottom:12px">
      <div><div style="font-size:.82rem;font-weight:700;color:#1A1F2E">Ravi Hooda</div><div style="font-size:.75rem;color:#6B7280">Broker · 416-825-5032</div></div>
      <div><div style="font-size:.82rem;font-weight:700;color:#1A1F2E">Rashmi Hooda</div><div style="font-size:.75rem;color:#6B7280">Broker · 647-766-5040</div></div>
    </div>
    <div style="font-size:.7rem;color:#9CA3AF;line-height:1.6">
      Century 21 Red Star Realty Inc. · 239 Queen St E, Unit 27, Brampton ON<br/>
      hoodarealestate@gmail.com · ravihooda.com<br/>
      <a href="${unsubUrl}" style="color:#A8894A">Unsubscribe</a> from future emails.
    </div>
  </div>
</div>
</body></html>`

  try {
    const result = await resend.emails.send({
      from: FROM,
      to:   [to],
      subject,
      html,
    })
    return NextResponse.json({ success: true, id: result.data?.id })
  } catch (err: any) {
    console.error('Single email error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send' }, { status: 500 })
  }
}
