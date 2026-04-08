import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { canAccessPathWithRole } from "@/lib/auth/access"
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

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const claims = token ? await verifySessionToken(token) : null
  const authenticated = Boolean(claims)

  if (pathname === "/login") {
    if (authenticated) {
      const url = request.nextUrl.clone()
      url.pathname = "/budget"
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (!authenticated) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    if (pathname !== "/") {
      url.searchParams.set("from", pathname)
    }
    return NextResponse.redirect(url)
  }

  const role = normalizeRole(claims?.role)

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
