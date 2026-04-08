import * as jose from "jose"
import type { NextResponse } from "next/server"

/** HttpOnly 会话 Cookie 名 */
export const SESSION_COOKIE_NAME = "bs_session"

/**
 * 传给 `NextResponse.cookies.set` 的会话 Cookie 选项（不含 `name` / `value`）。
 * 开发环境 `secure: false` 以便在 http://localhost 下调试；生产环境 `secure: true`。
 * 可用 `COOKIE_SECURE=true|false` 显式覆盖（例如本地模拟生产 Cookie 行为）。
 *
 * 生产若同时用 apex 与 www，可设置 `COOKIE_DOMAIN`（如 `.example.com`），
 * 使登录与登出使用同一 Domain，避免「清不掉旧 Cookie」导致仍被视为已登录。
 */
export type SessionCookieSetOptions = {
  httpOnly: true
  sameSite: "lax"
  path: "/"
  secure: boolean
  maxAge: number
  expires?: Date
  domain?: string
}

function sessionCookieSecure(): boolean {
  const flag = process.env.COOKIE_SECURE
  if (flag === "true") return true
  if (flag === "false") return false
  return process.env.NODE_ENV === "production"
}

/** 可选：如 `.example.com`（带点），用于跨子域共享会话 */
function sessionCookieDomain(): string | undefined {
  const d = process.env.COOKIE_DOMAIN?.trim()
  return d && d.length > 0 ? d : undefined
}

export function getSessionCookieOptions(maxAge: number): SessionCookieSetOptions {
  const domain = sessionCookieDomain()
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: sessionCookieSecure(),
    maxAge,
    ...(domain ? { domain } : {}),
  }
}

/**
 * 登出时尽可能删除会话 Cookie：与登录使用相同的 path/secure/sameSite/domain，
 * 并同时设置 maxAge=0 与 expires=过去时间，减少生产环境「Set-Cookie 未覆盖旧 Cookie」的情况。
 * 若配置了 COOKIE_DOMAIN，会再发一条不带 domain 的清除，用于覆盖历史上仅 host-only 的旧 Cookie。
 */
export function clearSessionCookieOnResponse(res: NextResponse): void {
  const secure = sessionCookieSecure()
  const domain = sessionCookieDomain()
  const base = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: 0,
    expires: new Date(0),
  }
  if (domain) {
    res.cookies.set(SESSION_COOKIE_NAME, "", { ...base, domain })
    res.cookies.set(SESSION_COOKIE_NAME, "", { ...base })
  } else {
    res.cookies.set(SESSION_COOKIE_NAME, "", base)
  }
}

export type SessionJwtClaims = {
  sub: string
  oid: string
  role: string
  email: string
  name: string
}

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET ?? ""
  if (s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET 长度至少 32 字符（生产环境必填）")
    }
    return new TextEncoder().encode(
      "dev-only-insecure-auth-secret-min-32-chars!"
    )
  }
  return new TextEncoder().encode(s)
}

export async function createSessionToken(
  claims: SessionJwtClaims
): Promise<string> {
  return new jose.SignJWT({
    oid: claims.oid,
    role: claims.role,
    email: claims.email,
    name: claims.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey())
}

export async function verifySessionToken(
  token: string
): Promise<SessionJwtClaims | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey())
    const sub = payload.sub
    const oid = payload.oid as string | undefined
    const role = payload.role as string | undefined
    if (!sub || !oid || !role) return null
    return {
      sub,
      oid,
      role,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    }
  } catch {
    return null
  }
}

export function readCookieFromHeader(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("=").trim())
  }
  return null
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const raw = readCookieFromHeader(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME
  )
  const t = raw?.trim()
  return t && t.length > 0 ? t : null
}
