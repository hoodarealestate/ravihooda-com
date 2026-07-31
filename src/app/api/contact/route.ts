import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, intent, message } = await req.json()
    if (!firstName || !email || !message) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://ravihooda.com'

    // Notify Ravi & Rashmi
    await sendEmail({
      to: 'hoodarealestate@gmail.com',
      subject: `New Lead: ${firstName} ${lastName} — ${intent || 'General'}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px">
        <h2 style="color:#1C3557">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Phone:</strong> ${phone || '—'}</p>
        <p><strong>Intent:</strong> ${intent || '—'}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p><a href="mailto:${email}" style="background:#1C3557;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Reply to ${firstName}</a></p>
      </div>`
    })

    // Auto-reply to sender
    await sendEmail({
      to: email,
      toName: firstName,
      subject: 'Thank you for contacting The Hooda Team',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px">
        <div style="background:#1C3557;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:#D4B97A;margin:0;font-family:Georgia,serif">The Hooda Team</h2>
          <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px">Century 21 Red Star Realty Inc.</p>
        </div>
        <div style="padding:24px;background:#fff;border:1px solid #eee;border-top:none">
          <p>Hi ${firstName},</p>
          <p>Thank you for reaching out to The Hooda Team! We have received your message and will be in touch shortly.</p>
          <p>In the meantime, feel free to call us directly:</p>
          <p><strong>Ravi Hooda:</strong> 416-825-5032<br/><strong>Rashmi Hooda:</strong> 647-766-5040</p>
          <p style="margin-top:24px">Warm regards,<br/><strong>Ravi & Rashmi Hooda</strong><br/>The Hooda Team</p>
        </div>
        <div style="padding:12px 24px;background:#F8F6F2;font-size:11px;color:#9CA3AF;border:1px solid #eee;border-top:none">
          Century 21 Red Star Realty Inc., Brokerage · ravihooda.com<br/>
          <a href="${SITE}/api/crm/unsubscribe?email=${encodeURIComponent(email)}" style="color:#A8894A">Unsubscribe</a>
        </div>
      </div>`
    })

    // Auto-save to CRM
    try {
      const existing = await supabase.from('contacts').select('id').eq('email', email.toLowerCase().trim()).single()
      if (!existing.data) {
        await supabase.from('contacts').insert({
          name: `${firstName} ${lastName}`.trim(),
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || null,
          status: 'Lead',
          source: `Contact Form — ${intent || 'General'}`,
          notes: message?.trim() || null,
        })
      }
    } catch (dbErr) {
      console.error('CRM save error (non-fatal):', dbErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
