import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/audit — list audit logs
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only principal/admin/developer can see all logs
  if (!['PRINCIPAL', 'ADMIN', 'DEVELOPER'].includes(session.role)) {
    // others see only their own
    const logs = await db.auditLog.findMany({
      where: { userId: session.id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return NextResponse.json({ logs })
  }

  const logs = await db.auditLog.findMany({
    where: session.institutionId ? { user: { institutionId: session.institutionId } } : {},
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  return NextResponse.json({ logs })
}
