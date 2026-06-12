// app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, intent, message } = await req.json()

    if (!firstName || !email || !message) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    // Send to Ravi & Rashmi
    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: 'hoodarealestate@gmail.com',
      replyTo: email,
      subject: `New Website Lead: ${firstName} ${lastName} — ${intent}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px">
          <h2 style="color:#1C3557">New Contact Form Submission</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;font-weight:bold;color:#4A5568;width:120px">Name</td><td style="padding:8px">${firstName} ${lastName}</td></tr>
            <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#4A5568">Email</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#4A5568">Phone</td><td style="padding:8px"><a href="tel:${phone}">${phone}</a></td></tr>
            <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#4A5568">Intent</td><td style="padding:8px">${intent}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#4A5568">Message</td><td style="padding:8px">${message}</td></tr>
            <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#4A5568">Time</td><td style="padding:8px">${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })} EST</td></tr>
          </table>
        </div>`,
    })

    // Auto-reply to sender
    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: email,
      subject: 'Thank you for contacting The Hooda Team',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1C3557;padding:24px;border-radius:8px 8px 0 0">
            <h1 style="color:#D4B97A;font-size:1.2rem;margin:0">The Hooda Team</h1>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #eee">
            <h2 style="color:#1A1F2E">Thank you, ${firstName}!</h2>
            <p style="color:#4A5568;line-height:1.7">
              We've received your message and will be in touch shortly — typically within a few hours during business hours.
            </p>
            <p style="color:#4A5568;line-height:1.7">
              If you need to reach us sooner:<br/>
              <strong>Ravi Hooda:</strong> <a href="tel:4168255032" style="color:#1C3557">416-825-5032</a><br/>
              <strong>Rashmi Hooda:</strong> <a href="tel:6477665040" style="color:#1C3557">647-766-5040</a>
            </p>
          </div>
          <div style="background:#f8f6f2;padding:16px;border-radius:0 0 8px 8px;font-size:0.72rem;color:#9CA3AF">
            Century 21 Red Star Realty Inc., 239 Queen St E Unit 27, Brampton ON L6W<br/>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${email}" style="color:#A8894A">Unsubscribe</a>
          </div>
        </div>`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
