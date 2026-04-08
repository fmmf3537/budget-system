import {
  clearSessionCookieOnResponse,
} from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({
    success: true,
    data: { ok: true },
    error: null,
  })
  clearSessionCookieOnResponse(res)
  return res
}
