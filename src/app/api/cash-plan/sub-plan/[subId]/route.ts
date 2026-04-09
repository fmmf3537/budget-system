import { CashPlanSubPlanStatus, CashPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { cashPlanSubPlanUpdateSchema } from "@/lib/api/cash-plan-schemas"
import {
  findCashPlanHeaderOnly,
  findCashPlanSubPlanDetail,
} from "@/lib/api/cash-plan-queries"
import { serializeCashPlanSubPlan } from "@/lib/api/cash-plan-serialize"
import { validateSubPlanDepartmentScope } from "@/lib/api/cash-plan-department-scope"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ subId: string }> }

function parsePositiveAmount(value: string): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function withinPeriod(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_VIEW)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { subId } = await ctx.params

    const row = await findCashPlanSubPlanDetail(subId, auth.organizationId)
    if (!row) return fail("NOT_FOUND", "子计划不存在或无权访问", 404)
    return ok(
      serializeCashPlanSubPlan(row, {
        incomes: row.incomes,
        expenses: row.expenses,
      })
    )
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_EDIT)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { subId } = await ctx.params

    const existing = await findCashPlanSubPlanDetail(subId, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "子计划不存在或无权访问", 404)
    if (existing.status !== CashPlanSubPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿子计划可编辑", 409)
    }
    const parent = await findCashPlanHeaderOnly(
      existing.parentHeaderId,
      auth.organizationId
    )
    if (!parent) return fail("NOT_FOUND", "主计划不存在或无权访问", 404)
    if (parent.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "主计划非编制中，不能编辑子计划", 409)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }
    const parsed = cashPlanSubPlanUpdateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const d = parsed.data
    const nextDeptCode = d.scopeDepartmentCode ?? existing.scopeDepartmentCode
    const scopeOk = await validateSubPlanDepartmentScope({
      organizationId: auth.organizationId,
      rootDepartmentCode: parent.rootDepartmentCode,
      scopeDepartmentCode: nextDeptCode,
    })
    if (!scopeOk.ok) return fail("VALIDATION_ERROR", scopeOk.message, 400)
    if (d.incomes !== undefined) {
      for (const line of d.incomes) {
        if (parsePositiveAmount(line.amount) == null) {
          return fail("VALIDATION_ERROR", "子计划明细金额必须大于 0", 400)
        }
        if (line.expectedDate) {
          const dt = new Date(line.expectedDate)
          if (!withinPeriod(dt, parent.periodStart, parent.periodEnd)) {
            return fail(
              "VALIDATION_ERROR",
              "子计划明细日期必须落在主计划月份范围内",
              400
            )
          }
        }
      }
    }
    if (d.expenses !== undefined) {
      for (const line of d.expenses) {
        if (parsePositiveAmount(line.amount) == null) {
          return fail("VALIDATION_ERROR", "子计划明细金额必须大于 0", 400)
        }
        if (line.expectedDate) {
          const dt = new Date(line.expectedDate)
          if (!withinPeriod(dt, parent.periodStart, parent.periodEnd)) {
            return fail(
              "VALIDATION_ERROR",
              "子计划明细日期必须落在主计划月份范围内",
              400
            )
          }
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.cashPlanSubPlan.update({
        where: { id: subId },
        data: {
          ...(d.scopeDepartmentCode !== undefined
            ? { scopeDepartmentCode: d.scopeDepartmentCode }
            : {}),
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.approvalProcessId !== undefined
            ? { approvalProcessId: d.approvalProcessId }
            : {}),
        },
      })
      if (d.incomes !== undefined) {
        await tx.cashPlanSubPlanIncome.deleteMany({ where: { subPlanId: subId } })
        if (d.incomes.length > 0) {
          await tx.cashPlanSubPlanIncome.createMany({
            data: d.incomes.map((r) => ({
              subPlanId: subId,
              category: r.category ?? null,
              amount: r.amount,
              expectedDate: r.expectedDate ? new Date(r.expectedDate) : null,
              remark: r.remark ?? null,
            })),
          })
        }
      }
      if (d.expenses !== undefined) {
        await tx.cashPlanSubPlanExpense.deleteMany({ where: { subPlanId: subId } })
        if (d.expenses.length > 0) {
          await tx.cashPlanSubPlanExpense.createMany({
            data: d.expenses.map((r) => ({
              subPlanId: subId,
              category: r.category ?? null,
              amount: r.amount,
              expectedDate: r.expectedDate ? new Date(r.expectedDate) : null,
              remark: r.remark ?? null,
            })),
          })
        }
      }
    })

    const updated = await findCashPlanSubPlanDetail(subId, auth.organizationId)
    if (!updated) return fail("NOT_FOUND", "子计划不存在", 404)
    return ok(
      serializeCashPlanSubPlan(updated, {
        incomes: updated.incomes,
        expenses: updated.expenses,
      })
    )
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_EDIT)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { subId } = await ctx.params

    const existing = await findCashPlanSubPlanDetail(subId, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "子计划不存在或无权访问", 404)
    if (existing.status !== CashPlanSubPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿子计划可删除", 409)
    }
    await prisma.cashPlanSubPlan.delete({ where: { id: subId } })
    return ok({ id: subId, deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
