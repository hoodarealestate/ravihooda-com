// Brevo email sender — replaces Resend
// 300 emails/day free, 9,000/month free
// API docs: https://developers.brevo.com/

const BREVO_API_KEY = process.env.BREVO_API_KEY!
const FROM_EMAIL    = process.env.RESEND_FROM_EMAIL || 'ravi@ravihooda.com'
const FROM_NAME     = process.env.RESEND_FROM_NAME  || 'The Hooda Team'
const REPLY_TO      = FROM_EMAIL

interface EmailPayload {
  to:      string
  toName?: string
  subject: string
  html:    string
}

interface BatchResult {
  sent:   number
  failed: number
}

// Send a single email via Brevo API
export async function sendEmail({ to, toName, subject, html }: EmailPayload): Promise<boolean> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept':       'application/json',
        'api-key':      BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender:    { name: FROM_NAME, email: FROM_EMAIL },
        replyTo:   { email: REPLY_TO },
        to:        [{ email: to, name: toName || to.split('@')[0] }],
        subject,
        htmlContent: html,
      })
    })
    return res.ok
  } catch (e) {
    console.error('Brevo send error:', e)
    return false
  }
}

// Send to a batch of recipients with personalisation callback
// Brevo free tier: 300/day — we pace at 100/batch with 1s pause
export async function sendBatch(
  recipients: Array<{ email: string; name: string }>,
  getEmail: (r: { email: string; name: string }) => { subject: string; html: string }
): Promise<BatchResult> {
  let sent = 0, failed = 0
  const BATCH = 50 // Conservative batch size for free tier

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    await Promise.all(batch.map(async r => {
      const { subject, html } = getEmail(r)
      const ok = await sendEmail({ to: r.email, toName: r.name, subject, html })
      ok ? sent++ : failed++
    }))
    // Pace between batches to respect rate limits
    if (i + BATCH < recipients.length) {
      await new Promise(r => setTimeout(r, 1200))
    }
  }
  return { sent, failed }
}
