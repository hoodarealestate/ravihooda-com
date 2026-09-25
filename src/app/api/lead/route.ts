import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

const SMS_GATEWAY   = '4168255032@txt.bell.ca'
const RAVI_EMAIL    = 'hoodarealestate@gmail.com'
const REALTOR_EMAIL = 'realtorhooda@gmail.com'
const SITE          = process.env.NEXT_PUBLIC_SITE_URL || 'https://ravihooda.com'

type LeadPayload = {
  name:      string
  email:     string
  phone?:    string
  type:      'inquiry' | 'pos' | 'price-drop' | 'home-value' | 'showing' | 'new-homes'
  property?: string
  message?:  string
  timeline?: string
  source?:   string
  // new-homes campaign fields
  budget?:         string
  areas?:          string[]
  homeType?:       string
  firstTimeBuyer?: string
  utm_source?:     string
  utm_medium?:     string
  utm_campaign?:   string
  utm_content?:    string
  utm_term?:       string
  referrer?:       string
}

const LABEL: Record<string, string> = {
  inquiry:     'General Inquiry',
  pos:         'Power of Sale',
  'price-drop':'Price Drop',
  'home-value':'Home Evaluation',
  showing:     'Showing Request',
  'new-homes': 'New Builder Home Lead',
}

export async function POST(req: NextRequest) {
  try {
    const body: LeadPayload = await req.json()
    const {
      name, email, phone, type, property, message, timeline, source,
      budget, areas, homeType, firstTimeBuyer,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
    } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
    }

    const label = LABEL[type] || type
    const isNewHomes = type === 'new-homes'
    const subjectLine = isNewHomes
      ? `NEW BUILDER HOME LEAD – ${name} – ${budget || 'Budget not specified'}`
      : property
        ? `New Lead [${label}]: ${name} — ${property}`
        : `New Lead [${label}]: ${name}`

    const smsText = [
      `NEW LEAD: ${label}`,
      `Name: ${name}`,
      phone ? `Phone: ${phone}` : null,
      `Email: ${email}`,
      property ? `Property: ${property}` : null,
      isNewHomes && budget ? `Budget: ${budget}` : null,
      isNewHomes && areas && areas.length ? `Areas: ${areas.join(', ')}` : null,
      timeline ? `Timeline: ${timeline}` : null,
      message && !isNewHomes ? `Note: ${message.substring(0, 80)}` : null,
    ].filter(Boolean).join('\n')

    const notificationHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px">
  <div style="background:#1C3557;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="color:#D4B97A;margin:0">New Lead — ${label}</h2>
  </div>
  <div style="border:1px solid #eee;border-top:none;padding:20px">
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    <p><strong>Phone:</strong> ${phone || '—'}</p>
    ${property ? `<p><strong>Property:</strong> ${property}</p>` : ''}
    ${isNewHomes ? `
    <p><strong>Budget:</strong> ${budget || '—'}</p>
    <p><strong>Preferred Areas:</strong> ${areas && areas.length ? areas.join(', ') : '—'}</p>
    <p><strong>Home Type:</strong> ${homeType || '—'}</p>
    <p><strong>First-Time Buyer:</strong> ${firstTimeBuyer || '—'}</p>
    <p><strong>Buying Timeline:</strong> ${timeline || '—'}</p>
    <p><strong>Date/Time Submitted:</strong> ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</p>
    <p><strong>Landing Page Source:</strong> ${source || 'new-homes'}</p>
    <p><strong>UTM Source:</strong> ${utm_source || '—'} &nbsp; <strong>Medium:</strong> ${utm_medium || '—'} &nbsp; <strong>Campaign:</strong> ${utm_campaign || '—'}</p>
    <p><strong>UTM Content:</strong> ${utm_content || '—'} &nbsp; <strong>Term:</strong> ${utm_term || '—'}</p>
    <p><strong>Referring URL:</strong> ${referrer || '—'}</p>
    ` : `
    ${timeline ? `<p><strong>Timeline:</strong> ${timeline}</p>` : ''}
    `}
    ${message ? `<p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>` : ''}
    <p style="margin-top:16px">
      <a href="mailto:${email}" style="background:#1C3557;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Reply to ${name}</a>
    </p>
  </div>
</div>`

    const autoReplyHtml = isNewHomes ? `
<div style="font-family:Arial,sans-serif;max-width:600px">
  <div style="background:#1C3557;padding:20px">
    <h2 style="color:#D4B97A;margin:0;font-family:Georgia,serif">The Hooda Team</h2>
    <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px">Century 21 Red Star Realty Inc.</p>
  </div>
  <div style="padding:24px;border:1px solid #eee">
    <p>Hi ${name.split(' ')[0]},</p>
    <p>Thank you for requesting our current New Builder Home Opportunity List.</p>
    <p>We're reviewing opportunities based on your budget, preferred locations and buying timeline.</p>
    <p>If you'd like to speak with us immediately, simply reply to this email or call/text 416-825-5032.</p>
    <p>Ravi Hooda<br/>Broker, ACP, B.Com, MBA<br/>Century 21 Red Star Realty Inc., Brokerage</p>
  </div>
  <div style="padding:12px 24px;background:#F8F6F2;font-size:11px;color:#9CA3AF">
    Century 21 Red Star Realty Inc., Brokerage · ravihooda.com<br/>
    <a href="${SITE}/api/crm/unsubscribe?email=${encodeURIComponent(email)}" style="color:#A8894A">Unsubscribe</a>
  </div>
</div>` : `
<div style="font-family:Arial,sans-serif;max-width:600px">
  <div style="background:#1C3557;padding:20px">
    <h2 style="color:#D4B97A;margin:0;font-family:Georgia,serif">The Hooda Team</h2>
    <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px">Century 21 Red Star Realty Inc.</p>
  </div>
  <div style="padding:24px;border:1px solid #eee">
    <p>Hi ${name.split(' ')[0]},</p>
    <p>Thank you for reaching out! We have received your inquiry and will be in touch very shortly.</p>
    <p><strong>Ravi Hooda:</strong> 416-825-5032<br/><strong>Rashmi Hooda:</strong> 647-766-5040</p>
    <p>Warm regards,<br/><strong>Ravi & Rashmi Hooda</strong><br/>The Hooda Team</p>
  </div>
  <div style="padding:12px 24px;background:#F8F6F2;font-size:11px;color:#9CA3AF">
    Century 21 Red Star Realty Inc., Brokerage · ravihooda.com<br/>
    <a href="${SITE}/api/crm/unsubscribe?email=${encodeURIComponent(email)}" style="color:#A8894A">Unsubscribe</a>
  </div>
</div>`

    const autoReplySubject = isNewHomes ? 'Your New Builder Home Request' : 'Thank you for contacting The Hooda Team'

    // Fire all notifications in parallel.
    // New-homes leads go to BOTH Ravi's inboxes; everything else keeps the existing single-recipient behavior.
    const notifyTargets = isNewHomes ? [RAVI_EMAIL, REALTOR_EMAIL] : [RAVI_EMAIL]

    await Promise.allSettled([
      ...notifyTargets.map(to => sendEmail({ to, subject: subjectLine, html: notificationHtml })),
      sendEmail({ to: SMS_GATEWAY, subject: smsText, html: smsText }),
      sendEmail({ to: email, toName: name, subject: autoReplySubject, html: autoReplyHtml }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Lead route error:', err)
    return NextResponse.json({ error: 'Failed to process lead' }, { status: 500 })
  }
}
