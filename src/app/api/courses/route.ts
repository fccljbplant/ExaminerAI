import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// GET /api/courses — list all courses for institution
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courses = await db.course.findMany({
    where: { institutionId: session.institutionId! },
    include: {
      teacher: true,
      batches: { include: { _count: { select: { enrollments: true } } } },
      _count: { select: { enrollments: true, assessments: true, assignments: true } }
    },
    orderBy: { code: 'asc' }
  })
  return NextResponse.json({ courses })
}

// POST /api/courses — create course (DEMO BLOCKED)
export async function POST(req: NextRequest) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('creating courses')

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { code, title, description, outline, credits, level, semester, teacherId } = body

  if (!code || !title) {
    return NextResponse.json({ error: 'Code and title required' }, { status: 400 })
  }

  const course = await db.course.create({
    data: {
      code,
      title,
      description: description || '',
      outline: outline || '',
      credits: credits || 3,
      level: level || 'Undergraduate',
      semester: semester || 'Current',
      teacherId: teacherId || null,
      institutionId: session.institutionId!
    }
  })

  await db.auditLog.create({
    data: { userId: session.id, action: 'CREATE', entity: 'Course', entityId: course.id, meta: `Created ${code}` }
  })

  return NextResponse.json({ course })
}
