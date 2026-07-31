import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { SignJWT } from 'jose'
import { supabase } from '@/lib/supabase'

const VOW_SECRET = new TextEncoder().encode(process.env.VOW_JWT_SECRET || 'hooda-vow-jwt-secret-2026')
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://ravihooda.com'

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password } = await req.json()
    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }

    const token = await new SignJWT({ name, email, phone, registeredAt: new Date().toISOString() })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('365d')
      .sign(VOW_SECRET)

    // Welcome email to registrant
    await sendEmail({
      to: email,
      toName: name,
      subject: 'Welcome — Your GTA Property Access is Ready',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px">
        <div style="background:#1C3557;padding:20px">
          <h2 style="color:#D4B97A;margin:0;font-family:Georgia,serif">The Hooda Team</h2>
        </div>
        <div style="padding:24px;border:1px solid #eee">
          <p>Hi ${name.split(' ')[0]},</p>
          <p>Your free VOW membership is now active! You now have full access to sold prices, days on market, and complete listing history across the GTA.</p>
          <p><a href="${SITE}" style="background:#1C3557;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Start Searching →</a></p>
          <p>Ravi: 416-825-5032 | Rashmi: 647-766-5040</p>
        </div>
        <div style="padding:12px 24px;background:#F8F6F2;font-size:11px;color:#9CA3AF">
          Century 21 Red Star Realty Inc., Brokerage · ravihooda.com<br/>
          <a href="${SITE}/api/crm/unsubscribe?email=${encodeURIComponent(email)}" style="color:#A8894A">Unsubscribe</a>
        </div>
      </div>`
    })

    // Notify Ravi
    await sendEmail({
      to: 'hoodarealestate@gmail.com',
      subject: `New VOW Registration: ${name}`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px">
        <h3>New VOW Member</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Phone:</strong> ${phone}</p>
      </div>`
    })

    // Auto-save to CRM
    try {
      const existing = await supabase.from('contacts').select('id').eq('email', email.toLowerCase().trim()).single()
      if (!existing.data) {
        await supabase.from('contacts').insert({
          name:   name.trim(),
          email:  email.toLowerCase().trim(),
          phone:  phone?.trim() || null,
          status: 'VOW Lead',
          source: 'VOW Registration',
          notes:  'Registered for VOW access on ravihooda.com',
        })
      } else {
        await supabase.from('contacts').update({ status: 'VOW Lead', source: 'VOW Registration' }).eq('id', existing.data.id)
      }
    } catch (dbErr) {
      console.error('CRM VOW save (non-fatal):', dbErr)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('vow_token', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 31536000, path: '/' })
    return response
  } catch (err) {
    console.error('VOW error:', err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
