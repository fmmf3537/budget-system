import { ok } from "@/lib/api/response"
import { SESSION_COOKIE_NAME } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({
    success: true,
    data: { ok: true },
    error: null,
  })
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return res
}
