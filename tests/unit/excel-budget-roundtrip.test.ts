import { describe, expect, it } from "vitest"

import {
  budgetExcelHeaderTitles,
  readBudgetLinesFromExcelBuffer,
  writeBudgetLinesExcelBuffer,
} from "@/lib/budget/excel-budget-lines"

describe("budget excel round-trip", () => {
  const labels = {
    departmentFieldLabel: "成本中心",
    dimension1Label: "项目",
    dimension2Label: "区域",
  } as const

  it("export then import preserves lines", async () => {
    const subjects = [
      { id: "sub-a", code: "601", name: "费用" },
      { id: "sub-b", code: "602", name: "其他" },
    ]
    const subjectById = new Map(
      subjects.map((s) => [s.id, { code: s.code, name: s.name }])
    )

    const exportLines = [
      {
        subjectId: "sub-a",
        amount: "100.5",
        amountYtd: "10",
        remark: "r1",
        departmentCode: "D1",
        dimension1: "P1",
        dimension2: "R1",
      },
      {
        subjectId: "sub-b",
        amount: "0",
        amountYtd: null,
        remark: null,
        departmentCode: null,
        dimension1: null,
        dimension2: null,
      },
    ]

    const u8 = await writeBudgetLinesExcelBuffer(
      exportLines,
      subjectById,
      labels
    )
    const ab = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength
    ) as ArrayBuffer

    const parsed = await readBudgetLinesFromExcelBuffer(ab, labels, subjects)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.lines).toHaveLength(2)
    expect(parsed.lines[0].subjectId).toBe("sub-a")
    expect(parsed.lines[0].amount).toBe("100.5")
    expect(parsed.lines[0].amountYtd).toBe("10")
    expect(parsed.lines[0].remark).toBe("r1")
    expect(parsed.lines[0].departmentCode).toBe("D1")
    expect(parsed.lines[0].dimension1).toBe("P1")
    expect(parsed.lines[0].dimension2).toBe("R1")
    expect(parsed.lines[1].subjectId).toBe("sub-b")
  })

  it("budgetExcelHeaderTitles uses template labels", () => {
    const h = budgetExcelHeaderTitles(labels)
    expect(h).toContain("成本中心")
    expect(h).toContain("项目")
    expect(h).toContain("区域")
    expect(h[0]).toBe("科目编码")
  })
})
