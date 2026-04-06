import { CashPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { cashPlanLinePatchSchema } from "@/lib/api/cash-plan-schemas"
import {
  findCashPlanExpenseLine,
  findCashPlanHeaderOnly,
} from "@/lib/api/cash-plan-queries"
import { serializeCashPlanExpense } from "@/lib/api/cash-plan-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ id: string; lineId: string }> }

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id: headerId, lineId } = await ctx.params

    const header = await findCashPlanHeaderOnly(headerId, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)
    if (header.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿状态可修改流出明细", 409)
    }

    const existing = await findCashPlanExpenseLine(
      lineId,
      headerId,
      auth.organizationId
    )
    if (!existing) return fail("NOT_FOUND", "明细不存在", 404)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = cashPlanLinePatchSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const p = parsed.data
    const row = await prisma.cashPlanExpense.update({
      where: { id: lineId },
      data: {
        ...(p.category !== undefined ? { category: p.category } : {}),
        ...(p.amount !== undefined ? { amount: p.amount } : {}),
        ...(p.expectedDate !== undefined
          ? {
              expectedDate: p.expectedDate
                ? new Date(p.expectedDate)
                : null,
            }
          : {}),
        ...(p.remark !== undefined ? { remark: p.remark } : {}),
      },
    })

    return ok(serializeCashPlanExpense(row))
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id: headerId, lineId } = await ctx.params

    const header = await findCashPlanHeaderOnly(headerId, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)
    if (header.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿状态可删除流出明细", 409)
    }

    const existing = await findCashPlanExpenseLine(
      lineId,
      headerId,
      auth.organizationId
    )
    if (!existing) return fail("NOT_FOUND", "明细不存在", 404)

    await prisma.cashPlanExpense.delete({ where: { id: lineId } })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
