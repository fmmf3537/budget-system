import { BudgetStatus } from "@/generated/prisma/enums"
import { ENTITY_BUDGET_HEADER } from "@/lib/api/approval-constants"
import { withdrawSubmittedEntity } from "@/lib/api/approval-workflow"
import {
  findBudgetHeaderOnly,
  resolveActorUserId,
} from "@/lib/api/budget-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(
      _request,
      Permission.BUDGET_SUBMIT
    )
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const existing = await findBudgetHeaderOnly(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "预算不存在或无权访问", 404)

    if (existing.status !== BudgetStatus.SUBMITTED) {
      return fail("INVALID_STATE", "仅已提交审批的预算可以撤回", 409)
    }

    const actorId = await resolveActorUserId(auth)
    const orgId = auth.organizationId

    const result = await withdrawSubmittedEntity({
      organizationId: orgId,
      entityType: ENTITY_BUDGET_HEADER,
      entityId: id,
      resolvedActorId: actorId,
      finalizeDraft: async (tx) => {
        const r = await tx.budgetHeader.updateMany({
          where: {
            id,
            organizationId: orgId,
            status: BudgetStatus.SUBMITTED,
          },
          data: {
            status: BudgetStatus.DRAFT,
            submittedAt: null,
            updatedById: actorId,
          },
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
      status: BudgetStatus.DRAFT,
      message: "已撤回提交，预算已回到草稿",
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
