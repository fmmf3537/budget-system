import { prisma } from "@/lib/prisma"
import {
  ENTITY_BUDGET_ADJUSTMENT,
  ENTITY_BUDGET_HEADER,
} from "@/lib/api/approval-constants"
import type { Prisma } from "@/generated/prisma/client"

/** 节点金额条件：null 金额（非预算实体）视为不限制，所有节点均可匹配 */
export function nodeMatchesTotalAmount(
  n: { minTotalAmount: unknown; maxTotalAmount: unknown },
  amount: number | null
): boolean {
  if (amount == null || Number.isNaN(amount)) return true
  const minRaw = n.minTotalAmount
  const maxRaw = n.maxTotalAmount
  const min =
    minRaw != null && minRaw !== ""
      ? Number(String(minRaw))
      : Number.NEGATIVE_INFINITY
  const max =
    maxRaw != null && maxRaw !== ""
      ? Number(String(maxRaw))
      : Number.POSITIVE_INFINITY
  if (!Number.isFinite(min) || !Number.isFinite(max)) return true
  return amount >= min && amount <= max
}

export async function getEntityTotalAmountForRouting(
  entityType: string,
  entityId: string,
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<number | null> {
  const db = tx ?? prisma
  if (entityType === ENTITY_BUDGET_HEADER) {
    const h = await db.budgetHeader.findFirst({
      where: { id: entityId, organizationId },
      select: { totalAmount: true },
    })
    if (!h) return null
    if (h.totalAmount == null) return 0
    return Number(h.totalAmount)
  }
  if (entityType === ENTITY_BUDGET_ADJUSTMENT) {
    const a = await db.budgetAdjustment.findFirst({
      where: { id: entityId, organizationId },
      select: { totalDelta: true },
    })
    if (!a) return null
    if (a.totalDelta == null) return null
    const n = Number(a.totalDelta)
    if (!Number.isFinite(n)) return null
    return Math.abs(n)
  }
  return null
}
