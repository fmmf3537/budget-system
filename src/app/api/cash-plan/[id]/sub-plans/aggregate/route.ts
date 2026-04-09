import { CashPlanSubPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import { UserRole } from "@/lib/auth/roles"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_VIEW)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const parent = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!parent) return fail("NOT_FOUND", "月度主计划不存在或无权访问", 404)
    const actorId = await resolveActorUserId(auth)
    const nonAdminCreatedByFilter =
      auth.role === UserRole.ADMIN
        ? {}
        : actorId
          ? { createdById: actorId }
          : { id: "__none__" }

    const approvedSubPlans = await prisma.cashPlanSubPlan.findMany({
      where: {
        organizationId: auth.organizationId,
        parentHeaderId: id,
        status: CashPlanSubPlanStatus.APPROVED,
        ...nonAdminCreatedByFilter,
      },
      select: { id: true },
    })
    const approvedIds = approvedSubPlans.map((s) => s.id)
    if (approvedIds.length === 0) {
      return ok({
        approvedSubPlanCount: 0,
        totalInflow: "0",
        totalOutflow: "0",
        netFlow: "0",
      })
    }

    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.cashPlanSubPlanIncome.aggregate({
        where: { subPlanId: { in: approvedIds } },
        _sum: { amount: true },
      }),
      prisma.cashPlanSubPlanExpense.aggregate({
        where: { subPlanId: { in: approvedIds } },
        _sum: { amount: true },
      }),
    ])
    const inc = Number(incomeAgg._sum.amount ?? 0)
    const exp = Number(expenseAgg._sum.amount ?? 0)
    const net = inc - exp

    return ok({
      approvedSubPlanCount: approvedIds.length,
      totalInflow: inc.toFixed(2),
      totalOutflow: exp.toFixed(2),
      netFlow: net.toFixed(2),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
