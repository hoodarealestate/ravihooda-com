import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { sendEmail } from '@/lib/brevo'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://ravihooda.com'

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
  const fullName  = toName || firstName
  const unsubUrl  = `${SITE}/api/crm/unsubscribe?email=${encodeURIComponent(to)}`

  const personalisedSubject = subject.replace(/{{firstName}}/g, firstName).replace(/{{fullName}}/g, fullName)
  const personalisedBody    = body.replace(/{{firstName}}/g, firstName).replace(/{{fullName}}/g, fullName)

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
  <div style="background:#1C3557;padding:24px 32px">
    <div style="color:#D4B97A;font-family:Georgia,serif;font-size:1.2rem;font-weight:700">The Hooda Team</div>
    <div style="color:rgba(255,255,255,.6);font-size:.75rem;margin-top:2px">Century 21 Red Star Realty Inc. · ravihooda.com</div>
  </div>
  <div style="padding:32px;color:#1A1F2E;line-height:1.75;font-size:.95rem;white-space:pre-wrap">${personalisedBody}</div>
  <div style="padding:20px 32px;background:#F8F6F2;border-top:1px solid #E2E4E8">
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
      <tr>
        <td style="padding-right:32px;vertical-align:top">
          <div style="font-size:.85rem;font-weight:700;color:#1A1F2E;white-space:nowrap">Ravi Hooda</div>
          <div style="font-size:.75rem;color:#6B7280;white-space:nowrap">Broker · 416-825-5032</div>
        </td>
        <td style="border-left:1px solid #E2E4E8;padding-left:32px;vertical-align:top">
          <div style="font-size:.85rem;font-weight:700;color:#1A1F2E;white-space:nowrap">Rashmi Hooda</div>
          <div style="font-size:.75rem;color:#6B7280;white-space:nowrap">Broker · 647-766-5040</div>
        </td>
      </tr>
    </table>
    <div style="font-size:.7rem;color:#9CA3AF;line-height:1.8">
      Century 21 Red Star Realty Inc., Brokerage · ravihooda.com<br/>
      <a href="mailto:ravi@ravihooda.com" style="color:#A8894A;text-decoration:none">ravi@ravihooda.com</a><br/>
      <a href="${unsubUrl}" style="color:#A8894A">Unsubscribe</a> from future emails.
    </div>
  </div>
</div>
</body></html>`

  const ok = await sendEmail({ to, toName, subject: personalisedSubject, html })
  if (ok) return NextResponse.json({ success: true })
  return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
}
