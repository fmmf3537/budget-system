import { BudgetStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { budgetUpdateBodySchema } from "@/lib/api/budget-schemas"
import {
  findBudgetDetail,
  findBudgetHeaderOnly,
  replaceBudgetLinesInTransaction,
  resolveActorUserId,
  validateSubjectIdsForOrg,
} from "@/lib/api/budget-queries"
import { serializeBudgetDetail } from "@/lib/api/budget-serialize"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

const EDITABLE: BudgetStatus[] = [BudgetStatus.DRAFT, BudgetStatus.REJECTED]

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.BUDGET_VIEW)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const header = await findBudgetDetail(id, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "预算不存在或无权访问", 404)

    return ok(serializeBudgetDetail(header))
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.BUDGET_EDIT)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = budgetUpdateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const existing = await findBudgetHeaderOnly(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "预算不存在或无权访问", 404)

    if (!EDITABLE.includes(existing.status)) {
      return fail(
        "INVALID_STATE",
        "仅草稿或已驳回的预算可以编辑",
        409
      )
    }

    const patch = parsed.data
    if (patch.periodStart && patch.periodEnd && patch.periodStart > patch.periodEnd) {
      return fail("VALIDATION_ERROR", "periodStart 不能晚于 periodEnd", 400)
    }

    if (patch.lines !== undefined) {
      const subjectIds = patch.lines.map((l) => l.subjectId)
      const subjectsOk = await validateSubjectIdsForOrg(
        auth.organizationId,
        subjectIds
      )
      if (!subjectsOk) {
        return fail(
          "BAD_REFERENCE",
          "部分预算科目不存在或不属于当前组织",
          400
        )
      }
    }

    const actorId = await resolveActorUserId(auth)

    await prisma.$transaction(async (tx) => {
      await tx.budgetHeader.update({
        where: { id },
        data: {
          ...(patch.fiscalYear !== undefined ? { fiscalYear: patch.fiscalYear } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.code !== undefined ? { code: patch.code } : {}),
          ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
          ...(patch.periodStart !== undefined
            ? { periodStart: patch.periodStart ? new Date(patch.periodStart) : null }
            : {}),
          ...(patch.periodEnd !== undefined
            ? { periodEnd: patch.periodEnd ? new Date(patch.periodEnd) : null }
            : {}),
          ...(patch.compilationMethod !== undefined
            ? { compilationMethod: patch.compilationMethod }
            : {}),
          ...(patch.approvalProcessId !== undefined
            ? { approvalProcessId: patch.approvalProcessId }
            : {}),
          updatedById: actorId,
          version: { increment: 1 },
        },
      })

      if (patch.lines !== undefined) {
        await replaceBudgetLinesInTransaction(tx, id, patch.lines)
      }
    })

    const updated = await findBudgetDetail(id, auth.organizationId)
    if (!updated) return fail("NOT_FOUND", "预算不存在", 404)

    return ok(serializeBudgetDetail(updated))
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.BUDGET_DELETE)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const existing = await findBudgetHeaderOnly(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "预算不存在或无权访问", 404)

    if (existing.status !== BudgetStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿状态的预算可以删除", 409)
    }

    await prisma.budgetHeader.delete({ where: { id } })

    return ok({ id, deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
