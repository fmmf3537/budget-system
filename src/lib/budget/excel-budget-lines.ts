import { v4 as uuidv4 } from "uuid"
import ExcelJS from "exceljs"

import { budgetLineInputSchema } from "@/lib/api/budget-schemas"

export type BudgetExcelTemplateLabels = {
  departmentFieldLabel: string | null
  dimension1Label: string | null
  dimension2Label: string | null
}

export type BudgetExcelSubject = { id: string; code: string; name: string }

/** 与 budget-form 明细行一致（含 clientKey） */
export type BudgetExcelFormLine = {
  clientKey: string
  subjectId: string
  amount: string
  amountYtd: string
  remark: string
  departmentCode: string
  dimension1: string
  dimension2: string
}

export type BudgetExcelRowError = { excelRow: number; message: string }

export type BudgetExcelParseResult =
  | { ok: true; lines: BudgetExcelFormLine[]; errors: [] }
  | { ok: false; lines: []; errors: BudgetExcelRowError[] }

type InternalKey =
  | "subjectCode"
  | "subjectName"
  | "departmentCode"
  | "dimension1"
  | "dimension2"
  | "amount"
  | "amountYtd"
  | "remark"

const STATIC_HEADER_ALIASES: Record<string, InternalKey> = {
  科目编码: "subjectCode",
  科目代码: "subjectCode",
  subjectcode: "subjectCode",
  "subject code": "subjectCode",
  科目名称: "subjectName",
  subjectname: "subjectName",
  "subject name": "subjectName",
  金额: "amount",
  amount: "amount",
  累计ytd: "amountYtd",
  累计YTD: "amountYtd",
  ytd: "amountYtd",
  amountytd: "amountYtd",
  备注: "remark",
  remark: "remark",
  维度1: "dimension1",
  维度2: "dimension2",
  dimension1: "dimension1",
  dimension2: "dimension2",
  部门编码: "departmentCode",
  部门代码: "departmentCode",
  departmentcode: "departmentCode",
  "department code": "departmentCode",
}

export function normalizeHeaderText(raw: string): string {
  return String(raw)
    .trim()
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function buildHeaderAliasTable(
  labels: BudgetExcelTemplateLabels
): Record<string, InternalKey> {
  const t: Record<string, InternalKey> = { ...STATIC_HEADER_ALIASES }
  const d = labels.departmentFieldLabel?.trim()
  if (d) t[normalizeHeaderText(d)] = "departmentCode"
  const a = labels.dimension1Label?.trim()
  if (a) t[normalizeHeaderText(a)] = "dimension1"
  const b = labels.dimension2Label?.trim()
  if (b) t[normalizeHeaderText(b)] = "dimension2"
  return t
}

/**
 * 从表头行得到「内部字段 → 列索引（0-based）」
 */
export function mapBudgetExcelHeaderRow(
  headerRow: unknown[],
  labels: BudgetExcelTemplateLabels
): Map<InternalKey, number> {
  const aliases = buildHeaderAliasTable(labels)
  const colMap = new Map<InternalKey, number>()
  for (let c = 0; c < headerRow.length; c++) {
    const cell = headerRow[c]
    const n = normalizeHeaderText(cellToPlainString(cell))
    if (!n) continue
    const internal = aliases[n]
    if (internal != null && !colMap.has(internal)) colMap.set(internal, c)
  }
  return colMap
}

export function cellToPlainString(val: unknown): string {
  if (val == null || val === "") return ""
  if (typeof val === "string") return val.trim()
  if (typeof val === "number")
    return Number.isFinite(val) ? String(val) : ""
  if (typeof val === "boolean") return val ? "true" : ""
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === "object" && val !== null) {
    const o = val as Record<string, unknown>
    if (typeof o.text === "string" && o.text.length > 0) return o.text.trim()
    if (typeof o.richText === "object" && o.richText !== null) {
      const rt = o.richText as { richText?: { text?: string }[] }
      const parts = rt.richText?.map((x) => x.text ?? "").join("") ?? ""
      return parts.trim()
    }
    if (typeof o.result !== "undefined")
      return cellToPlainString(o.result)
  }
  return String(val).trim()
}

