'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-store'
import { LoginPage } from '@/components/login-page'
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

  if (!user) return <LoginPage />
  return <AppShell />
}
