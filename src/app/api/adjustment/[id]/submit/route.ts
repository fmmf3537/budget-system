import { AdjustmentStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { ENTITY_BUDGET_ADJUSTMENT } from "@/lib/api/approval-constants"
import { startApprovalForEntity } from "@/lib/api/approval-workflow"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(req)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    const existing = await prisma.budgetAdjustment.findFirst({
      where: { id, organizationId: auth.organizationId },
    })
    if (!existing) {
      return fail("NOT_FOUND", "调整单不存在或无权访问", 404)
    }

    if (existing.status !== AdjustmentStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿状态的调整单可以提交审批", 409)
    }

    const actorId = await resolveActorUserId(auth)

    const updated = await prisma.budgetAdjustment.update({
      where: { id },
      data: {
        status: AdjustmentStatus.SUBMITTED,
        requesterId: existing.requesterId ?? actorId,
      },
    })

    let approvalSpawn: { created: boolean; reason?: string } | null = null
    if (updated.approvalProcessId) {
      approvalSpawn = await startApprovalForEntity({
        processId: updated.approvalProcessId,
        entityType: ENTITY_BUDGET_ADJUSTMENT,
        entityId: updated.id,
        organizationId: auth.organizationId,
      })
    }

    return ok({
      id: updated.id,
      status: updated.status,
      message: updated.approvalProcessId
        ? "已提交审批，已尝试生成审批待办"
        : "已提交（未绑定审批流程时无待办记录）",
      approval: approvalSpawn,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
