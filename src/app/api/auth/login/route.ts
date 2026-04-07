import { prisma } from "@/lib/prisma"
import { fail } from "@/lib/api/response"
import { verifyPassword } from "@/lib/auth/password"
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session"
import { normalizeRole } from "@/lib/auth/roles"
import { UserStatus } from "@/generated/prisma/enums"
import { NextResponse } from "next/server"
import { z } from "zod"

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail("INVALID_JSON", "请求体必须是 JSON", 400)
  }

  const parsed = loginBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "邮箱或密码格式不正确", 400)
  }

  const email = parsed.data.email.toLowerCase()
  const user = await prisma.user.findFirst({
    where: { email },
    include: {
      organization: { select: { id: true, name: true, code: true } },
    },
  })

  if (
    !user ||
    user.status !== UserStatus.ACTIVE ||
    !verifyPassword(parsed.data.password, user.passwordHash)
  ) {
    return fail("AUTH_FAILED", "邮箱或密码错误", 401)
  }

  const role = normalizeRole(user.role)
  const token = await createSessionToken({
    sub: user.id,
    oid: user.organizationId,
    role,
    email: user.email,
    name: user.name,
  })

  const res = NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationCode: user.organization.code,
      },
    },
    error: null,
  })

  res.cookies.set(
    SESSION_COOKIE_NAME,
    token,
    getSessionCookieOptions(60 * 60 * 24 * 7)
  )

  return res
}
