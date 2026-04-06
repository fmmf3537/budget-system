import { prisma } from "@/lib/prisma"
import { cashPlanCategoryUpdateSchema } from "@/lib/api/master-data-schemas"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import { CashPlanCategoryKind } from "@/generated/prisma/enums"

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

    const parsed = cashPlanCategoryUpdateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const existing = await prisma.cashPlanCategory.findFirst({
      where: { id, organizationId: auth.organizationId },
    })
    if (!existing) return fail("NOT_FOUND", "记录不存在", 404)

    const patch = parsed.data
    if (patch.code !== undefined) {
      const dup = await prisma.cashPlanCategory.findFirst({
        where: {
          organizationId: auth.organizationId,
          kind: existing.kind,
          code: patch.code,
          NOT: { id },
        },
      })
      if (dup) return fail("DUPLICATE", "该类型下编码已存在", 409)
    }

    const updated = await prisma.cashPlanCategory.update({
      where: { id },
      data: {
        ...(patch.code !== undefined ? { code: patch.code } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      },
      select: {
        id: true,
        kind: true,
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

    const existing = await prisma.cashPlanCategory.findFirst({
      where: { id, organizationId: auth.organizationId },
    })
    if (!existing) return fail("NOT_FOUND", "记录不存在", 404)

    if (existing.kind === CashPlanCategoryKind.INCOME) {
      const refCount = await prisma.cashPlanIncome.count({
        where: {
          category: existing.code,
          header: { organizationId: auth.organizationId },
        },
      })
      if (refCount > 0) {
        return fail("INVALID_STATE", "该编码已被资金流入明细引用，无法删除", 409)
      }
    } else {
      const refCount = await prisma.cashPlanExpense.count({
        where: {
          category: existing.code,
          header: { organizationId: auth.organizationId },
        },
      })
      if (refCount > 0) {
        return fail("INVALID_STATE", "该编码已被资金流出明细引用，无法删除", 409)
      }
    }

    await prisma.cashPlanCategory.delete({ where: { id } })
    return ok({ id, deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