function isRowEmpty(values: string[]): boolean {
  return values.every((v) => !v || !String(v).trim())
}

function buildSubjectByCode(subjects: BudgetExcelSubject[]): Map<string, BudgetExcelSubject> {
  const m = new Map<string, BudgetExcelSubject>()
  for (const s of subjects) {
    m.set(s.code.trim(), s)
  }
  return m
}

/**
 * 将二维数组（含首行表头）解析为表单明细行；excelRow 为 1-based 工作表行号
 */
export function parseBudgetLineRowsFromMatrix(
  matrix: unknown[][],
  labels: BudgetExcelTemplateLabels,
  subjects: BudgetExcelSubject[]
): BudgetExcelParseResult {
  const errors: BudgetExcelRowError[] = []
  if (matrix.length < 2) {
    return {
      ok: false,
      lines: [],
      errors: [{ excelRow: 1, message: "至少需要表头与一行数据" }],
    }
  }

  const headerRow = matrix[0] ?? []
  const colMap = mapBudgetExcelHeaderRow(headerRow, labels)
  if (!colMap.has("subjectCode")) {
    return {
      ok: false,
      lines: [],
      errors: [{ excelRow: 1, message: "缺少必填列：科目编码" }],
    }
  }
  if (!colMap.has("amount")) {
    return {
      ok: false,
      lines: [],
      errors: [{ excelRow: 1, message: "缺少必填列：金额" }],
    }
  }

  const subjectByCode = buildSubjectByCode(subjects)
  const lines: BudgetExcelFormLine[] = []

  for (let r = 1; r < matrix.length; r++) {
    const excelRow = r + 1
    const row = matrix[r] ?? []
    const get = (k: InternalKey): string => {
      const idx = colMap.get(k)
      if (idx == null) return ""
      return cellToPlainString(row[idx])
    }

    const rowParts: string[] = []
    for (const idx of colMap.values()) {
      rowParts.push(cellToPlainString(row[idx]))
    }
    if (isRowEmpty(rowParts)) continue

    const subjectCode = get("subjectCode").trim()
    if (!subjectCode) {
      errors.push({ excelRow, message: "科目编码不能为空" })
      continue
    }

    const sub = subjectByCode.get(subjectCode)
    if (!sub) {
      errors.push({
        excelRow,
        message: `未知科目编码：${subjectCode}`,
      })
      continue
    }

    const amountRaw = get("amount")
    const amountYtdRaw = get("amountYtd")
    const remark = get("remark").trim()
    const departmentCode = get("departmentCode").trim()
    const dimension1 = get("dimension1").trim()
    const dimension2 = get("dimension2").trim()

    const payload = {
      subjectId: sub.id,
      amount: amountRaw,
      amountYtd: amountYtdRaw.trim() ? amountYtdRaw : null,
      remark: remark || null,
      departmentCode: departmentCode || null,
      dimension1: dimension1 || null,
      dimension2: dimension2 || null,
    }

    const parsed = budgetLineInputSchema.safeParse(payload)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("；")
      errors.push({ excelRow, message: msg || "字段校验失败" })
      continue
    }

    const amt = String(parsed.data.amount)
    const ytd =
      parsed.data.amountYtd != null && String(parsed.data.amountYtd).trim()
        ? String(parsed.data.amountYtd)
        : ""

    lines.push({
      clientKey: uuidv4(),
      subjectId: sub.id,
      amount: amt,
      amountYtd: ytd,
      remark: parsed.data.remark?.trim() ? parsed.data.remark.trim() : "",
      departmentCode: parsed.data.departmentCode?.trim() ?? "",
      dimension1: parsed.data.dimension1?.trim() ?? "",
      dimension2: parsed.data.dimension2?.trim() ?? "",
    })
  }

  if (errors.length > 0) {
    return { ok: false, lines: [], errors }
  }
  if (lines.length === 0) {
    return {
      ok: false,
      lines: [],
      errors: [{ excelRow: 2, message: "没有有效数据行" }],
    }
  }

  return { ok: true, lines, errors: [] }
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

