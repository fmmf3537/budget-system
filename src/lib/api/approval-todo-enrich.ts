import { prisma } from "@/lib/prisma"
import {
  ENTITY_BUDGET_ADJUSTMENT,
  ENTITY_BUDGET_HEADER,
  ENTITY_CASH_PLAN_SUB_PLAN,
} from "@/lib/api/approval-constants"
import { ENTITY_CASH_PLAN_HEADER } from "@/lib/api/cash-plan-constants"

export type TodoEnrichment = {
  entityTitle: string | null
  applicantName: string | null
  applicationTime: string
}

/**
 * 按 entityType + entityId 批量补全待办展示字段（标题、申请人、申请时间）。
 */
export async function enrichApprovalTodoRows(
  rows: Array<{ entityType: string; entityId: string; createdAt: Date }>,
  organizationId: string
): Promise<Map<string, TodoEnrichment>> {
  const map = new Map<string, TodoEnrichment>()

  const budgetIds = [
    ...new Set(
      rows
        .filter((r) => r.entityType === ENTITY_BUDGET_HEADER)
        .map((r) => r.entityId)
    ),
  ]
  const cashIds = [
    ...new Set(
      rows
        .filter((r) => r.entityType === ENTITY_CASH_PLAN_HEADER)
        .map((r) => r.entityId)
    ),
  ]
  const adjustmentIds = [
    ...new Set(
      rows
        .filter((r) => r.entityType === ENTITY_BUDGET_ADJUSTMENT)
        .map((r) => r.entityId)
    ),
  ]
  const subPlanIds = [
    ...new Set(
      rows
        .filter((r) => r.entityType === ENTITY_CASH_PLAN_SUB_PLAN)
        .map((r) => r.entityId)
    ),
  ]

  if (budgetIds.length > 0) {
    const budgets = await prisma.budgetHeader.findMany({
      where: { id: { in: budgetIds }, organizationId },
      select: {
        id: true,
        name: true,
        submittedAt: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    })
    for (const b of budgets) {
      const t = b.submittedAt ?? b.createdAt
      map.set(`${ENTITY_BUDGET_HEADER}:${b.id}`, {
        entityTitle: b.name,
        applicantName: b.createdBy?.name ?? b.createdBy?.email ?? null,
        applicationTime: t.toISOString(),
      })
    }
  }

  if (cashIds.length > 0) {
    const plans = await prisma.cashPlanHeader.findMany({
      where: { id: { in: cashIds }, organizationId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    })
    for (const c of plans) {
      map.set(`${ENTITY_CASH_PLAN_HEADER}:${c.id}`, {
        entityTitle: c.name ?? `资金计划 ${c.id.slice(0, 8)}…`,
        applicantName: c.createdBy?.name ?? c.createdBy?.email ?? null,
        applicationTime: c.createdAt.toISOString(),
      })
    }
  }

  if (adjustmentIds.length > 0) {
    const adjustments = await prisma.budgetAdjustment.findMany({
      where: { id: { in: adjustmentIds }, organizationId },
      select: {
        id: true,
        title: true,
        reason: true,
        createdAt: true,
        requester: { select: { name: true, email: true } },
      },
    })
    for (const a of adjustments) {
      const r = a.reason?.trim() ?? ""
      const title =
        a.title?.trim() ||
        (r.length > 40 ? `${r.slice(0, 40)}…` : r || null)
      map.set(`${ENTITY_BUDGET_ADJUSTMENT}:${a.id}`, {
        entityTitle: title || `预算调整 ${a.id.slice(0, 8)}…`,
        applicantName: a.requester?.name ?? a.requester?.email ?? null,
        applicationTime: a.createdAt.toISOString(),
      })
    }
  }

  if (subPlanIds.length > 0) {
    const subPlans = await prisma.cashPlanSubPlan.findMany({
      where: { id: { in: subPlanIds }, organizationId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        scopeDepartmentCode: true,
        createdBy: { select: { name: true, email: true } },
      },
    })
    for (const s of subPlans) {
      map.set(`${ENTITY_CASH_PLAN_SUB_PLAN}:${s.id}`, {
        entityTitle:
          s.name?.trim() ||
          `子计划 ${s.scopeDepartmentCode} ${s.id.slice(0, 8)}…`,
        applicantName: s.createdBy?.name ?? s.createdBy?.email ?? null,
        applicationTime: s.createdAt.toISOString(),
      })
    }
  }

  return map
}
