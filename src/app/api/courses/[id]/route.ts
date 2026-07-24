import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// GET /api/courses/[id] — full course detail with outline, timeline, assessments, batches
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const course = await db.course.findUnique({
    where: { id },
    include: {
      teacher: true,
      institution: true,
      batches: { include: { teachers: true, _count: { select: { enrollments: true } } } },
      assessments: { orderBy: { date: 'asc' } },
      assignments: { orderBy: { dueDate: 'asc' } },
      timelineEvents: { orderBy: { date: 'asc' } },
      sessions: { orderBy: { date: 'asc' }, take: 20 },
      _count: { select: { enrollments: true } }
    }
  })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ course })
}

// PUT /api/courses/[id] — update course (DEMO BLOCKED)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('editing courses')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const course = await db.course.update({ where: { id }, data: body })
  return NextResponse.json({ course })
}

// DELETE /api/courses/[id] — DEMO BLOCKED
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('deleting courses')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.course.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
