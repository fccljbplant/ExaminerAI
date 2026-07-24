import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// GET /api/assignments — list assignments
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const courseId = searchParams.get('courseId')

  const assignments = await db.assignment.findMany({
    where: courseId ? { courseId } : {},
    include: {
      course: true,
      _count: { select: { submissions: true } }
    },
    orderBy: { dueDate: 'asc' }
  })
  return NextResponse.json({ assignments })
}

// POST /api/assignments — create (DEMO BLOCKED)
export async function POST(req: NextRequest) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('creating assignments')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { courseId, title, description, dueDate, maxMarks } = body
  if (!courseId || !title) {
    return NextResponse.json({ error: 'courseId and title required' }, { status: 400 })
  }
  const assignment = await db.assignment.create({
    data: {
      courseId,
      title,
      description: description || '',
      dueDate: new Date(dueDate),
      maxMarks: maxMarks || 100
    }
  })
  return NextResponse.json({ assignment })
}
