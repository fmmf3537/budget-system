import { prisma } from "@/lib/prisma"
import { userSelfUpdateBodySchema } from "@/lib/api/user-schemas"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { normalizeRole } from "@/lib/auth/roles"

export async function GET(request: Request) {
  try {
    const authOrErr = await requireAuth(request)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!user) return fail("NOT_FOUND", "用户不存在", 404)

    return ok({
      user: { ...user, role: user.role ? normalizeRole(user.role) : null },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PATCH(request: Request) {
  try {
    const authOrErr = await requireAuth(request)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = userSelfUpdateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const existing = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    })
    if (!existing) return fail("NOT_FOUND", "用户不存在", 404)

    const data: { name?: string; email?: string; passwordHash?: string } = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name

    if (parsed.data.email !== undefined) {
      const emailNorm = parsed.data.email.toLowerCase()
      if (emailNorm !== existing.email) {
        const dup = await prisma.user.findUnique({ where: { email: emailNorm } })
        if (dup) return fail("EMAIL_EXISTS", "该邮箱已被使用", 409)
      }
      data.email = emailNorm
    }

    if (parsed.data.newPassword !== undefined) {
      const passOk = verifyPassword(
        parsed.data.currentPassword ?? "",
        existing.passwordHash
      )
      if (!passOk) return fail("INVALID_PASSWORD", "原密码不正确", 400)
      data.passwordHash = hashPassword(parsed.data.newPassword)
    }

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        organizationId: true,
        updatedAt: true,
      },
    })

    return ok({
      user: { ...user, role: user.role ? normalizeRole(user.role) : null },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
