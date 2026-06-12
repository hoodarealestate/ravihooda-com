// app/api/vow/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { signVowToken } from '@/lib/auth'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password } = await req.json()

    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const user = { name, email, phone, registeredAt: new Date().toISOString() }
    const token = await signVowToken(user)

    // Send welcome email to new registrant
    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: email,
      subject: 'Welcome to The Hooda Team — Your GTA Property Access is Ready',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1C3557;padding:24px;border-radius:8px 8px 0 0">
            <h1 style="color:#D4B97A;font-size:1.2rem;margin:0">The Hooda Team</h1>
            <p style="color:rgba(255,255,255,0.7);font-size:0.8rem;margin:4px 0 0">Century 21 Red Star Realty Inc.</p>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #eee">
            <h2 style="color:#1A1F2E">Welcome, ${name.split(' ')[0]}!</h2>
            <p style="color:#4A5568;line-height:1.7">
              Your free membership is active. You now have full access to:
            </p>
            <ul style="color:#4A5568;line-height:2">
              <li><strong>Sold prices</strong> across the GTA</li>
              <li><strong>Days on market</strong> for any listing</li>
              <li><strong>Price change history</strong></li>
              <li><strong>Full listing details</strong></li>
            </ul>
            <p style="color:#4A5568;line-height:1.7">
              Visit <a href="https://ravihooda.com" style="color:#1C3557">ravihooda.com</a> and sign in to access all GTA property data.
            </p>
            <p style="color:#4A5568">
              Questions? Call us anytime.<br/>
              <strong>Ravi Hooda:</strong> 416-825-5032<br/>
              <strong>Rashmi Hooda:</strong> 647-766-5040
            </p>
          </div>
          <div style="background:#f8f8f8;padding:16px;border-radius:0 0 8px 8px;font-size:0.72rem;color:#9CA3AF;line-height:1.6">
            Century 21 Red Star Realty Inc., 239 Queen St E Unit 27, Brampton ON L6W<br/>
            The information provided herein must only be used by consumers with a bona fide interest in real estate.<br/>
            <a href="https://ravihooda.com/unsubscribe?email=${email}" style="color:#A8894A">Unsubscribe</a>
          </div>
        </div>`,
    })

    // Notify Ravi of new VOW registration
    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: 'hoodarealestate@gmail.com',
      subject: `New VOW Registration: ${name}`,
      html: `
        <p><strong>New VOW registration on ravihooda.com:</strong></p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Time:</strong> ${new Date().toLocaleString('en-CA')}</li>
        </ul>
        <p>This lead has been automatically added to your CRM.</p>`,
    })

    const response = NextResponse.json({ success: true, user: { name, email, phone } })
    response.cookies.set('vow_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    })
    return response
  } catch (err) {
    console.error('VOW registration error:', err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
