import { describe, expect, it } from "vitest"

import { parseCashPlanSheet } from "@/lib/cash-plan/excel-cash-plan-lines"

describe("parseCashPlanSheet", () => {
  it("parses valid rows with date string", () => {
    const matrix = [
      ["类别编码", "金额", "预计日期", "备注"],
      ["CAT1", "1000", "2026-04-01", "n"],
    ]
    const { lines, errors } = parseCashPlanSheet(matrix, "流入")
    expect(errors).toHaveLength(0)
    expect(lines).toHaveLength(1)
    expect(lines[0].category).toBe("CAT1")
    expect(lines[0].amount).toBe("1000")
    expect(lines[0].expectedDate).toBe("2026-04-01T23:59:59.999Z")
    expect(lines[0].remark).toBe("n")
  })

  it("requires amount column in header", () => {
    const matrix = [["类别"], ["x"]]
    const { lines, errors } = parseCashPlanSheet(matrix, "流出")
    expect(lines).toHaveLength(0)
    expect(errors.some((e) => e.message.includes("金额"))).toBe(true)
  })
})
