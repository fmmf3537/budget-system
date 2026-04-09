import { CashPlanSubPlanStatus, CashPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { ENTITY_CASH_PLAN_SUB_PLAN } from "@/lib/api/approval-constants"
import { startApprovalForEntity } from "@/lib/api/approval-workflow"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import {
  findCashPlanHeaderOnly,
  findCashPlanSubPlanHeaderOnly,
} from "@/lib/api/cash-plan-queries"
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

    const actorId = await resolveActorUserId(auth)
    if (!actorId) {
      return fail("FORBIDDEN", "当前用户不存在，无法提交子计划", 403)
    }

    const sub = await findCashPlanSubPlanHeaderOnly(subId, auth.organizationId)
    if (!sub) return fail("NOT_FOUND", "子计划不存在或无权访问", 404)
    if (sub.createdById !== actorId) {
      return fail("FORBIDDEN", "仅子计划创建人可提交", 403)
    }
    const parent = await findCashPlanHeaderOnly(sub.parentHeaderId, auth.organizationId)
    if (!parent) return fail("NOT_FOUND", "主计划不存在或无权访问", 404)
    if (parent.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "主计划非编制中，子计划不可提交", 409)
    }
    if (sub.status !== CashPlanSubPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿子计划可提交", 409)
    }

    const updated = await prisma.cashPlanSubPlan.update({
      where: { id: subId },
      data: { status: CashPlanSubPlanStatus.SUBMITTED },
    })

    let approvalSpawn: { created: boolean; reason?: string } | null = null
    const processId = updated.approvalProcessId ?? parent.approvalProcessId
    if (processId) {
      approvalSpawn = await startApprovalForEntity({
        processId,
        entityType: ENTITY_CASH_PLAN_SUB_PLAN,
        entityId: updated.id,
        organizationId: auth.organizationId,
      })
    }

    return ok({
      id: updated.id,
      status: updated.status,
      message: processId
        ? "子计划已提交审批，已尝试生成审批待办"
        : "子计划已提交（未绑定审批流程时无待办记录）",
      approval: approvalSpawn,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
