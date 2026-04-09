import { prisma } from "@/lib/prisma"
import { CashPlanSubPlanStatus } from "@/generated/prisma/enums"
import { ENTITY_CASH_PLAN_HEADER } from "@/lib/api/cash-plan-constants"
import { cashPlanForecastQuerySchema } from "@/lib/api/cash-plan-schemas"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { serializeCashFlowForecast } from "@/lib/api/cash-plan-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { UserRole } from "@/lib/auth/roles"

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
    const includeBalance = auth.role === UserRole.ADMIN

    const approvedSubPlans = await prisma.cashPlanSubPlan.findMany({
      where: {
        organizationId: auth.organizationId,
        parentHeaderId: id,
        status: CashPlanSubPlanStatus.APPROVED,
      },
      select: { id: true },
    })
    const approvedSubPlanIds = approvedSubPlans.map((s) => s.id)

    const [incomeAgg, expenseAgg, subIncomeAgg, subExpenseAgg] = await Promise.all([
      prisma.cashPlanIncome.aggregate({
        where: { headerId: id },
        _sum: { amount: true },
      }),
      prisma.cashPlanExpense.aggregate({
        where: { headerId: id },
        _sum: { amount: true },
      }),
      approvedSubPlanIds.length > 0
        ? prisma.cashPlanSubPlanIncome.aggregate({
            where: { subPlanId: { in: approvedSubPlanIds } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      approvedSubPlanIds.length > 0
        ? prisma.cashPlanSubPlanExpense.aggregate({
            where: { subPlanId: { in: approvedSubPlanIds } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
    ])

    const totalInflow = (
      Number(incomeAgg._sum.amount ?? 0) + Number(subIncomeAgg._sum.amount ?? 0)
    ).toFixed(2)
    const totalOutflow = (
      Number(expenseAgg._sum.amount ?? 0) + Number(subExpenseAgg._sum.amount ?? 0)
    ).toFixed(2)
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
        openingBalance: includeBalance ? openingStr : null,
        openingBalanceSource: includeBalance
          ? parsed.data.openingBalance !== undefined
            ? "query"
            : headerOpening !== null
              ? "plan"
              : "default_zero"
          : "hidden",
        totalInflow,
        totalOutflow,
        netFlow,
        closingBalance: includeBalance ? closingStr : null,
        safetyCheck: includeBalance ? safetyCheck : null,
        note: "流入/流出 = 主计划明细 + 已审批子计划汇总；期初优先使用查询参数，否则使用计划上保存的期初，再否则为 0。",
      },
      storedForecasts: storedForecasts.map(serializeCashFlowForecast),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
