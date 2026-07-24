import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// GET /api/alerts — list alerts (scoped by role)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveUserId = session.isDemo && session.viewingAsUserId
    ? session.viewingAsUserId
    : session.id

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') // 'sent' | 'received' | 'all'

  let where: any = {}
  if (session.role === 'TEACHER') {
    where = scope === 'received' ? { toUserId: effectiveUserId } : { fromUserId: effectiveUserId }
  } else if (session.role === 'COUNSELOR') {
    where = { toUserId: effectiveUserId }
  } else if (session.role === 'PRINCIPAL' || session.role === 'ADMIN' || session.role === 'DEVELOPER') {
    where = scope === 'received' ? {} : {}
  } else {
    // student
    where = { studentId: effectiveUserId }
  }

  const alerts = await db.alert.findMany({
    where,
    include: {
      student: true,
      fromUser: true,
      toUser: true,
      course: true
    },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json({ alerts })
}

// POST /api/alerts — create alert (DEMO BLOCKED)
export async function POST(req: NextRequest) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('raising alerts')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { type, severity, message, courseId, studentId, toUserId } = body
  if (!type || !message || !toUserId) {
    return NextResponse.json({ error: 'type, message, toUserId required' }, { status: 400 })
  }
  const alert = await db.alert.create({
    data: {
      type,
      severity: severity || 'MEDIUM',
      message,
      courseId,
      studentId,
      fromUserId: session.id,
      toUserId
    }
  })
  return NextResponse.json({ alert })
}
