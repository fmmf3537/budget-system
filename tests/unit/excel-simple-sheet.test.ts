import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"

import { writeSimpleExcelBuffer } from "@/lib/excel/simple-sheet"

describe("writeSimpleExcelBuffer", () => {
  it("writes headers and rows into a readable workbook", async () => {
    const u8 = await writeSimpleExcelBuffer([
      {
        name: "TestSheet",
        headers: ["A", "B"],
        rows: [
          [1, "x"],
          [null, "y"],
        ],
      },
    ])
    expect(u8.byteLength).toBeGreaterThan(100)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(u8)
    const ws = wb.getWorksheet("TestSheet")
    expect(ws).toBeTruthy()
    expect(ws!.getCell(1, 1).value).toBe("A")
    expect(ws!.getCell(2, 1).value).toBe(1)
    expect(ws!.getCell(3, 2).value).toBe("y")
  })
})
