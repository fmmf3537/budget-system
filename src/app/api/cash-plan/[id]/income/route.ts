import { CashPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { cashPlanLineBodySchema } from "@/lib/api/cash-plan-schemas"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { serializeCashPlanIncome } from "@/lib/api/cash-plan-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id: headerId } = await ctx.params

    const header = await findCashPlanHeaderOnly(headerId, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)

    if (header.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿状态可添加流入明细", 409)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = cashPlanLineBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const d = parsed.data
    const row = await prisma.cashPlanIncome.create({
      data: {
        headerId,
        category: d.category ?? null,
        amount: d.amount,
        expectedDate: d.expectedDate ? new Date(d.expectedDate) : null,
        remark: d.remark ?? null,
      },
    })

    return created(serializeCashPlanIncome(row))
  } catch (e) {
    return handleRouteError(e)
  }
}
