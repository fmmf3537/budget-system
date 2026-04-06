import { prisma } from "@/lib/prisma"
import { budgetDimensionValueUpdateSchema } from "@/lib/api/master-data-schemas"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ id: string }> }

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireApiPermission(request, Permission.SETTINGS_MANAGE)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = budgetDimensionValueUpdateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const existing = await prisma.budgetDimensionValue.findFirst({
      where: { id, organizationId: auth.organizationId },
    })
    if (!existing) return fail("NOT_FOUND", "记录不存在", 404)

    const patch = parsed.data
    if (patch.code !== undefined) {
      const dup = await prisma.budgetDimensionValue.findFirst({
        where: {
          organizationId: auth.organizationId,
          slot: existing.slot,
          code: patch.code,
          NOT: { id },
        },
      })
      if (dup) return fail("DUPLICATE", "该维度下编码已存在", 409)
    }

    const updated = await prisma.budgetDimensionValue.update({
      where: { id },
      data: {
        ...(patch.code !== undefined ? { code: patch.code } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      },
      select: {
        id: true,
        slot: true,
        code: true,
        name: true,
        sortOrder: true,
        isActive: true,
      },
    })
    return ok(updated)
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireApiPermission(request, Permission.SETTINGS_MANAGE)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    const existing = await prisma.budgetDimensionValue.findFirst({
      where: { id, organizationId: auth.organizationId },
    })
    if (!existing) return fail("NOT_FOUND", "记录不存在", 404)

    const refCount =
      existing.slot === 1
        ? await prisma.budgetLine.count({
            where: {
              dimension1: existing.code,
              header: { organizationId: auth.organizationId },
            },
          })
        : await prisma.budgetLine.count({
            where: {
              dimension2: existing.code,
              header: { organizationId: auth.organizationId },
            },
          })
    if (refCount > 0) {
      return fail("INVALID_STATE", "该编码已被预算明细引用，无法删除", 409)
    }

    await prisma.budgetDimensionValue.delete({ where: { id } })
    return ok({ id, deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
