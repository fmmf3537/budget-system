import { CashPlanSubPlanStatus } from "@/generated/prisma/enums"
import { ENTITY_CASH_PLAN_SUB_PLAN } from "@/lib/api/approval-constants"
import { withdrawSubmittedEntity } from "@/lib/api/approval-workflow"
import { findCashPlanSubPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ subId: string }> }

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(
      request,
      Permission.CASH_PLAN_SUBMIT
    )
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { subId } = await ctx.params

    const sub = await findCashPlanSubPlanHeaderOnly(subId, auth.organizationId)
    if (!sub) return fail("NOT_FOUND", "子计划不存在或无权访问", 404)
    if (sub.status !== CashPlanSubPlanStatus.SUBMITTED) {
      return fail("INVALID_STATE", "仅已提交子计划可撤回", 409)
    }

    const actorId = await resolveActorUserId(auth)
    const result = await withdrawSubmittedEntity({
      organizationId: auth.organizationId,
      entityType: ENTITY_CASH_PLAN_SUB_PLAN,
      entityId: subId,
      resolvedActorId: actorId,
      finalizeDraft: async (tx) => {
        const r = await tx.cashPlanSubPlan.updateMany({
          where: {
            id: subId,
            organizationId: auth.organizationId,
            status: CashPlanSubPlanStatus.SUBMITTED,
          },
          data: { status: CashPlanSubPlanStatus.DRAFT },
        })
        return { updated: r.count > 0 }
      },
    })
    if (!result.ok) {
      if (result.code === "HAS_APPROVED") {
        return fail("INVALID_STATE", "已有审批通过记录，无法撤回提交", 409)
      }
      return fail("INVALID_STATE", "当前状态不可撤回", 409)
    }

    return ok({
      id: subId,
      status: CashPlanSubPlanStatus.DRAFT,
      message: "已撤回提交，子计划已回到草稿",
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
