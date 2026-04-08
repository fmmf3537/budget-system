import ExcelJS from "exceljs"

export type SimpleExcelSheet = {
  name: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
}

export type SimpleExcelReadSheet = {
  name: string
  headers: string[]
  rows: string[][]
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

function toCellString(val: unknown): string {
  if (val == null) return ""
  if (typeof val === "string") return val.trim()
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : ""
  if (typeof val === "boolean") return val ? "true" : "false"
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === "object") {
    const o = val as Record<string, unknown>
    if (typeof o.text === "string") return o.text.trim()
    if (typeof o.result !== "undefined") return toCellString(o.result)
  }
  return String(val).trim()
}

export async function readSimpleExcelBuffer(
  buffer: ArrayBuffer
): Promise<SimpleExcelReadSheet[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return wb.worksheets.map((ws) => {
    const rows: string[][] = []
    const rowCount = ws.rowCount || 0
    const colCount = ws.columnCount || 0
    for (let r = 1; r <= rowCount; r++) {
      const arr: string[] = []
      for (let c = 1; c <= colCount; c++) {
        arr.push(toCellString(ws.getCell(r, c).value))
      }
      rows.push(arr)
    }
    const headers = rows[0] ?? []
    return { name: ws.name, headers, rows: rows.slice(1) }
  })
}
