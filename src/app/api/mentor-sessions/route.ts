import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/mentor-sessions — list mentor sessions (scoped by role)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveUserId = session.isDemo && session.viewingAsUserId
    ? session.viewingAsUserId
    : session.id

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // PSYCHOLOGICAL | EDUCATIONAL

  let where: any = {}
  if (session.role === 'MENTOR') {
    where = { mentorId: effectiveUserId, ...(type ? { type } : {}) }
  } else if (session.role === 'STUDENT') {
    where = { studentId: effectiveUserId, ...(type ? { type } : {}) }
  } else if (session.role === 'PRINCIPAL' || session.role === 'ADMIN' || session.role === 'DEVELOPER') {
    where = { ...(type ? { type } : {}) }
  }

  const sessions = await db.mentorSession.findMany({
    where,
    include: { mentor: true, student: true },
    orderBy: { date: 'desc' }
  })
  return NextResponse.json({ sessions })
}

// POST /api/mentor-sessions — create mentor session (DEMO BLOCKED)
export async function POST(req: NextRequest) {
  const { isDemoMode } = await import('@/lib/auth')
  const { demo } = await isDemoMode()
  if (demo) {
    const { demoRefusal } = await import('@/lib/demo-guard')
    return demoRefusal('logging mentor sessions')
  }
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { studentId, type, date, duration, goal, reality, options, will, mood, notes, followUp } = body
  if (!studentId || !type) {
    return NextResponse.json({ error: 'studentId and type required' }, { status: 400 })
  }
  const effectiveUserId = session.isDemo && session.viewingAsUserId
    ? session.viewingAsUserId
    : session.id
  const ms = await db.mentorSession.create({
    data: {
      mentorId: effectiveUserId,
      studentId,
      type,
      date: date ? new Date(date) : new Date(),
      duration: duration || 45,
      goal, reality, options, will,
      mood, notes, followUp
    }
  })
  return NextResponse.json({ session: ms })
}
