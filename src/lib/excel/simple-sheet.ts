import ExcelJS from "exceljs"

export type SimpleExcelSheet = {
  name: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
}

export async function writeSimpleExcelBuffer(
  sheets: SimpleExcelSheet[]
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  for (const s of sheets) {
    const safeName = s.name.slice(0, 31).replace(/[*?:/\\[\]]/g, "_")
    const ws = wb.addWorksheet(safeName || "Sheet1", {
      views: [{ state: "frozen", ySplit: 1 }],
    })
    ws.addRow(s.headers)
    ws.getRow(1).font = { bold: true }
    for (const r of s.rows) {
      ws.addRow(r.map((c) => (c == null ? "" : c)))
    }
  }
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBufferLike)
}
