import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// GET /api/timeline?courseId=...
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const courseId = searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  const events = await db.timelineEvent.findMany({
    where: { courseId },
    orderBy: { date: 'asc' }
  })
  return NextResponse.json({ events })
}

// POST /api/timeline — AI-generated timeline event (DEMO BLOCKED)
export async function POST(req: NextRequest) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('generating timeline events — AI generation is preview-only in demo')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { courseId, type, title, description, date } = body
  if (!courseId || !title) {
    return NextResponse.json({ error: 'courseId and title required' }, { status: 400 })
  }
  const event = await db.timelineEvent.create({
    data: {
      courseId,
      type: type || 'AI_GENERATED',
      title,
      description: description || '',
      date: date ? new Date(date) : new Date()
    }
  })
  return NextResponse.json({ event })
}
