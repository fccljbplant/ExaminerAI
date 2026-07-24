import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// GET /api/messages — list messages for current user (or view-as user)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveUserId = session.isDemo && session.viewingAsUserId
    ? session.viewingAsUserId
    : session.id

  const { searchParams } = new URL(req.url)
  const withUserId = searchParams.get('with')

  const where = withUserId
    ? { OR: [
        { fromId: effectiveUserId, toId: withUserId },
        { fromId: withUserId, toId: effectiveUserId }
      ]}
    : { OR: [{ fromId: effectiveUserId }, { toId: effectiveUserId }] }

  const messages = await db.message.findMany({
    where,
    include: { fromUser: true, toUser: true },
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json({ messages })
}

// POST /api/messages — send message (DEMO BLOCKED)
export async function POST(req: NextRequest) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('sending messages — but you CAN preview the compose form!')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { toId, content } = body
  if (!toId || !content) {
    return NextResponse.json({ error: 'toId and content required' }, { status: 400 })
  }
  const effectiveUserId = session.isDemo && session.viewingAsUserId
    ? session.viewingAsUserId
    : session.id
  const message = await db.message.create({
    data: { fromId: effectiveUserId, toId, content }
  })
  return NextResponse.json({ message })
}
