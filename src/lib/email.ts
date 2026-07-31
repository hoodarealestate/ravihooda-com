// lib/email.ts — unified email sender using Brevo API
// Replaces Resend across all CRM and notification routes
// Brevo free tier: 300 emails/day, 9,000/month — no daily cap issues

const BREVO_API_KEY = process.env.BREVO_API_KEY!
const FROM_EMAIL    = process.env.RESEND_FROM_EMAIL || 'ravi@ravihooda.com'
const FROM_NAME     = process.env.RESEND_FROM_NAME  || 'The Hooda Team'
const REPLY_TO      = FROM_EMAIL

interface SendEmailParams {
  to: string | string[]
  toName?: string
  subject: string
  html: string
  replyTo?: string
}

interface BatchEmail {
  to: string
  toName?: string
  subject: string
  html: string
}

export async function sendEmail({ to, toName, subject, html, replyTo }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const recipients = Array.isArray(to) ? to : [to]

  const body = {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: recipients.map(email => ({ email, name: toName || email.split('@')[0] })),
    replyTo: { email: replyTo || REPLY_TO },
    subject,
    htmlContent: html,
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Brevo send error:', res.status, err)
      return { success: false, error: `Brevo ${res.status}: ${err.substring(0, 200)}` }
    }

    return { success: true }
  } catch (e: any) {
    console.error('Brevo fetch error:', e)
    return { success: false, error: e.message }
  }
}

// Batch send — Brevo doesn't have a native batch endpoint like Resend
// so we send individually but with a small delay to stay within rate limits
export async function sendBatch(emails: BatchEmail[], delayMs = 100): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0

  for (const email of emails) {
    const result = await sendEmail({
      to: email.to,
      toName: email.toName,
      subject: email.subject,
      html: email.html,
    })

    if (result.success) sent++
    else failed++

    // Small delay between sends to respect Brevo rate limits
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs))
  }

  return { sent, failed }
}
