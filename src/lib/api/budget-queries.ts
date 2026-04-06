import { prisma } from "@/lib/prisma"
import type { MockAuthContext } from "@/lib/api/mock-auth"
import type { BudgetHeaderWithLines } from "@/lib/api/budget-serialize"
import type { Prisma } from "@/generated/prisma/client"

export const budgetLinesInclude = {
  include: { subject: true },
  orderBy: { createdAt: "asc" as const },
}

export async function resolveActorUserId(
  auth: MockAuthContext
): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: { id: auth.userId, organizationId: auth.organizationId },
    select: { id: true },
  })
  return u?.id ?? null
}

export async function findBudgetDetail(
  id: string,
  organizationId: string
): Promise<BudgetHeaderWithLines | null> {
  const row = await prisma.budgetHeader.findFirst({
    where: { id, organizationId },
    include: { lines: budgetLinesInclude },
  })
  return row as BudgetHeaderWithLines | null
}

export async function findBudgetHeaderOnly(
  id: string,
  organizationId: string
) {
  return prisma.budgetHeader.findFirst({
    where: { id, organizationId },
  })
}

export async function validateSubjectIdsForOrg(
  organizationId: string,
  subjectIds: string[]
): Promise<boolean> {
  if (subjectIds.length === 0) return true
  const unique = [...new Set(subjectIds)]
  const count = await prisma.budgetSubject.count({
    where: {
      id: { in: unique },
      OR: [{ organizationId }, { organizationId: null }],
    },
  })
  return count === unique.length
}

export type BudgetLineWriteInput = {
  subjectId: string
  amount: string
  amountYtd?: string | null
  remark?: string | null
  departmentCode?: string | null
  dimension1?: string | null
  dimension2?: string | null
}

export async function replaceBudgetLinesInTransaction(
  tx: Prisma.TransactionClient,
  headerId: string,
  lines: BudgetLineWriteInput[]
) {
  await tx.budgetLine.deleteMany({ where: { headerId } })
  if (lines.length > 0) {
    await tx.budgetLine.createMany({
      data: lines.map((l) => ({
        headerId,
        subjectId: l.subjectId,
        amount: l.amount,
        amountYtd: l.amountYtd ?? null,
        remark: l.remark ?? null,
        departmentCode: l.departmentCode ?? null,
        dimension1: l.dimension1 ?? null,
        dimension2: l.dimension2 ?? null,
      })),
    })
  }
  const agg = await tx.budgetLine.aggregate({
    where: { headerId },
    _sum: { amount: true },
  })
  await tx.budgetHeader.update({
    where: { id: headerId },
    data: { totalAmount: agg._sum.amount ?? 0 },
  })
}

export async function replaceBudgetLines(
  headerId: string,
  lines: BudgetLineWriteInput[]
) {
  await prisma.$transaction(async (tx) => {
    await replaceBudgetLinesInTransaction(tx, headerId, lines)
  })
}
