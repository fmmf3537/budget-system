import { CashPlanStatus, CashPlanSubPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"
import { UserRole } from "@/lib/auth/roles"

function monthKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-")
  return `${y}年${Number(m)}月`
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: Request) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    if (auth.role !== UserRole.ADMIN) {
      return fail("FORBIDDEN", "仅管理员可查看看板", 403)
    }

    const searchParams = new URL(request.url).searchParams
    const rawMonths = Number(searchParams.get("months") ?? "6")
    const departmentScopeRaw = searchParams.get("departmentScope")?.trim() || "__org__"
    const isOrgScope = departmentScopeRaw === "__org__"
    const scopeRaw = searchParams.get("scope")
    const scope =
      scopeRaw === "submitted_and_approved"
        ? "submitted_and_approved"
        : scopeRaw === "approved_only"
          ? "approved_only"
          : "submitted_only"
    const months = Math.min(24, Math.max(3, Number.isFinite(rawMonths) ? rawMonths : 6))
    const headerStatuses =
      scope === "submitted_and_approved"
        ? [CashPlanStatus.SUBMITTED, CashPlanStatus.APPROVED]
        : scope === "approved_only"
          ? [CashPlanStatus.APPROVED]
        : [CashPlanStatus.SUBMITTED]
    const subPlanStatuses =
      scope === "submitted_and_approved"
        ? [CashPlanSubPlanStatus.SUBMITTED, CashPlanSubPlanStatus.APPROVED]
        : scope === "approved_only"
          ? [CashPlanSubPlanStatus.APPROVED]
        : [CashPlanSubPlanStatus.SUBMITTED]
    let headerScopeFilter: { rootDepartmentCode?: string } = {}
    let subPlanScopeFilter: { parentHeader?: { rootDepartmentCode?: string } } = {}
    if (!isOrgScope) {
      const top = await prisma.budgetDepartment.findFirst({
        where: {
          organizationId: auth.organizationId,
          isActive: true,
          code: departmentScopeRaw,
          parentId: null,
        },
        select: { id: true },
      })
      if (!top) {
        return ok({
          overview: {
            matchedMainPlanCount: 0,
            matchedSubPlanCount: 0,
            mainSubmittedInflow: "0.00",
            mainSubmittedOutflow: "0.00",
            subSubmittedInflow: "0.00",
            subSubmittedOutflow: "0.00",
            totalInflow: "0.00",
            totalOutflow: "0.00",
            netFlow: "0.00",
          },
          trend: [],
          note: "统计口径：未匹配到该顶级部门。",
        })
      }
      headerScopeFilter = { rootDepartmentCode: departmentScopeRaw }
      subPlanScopeFilter = {
        parentHeader: {
          rootDepartmentCode: departmentScopeRaw,
        },
      }
    }

    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

    const [
      headersWithOwnLines,
      subPlansForCount,
      mainIncomeAgg,
      mainExpenseAgg,
      subIncomeAgg,
      subExpenseAgg,
      mainIncomeTrend,
      mainExpenseTrend,
      subIncomeTrend,
      subExpenseTrend,
    ] = await Promise.all([
      prisma.cashPlanHeader.findMany({
        where: {
          organizationId: auth.organizationId,
          status: { in: headerStatuses },
          ...headerScopeFilter,
          OR: [{ incomes: { some: {} } }, { expenses: { some: {} } }],
        },
        select: { id: true },
      }),
      prisma.cashPlanSubPlan.findMany({
        where: {
          organizationId: auth.organizationId,
          status: { in: subPlanStatuses },
          ...subPlanScopeFilter,
        },
        select: {
          id: true,
          parentHeaderId: true,
        },
      }),
      prisma.cashPlanIncome.aggregate({
        where: {
          header: {
            organizationId: auth.organizationId,
            status: { in: headerStatuses },
            ...headerScopeFilter,
          },
        },
        _sum: { amount: true },
      }),
      prisma.cashPlanExpense.aggregate({
        where: {
          header: {
            organizationId: auth.organizationId,
            status: { in: headerStatuses },
            ...headerScopeFilter,
          },
        },
        _sum: { amount: true },
      }),
      prisma.cashPlanSubPlanIncome.aggregate({
        where: {
          subPlan: {
            organizationId: auth.organizationId,
            status: { in: subPlanStatuses },
            ...subPlanScopeFilter,
          },
        },
        _sum: { amount: true },
      }),
      prisma.cashPlanSubPlanExpense.aggregate({
        where: {
          subPlan: {
            organizationId: auth.organizationId,
            status: { in: subPlanStatuses },
            ...subPlanScopeFilter,
          },
        },
        _sum: { amount: true },
      }),
      prisma.cashPlanIncome.groupBy({
        by: ["expectedDate"],
        where: {
          header: {
            organizationId: auth.organizationId,
            status: { in: headerStatuses },
            ...headerScopeFilter,
          },
          expectedDate: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.cashPlanExpense.groupBy({
        by: ["expectedDate"],
        where: {
          header: {
            organizationId: auth.organizationId,
            status: { in: headerStatuses },
            ...headerScopeFilter,
          },
          expectedDate: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.cashPlanSubPlanIncome.groupBy({
        by: ["expectedDate"],
        where: {
          subPlan: {
            organizationId: auth.organizationId,
            status: { in: subPlanStatuses },
            ...subPlanScopeFilter,
          },
          expectedDate: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.cashPlanSubPlanExpense.groupBy({
        by: ["expectedDate"],
        where: {
          subPlan: {
            organizationId: auth.organizationId,
            status: { in: subPlanStatuses },
            ...subPlanScopeFilter,
          },
          expectedDate: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
    ])

    const mainPlanIdSet = new Set<string>(headersWithOwnLines.map((h) => h.id))
    for (const s of subPlansForCount) mainPlanIdSet.add(s.parentHeaderId)
    const mainPlanCount = mainPlanIdSet.size
    const subPlanCount = subPlansForCount.length

    const mainIn = toNum(mainIncomeAgg._sum.amount)
    const mainOut = toNum(mainExpenseAgg._sum.amount)
    const subIn = toNum(subIncomeAgg._sum.amount)
    const subOut = toNum(subExpenseAgg._sum.amount)
    const totalIn = mainIn + subIn
    const totalOut = mainOut + subOut

    const inByMonth = new Map<string, number>()
    const outByMonth = new Map<string, number>()
    for (const r of [...mainIncomeTrend, ...subIncomeTrend]) {
      if (!r.expectedDate) continue
      const key = monthKey(r.expectedDate)
      inByMonth.set(key, (inByMonth.get(key) ?? 0) + toNum(r._sum.amount))
    }
    for (const r of [...mainExpenseTrend, ...subExpenseTrend]) {
      if (!r.expectedDate) continue
      const key = monthKey(r.expectedDate)
      outByMonth.set(key, (outByMonth.get(key) ?? 0) + toNum(r._sum.amount))
    }

    const trend: Array<{ key: string; label: string; inflow: string; outflow: string; net: string }> = []
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))
      const key = monthKey(d)
      const inflow = inByMonth.get(key) ?? 0
      const outflow = outByMonth.get(key) ?? 0
      trend.push({
        key,
        label: monthLabel(key),
        inflow: inflow.toFixed(2),
        outflow: outflow.toFixed(2),
        net: (inflow - outflow).toFixed(2),
      })
    }

    return ok({
      overview: {
        matchedMainPlanCount: mainPlanCount,
        matchedSubPlanCount: subPlanCount,
        mainSubmittedInflow: mainIn.toFixed(2),
        mainSubmittedOutflow: mainOut.toFixed(2),
        subSubmittedInflow: subIn.toFixed(2),
        subSubmittedOutflow: subOut.toFixed(2),
        totalInflow: totalIn.toFixed(2),
        totalOutflow: totalOut.toFixed(2),
        netFlow: (totalIn - totalOut).toFixed(2),
      },
      trend,
      note:
        scope === "submitted_and_approved"
          ? "统计口径：包含状态为 SUBMITTED 与 APPROVED 的主计划与子计划明细。"
          : scope === "approved_only"
            ? "统计口径：仅包含状态为 APPROVED 的主计划与子计划明细。"
          : "统计口径：仅包含状态为 SUBMITTED 的主计划与子计划明细。",
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

