import { prisma } from "@/lib/prisma"
import { getAdjustmentDetailPayload } from "@/lib/api/adjustment-detail"
import {
  ENTITY_BUDGET_ADJUSTMENT,
  ENTITY_BUDGET_HEADER,
} from "@/lib/api/approval-constants"
import {
  canActorHandlePending,
  findCurrentPendingRecord,
  findProcessForOrg,
} from "@/lib/api/approval-workflow"
import { serializeApprovalProcess, serializeApprovalRecord } from "@/lib/api/approval-serialize"
import {
  findBudgetDetail,
  resolveActorUserId,
} from "@/lib/api/budget-queries"
import { serializeBudgetDetail } from "@/lib/api/budget-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { UserStatus } from "@/generated/prisma/enums"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ processId: string }> }

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { processId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get("entityType")?.trim()
    const entityId = searchParams.get("entityId")?.trim()

    if (!entityType || !entityId) {
      return fail(
        "VALIDATION_ERROR",
        "缺少查询参数 entityType 或 entityId",
        400
      )
    }

    const process = await findProcessForOrg(processId, auth.organizationId)
    if (!process) return fail("NOT_FOUND", "审批流程不存在或无权访问", 404)

    const [history, pending, resolvedActorId, usersInOrg] = await Promise.all([
      prisma.approvalRecord.findMany({
        where: {
          processId,
          entityType,
          entityId,
          process: { organizationId: auth.organizationId },
        },
        include: {
          node: { select: { id: true, name: true, sortOrder: true } },
          actorUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      findCurrentPendingRecord(
        processId,
        entityType,
        entityId,
        auth.organizationId
      ),
      resolveActorUserId(auth),
      prisma.user.findMany({
        where: {
          organizationId: auth.organizationId,
          status: UserStatus.ACTIVE,
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ])

    let budget = null as ReturnType<typeof serializeBudgetDetail> | null
    let adjustmentDetail = null as Awaited<
      ReturnType<typeof getAdjustmentDetailPayload>
    > | null

    if (entityType === ENTITY_BUDGET_HEADER) {
      const b = await findBudgetDetail(entityId, auth.organizationId)
      if (b) budget = serializeBudgetDetail(b)
    } else if (entityType === ENTITY_BUDGET_ADJUSTMENT) {
      adjustmentDetail = await getAdjustmentDetailPayload(
        entityId,
        auth.organizationId
      )
    }

    const canAct =
      !!pending &&
      !!resolvedActorId &&
      canActorHandlePending(resolvedActorId, pending)

    return ok({
      process: serializeApprovalProcess(process, process.nodes),
      entityType,
      entityId,
      budget,
      adjustmentDetail,
      history: history.map((r) => ({
        ...serializeApprovalRecord(r, {
          process: { name: process.name },
          node: r.node,
        }),
        actorName: r.actorUser?.name ?? r.actorUser?.email ?? null,
      })),
      pending: pending
        ? {
            id: pending.id,
            nodeId: pending.nodeId,
            nodeName: pending.node?.name ?? null,
            nodeSortOrder: pending.node?.sortOrder ?? null,
          }
        : null,
      canAct,
      usersInOrg,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
