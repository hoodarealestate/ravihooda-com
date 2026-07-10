import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY!)
const VOW_SECRET = new TextEncoder().encode(process.env.VOW_JWT_SECRET || 'hooda-vow-jwt-secret-2026')

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

    // Welcome email
    await resend.emails.send({
      from: `The Hooda Team <${process.env.RESEND_FROM_EMAIL}>`,
      to: email,
      subject: 'Welcome — Your GTA Property Access is Ready',
      html: `<p>Hi ${name.split(' ')[0]},</p><p>Your free VOW membership is active. You now have access to sold prices, days on market, and full listing history across the GTA.</p><p>Visit <a href="https://ravihooda.com">ravihooda.com</a> to start searching.</p><p>Ravi: 416-825-5032 | Rashmi: 647-766-5040</p><p style="font-size:11px;color:#999">Century 21 Red Star Realty Inc., 239 Queen St E Unit 27, Brampton ON. <a href="https://ravihooda.com/unsubscribe?email=${email}">Unsubscribe</a></p>`
    })

    // Notify Ravi
    await resend.emails.send({
      from: `The Hooda Team <${process.env.RESEND_FROM_EMAIL}>`,
      to: 'hoodarealestate@gmail.com',
      subject: `New VOW Registration: ${name}`,
      html: `<p><strong>Name:</strong> ${name}<br/><strong>Email:</strong> ${email}<br/><strong>Phone:</strong> ${phone}</p>`
    })

    // Auto-save VOW registrant to CRM
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
