import { BudgetStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { ENTITY_BUDGET_HEADER } from "@/lib/api/approval-constants"
import { startApprovalForEntity } from "@/lib/api/approval-workflow"
import { findBudgetHeaderOnly, resolveActorUserId } from "@/lib/api/budget-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.BUDGET_SUBMIT)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const existing = await findBudgetHeaderOnly(id, auth.organizationId)
    if (!existing) return fail("NOT_FOUND", "预算不存在或无权访问", 404)

    if (existing.status !== BudgetStatus.DRAFT) {
      return fail(
        "INVALID_STATE",
        "仅草稿状态的预算可以提交审批",
        409
      )
    }

    const actorId = await resolveActorUserId(auth)

    const updated = await prisma.budgetHeader.update({
      where: { id },
      data: {
        status: BudgetStatus.SUBMITTED,
        submittedAt: new Date(),
        updatedById: actorId,
      },
    })

    let approvalSpawn: { created: boolean; reason?: string } | null = null
    if (updated.approvalProcessId) {
      approvalSpawn = await startApprovalForEntity({
        processId: updated.approvalProcessId,
        entityType: ENTITY_BUDGET_HEADER,
        entityId: updated.id,
        organizationId: auth.organizationId,
      })
    }

    return ok({
      id: updated.id,
      status: updated.status,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
      message: updated.approvalProcessId
        ? "已提交审批，已尝试生成审批待办"
        : "已提交审批（未绑定审批流程时无待办记录）",
      approval: approvalSpawn,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
