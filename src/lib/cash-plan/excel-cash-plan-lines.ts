import ExcelJS from "exceljs"

import { cashPlanLineBodySchema } from "@/lib/api/cash-plan-schemas"
import {
  cellToPlainString,
  normalizeHeaderText,
} from "@/lib/budget/excel-budget-lines"

export type CashPlanLineExportRow = {
  category: string | null
  amount: string | null
  expectedDate: string | null
  remark: string | null
}

export type CashPlanLineImportDto = {
  category: string | null
  amount: string
  expectedDate: string | null
  remark: string | null
}

export type CashPlanExcelRowError = {
  sheet: string
  excelRow: number
  message: string
}

export type CashPlanExcelParseResult =
  | { ok: true; income: CashPlanLineImportDto[]; expense: CashPlanLineImportDto[] }
  | { ok: false; errors: CashPlanExcelRowError[] }

type InternalKey = "category" | "amount" | "expectedDate" | "remark"

const STATIC_ALIASES: Record<string, InternalKey> = {
  类别编码: "category",
  类别代码: "category",
  类别: "category",
  category: "category",
  金额: "amount",
  amount: "amount",
  预计日期: "expectedDate",
  日期: "expectedDate",
  expecteddate: "expectedDate",
  "expected date": "expectedDate",
  备注: "remark",
  remark: "remark",
}

const SHEET_INCOME_NAMES = ["流入", "inflow", "income"]
const SHEET_EXPENSE_NAMES = ["流出", "outflow", "expense"]

function mapCashPlanHeaderRow(headerRow: unknown[]): Map<InternalKey, number> {
  const colMap = new Map<InternalKey, number>()
  for (let c = 0; c < headerRow.length; c++) {
    const n = normalizeHeaderText(cellToPlainString(headerRow[c]))
    if (!n) continue
    const internal = STATIC_ALIASES[n]
    if (internal != null && !colMap.has(internal)) colMap.set(internal, c)
  }
  return colMap
}

function matrixFromWorksheet(ws: ExcelJS.Worksheet): unknown[][] {
  const rowCount = ws.rowCount || 0
  const colCount = ws.columnCount || 0
  if (rowCount === 0 || colCount === 0) return []
  const out: unknown[][] = []
  for (let r = 1; r <= rowCount; r++) {
    const row: unknown[] = []
    for (let c = 1; c <= colCount; c++) {
      row.push(ws.getCell(r, c).value)
    }
    out.push(row)
  }
  return out
}

function isRowEmptyStrings(parts: string[]): boolean {
  return parts.every((p) => !p.trim())
}

