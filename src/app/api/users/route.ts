import { prisma } from "@/lib/prisma"
import { userCreateBodySchema } from "@/lib/api/user-schemas"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { hashPassword } from "@/lib/auth/password"
import { normalizeRole } from "@/lib/auth/roles"
import { Permission } from "@/lib/auth/permissions"

export async function GET(request: Request) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.USER_MANAGE)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr

    const items = await prisma.user.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return ok({
      items: items.map((u) => ({
        ...u,
        role: u.role ? normalizeRole(u.role) : null,
      })),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(request: Request) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.USER_MANAGE)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = userCreateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const { email, name, role, password } = parsed.data
    const emailNorm = email.toLowerCase()

    const dup = await prisma.user.findUnique({ where: { email: emailNorm } })
    if (dup) {
      return fail("EMAIL_EXISTS", "该邮箱已被使用", 409)
    }

    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        name,
        role,
        passwordHash: hashPassword(password),
        organizationId: auth.organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    return created({
      user: { ...user, role: user.role ? normalizeRole(user.role) : null },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
