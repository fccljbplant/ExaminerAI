import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { setSession } from '@/lib/auth'

// POST /api/auth/login
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password } = body

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() }
  })

  // Demo-friendly: accept any password OR the default "demo123"
  if (!user || (password !== user.password && password !== 'demo123')) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (!user.isActive) {
    return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
  }

  await db.auditLog.create({
    data: { userId: user.id, action: 'LOGIN', entity: 'Auth', entityId: user.id, meta: 'Web login' }
  })

  const sessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isDemo: user.isDemo,
    institutionId: user.institutionId
  }
  await setSession(sessionUser)

  return NextResponse.json({ user: sessionUser })
}

export async function DELETE() {
  const { clearSession } = await import('@/lib/auth')
  await clearSession()
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const { getSession } = await import('@/lib/auth')
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null })
  return NextResponse.json({ user: session })
}
