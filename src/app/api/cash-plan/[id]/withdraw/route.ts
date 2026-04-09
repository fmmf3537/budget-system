import { CashPlanStatus } from "@/generated/prisma/enums"
import { ENTITY_CASH_PLAN_HEADER } from "@/lib/api/approval-constants"
import { withdrawSubmittedEntity } from "@/lib/api/approval-workflow"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(
      _request,
      Permission.CASH_PLAN_SUBMIT
    )
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const existing = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)

    if (existing.status !== CashPlanStatus.SUBMITTED) {
      return fail("INVALID_STATE", "仅已提交审批的资金计划可以撤回", 409)
    }

    const actorId = await resolveActorUserId(auth)
    const orgId = auth.organizationId

    const result = await withdrawSubmittedEntity({
      organizationId: orgId,
      entityType: ENTITY_CASH_PLAN_HEADER,
      entityId: id,
      resolvedActorId: actorId,
      finalizeDraft: async (tx) => {
        const r = await tx.cashPlanHeader.updateMany({
          where: {
            id,
            organizationId: orgId,
            status: CashPlanStatus.SUBMITTED,
          },
          data: { status: CashPlanStatus.DRAFT },
        })
        return { updated: r.count > 0 }
      },
    })

    if (!result.ok) {
      if (result.code === "HAS_APPROVED") {
        return fail(
          "INVALID_STATE",
          "已有审批通过记录，无法撤回提交",
          409
        )
      }
      return fail("INVALID_STATE", "当前状态不可撤回", 409)
    }

    return ok({
      id,
      status: CashPlanStatus.DRAFT,
      message: "已撤回提交，资金计划已回到编制中",
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
