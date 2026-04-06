import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { cashDashboardQuerySchema } from "@/lib/api/cash-dashboard-schemas"
import { serializeDecimal } from "@/lib/api/budget-serialize"
import { serializeWarningRecord } from "@/lib/api/cash-plan-serialize"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"

dayjs.extend(utc)

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: Request) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_VIEW)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const raw = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = cashDashboardQuerySchema.safeParse(raw)
    if (!parsed.success) return fromZodError(parsed.error)

    const {
      periodYear: py,
      periodMonth: pm,
      trendMonths,
      baseBalance: baseBalanceRaw,
      largeAmountMin,
      largeListLimit,
      warningsLimit,
    } = parsed.data

    const now = new Date()
    const year = py ?? now.getUTCFullYear()
    const month = pm ?? now.getUTCMonth() + 1

    const periodStart = dayjs
      .utc(`${year}-${String(month).padStart(2, "0")}-01`)
      .startOf("month")
      .toDate()
    const periodEnd = dayjs
      .utc(`${year}-${String(month).padStart(2, "0")}-01`)
      .endOf("month")
      .toDate()

    const [incomeRows, expenseRows] = await Promise.all([
      prisma.cashPlanIncome.findMany({
        where: {
          header: { organizationId: auth.organizationId },
          expectedDate: { gte: periodStart, lte: periodEnd },
        },
        select: { amount: true },
      }),
      prisma.cashPlanExpense.findMany({
        where: {
          header: { organizationId: auth.organizationId },
          expectedDate: { gte: periodStart, lte: periodEnd },
        },
        select: { amount: true },
      }),
    ])

    const inflowTotal = incomeRows.reduce((s, r) => s + num(r.amount), 0)
    const outflowTotal = expenseRows.reduce((s, r) => s + num(r.amount), 0)
    const netInflow = inflowTotal - outflowTotal

    const base =
      baseBalanceRaw !== undefined ? num(baseBalanceRaw) : 0
    const estimatedClosing = base + netInflow

    const trend: Array<{
      key: string
      label: string
      inflow: string
      outflow: string
      net: string
    }> = []

    const firstFuture = dayjs
      .utc(`${year}-${String(month).padStart(2, "0")}-01`)
      .add(1, "month")
      .startOf("month")

    for (let i = 0; i < trendMonths; i++) {
      const d = firstFuture.add(i, "month")
      const ms = d.startOf("month").toDate()
      const me = d.endOf("month").toDate()
      const key = d.format("YYYY-MM")
      const label = d.format("YYYY年M月")

      const [inc, exp] = await Promise.all([
        prisma.cashPlanIncome.findMany({
          where: {
            header: { organizationId: auth.organizationId },
            expectedDate: { gte: ms, lte: me },
          },
          select: { amount: true },
        }),
        prisma.cashPlanExpense.findMany({
          where: {
            header: { organizationId: auth.organizationId },
            expectedDate: { gte: ms, lte: me },
          },
          select: { amount: true },
        }),
      ])

      const inf = inc.reduce((s, r) => s + num(r.amount), 0)
      const out = exp.reduce((s, r) => s + num(r.amount), 0)
      trend.push({
        key,
        label,
        inflow: inf.toFixed(2),
        outflow: out.toFixed(2),
        net: (inf - out).toFixed(2),
      })
    }

    const largeMin = new Prisma.Decimal(String(largeAmountMin))

    const [bigIncomes, bigExpenses] = await Promise.all([
      prisma.cashPlanIncome.findMany({
        where: {
          header: { organizationId: auth.organizationId },
          amount: { gte: largeMin },
        },
        orderBy: { amount: "desc" },
        take: largeListLimit,
        include: {
          header: { select: { id: true, name: true } },
        },
      }),
      prisma.cashPlanExpense.findMany({
        where: {
          header: { organizationId: auth.organizationId },
          amount: { gte: largeMin },
        },
        orderBy: { amount: "desc" },
        take: largeListLimit,
        include: {
          header: { select: { id: true, name: true } },
        },
      }),
    ])

    type LargeRow = {
      id: string
      direction: "inflow" | "outflow"
      amount: string
      category: string | null
      expectedDate: string | null
      remark: string | null
      planId: string
      planName: string | null
    }

    const largeMerged: LargeRow[] = [
      ...bigIncomes.map((r) => ({
        id: r.id,
        direction: "inflow" as const,
        amount: serializeDecimal(r.amount) ?? "0",
        category: r.category,
        expectedDate: r.expectedDate?.toISOString() ?? null,
        remark: r.remark,
        planId: r.headerId,
        planName: r.header.name,
      })),
      ...bigExpenses.map((r) => ({
        id: r.id,
        direction: "outflow" as const,
        amount: serializeDecimal(r.amount) ?? "0",
        category: r.category,
        expectedDate: r.expectedDate?.toISOString() ?? null,
        remark: r.remark,
        planId: r.headerId,
        planName: r.header.name,
      })),
    ]
      .sort((a, b) => num(b.amount) - num(a.amount))
      .slice(0, largeListLimit)

    const warningRows = await prisma.warningRecord.findMany({
      where: {
        organizationId: auth.organizationId,
        isResolved: false,
      },
      orderBy: { createdAt: "desc" },
      take: warningsLimit,
    })

    return ok({
      overview: {
        periodYear: year,
        periodMonth: month,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        inflowTotal: inflowTotal.toFixed(2),
        outflowTotal: outflowTotal.toFixed(2),
        netInflow: netInflow.toFixed(2),
        baseBalanceUsed: base.toFixed(2),
        estimatedClosing: estimatedClosing.toFixed(2),
        note: "本期流入/流出仅统计「预计日期」落在该月内的明细；期末余额 = 基数 + 净流入。",
      },
      trendMonths: trend,
      warnings: warningRows.map(serializeWarningRecord),
      largeItems: largeMerged,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
