"use client"

import * as React from "react"

import type { UserRoleType } from "@/lib/auth/roles"
import { useBudgetStore } from "@/stores/budget-store"

type MeUser = {
  id: string
  name: string
  role: UserRoleType
  organizationId: string
}

type MeResponse =
  | { success: true; data: { user: MeUser | null }; error: null }
  | { success: false }

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const setSessionFromServer = useBudgetStore((s) => s.setSessionFromServer)
  const clearSessionProfileOnly = useBudgetStore(
    (s) => s.clearSessionProfileOnly
  )

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        const json = (await res.json()) as MeResponse
        if (cancelled || !json.success) return
        if (!json.data?.user) {
          clearSessionProfileOnly()
          return
        }
        const u = json.data.user
        setSessionFromServer({
          displayName: u.name,
          organizationId: u.organizationId,
          userId: u.id,
          role: u.role,
        })
      } catch {
        if (!cancelled) clearSessionProfileOnly()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setSessionFromServer, clearSessionProfileOnly])

  return <>{children}</>
}
