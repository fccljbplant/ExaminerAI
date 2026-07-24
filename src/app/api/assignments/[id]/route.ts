import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// POST /api/assignments/[id]/submit — submit assignment (DEMO BLOCKED)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('submitting assignments')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { content } = body
  const effectiveUserId = session.isDemo && session.viewingAsUserId
    ? session.viewingAsUserId
    : session.id
  const submission = await db.submission.create({
    data: {
      assignmentId: id,
      studentId: effectiveUserId,
      content: content || '',
      status: 'SUBMITTED'
    }
  })
  return NextResponse.json({ submission })
}
