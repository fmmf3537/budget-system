import { BudgetCompilationGranularity } from "@/generated/prisma/enums"

export type BudgetPeriodBounds = {
  periodStart: Date
  periodEnd: Date
}

export function computeBudgetPeriod(
  fiscalYear: number,
  granularity: BudgetCompilationGranularity,
  periodUnit: number | null | undefined
): BudgetPeriodBounds {
  const y = fiscalYear
  switch (granularity) {
    case "ANNUAL": {
      return {
        periodStart: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
        periodEnd: new Date(Date.UTC(y, 12, 0, 23, 59, 59, 999)),
      }
    }
    case "QUARTERLY": {
      const q = periodUnit
      if (q == null || q < 1 || q > 4) {
        throw new Error("QUARTERLY 编制须指定 periodUnit 为 1～4（季度）")
      }
      const startMonth0 = (q - 1) * 3
      return {
        periodStart: new Date(Date.UTC(y, startMonth0, 1, 0, 0, 0, 0)),
        periodEnd: new Date(Date.UTC(y, startMonth0 + 3, 0, 23, 59, 59, 999)),
      }
    }
    case "MONTHLY": {
      const m = periodUnit
      if (m == null || m < 1 || m > 12) {
        throw new Error("MONTHLY 编制须指定 periodUnit 为 1～12（月份）")
      }
      return {
        periodStart: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
        periodEnd: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
      }
    }
    default: {
      const _x: never = granularity
      throw new Error(`未知编制粒度: ${_x}`)
    }
  }
}

const GRANULARITY_LABEL: Record<BudgetCompilationGranularity, string> = {
  ANNUAL: "年度",
  QUARTERLY: "季度",
  MONTHLY: "月度",
}

export function formatBudgetPeriodLabel(params: {
  fiscalYear: number
  compilationGranularity: BudgetCompilationGranularity
  periodUnit: number | null | undefined
}): string {
  const { fiscalYear, compilationGranularity, periodUnit } = params
  switch (compilationGranularity) {
    case "ANNUAL":
      return `${fiscalYear} 年（${GRANULARITY_LABEL.ANNUAL}）`
    case "QUARTERLY": {
      const q = periodUnit ?? "?"
      return `${fiscalYear} 年 Q${q}（${GRANULARITY_LABEL.QUARTERLY}）`
    }
    case "MONTHLY": {
      const m = periodUnit ?? "?"
      return `${fiscalYear} 年 ${m} 月（${GRANULARITY_LABEL.MONTHLY}）`
    }
    default:
      return `${fiscalYear} 年`
  }
}
