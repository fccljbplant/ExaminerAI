'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-store'
import { LandingPage } from '@/components/landing-page'
import { AppShell } from '@/components/app-shell'

export default function Home() {
  const { user, loading, refresh } = useAuth()

  useEffect(() => {
    refresh()
  }, [refresh])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading ExaminerAI…</div>
      </div>
    )
  }

  if (!user) return <LandingPage />
  return <AppShell />
}
