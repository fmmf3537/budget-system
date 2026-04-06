import { prisma } from "@/lib/prisma"
import { ENTITY_CASH_PLAN_HEADER } from "@/lib/api/cash-plan-constants"
import { cashPlanForecastQuerySchema } from "@/lib/api/cash-plan-schemas"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { serializeCashFlowForecast } from "@/lib/api/cash-plan-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ id: string }> }

function addMoneyStrings(a: string, b: string) {
  return (Number.parseFloat(a) + Number.parseFloat(b)).toFixed(2)
}

function subMoneyStrings(a: string, b: string) {
  return (Number.parseFloat(a) - Number.parseFloat(b)).toFixed(2)
}

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    const raw = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = cashPlanForecastQuerySchema.safeParse(raw)
    if (!parsed.success) return fromZodError(parsed.error)

    const header = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)

    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.cashPlanIncome.aggregate({
        where: { headerId: id },
        _sum: { amount: true },
      }),
      prisma.cashPlanExpense.aggregate({
        where: { headerId: id },
        _sum: { amount: true },
      }),
    ])

    const totalInflow = incomeAgg._sum.amount?.toString() ?? "0"
    const totalOutflow = expenseAgg._sum.amount?.toString() ?? "0"
    const netFlow = subMoneyStrings(totalInflow, totalOutflow)

    const headerOpening = header.openingBalance?.toString() ?? null
    const openingInput =
      parsed.data.openingBalance !== undefined
        ? parsed.data.openingBalance
        : headerOpening !== null
          ? headerOpening
          : "0"
    const openingStr = String(openingInput)
    const closingStr = addMoneyStrings(openingStr, netFlow)

    const safetyStr = header.safetyWaterLevel?.toString() ?? null
    const safetyNum = safetyStr != null ? Number.parseFloat(safetyStr) : null
    const closingNum = Number.parseFloat(closingStr)
    const safetyCheck =
      safetyNum != null && Number.isFinite(safetyNum) && Number.isFinite(closingNum)
        ? {
            safetyWaterLevel: safetyStr,
            closingBalance: closingStr,
            isBelowSafety: closingNum < safetyNum,
          }
        : null

    const storedForecasts = await prisma.cashFlowForecast.findMany({
      where: {
        organizationId: header.organizationId,
        periodStart: { lte: header.periodEnd },
        periodEnd: { gte: header.periodStart },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })

    return ok({
      planId: header.id,
      entityType: ENTITY_CASH_PLAN_HEADER,
      planPeriod: {
        periodStart: header.periodStart.toISOString(),
        periodEnd: header.periodEnd.toISOString(),
      },
      computed: {
        openingBalance: openingStr,
        openingBalanceSource:
          parsed.data.openingBalance !== undefined
            ? "query"
            : headerOpening !== null
              ? "plan"
              : "default_zero",
        totalInflow,
        totalOutflow,
        netFlow,
        closingBalance: closingStr,
        safetyCheck,
        note: "流入/流出为计划内明细汇总；期初优先使用查询参数，否则使用计划上保存的期初，再否则为 0。",
      },
      storedForecasts: storedForecasts.map(serializeCashFlowForecast),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
