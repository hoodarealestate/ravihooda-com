// app/api/admin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { signCrmToken, verifyCrmToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (
      email !== process.env.CRM_ADMIN_EMAIL ||
      password !== process.env.CRM_ADMIN_PASSWORD
    ) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await signCrmToken(email)
    const response = NextResponse.json({ success: true })
    response.cookies.set('crm_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })
    return response
  } catch (err) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('crm_token')?.value
  const valid = token ? await verifyCrmToken(token) : false
  return NextResponse.json({ authenticated: valid })
}