export async function readBudgetLinesFromExcelBuffer(
  buffer: ArrayBuffer,
  labels: BudgetExcelTemplateLabels,
  subjects: BudgetExcelSubject[]
): Promise<BudgetExcelParseResult> {
  try {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    const ws = wb.worksheets[0]
    if (!ws) {
      return {
        ok: false,
        lines: [],
        errors: [{ excelRow: 0, message: "文件中没有工作表" }],
      }
    }
    const matrix = matrixFromWorksheet(ws)
    return parseBudgetLineRowsFromMatrix(matrix, labels, subjects)
  } catch {
    return {
      ok: false,
      lines: [],
      errors: [{ excelRow: 0, message: "无法解析 Excel 文件" }],
    }
  }
}

export type BudgetExcelExportLine = {
  subjectId: string
  amount: string
  amountYtd: string | null
  remark: string | null
  departmentCode: string | null
  dimension1: string | null
  dimension2: string | null
}

export function budgetExcelHeaderTitles(
  labels: BudgetExcelTemplateLabels
): string[] {
  const dept = labels.departmentFieldLabel?.trim() || "部门编码"
  const d1 = labels.dimension1Label?.trim() || "维度1"
  const d2 = labels.dimension2Label?.trim() || "维度2"
  return [
    "科目编码",
    "科目名称",
    dept,
    d1,
    d2,
    "金额",
    "累计YTD",
    "备注",
  ]
}

export async function writeBudgetLinesExcelBuffer(
  lines: BudgetExcelExportLine[],
  subjectById: Map<string, { code: string; name: string }>,
  labels: BudgetExcelTemplateLabels
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("预算明细", {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  const titles = budgetExcelHeaderTitles(labels)
  ws.addRow(titles)
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }

  for (const line of lines) {
    const sub = subjectById.get(line.subjectId)
    const code = sub?.code ?? ""
    const name = sub?.name ?? ""
    ws.addRow([
      code,
      name,
      line.departmentCode ?? "",
      line.dimension1 ?? "",
      line.dimension2 ?? "",
      line.amount,
      line.amountYtd ?? "",
      line.remark ?? "",
    ])
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBufferLike)
}

export async function buildEmptyBudgetTemplateBuffer(
  labels: BudgetExcelTemplateLabels
): Promise<Uint8Array> {
  const sampleSubjectById = new Map<string, { code: string; name: string }>([
    ["sample-1", { code: "600101", name: "办公费" }],
    ["sample-2", { code: "600102", name: "差旅费" }],
    ["sample-3", { code: "600103", name: "市场推广费" }],
    ["sample-4", { code: "600104", name: "系统服务费" }],
    ["sample-5", { code: "600105", name: "培训费" }],
  ])
  const sampleLines: BudgetExcelExportLine[] = [
    {
      subjectId: "sample-1",
      amount: "12000",
      amountYtd: "3000",
      remark: "总部月度办公用品",
      departmentCode: "D001",
      dimension1: "项目A",
      dimension2: "成本中心01",
    },
    {
      subjectId: "sample-2",
      amount: "25000",
      amountYtd: "8000",
      remark: "销售出差交通与住宿",
      departmentCode: "D002",
      dimension1: "华北区域",
      dimension2: "成本中心02",
    },
    {
      subjectId: "sample-3",
      amount: "68000",
      amountYtd: "12000",
      remark: "线上投放预算",
      departmentCode: "D003",
      dimension1: "电商渠道",
      dimension2: "成本中心03",
    },
    {
      subjectId: "sample-4",
      amount: "15000",
      amountYtd: "",
      remark: "预算系统年服务费（示例）",
      departmentCode: "D001",
      dimension1: "信息化",
      dimension2: "成本中心01",
    },
    {
      subjectId: "sample-5",
      amount: "9000",
      amountYtd: "2000",
      remark: "管理层专项培训",
      departmentCode: "D004",
      dimension1: "人力资源",
      dimension2: "成本中心04",
    },
  ]
  return writeBudgetLinesExcelBuffer(sampleLines, sampleSubjectById, labels)
}
