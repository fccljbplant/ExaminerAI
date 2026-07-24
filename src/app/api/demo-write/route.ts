import { NextRequest, NextResponse } from 'next/server'
import { getSession, isDemoMode } from '@/lib/auth'
import { demoRefusal } from '@/lib/demo-guard'

// POST /api/demo-write — generic catch-all for any demo-blocked action
// Returns the demo refusal message. Used by client-side demo interceptors.
export async function POST(req: NextRequest) {
  const { demo } = await isDemoMode()
  if (demo) {
    const body = await req.json().catch(() => ({}))
    const action = body?.action || 'this action'
    return demoRefusal(action)
  }
  return NextResponse.json({ ok: true, message: 'Not in demo mode' })
}
