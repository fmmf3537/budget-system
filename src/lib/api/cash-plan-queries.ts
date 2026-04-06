import { prisma } from "@/lib/prisma"
import type { CashPlanWithLines } from "@/lib/api/cash-plan-serialize"

const planInclude = {
  incomes: { orderBy: { expectedDate: "asc" as const } },
  expenses: { orderBy: { expectedDate: "asc" as const } },
}

export async function findCashPlanDetail(
  id: string,
  organizationId: string
): Promise<CashPlanWithLines | null> {
  const row = await prisma.cashPlanHeader.findFirst({
    where: { id, organizationId },
    include: planInclude,
  })
  return row as CashPlanWithLines | null
}

export async function findCashPlanHeaderOnly(
  id: string,
  organizationId: string
) {
  return prisma.cashPlanHeader.findFirst({
    where: { id, organizationId },
  })
}

export async function findCashPlanIncomeLine(
  lineId: string,
  headerId: string,
  organizationId: string
) {
  return prisma.cashPlanIncome.findFirst({
    where: {
      id: lineId,
      headerId,
      header: { organizationId },
    },
  })
}

export async function findCashPlanExpenseLine(
  lineId: string,
  headerId: string,
  organizationId: string
) {
  return prisma.cashPlanExpense.findFirst({
    where: {
      id: lineId,
      headerId,
      header: { organizationId },
    },
  })
}

export { planInclude }
