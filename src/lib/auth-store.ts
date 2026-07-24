'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  isDemo: boolean
  institutionId: string | null
  viewingAsRole?: string
  viewingAsUserId?: string
}

interface AuthState {
  user: SessionUser | null
  loading: boolean
  set_user: (u: SessionUser | null) => void
  set_loading: (l: boolean) => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      set_user: (u) => set({ user: u }),
      set_loading: (l) => set({ loading: l }),
      logout: async () => {
        await fetch('/api/auth', { method: 'DELETE' })
        set({ user: null })
        window.location.href = '/'
      },
      refresh: async () => {
        try {
          const r = await fetch('/api/auth')
          const d = await r.json()
          set({ user: d.user, loading: false })
        } catch {
          set({ loading: false })
        }
      }
    }),
    {
      name: 'examiner-auth',
      // Don't persist `loading` — always start as loading until refresh() resolves
      partialize: (state) => ({ user: state.user }) as any
    }
  )
)

/**
 * Demo-aware fetch wrapper. If user is in demo mode AND the request is a write
 * (POST/PUT/PATCH/DELETE), intercept and show a toast instead of sending.
 * Returns a Response-like object.
 */
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { user } = useAuth.getState()
  const isWrite = init?.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(init.method.toUpperCase())

  if (user?.isDemo && isWrite) {
    // Special case: view-as switching is ALLOWED for demo
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url)
    const isViewAs = url.includes('/api/auth/view-as')
    if (!isViewAs) {
      // Build a fake refusal response
      const { toast } = await import('sonner')
      toast.error('Demo Account Restriction', {
        description: '🚫 This is a demo account — writes are blocked. You can open all forms, menus, and dialogs for preview, but no changes will be saved. Sign up your institution to enable full functionality.',
        duration: 5000
      })
      return new Response(JSON.stringify({
        error: 'Demo account restriction',
        code: 'DEMO_BLOCKED'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  return fetch(input, init)
}
