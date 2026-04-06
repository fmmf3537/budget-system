import { describe, expect, it } from "vitest"

import {
  cellToPlainString,
  mapBudgetExcelHeaderRow,
  parseBudgetLineRowsFromMatrix,
} from "@/lib/budget/excel-budget-lines"

describe("cellToPlainString", () => {
  it("normalizes numbers and strings", () => {
    expect(cellToPlainString(12.5)).toBe("12.5")
    expect(cellToPlainString("  x ")).toBe("x")
    expect(cellToPlainString(null)).toBe("")
  })
})

describe("mapBudgetExcelHeaderRow", () => {
  it("maps fixed Chinese headers", () => {
    const row = ["科目编码", "金额", "备注", "维度1", "维度2", "部门编码"]
    const m = mapBudgetExcelHeaderRow(row, {
      departmentFieldLabel: null,
      dimension1Label: null,
      dimension2Label: null,
    })
    expect(m.get("subjectCode")).toBe(0)
    expect(m.get("amount")).toBe(1)
    expect(m.get("remark")).toBe(2)
    expect(m.get("dimension1")).toBe(3)
    expect(m.get("dimension2")).toBe(4)
    expect(m.get("departmentCode")).toBe(5)
  })

  it("maps template column labels to department and dimensions", () => {
    const row = ["科目编码", "成本中心", "项目", "区域", "金额"]
    const m = mapBudgetExcelHeaderRow(row, {
      departmentFieldLabel: "成本中心",
      dimension1Label: "项目",
      dimension2Label: "区域",
    })
    expect(m.get("subjectCode")).toBe(0)
    expect(m.get("departmentCode")).toBe(1)
    expect(m.get("dimension1")).toBe(2)
    expect(m.get("dimension2")).toBe(3)
    expect(m.get("amount")).toBe(4)
  })
})

describe("parseBudgetLineRowsFromMatrix", () => {
  const labels = {
    departmentFieldLabel: null,
    dimension1Label: null,
    dimension2Label: null,
  }
  const subjects = [
    { id: "s1", code: "601", name: "费用", parentId: null },
    { id: "s2", code: "602", name: "其他", parentId: null },
  ]

  it("parses valid rows", () => {
    const matrix = [
      ["科目编码", "金额", "累计YTD", "备注"],
      ["601", "1000", "500", "测试"],
      ["602", "0", "", ""],
    ]
    const r = parseBudgetLineRowsFromMatrix(matrix, labels, subjects)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lines).toHaveLength(2)
    expect(r.lines[0].subjectId).toBe("s1")
    expect(r.lines[0].amount).toBe("1000")
    expect(r.lines[0].amountYtd).toBe("500")
    expect(r.lines[0].remark).toBe("测试")
  })

  it("returns errors for unknown subject code", () => {
    const matrix = [
      ["科目编码", "金额"],
      ["999", "1"],
    ]
    const r = parseBudgetLineRowsFromMatrix(matrix, labels, subjects)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.some((e) => e.message.includes("未知科目编码"))).toBe(true)
  })

  it("returns errors for remark over max length", () => {
    const matrix = [
      ["科目编码", "金额", "备注"],
      ["601", "10", "x".repeat(501)],
    ]
    const r = parseBudgetLineRowsFromMatrix(matrix, labels, subjects)
    expect(r.ok).toBe(false)
  })

  it("skips completely empty data rows", () => {
    const matrix = [
      ["科目编码", "金额"],
      ["601", "10"],
      ["", ""],
      ["602", "20"],
    ]
    const r = parseBudgetLineRowsFromMatrix(matrix, labels, subjects)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lines).toHaveLength(2)
  })
})
