import { describe, expect, it } from "vitest"
import {
  AdjustmentKind,
  AdjustmentStatus,
  BudgetCompilationGranularity,
} from "@/generated/prisma/enums"
import { serializeAdjustmentListItem } from "@/lib/api/adjustment-serialize"

describe("serializeAdjustmentListItem — 关联预算编制期间标签（回归：调整列表）", () => {
  it("includes budgetPeriodLabel from budget header granularity", () => {
    const row = {
      id: "adj-1",
      title: "调增",
      reason: "测试",
      kind: AdjustmentKind.INCREASE,
      status: AdjustmentStatus.DRAFT,
      totalDelta: "100.00",
      budgetHeaderId: "bh-1",
      approvalProcessId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      budgetHeader: {
        name: "示例预算",
        fiscalYear: 2026,
        compilationGranularity: BudgetCompilationGranularity.MONTHLY,
        periodUnit: 2,
      },
    }

    const out = serializeAdjustmentListItem(row)
    expect(out.budgetName).toBe("示例预算")
    expect(out.fiscalYear).toBe(2026)
    expect(out.budgetPeriodLabel).toContain("2026")
    expect(out.budgetPeriodLabel).toContain("月度")
  })
})
