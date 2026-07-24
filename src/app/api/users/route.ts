import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// GET /api/users — list users (filtered by role if provided)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')

  const users = await db.user.findMany({
    where: {
      institutionId: session.institutionId!,
      ...(role ? { role } : {})
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isDemo: true,
      phone: true,
      bio: true,
      createdAt: true
    }
  })
  return NextResponse.json({ users })
}

// POST /api/users — create user (DEMO BLOCKED)
export async function POST(req: NextRequest) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('creating users')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { email, name, role, phone, bio } = body
  if (!email || !name || !role) {
    return NextResponse.json({ error: 'email, name, role required' }, { status: 400 })
  }
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      role,
      phone,
      bio,
      institutionId: session.institutionId!
    }
  })
  return NextResponse.json({ user })
}
