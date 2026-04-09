import { CashPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { ENTITY_CASH_PLAN_HEADER } from "@/lib/api/approval-constants"
import { startApprovalForEntity } from "@/lib/api/approval-workflow"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(
      request,
      Permission.CASH_PLAN_SUBMIT
    )
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const existing = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)

    if (existing.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅编制中状态的资金计划可以提交审批", 409)
    }

    const updated = await prisma.cashPlanHeader.update({
      where: { id },
      data: {
        status: CashPlanStatus.SUBMITTED,
      },
    })

    let approvalSpawn: { created: boolean; reason?: string } | null = null
    if (updated.approvalProcessId) {
      approvalSpawn = await startApprovalForEntity({
        processId: updated.approvalProcessId,
        entityType: ENTITY_CASH_PLAN_HEADER,
        entityId: updated.id,
        organizationId: auth.organizationId,
      })
    }

    return ok({
      id: updated.id,
      status: updated.status,
      message: updated.approvalProcessId
        ? "已提交审批，已尝试生成审批待办"
        : "已提交审批（未绑定审批流程时无待办记录）",
      approval: approvalSpawn,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
