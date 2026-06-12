// app/api/email/route.ts
// Bulk email sending via Resend — CASL/PIPEDA compliant
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { verifyCrmToken } from '@/lib/auth'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  // Verify CRM admin auth
  const token = req.cookies.get('crm_token')?.value
  if (!token || !(await verifyCrmToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { subject, body, recipients, senderName } = await req.json()

    if (!subject || !body || !recipients?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Resend supports batch sending — max 100 per call
    const BATCH_SIZE = 100
    let sent = 0
    let failed = 0

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE)

      const emails = batch.map((r: { name: string; email: string }) => ({
        from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
        to: r.email,
        subject,
        html: buildEmailHtml(
          subject,
          body
            .replace(/\{\{firstName\}\}/g, r.name.split(' ')[0])
            .replace(/\{\{fullName\}\}/g, r.name),
          r.email
        ),
      }))

      try {
        await resend.batch.send(emails)
        sent += batch.length
      } catch (batchErr) {
        console.error('Batch send error:', batchErr)
        failed += batch.length
      }

      // Small delay between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: recipients.length
    })
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 })
  }
}

function buildEmailHtml(subject: string, body: string, recipientEmail: string): string {
  const unsubUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
    <div style="background:#1C3557;padding:24px 32px">
      <div style="color:#D4B97A;font-family:Georgia,serif;font-size:1.3rem;font-weight:700">The Hooda Team</div>
      <div style="color:rgba(255,255,255,0.6);font-size:0.75rem;margin-top:2px">Century 21 Red Star Realty Inc. | ravihooda.com</div>
    </div>
    <div style="padding:32px;color:#1A1F2E;line-height:1.7;white-space:pre-wrap;font-size:0.95rem">${body}</div>
    <div style="padding:16px 32px;background:#f8f6f2;border-top:1px solid #E2E4E8">
      <div style="display:flex;gap:16px;margin-bottom:12px">
        <div>
          <div style="font-size:0.8rem;font-weight:700;color:#1A1F2E">Ravi Hooda</div>
          <div style="font-size:0.75rem;color:#4A5568">Broker — 416-825-5032</div>
        </div>
        <div>
          <div style="font-size:0.8rem;font-weight:700;color:#1A1F2E">Rashmi Hooda</div>
          <div style="font-size:0.75rem;color:#4A5568">Broker — 647-766-5040</div>
        </div>
      </div>
      <div style="font-size:0.68rem;color:#9CA3AF;line-height:1.6">
        Century 21 Red Star Realty Inc., Brokerage | 239 Queen St E, Unit 27, Brampton, ON L6W<br/>
        hoodarealestate@gmail.com | ravihooda.com | @prohomelist<br/><br/>
        You received this email because you are a client or contact of The Hooda Team.<br/>
        <a href="${unsubUrl}" style="color:#A8894A">Unsubscribe</a> from future emails (required by CASL).
      </div>
    </div>
  </div>
</body>
</html>`
}
