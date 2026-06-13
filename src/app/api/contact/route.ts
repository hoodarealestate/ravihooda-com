import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, intent, message } = await req.json()
    if (!firstName || !email || !message) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    // Notify Ravi & Rashmi
    await resend.emails.send({
      from: `The Hooda Team <${process.env.RESEND_FROM_EMAIL}>`,
      to: ['hoodarealestate@gmail.com'],
      subject: `New Lead: ${firstName} ${lastName} — ${intent}`,
      html: `<p><strong>Name:</strong> ${firstName} ${lastName}<br/>
<strong>Email:</strong> ${email}<br/>
<strong>Phone:</strong> ${phone}<br/>
<strong>Intent:</strong> ${intent}<br/>
<strong>Message:</strong> ${message}</p>
<p><a href="mailto:${email}">Reply to ${firstName}</a></p>`
    })

    // Auto-reply to sender
    await resend.emails.send({
      from: `The Hooda Team <${process.env.RESEND_FROM_EMAIL}>`,
      to: [email],
      subject: 'Thank you for contacting The Hooda Team',
      html: `<p>Hi ${firstName},</p>
<p>Thank you for reaching out! We will be in touch shortly.</p>
<p>Ravi: 416-825-5032 | Rashmi: 647-766-5040</p>
<p style="font-size:11px;color:#999">Century 21 Red Star Realty Inc., 239 Queen St E Unit 27, Brampton ON.<br/>
<a href="${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}">Unsubscribe</a></p>`
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