/** Excel 序列日期 → YYYY-MM-DD */
function excelSerialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial)) return null
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function cellToExpectedDateIso(cell: unknown): string | null {
  if (cell instanceof Date) {
    const y = cell.getFullYear()
    const m = String(cell.getMonth() + 1).padStart(2, "0")
    const d = String(cell.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}T23:59:59.999Z`
  }
  if (typeof cell === "number") {
    const ymd = excelSerialToYmd(cell)
    return ymd ? `${ymd}T23:59:59.999Z` : null
  }
  const s = cellToPlainString(cell)
  if (!s) return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return `${m[1]}T23:59:59.999Z`
  return null
}

function findWorksheet(
  wb: ExcelJS.Workbook,
  candidates: string[]
): ExcelJS.Worksheet | undefined {
  const lower = candidates.map((c) => c.toLowerCase())
  return wb.worksheets.find((ws) => {
    const n = ws.name.trim().toLowerCase()
    return lower.includes(n)
  })
}

/** 导出供单测覆盖解析逻辑 */
export function parseCashPlanSheet(
  matrix: unknown[][],
  sheetLabel: string
): { lines: CashPlanLineImportDto[]; errors: CashPlanExcelRowError[] } {
  const errors: CashPlanExcelRowError[] = []
  const lines: CashPlanLineImportDto[] = []

  if (matrix.length < 1) {
    return {
      lines: [],
      errors: [{ sheet: sheetLabel, excelRow: 1, message: "缺少表头行" }],
    }
  }

  const colMap = mapCashPlanHeaderRow(matrix[0] ?? [])
  if (!colMap.has("amount")) {
    return {
      lines: [],
      errors: [
        { sheet: sheetLabel, excelRow: 1, message: "缺少必填列：金额" },
      ],
    }
  }

  if (matrix.length < 2) {
    return { lines: [], errors: [] }
  }

  for (let r = 1; r < matrix.length; r++) {
    const excelRow = r + 1
    const row = matrix[r] ?? []
    const parts: string[] = []
    for (const idx of colMap.values()) {
      parts.push(cellToPlainString(row[idx]))
    }
    if (isRowEmptyStrings(parts)) continue

    const get = (k: InternalKey): unknown => {
      const idx = colMap.get(k)
      return idx == null ? "" : row[idx]
    }

    const categoryRaw = cellToPlainString(get("category")).trim()
    const amountCell = get("amount")
    const amountStr =
      typeof amountCell === "number" && Number.isFinite(amountCell)
        ? String(amountCell)
        : cellToPlainString(amountCell)
    const expectedDateIso = cellToExpectedDateIso(get("expectedDate"))
    const remarkRaw = cellToPlainString(get("remark")).trim()

    const payload = {
      category: categoryRaw || null,
      amount: amountStr,
      expectedDate: expectedDateIso,
      remark: remarkRaw || null,
    }

    const parsed = cashPlanLineBodySchema.safeParse(payload)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("；")
      errors.push({ sheet: sheetLabel, excelRow, message: msg || "校验失败" })
      continue
    }

    lines.push({
      category: parsed.data.category ?? null,
      amount: String(parsed.data.amount),
      expectedDate: parsed.data.expectedDate ?? null,
      remark: parsed.data.remark ?? null,
    })
  }

  return { lines, errors }
}

export async function readCashPlanLinesFromExcelBuffer(
  buffer: ArrayBuffer
): Promise<CashPlanExcelParseResult> {
  try {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)

    const wsIn = findWorksheet(wb, SHEET_INCOME_NAMES)
    const wsOut = findWorksheet(wb, SHEET_EXPENSE_NAMES)
    if (!wsIn || !wsOut) {
      return {
        ok: false,
        errors: [
          {
            sheet: "",
            excelRow: 0,
            message:
              "须包含名为「流入」与「流出」的两个工作表（或 Inflow / Outflow）",
          },
        ],
      }
    }

    const inMatrix = matrixFromWorksheet(wsIn)
    const outMatrix = matrixFromWorksheet(wsOut)

    const inParsed = parseCashPlanSheet(inMatrix, "流入")
    const outParsed = parseCashPlanSheet(outMatrix, "流出")
    const allErrors = [...inParsed.errors, ...outParsed.errors]
    if (allErrors.length > 0) {
      return { ok: false, errors: allErrors }
    }

    return {
      ok: true,
      income: inParsed.lines,
      expense: outParsed.lines,
    }
  } catch {
    return {
      ok: false,
      errors: [{ sheet: "", excelRow: 0, message: "无法解析 Excel 文件" }],
    }
  }
}

const CASH_EXPORT_HEADERS = ["类别编码", "金额", "预计日期", "备注"]

export async function writeCashPlanExcelBuffer(
  incomes: CashPlanLineExportRow[],
  expenses: CashPlanLineExportRow[]
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const wsIn = wb.addWorksheet("流入", {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  const wsOut = wb.addWorksheet("流出", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  for (const ws of [wsIn, wsOut]) {
    ws.addRow(CASH_EXPORT_HEADERS)
    ws.getRow(1).font = { bold: true }
  }

  for (const row of incomes) {
    wsIn.addRow([
      row.category ?? "",
      row.amount ?? "",
      row.expectedDate ? row.expectedDate.slice(0, 10) : "",
      row.remark ?? "",
    ])
  }
  for (const row of expenses) {
    wsOut.addRow([
      row.category ?? "",
      row.amount ?? "",
      row.expectedDate ? row.expectedDate.slice(0, 10) : "",
      row.remark ?? "",
    ])
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBufferLike)
}

export async function buildEmptyCashPlanTemplateBuffer(): Promise<Uint8Array> {
  return writeCashPlanExcelBuffer([], [])
}
