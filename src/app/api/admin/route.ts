import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

const CRM_SECRET = new TextEncoder().encode(process.env.CRM_JWT_SECRET || 'hooda-crm-jwt-secret-2026')

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (email !== process.env.CRM_ADMIN_EMAIL || password !== process.env.CRM_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const token = await new SignJWT({ email, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(CRM_SECRET)
    const response = NextResponse.json({ success: true })
    response.cookies.set('crm_token', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400, path: '/' })
    return response
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  try {
    if (token) { await jwtVerify(token, CRM_SECRET); return NextResponse.json({ authenticated: true }) }
  } catch {}
  return NextResponse.json({ authenticated: false })
}
