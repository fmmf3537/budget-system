import { prisma } from "@/lib/prisma"
import { findBudgetDetail } from "@/lib/api/budget-queries"
import { serializeDecimal } from "@/lib/api/budget-serialize"
import {
  adjustmentWithDetailsInclude,
  buildBudgetSubjectComparison,
  serializeAdjustment,
} from "@/lib/api/adjustment-serialize"
import type { BudgetHeaderWithLines } from "@/lib/api/budget-serialize"

export type AdjustmentComparisonPayload = ReturnType<
  typeof buildBudgetSubjectComparison
>

export type AdjustmentDetailApiPayload = {
  adjustment: ReturnType<typeof serializeAdjustment> & {
    requesterName: string | null
  }
  budgetHeader: {
    id: string
    name: string
    fiscalYear: number
    status: string
    totalAmount: string | null
    currency: string
  } | null
  budgetLinesBefore: Array<{
    id: string
    subjectId: string
    subject: { code: string; name: string } | null
    amount: string | null
  }>
  comparison: AdjustmentComparisonPayload | null
}

function serializeBudgetLinesLite(header: BudgetHeaderWithLines) {
  return header.lines.map((l) => ({
    id: l.id,
    subjectId: l.subjectId,
    subject: l.subject
      ? { code: l.subject.code, name: l.subject.name }
      : null,
    amount: serializeDecimal(l.amount),
  }))
}

/**
 * 调整单详情 + 原预算行 + 按科目汇总的调整前后对比（批准前为模拟结果）。
 */
export async function getAdjustmentDetailPayload(
  id: string,
  organizationId: string
): Promise<AdjustmentDetailApiPayload | null> {
  const adj = await prisma.budgetAdjustment.findFirst({
    where: { id, organizationId },
    include: {
      ...adjustmentWithDetailsInclude,
      budgetHeader: {
        select: {
          id: true,
          name: true,
          fiscalYear: true,
          status: true,
          totalAmount: true,
          currency: true,
        },
      },
      requester: { select: { name: true, email: true } },
    },
  })

  if (!adj) return null

  const requesterName =
    adj.requester?.name ?? adj.requester?.email ?? null

  const base = serializeAdjustment(adj)
  const adjustment = { ...base, requesterName }

  let budgetLinesBefore: AdjustmentDetailApiPayload["budgetLinesBefore"] = []
  let comparison: AdjustmentComparisonPayload | null = null

  if (adj.budgetHeaderId) {
    const b = await findBudgetDetail(adj.budgetHeaderId, organizationId)
    if (b) {
      budgetLinesBefore = serializeBudgetLinesLite(b)
      comparison = buildBudgetSubjectComparison(adj.kind, b.lines, adj.details)
    }
  }

  return {
    adjustment,
    budgetHeader: adj.budgetHeader
      ? {
          id: adj.budgetHeader.id,
          name: adj.budgetHeader.name,
          fiscalYear: adj.budgetHeader.fiscalYear,
          status: adj.budgetHeader.status,
          totalAmount: serializeDecimal(adj.budgetHeader.totalAmount),
          currency: adj.budgetHeader.currency,
        }
      : null,
    budgetLinesBefore,
    comparison,
  }
}
