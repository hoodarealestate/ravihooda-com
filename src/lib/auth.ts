// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'

const VOW_SECRET  = new TextEncoder().encode(process.env.VOW_JWT_SECRET!)
const CRM_SECRET  = new TextEncoder().encode(process.env.CRM_JWT_SECRET!)

export interface VowUser {
  name: string
  email: string
  phone: string
  registeredAt: string
}

// VOW token — issued when visitor registers on website
export async function signVowToken(user: VowUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(VOW_SECRET)
}

export async function verifyVowToken(token: string): Promise<VowUser | null> {
  try {
    const { payload } = await jwtVerify(token, VOW_SECRET)
    return payload as unknown as VowUser
  } catch {
    return null
  }
}

// CRM admin token
export async function signCrmToken(email: string): Promise<string> {
  return await new SignJWT({ email, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(CRM_SECRET)
}

export async function verifyCrmToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, CRM_SECRET)
    return true
  } catch {
    return false
  }
}
