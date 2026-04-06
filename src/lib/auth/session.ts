import * as jose from "jose"

/** HttpOnly 会话 Cookie 名 */
export const SESSION_COOKIE_NAME = "bs_session"

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
  return readCookieFromHeader(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME
  )
}
