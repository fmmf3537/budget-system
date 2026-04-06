import type {
  CashPlanExpense,
  CashPlanHeader,
  CashPlanIncome,
  CashFlowForecast,
  WarningRecord,
} from "@/generated/prisma/client"
import { serializeDecimal } from "@/lib/api/budget-serialize"

export type CashPlanWithLines = CashPlanHeader & {
  incomes: CashPlanIncome[]
  expenses: CashPlanExpense[]
}

export function serializeCashPlanIncome(row: CashPlanIncome) {
  return {
    id: row.id,
    headerId: row.headerId,
    category: row.category,
    amount: serializeDecimal(row.amount),
    expectedDate: row.expectedDate?.toISOString() ?? null,
    remark: row.remark,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function serializeCashPlanExpense(row: CashPlanExpense) {
  return {
    id: row.id,
    headerId: row.headerId,
    category: row.category,
    amount: serializeDecimal(row.amount),
    expectedDate: row.expectedDate?.toISOString() ?? null,
    remark: row.remark,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function serializeCashPlanHeader(
  h: CashPlanHeader,
  lines?: { incomes: CashPlanIncome[]; expenses: CashPlanExpense[] }
) {
  return {
    id: h.id,
    organizationId: h.organizationId,
    name: h.name,
    periodStart: h.periodStart.toISOString(),
    periodEnd: h.periodEnd.toISOString(),
    status: h.status,
    openingBalance: serializeDecimal(h.openingBalance),
    safetyWaterLevel: serializeDecimal(h.safetyWaterLevel),
    createdById: h.createdById,
    approvalProcessId: h.approvalProcessId,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
    ...(lines !== undefined
      ? {
          incomes: lines.incomes.map(serializeCashPlanIncome),
          expenses: lines.expenses.map(serializeCashPlanExpense),
        }
      : {}),
  }
}

export function serializeCashPlanDetail(plan: CashPlanWithLines) {
  return serializeCashPlanHeader(plan, {
    incomes: plan.incomes,
    expenses: plan.expenses,
  })
}

export function serializeCashFlowForecast(f: CashFlowForecast) {
  return {
    id: f.id,
    organizationId: f.organizationId,
    periodStart: f.periodStart.toISOString(),
    periodEnd: f.periodEnd.toISOString(),
    openingBalance: serializeDecimal(f.openingBalance),
    inflowTotal: serializeDecimal(f.inflowTotal),
    outflowTotal: serializeDecimal(f.outflowTotal),
    closingBalance: serializeDecimal(f.closingBalance),
    source: f.source,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }
}

export function serializeWarningRecord(w: WarningRecord) {
  return {
    id: w.id,
    organizationId: w.organizationId,
    type: w.type,
    severity: w.severity,
    message: w.message,
    entityType: w.entityType,
    entityId: w.entityId,
    isResolved: w.isResolved,
    resolvedAt: w.resolvedAt?.toISOString() ?? null,
    resolvedById: w.resolvedById,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }
}
