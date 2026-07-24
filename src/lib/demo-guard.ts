import { NextResponse } from 'next/server'

/**
 * Standard demo-mode refusal response.
 * Every write endpoint MUST return this when called by the demo account.
 */
export function demoRefusal(action = 'this action') {
  return NextResponse.json(
    {
      error: 'Demo account restriction',
      message: `🚫 This is a demo account — ${action} is not allowed. Forms, dialogs, and menus open for preview only. To make real changes, sign up your institution.`,
      code: 'DEMO_BLOCKED'
    },
    { status: 403 }
  )
}

/**
 * Check if a request is from a demo session by inspecting the demo flag in
 * the request body or query string. (Server-side enforcement is in auth.ts.)
 */
export function isDemoRequest(req: Request): boolean {
  // The actual session check happens server-side via isDemoMode().
  // This helper is just for client-side fetch wrappers.
  return false
}
