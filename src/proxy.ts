import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { canAccessPathWithRole } from "@/lib/auth/access"
import { MOCK_ROLE_COOKIE } from "@/lib/auth/cookie-names"
import { normalizeRole } from "@/lib/auth/roles"
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  if (pathname === "/login") {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (token) {
      const claims = await verifySessionToken(token)
      if (claims) {
        const url = request.nextUrl.clone()
        url.pathname = "/"
        return NextResponse.redirect(url)
      }
    }
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  let role = normalizeRole(request.cookies.get(MOCK_ROLE_COOKIE)?.value)
  if (token) {
    const claims = await verifySessionToken(token)
    if (claims) role = normalizeRole(claims.role)
  }

  if (!canAccessPathWithRole(pathname, role)) {
    const url = request.nextUrl.clone()
    url.pathname = "/unauthorized"
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
