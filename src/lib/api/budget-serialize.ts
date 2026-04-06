import type { BudgetHeader, BudgetLine, BudgetSubject } from "@/generated/prisma/client"

export type BudgetLineWithSubject = BudgetLine & { subject: BudgetSubject }

export type BudgetHeaderWithLines = BudgetHeader & {
  lines: BudgetLineWithSubject[]
}

export function serializeDecimal(v: unknown) {
  if (v == null) return null
  if (typeof v === "object" && v !== null && "toString" in v) {
    return String((v as { toString: () => string }).toString())
  }
  return String(v)
}

export function serializeBudgetLine(line: BudgetLineWithSubject) {
  return {
    id: line.id,
    headerId: line.headerId,
    subjectId: line.subjectId,
    subject: line.subject
      ? {
          id: line.subject.id,
          code: line.subject.code,
          name: line.subject.name,
        }
      : null,
    amount: serializeDecimal(line.amount),
    amountYtd: serializeDecimal(line.amountYtd),
    remark: line.remark,
    departmentCode: line.departmentCode,
    dimension1: line.dimension1,
    dimension2: line.dimension2,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  }
}

export function serializeBudgetHeader(
  header: BudgetHeader,
  lines?: BudgetLineWithSubject[]
) {
  return {
    id: header.id,
    organizationId: header.organizationId,
    fiscalYear: header.fiscalYear,
    code: header.code,
    name: header.name,
    status: header.status,
    totalAmount: serializeDecimal(header.totalAmount),
    currency: header.currency,
    periodStart: header.periodStart?.toISOString() ?? null,
    periodEnd: header.periodEnd?.toISOString() ?? null,
    compilationMethod: header.compilationMethod ?? null,
    version: header.version,
    createdById: header.createdById,
    updatedById: header.updatedById,
    submittedAt: header.submittedAt?.toISOString() ?? null,
    approvedAt: header.approvedAt?.toISOString() ?? null,
    approvalProcessId: header.approvalProcessId,
    createdAt: header.createdAt.toISOString(),
    updatedAt: header.updatedAt.toISOString(),
    ...(lines !== undefined ? { lines: lines.map(serializeBudgetLine) } : {}),
  }
}

export function serializeBudgetDetail(header: BudgetHeaderWithLines) {
  return serializeBudgetHeader(header, header.lines)
}
