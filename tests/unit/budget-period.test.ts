import { describe, expect, it } from "vitest"
import { BudgetCompilationGranularity } from "@/generated/prisma/enums"
import {
  computeBudgetPeriod,
  formatBudgetPeriodLabel,
} from "@/lib/budget/period"

describe("computeBudgetPeriod", () => {
  it("returns full natural year for ANNUAL", () => {
    const { periodStart, periodEnd } = computeBudgetPeriod(
      2026,
      BudgetCompilationGranularity.ANNUAL,
      null
    )
    expect(periodStart.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(periodEnd.toISOString()).toBe("2026-12-31T23:59:59.999Z")
  })

  it("returns Q1 for QUARTERLY periodUnit 1", () => {
    const { periodStart, periodEnd } = computeBudgetPeriod(
      2026,
      BudgetCompilationGranularity.QUARTERLY,
      1
    )
    expect(periodStart.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(periodEnd.toISOString()).toBe("2026-03-31T23:59:59.999Z")
  })

  it("returns Q2 for QUARTERLY periodUnit 2", () => {
    const { periodStart, periodEnd } = computeBudgetPeriod(
      2026,
      BudgetCompilationGranularity.QUARTERLY,
      2
    )
    expect(periodStart.toISOString()).toBe("2026-04-01T00:00:00.000Z")
    expect(periodEnd.toISOString()).toBe("2026-06-30T23:59:59.999Z")
  })

  it("returns March for MONTHLY periodUnit 3", () => {
    const { periodStart, periodEnd } = computeBudgetPeriod(
      2026,
      BudgetCompilationGranularity.MONTHLY,
      3
    )
    expect(periodStart.toISOString()).toBe("2026-03-01T00:00:00.000Z")
    expect(periodEnd.toISOString()).toBe("2026-03-31T23:59:59.999Z")
  })

  it("throws for QUARTERLY without periodUnit", () => {
    expect(() =>
      computeBudgetPeriod(
        2026,
        BudgetCompilationGranularity.QUARTERLY,
        null
      )
    ).toThrow()
  })
})

describe("formatBudgetPeriodLabel", () => {
  it("formats annual label", () => {
    expect(
      formatBudgetPeriodLabel({
        fiscalYear: 2026,
        compilationGranularity: BudgetCompilationGranularity.ANNUAL,
        periodUnit: null,
      })
    ).toContain("2026")
    expect(
      formatBudgetPeriodLabel({
        fiscalYear: 2026,
        compilationGranularity: BudgetCompilationGranularity.ANNUAL,
        periodUnit: null,
      })
    ).toContain("年度")
  })
})
