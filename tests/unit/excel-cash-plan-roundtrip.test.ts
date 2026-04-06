import { describe, expect, it } from "vitest"

import {
  readCashPlanLinesFromExcelBuffer,
  writeCashPlanExcelBuffer,
} from "@/lib/cash-plan/excel-cash-plan-lines"

describe("cash plan excel round-trip", () => {
  it("export then import preserves income and expense lines", async () => {
    const u8 = await writeCashPlanExcelBuffer(
      [
        {
          category: "IN1",
          amount: "100",
          expectedDate: "2026-06-15T12:00:00.000Z",
          remark: "a",
        },
      ],
      [
        {
          category: "OUT1",
          amount: "50.25",
          expectedDate: null,
          remark: null,
        },
      ]
    )
    const ab = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength
    ) as ArrayBuffer

    const parsed = await readCashPlanLinesFromExcelBuffer(ab)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.income).toHaveLength(1)
    expect(parsed.expense).toHaveLength(1)
    expect(parsed.income[0].category).toBe("IN1")
    expect(parsed.income[0].amount).toBe("100")
    expect(parsed.income[0].expectedDate).toBe("2026-06-15T23:59:59.999Z")
    expect(parsed.expense[0].category).toBe("OUT1")
    expect(parsed.expense[0].amount).toBe("50.25")
  })
})
