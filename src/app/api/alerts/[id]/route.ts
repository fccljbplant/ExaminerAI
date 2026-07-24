import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// PUT /api/alerts/[id] — respond to alert (DEMO BLOCKED)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { demo } = await isDemoMode()
  if (demo) return demoRefusal('responding to alerts')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { response, status } = body

  const alert = await db.alert.update({
    where: { id },
    data: {
      response,
      status: status || 'ACKNOWLEDGED',
      respondedAt: new Date()
    }
  })
  return NextResponse.json({ alert })
}
