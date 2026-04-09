import { CashPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { cashPlanUpdateBodySchema } from "@/lib/api/cash-plan-schemas"
import {
  findCashPlanDetail,
  findCashPlanHeaderOnly,
} from "@/lib/api/cash-plan-queries"
import { serializeCashPlanHeader } from "@/lib/api/cash-plan-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import { UserRole } from "@/lib/auth/roles"
import { validateRootDepartmentCode } from "@/lib/api/cash-plan-department-scope"

type RouteCtx = { params: Promise<{ id: string }> }

const EDITABLE: CashPlanStatus[] = [CashPlanStatus.DRAFT]

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    const plan = await findCashPlanDetail(id, auth.organizationId)
    if (!plan) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)

    return ok(
      serializeCashPlanHeader(
        plan,
        { incomes: plan.incomes, expenses: plan.expenses },
        { includeBalance: auth.role === UserRole.ADMIN }
      )
    )
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = cashPlanUpdateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const existing = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)

    if (!EDITABLE.includes(existing.status)) {
      return fail("INVALID_STATE", "仅草稿状态的资金计划可以编辑", 409)
    }

    const patch = parsed.data
    const nextStart = patch.periodStart
      ? new Date(patch.periodStart)
      : existing.periodStart
    const nextEnd = patch.periodEnd
      ? new Date(patch.periodEnd)
      : existing.periodEnd
    if (nextStart > nextEnd) {
      return fail("VALIDATION_ERROR", "periodStart 不能晚于 periodEnd", 400)
    }
    const rootScope = await validateRootDepartmentCode(
      auth.organizationId,
      patch.rootDepartmentCode
    )
    if (!rootScope.ok) {
      return fail("VALIDATION_ERROR", rootScope.message, 400)
    }

    await prisma.cashPlanHeader.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.rootDepartmentCode !== undefined
          ? { rootDepartmentCode: rootScope.code }
          : {}),
        ...(patch.periodStart !== undefined ? { periodStart: nextStart } : {}),
        ...(patch.periodEnd !== undefined ? { periodEnd: nextEnd } : {}),
        ...(patch.approvalProcessId !== undefined
          ? { approvalProcessId: patch.approvalProcessId }
          : {}),
        ...(patch.openingBalance !== undefined
          ? {
              openingBalance:
                patch.openingBalance === null ? null : patch.openingBalance,
            }
          : {}),
        ...(patch.safetyWaterLevel !== undefined
          ? {
              safetyWaterLevel:
                patch.safetyWaterLevel === null ? null : patch.safetyWaterLevel,
            }
          : {}),
      },
    })

    const updated = await findCashPlanDetail(id, auth.organizationId)
    if (!updated) return fail("NOT_FOUND", "资金计划不存在", 404)

    return ok(
      serializeCashPlanHeader(
        updated,
        { incomes: updated.incomes, expenses: updated.expenses },
        { includeBalance: auth.role === UserRole.ADMIN }
      )
    )
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(
      _request,
      Permission.CASH_PLAN_DELETE
    )
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const existing = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)

    if (existing.status !== CashPlanStatus.DRAFT) {
      return fail(
        "INVALID_STATE",
        "仅编制中状态的资金计划可以删除",
        409
      )
    }

    await prisma.cashPlanHeader.delete({ where: { id } })

    return ok({ id, deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
