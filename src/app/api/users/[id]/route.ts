import { prisma } from "@/lib/prisma"
import { userUpdateBodySchema } from "@/lib/api/user-schemas"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { hashPassword } from "@/lib/auth/password"
import { normalizeRole } from "@/lib/auth/roles"
import { Permission } from "@/lib/auth/permissions"
import { UserStatus } from "@/generated/prisma/enums"

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.USER_MANAGE)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr

    const { id } = await ctx.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = userUpdateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const existing = await prisma.user.findFirst({
      where: { id, organizationId: auth.organizationId },
    })
    if (!existing) {
      return fail("NOT_FOUND", "用户不存在或不在本组织", 404)
    }

    if (parsed.data.status === UserStatus.INACTIVE && existing.id === auth.userId) {
      return fail("INVALID_OP", "不能停用自己账号", 400)
    }

    const data: {
      name?: string
      role?: string
      status?: UserStatus
      passwordHash?: string
    } = {}

    if (parsed.data.name !== undefined) data.name = parsed.data.name
    if (parsed.data.role !== undefined) data.role = parsed.data.role
    if (parsed.data.status !== undefined) data.status = parsed.data.status
    if (parsed.data.password && parsed.data.password.length > 0) {
      data.passwordHash = hashPassword(parsed.data.password)
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
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
