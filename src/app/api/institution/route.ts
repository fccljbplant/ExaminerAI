import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/institution — current user's institution details
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.institutionId) return NextResponse.json({ institution: null })
  const institution = await db.institution.findUnique({
    where: { id: session.institutionId },
    include: {
      _count: { select: { users: true, courses: true, batches: true } }
    }
  })
  return NextResponse.json({ institution })
}
