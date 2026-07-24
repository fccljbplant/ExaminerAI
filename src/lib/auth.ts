import { cookies } from 'next/headers'
import { db } from './db'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  isDemo: boolean
  institutionId: string | null
  // For demo account: which role they're previewing
  viewingAsRole?: string
  viewingAsUserId?: string
}

const SESSION_COOKIE = 'examiner-session'
const ONE_WEEK = 60 * 60 * 24 * 7

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SessionUser
    // Validate the user still exists
    const user = await db.user.findUnique({ where: { id: parsed.id } })
    if (!user || !user.isActive) return null
    return parsed
  } catch {
    return null
  }
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ONE_WEEK,
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function updateSession(patch: Partial<SessionUser>) {
  const current = await getSession()
  if (!current) return null
  const updated = { ...current, ...patch }
  await setSession(updated)
  return updated
}

/**
 * DEMO WRITE GUARD
 * Returns true if the current session is in demo mode (the demo developer account
 * OR any account being viewed-as by the demo account). All write endpoints must
 * check this and refuse with a 403 if true.
 */
export async function isDemoMode(): Promise<{ demo: boolean; user: SessionUser | null }> {
  const user = await getSession()
  return { demo: user?.isDemo === true, user }
}

/**
 * Get the "effective" user for data scoping. If the demo account is "viewing as"
 * another user, return that target user's full record; otherwise return the
 * logged-in user's full record.
 */
export async function getEffectiveUser() {
  const session = await getSession()
  if (!session) return null
  // If demo and viewing as someone, fetch that user
  if (session.isDemo && session.viewingAsUserId) {
    return db.user.findUnique({ where: { id: session.viewingAsUserId } })
  }
  return db.user.findUnique({ where: { id: session.id } })
}
