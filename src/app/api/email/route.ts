import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { jwtVerify } from 'jose'

const resend = new Resend(process.env.RESEND_API_KEY!)
const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')

export async function POST(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { await jwtVerify(token, CRM_SECRET) } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  try {
    const { subject, body, recipients } = await req.json()
    if (!subject || !body || !recipients?.length) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const BATCH = 100
    let sent = 0
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH)
      const emails = batch.map((r: { name: string; email: string }) => ({
        from: `The Hooda Team <${process.env.RESEND_FROM_EMAIL}>`,
        to: r.email,
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px">${body.replace(/{{firstName}}/g, r.name.split(' ')[0]).replace(/{{fullName}}/g, r.name).replace(/\n/g,'<br/>')}</div><p style="font-size:11px;color:#999;margin-top:24px">Century 21 Red Star Realty Inc., 239 Queen St E Unit 27, Brampton ON<br/><a href="${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${r.email}">Unsubscribe</a></p>`
      }))
      await resend.batch.send(emails)
      sent += batch.length
      if (i + BATCH < recipients.length) await new Promise(r => setTimeout(r, 500))
    }
    return NextResponse.json({ success: true, sent })
  } catch (err) {
    console.error('Email error:', err)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}
