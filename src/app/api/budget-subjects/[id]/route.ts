import { prisma } from "@/lib/prisma"
import {
  budgetSubjectUpdateSchema,
} from "@/lib/api/budget-subject-schemas"
import {
  collectDescendantSubjectIds,
  propagateLevelsUnder,
} from "@/lib/api/budget-subject-mutations"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ id: string }> }

async function subjectVisibleToOrg(id: string, organizationId: string) {
  return prisma.budgetSubject.findFirst({
    where: {
      id,
      OR: [{ organizationId }, { organizationId: null }],
    },
  })
}

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

    const parsed = budgetSubjectUpdateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const existing = await subjectVisibleToOrg(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "科目不存在或无权访问", 404)

    if (existing.organizationId == null) {
      return fail("FORBIDDEN", "系统预置科目不可在此修改", 403)
    }
    if (existing.organizationId !== auth.organizationId) {
      return fail("FORBIDDEN", "无权修改该科目", 403)
    }

    const patch = parsed.data

    if (patch.code !== undefined) {
      const dup = await prisma.budgetSubject.findFirst({
        where: {
          organizationId: auth.organizationId,
          code: patch.code,
          NOT: { id },
        },
      })
      if (dup) return fail("DUPLICATE", "科目编码已存在", 409)
    }

    if (patch.parentId !== undefined) {
      const newParentId = patch.parentId
      if (newParentId === null) {
        // ok — 升为顶级
      } else {
        const parent = await subjectVisibleToOrg(newParentId, auth.organizationId)
        if (!parent) {
          return fail("BAD_REFERENCE", "上级科目不存在或不可选", 400)
        }
        const invalid = new Set<string>([id])
        const desc = await collectDescendantSubjectIds(id)
        desc.forEach((x) => invalid.add(x))
        if (invalid.has(newParentId)) {
          return fail("VALIDATION_ERROR", "不能将上级设为自己或下级科目", 400)
        }
      }
    }

    let nextLevel = existing.level ?? 1
    if (patch.parentId !== undefined) {
      if (patch.parentId === null) {
        nextLevel = 1
      } else {
        const p = await prisma.budgetSubject.findUnique({
          where: { id: patch.parentId },
          select: { level: true },
        })
        nextLevel = (p?.level ?? 0) + 1
      }
    }

    const updated = await prisma.budgetSubject.update({
      where: { id },
      data: {
        ...(patch.code !== undefined ? { code: patch.code } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        level: nextLevel,
      },
      select: {
        id: true,
        organizationId: true,
        parentId: true,
        code: true,
        name: true,
        level: true,
        sortOrder: true,
        isActive: true,
        updatedAt: true,
      },
    })

    await propagateLevelsUnder(updated.id)

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

    const existing = await subjectVisibleToOrg(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "科目不存在或无权访问", 404)

    if (existing.organizationId == null) {
      return fail("FORBIDDEN", "系统预置科目不可删除", 403)
    }
    if (existing.organizationId !== auth.organizationId) {
      return fail("FORBIDDEN", "无权删除该科目", 403)
    }

    const childCount = await prisma.budgetSubject.count({
      where: { parentId: id },
    })
    if (childCount > 0) {
      return fail("INVALID_STATE", "请先删除或移动子科目", 409)
    }

    const lineCount = await prisma.budgetLine.count({ where: { subjectId: id } })
    if (lineCount > 0) {
      return fail("INVALID_STATE", "科目已被预算明细引用，无法删除", 409)
    }

    await prisma.budgetSubject.delete({ where: { id } })

    return ok({ id, deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
