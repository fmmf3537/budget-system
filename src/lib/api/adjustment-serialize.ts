import type { Prisma } from "@/generated/prisma/client"
import type { AdjustmentStatus } from "@/generated/prisma/enums"
import {
  AdjustmentKind,
  BudgetCompilationGranularity,
} from "@/generated/prisma/enums"
import { serializeDecimal } from "@/lib/api/budget-serialize"
import { formatBudgetPeriodLabel } from "@/lib/budget/period"

export function computeLineAmountDelta(
  kind: AdjustmentKind,
  amount: number
): string {
  switch (kind) {
    case AdjustmentKind.INCREASE:
      return String(amount)
    case AdjustmentKind.DECREASE:
      return String(-amount)
    case AdjustmentKind.SUBJECT_TRANSFER:
    case AdjustmentKind.ROLLING:
      return String(amount)
    default:
      return String(amount)
  }
}

export function computeTotalNetDelta(
  kind: AdjustmentKind,
  detailAmounts: number[]
): string {
  let net = 0
  for (const a of detailAmounts) {
    switch (kind) {
      case AdjustmentKind.INCREASE:
        net += a
        break
      case AdjustmentKind.DECREASE:
        net -= a
        break
      default:
        break
    }
  }
  return String(net)
}

function parseAmount(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmt2(n: number): string {
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

type BudgetLineForComparison = {
  subjectId: string
  subject: { code: string; name: string } | null
  amount: unknown
}

type DetailForComparison = {
  sourceSubjectId: string | null
  targetSubjectId: string | null
  amountDelta: unknown
}

/**
 * 按科目汇总：调整前为当前预算行合计；调整后为按调整类型与明细模拟后的科目金额。
 */
export function buildBudgetSubjectComparison(
  kind: AdjustmentKind,
  budgetLines: BudgetLineForComparison[],
  details: DetailForComparison[]
) {
  const subjectMeta = new Map<
    string,
    { code: string | null; name: string | null }
  >()
  const beforeMap = new Map<string, number>()

  for (const l of budgetLines) {
    beforeMap.set(
      l.subjectId,
      (beforeMap.get(l.subjectId) ?? 0) + parseAmount(l.amount)
    )
    if (l.subject) {
      subjectMeta.set(l.subjectId, {
        code: l.subject.code,
        name: l.subject.name,
      })
    }
  }

  const afterMap = new Map(beforeMap)
  const ensure = (id: string) => {
    if (!afterMap.has(id)) afterMap.set(id, 0)
  }

  for (const d of details) {
    const delta = parseAmount(d.amountDelta)
    const src = d.sourceSubjectId
    const tgt = d.targetSubjectId
    switch (kind) {
      case AdjustmentKind.INCREASE:
        if (tgt) {
          ensure(tgt)
          afterMap.set(tgt, (afterMap.get(tgt) ?? 0) + delta)
        }
        break
      case AdjustmentKind.DECREASE:
        if (src) {
          ensure(src)
          afterMap.set(src, (afterMap.get(src) ?? 0) + delta)
        }
        break
      case AdjustmentKind.SUBJECT_TRANSFER:
      case AdjustmentKind.ROLLING: {
        const mag = Math.abs(delta)
        if (src) {
          ensure(src)
          afterMap.set(src, (afterMap.get(src) ?? 0) - mag)
        }
        if (tgt) {
          ensure(tgt)
          afterMap.set(tgt, (afterMap.get(tgt) ?? 0) + mag)
        }
        break
      }
      default:
        break
    }
  }

  const ids = new Set<string>([...beforeMap.keys(), ...afterMap.keys()])
  const rows = [...ids]
    .filter(
      (subjectId) =>
        (beforeMap.get(subjectId) ?? 0) !== 0 ||
        (afterMap.get(subjectId) ?? 0) !== 0
    )
    .map((subjectId) => {
      const b = beforeMap.get(subjectId) ?? 0
      const a = afterMap.get(subjectId) ?? 0
      const meta = subjectMeta.get(subjectId) ?? { code: null, name: null }
      return {
        subjectId,
        subjectCode: meta.code,
        subjectName: meta.name,
        beforeAmount: fmt2(b),
        afterAmount: fmt2(a),
        delta: fmt2(a - b),
      }
    })
    .sort((x, y) =>
      (x.subjectCode ?? x.subjectId).localeCompare(
        y.subjectCode ?? y.subjectId,
        "zh-CN"
      )
    )

  const totalBefore = [...beforeMap.values()].reduce((s, v) => s + v, 0)
  const totalAfter = [...afterMap.values()].reduce((s, v) => s + v, 0)

  return {
    rows,
    totalBefore: fmt2(totalBefore),
    totalAfter: fmt2(totalAfter),
    totalDelta: fmt2(totalAfter - totalBefore),
    note: "按科目汇总模拟；若尚未执行落库应用，请以实际预算数据为准。",
  }
}

export const adjustmentWithDetailsInclude = {
  details: {
    orderBy: { createdAt: "asc" as const },
    include: {
      sourceSubject: { select: { id: true, code: true, name: true } },
      targetSubject: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.BudgetAdjustmentInclude

export type BudgetAdjustmentWithDetails = Prisma.BudgetAdjustmentGetPayload<{
  include: typeof adjustmentWithDetailsInclude
}>

export function serializeAdjustmentDetail(
  d: BudgetAdjustmentWithDetails["details"][number]
) {
  return {
    id: d.id,
    adjustmentId: d.adjustmentId,
    budgetLineId: d.budgetLineId,
    subjectId: d.subjectId,
    sourceSubjectId: d.sourceSubjectId,
    targetSubjectId: d.targetSubjectId,
    sourceProject: d.sourceProject,
    targetProject: d.targetProject,
    amountDelta: serializeDecimal(d.amountDelta),
    remark: d.remark,
    sourceSubject: d.sourceSubject
      ? {
          id: d.sourceSubject.id,
          code: d.sourceSubject.code,
          name: d.sourceSubject.name,
        }
      : null,
    targetSubject: d.targetSubject
      ? {
          id: d.targetSubject.id,
          code: d.targetSubject.code,
          name: d.targetSubject.name,
        }
      : null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

export function serializeAdjustmentListItem(row: {
  id: string
  title: string | null
  reason: string
  kind: AdjustmentKind
  status: AdjustmentStatus
  totalDelta: unknown
  budgetHeaderId: string | null
  approvalProcessId: string | null
  createdAt: Date
  updatedAt: Date
  budgetHeader: {
    name: string
    fiscalYear: number
    compilationGranularity: BudgetCompilationGranularity
    periodUnit: number | null
  } | null
}) {
  const bh = row.budgetHeader
  return {
    id: row.id,
    title: row.title,
    reasonPreview:
      row.reason.length > 80 ? `${row.reason.slice(0, 80)}…` : row.reason,
    kind: row.kind,
    status: row.status,
    totalDelta: serializeDecimal(row.totalDelta),
    budgetHeaderId: row.budgetHeaderId,
    budgetName: bh?.name ?? null,
    fiscalYear: bh?.fiscalYear ?? null,
    budgetPeriodLabel:
      bh != null
        ? formatBudgetPeriodLabel({
            fiscalYear: bh.fiscalYear,
            compilationGranularity: bh.compilationGranularity,
            periodUnit: bh.periodUnit,
          })
        : null,
    approvalProcessId: row.approvalProcessId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function serializeAdjustment(row: BudgetAdjustmentWithDetails) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    budgetHeaderId: row.budgetHeaderId,
    budgetLineId: row.budgetLineId,
    title: row.title,
    reason: row.reason,
    kind: row.kind,
    status: row.status,
    totalDelta: serializeDecimal(row.totalDelta),
    requesterId: row.requesterId,
    approvalProcessId: row.approvalProcessId,
    attachmentName: row.attachmentName,
    attachmentMime: row.attachmentMime,
    hasAttachment: Boolean(row.attachmentDataBase64),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    details: row.details.map(serializeAdjustmentDetail),
  }
}
