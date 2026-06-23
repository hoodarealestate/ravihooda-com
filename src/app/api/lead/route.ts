import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

// Bell Canada SMS gateway — no Twilio needed
const SMS_GATEWAY = '4168255032@txt.bell.ca'
const RAVI_EMAIL  = 'hoodarealestate@gmail.com'

type LeadPayload = {
  name:     string
  email:    string
  phone?:   string
  type:     'inquiry' | 'pos' | 'price-drop' | 'home-value' | 'showing'
  property?: string   // address or MLS# or "Home Value at <address>"
  message?: string
  timeline?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as LeadPayload
    const { name, email, phone, type, property, message, timeline } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const typeLabel: Record<string, string> = {
      inquiry:     'Property Inquiry',
      pos:         'Power of Sale Alert',
      'price-drop':'Price Drop Alert',
      'home-value':'Home Value Request',
      showing:     'Showing Request',
    }
    const label = typeLabel[type] || type

    const subjectLine = property
      ? `New Lead [${label}]: ${name} — ${property}`
      : `New Lead [${label}]: ${name}`

    // Short SMS-friendly text (Bell gateway strips HTML)
    const smsText = [
      `NEW LEAD: ${label}`,
      `Name: ${name}`,
      phone ? `Phone: ${phone}` : null,
      `Email: ${email}`,
      property ? `Property: ${property}` : null,
      timeline ? `Timeline: ${timeline}` : null,
      message ? `Note: ${message.substring(0, 80)}` : null,
    ].filter(Boolean).join('\n')

    // Fire email + SMS in parallel; don't let one failure block the other
    const emailPromise = resend.emails.send({
      from: `The Hooda Team <${process.env.RESEND_FROM_EMAIL}>`,
      to:   [RAVI_EMAIL],
      subject: subjectLine,
      html: `
<table style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px">
  <tr><td style="padding:20px;background:#1C3557;color:#fff">
    <h2 style="margin:0;font-size:18px">🏠 New Lead — ${label}</h2>
  </td></tr>
  <tr><td style="padding:20px;border:1px solid #eee">
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    ${phone ? `<p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>` : ''}
    ${property ? `<p><strong>Property/Address:</strong> ${property}</p>` : ''}
    ${timeline ? `<p><strong>Timeline:</strong> ${timeline}</p>` : ''}
    ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
    <p style="font-size:12px;color:#999">Submitted via ravihooda.com · ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</p>
  </td></tr>
</table>`
    }).catch(err => { console.error('Lead email error:', err); return null })

    // Send SMS via Bell email-to-SMS gateway
    const smsPromise = resend.emails.send({
      from:    `The Hooda Team <${process.env.RESEND_FROM_EMAIL}>`,
      to:      [SMS_GATEWAY],
      subject: '',          // subject is prepended to body on Bell gateway — keep empty
      text:    smsText,
    }).catch(err => { console.error('Lead SMS error:', err); return null })

    // Auto-reply to lead
    const replyPromise = resend.emails.send({
      from:    `The Hooda Team <${process.env.RESEND_FROM_EMAIL}>`,
      to:      [email],
      subject: 'Thanks for reaching out — The Hooda Team',
      html: `
<table style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px">
  <tr><td style="padding:20px;background:#1C3557;color:#fff">
    <h2 style="margin:0;font-size:18px">The Hooda Team | Century 21 Red Star Realty</h2>
  </td></tr>
  <tr><td style="padding:24px;border:1px solid #eee">
    <p>Hi ${name},</p>
    <p>Thank you for reaching out! We've received your message and will get back to you shortly — usually within a few hours.</p>
    ${property ? `<p>You inquired about: <strong>${property}</strong></p>` : ''}
    <p>In the meantime, feel free to reach us directly:</p>
    <p><strong>Ravi Hooda:</strong> <a href="tel:4168255032">416-825-5032</a><br/>
    <strong>Rashmi Hooda:</strong> <a href="tel:6477665040">647-766-5040</a><br/>
    <strong>Email:</strong> <a href="mailto:hoodarealestate@gmail.com">hoodarealestate@gmail.com</a></p>
    <p>— Ravi &amp; Rashmi Hooda<br/>Brokers · Century 21 Red Star Realty Inc.</p>
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
    <p style="font-size:11px;color:#999">239 Queen St E Unit 27, Brampton, ON · <a href="${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#999">Unsubscribe</a></p>
  </td></tr>
</table>`
    }).catch(err => { console.error('Lead auto-reply error:', err); return null })

    await Promise.all([emailPromise, smsPromise, replyPromise])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Lead API error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send' }, { status: 500 })
  }
}
