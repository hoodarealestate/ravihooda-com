// api/crm/unsubscribe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const email = new URL(req.url).searchParams.get('email')
  if (!email) return new NextResponse(unsubHtml('', false, 'Missing email address.'), { headers: { 'Content-Type': 'text/html' } })
  return new NextResponse(unsubHtml(email, false, ''), { headers: { 'Content-Type': 'text/html' } })
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  await supabase.from('unsubscribes').upsert({ email: email.toLowerCase().trim() }, { onConflict: 'email', ignoreDuplicates: true })
  await supabase.from('contacts').update({ status: 'Unsubscribed' }).eq('email', email.toLowerCase().trim())

  return NextResponse.json({ success: true })
}

function unsubHtml(email: string, done: boolean, err: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Unsubscribe · The Hooda Team</title>
<style>body{font-family:Arial,sans-serif;background:#F5F3EF;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border-radius:12px;padding:40px;max-width:420px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
h2{color:#1C3557;margin-bottom:8px}p{color:#6B7280;line-height:1.6}
button{background:#1C3557;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:.95rem;font-weight:600;cursor:pointer;margin-top:16px}
button:hover{background:#A8894A}a{color:#1C3557;text-decoration:none;display:block;margin-top:12px;font-size:.85rem}</style>
</head><body><div class="card">
<div style="font-family:Georgia,serif;font-size:1.1rem;font-weight:700;color:#D4B97A;margin-bottom:16px">The Hooda Team</div>
${err ? `<p style="color:#dc2626">${err}</p>` : done ? `<h2>✅ Unsubscribed</h2><p>You have been removed from our mailing list. You will not receive any further emails from The Hooda Team.</p><a href="https://ravihooda.com">← Back to ravihooda.com</a>`
: `<h2>Unsubscribe</h2><p>Click below to remove <strong>${email}</strong> from The Hooda Team's mailing list.</p>
<button onclick="doUnsub()">Confirm Unsubscribe</button>
<a href="https://ravihooda.com">← Back to ravihooda.com</a>
<script>async function doUnsub(){const r=await fetch('/api/crm/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'${email}'})});if(r.ok){document.querySelector('.card').innerHTML='<h2>✅ Unsubscribed</h2><p>You have been removed from our list.</p><a href="https://ravihooda.com">← Back</a>';}}</script>`}
</div></body></html>`
}
