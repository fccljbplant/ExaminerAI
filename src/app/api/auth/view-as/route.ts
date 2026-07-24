import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, setSession } from '@/lib/auth'

// POST /api/auth/view-as
// Demo developer can switch to view-as any user in their institution
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!session.isDemo) {
    return NextResponse.json({ error: 'Only demo account can use view-as' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, role } = body

  // Either userId OR role must be provided
  let targetUserId = userId
  if (!targetUserId && role) {
    // find first user with that role in this institution
    const target = await db.user.findFirst({
      where: { role, institutionId: session.institutionId! },
      orderBy: { createdAt: 'asc' }
    })
    if (!target) return NextResponse.json({ error: `No user found for role ${role}` }, { status: 404 })
    targetUserId = target.id
  }
  if (!targetUserId) {
    return NextResponse.json({ error: 'Provide userId or role' }, { status: 400 })
  }

  const target = await db.user.findUnique({ where: { id: targetUserId } })
  if (!target) {
    return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
  }

  // Update the session: keep demo flag, but track who we're viewing-as
  await setSession({
    ...session,
    viewingAsUserId: target.id,
    viewingAsRole: target.role,
    // Override role for routing purposes, but isDemo stays true
    role: target.role
  })

  return NextResponse.json({
    ok: true,
    viewingAs: { id: target.id, name: target.name, role: target.role, email: target.email }
  })
}

// DELETE /api/auth/view-as — return to demo developer view
export async function DELETE() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!session.isDemo) {
    return NextResponse.json({ error: 'Only demo account can use view-as' }, { status: 403 })
  }
  // Restore the demo developer role
  const demo = await db.user.findUnique({ where: { id: session.id } })
  await setSession({
    id: session.id,
    email: session.email,
    name: session.name,
    role: demo?.role || 'DEVELOPER',
    isDemo: true,
    institutionId: session.institutionId
  })
  return NextResponse.json({ ok: true })
}
