"use client"

import * as React from "react"

import {
  MOCK_ORG_COOKIE,
  MOCK_ROLE_COOKIE,
  MOCK_USER_COOKIE,
} from "@/lib/auth/cookie-names"
import { normalizeRole } from "@/lib/auth/roles"
import { useBudgetStore } from "@/stores/budget-store"

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`)
  )
  return m ? decodeURIComponent(m[1]) : null
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

export function AuthCookieSync() {
  const [ready, setReady] = React.useState(false)
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)
  const setMockOrgId = useBudgetStore((s) => s.setMockOrgId)
  const setMockUserId = useBudgetStore((s) => s.setMockUserId)
  const setMockUserRole = useBudgetStore((s) => s.setMockUserRole)

  React.useEffect(() => {
    const org = readCookie(MOCK_ORG_COOKIE)
    const user = readCookie(MOCK_USER_COOKIE)
    const role = readCookie(MOCK_ROLE_COOKIE)
    if (org) setMockOrgId(org)
    if (user) setMockUserId(user)
    if (role) setMockUserRole(normalizeRole(role))
    setReady(true)
  }, [setMockOrgId, setMockUserId, setMockUserRole])

  React.useEffect(() => {
    if (!ready) return
    writeCookie(MOCK_ORG_COOKIE, mockOrgId)
    writeCookie(MOCK_USER_COOKIE, mockUserId)
    writeCookie(MOCK_ROLE_COOKIE, mockUserRole)
  }, [ready, mockOrgId, mockUserId, mockUserRole])

  return null
}
