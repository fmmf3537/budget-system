import { approvalRejectBodySchema } from "@/lib/api/approval-schemas"
import { runReject } from "@/lib/api/approval-workflow"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

type RouteCtx = { params: Promise<{ processId: string }> }

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.APPROVAL_APPROVE)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { processId } = await ctx.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = approvalRejectBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const resolvedActorId = await resolveActorUserId(auth)
    if (!resolvedActorId) {
      return fail(
        "NO_DB_USER",
        "当前模拟用户在数据库中不存在，无法执行审批（请使用已存在的 User.id 作为 x-mock-user-id）",
        403
      )
    }

    const result = await runReject({
      processId,
      organizationId: auth.organizationId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      resolvedActorId,
      comment: parsed.data.comment,
      returnToNodeId: parsed.data.returnToNodeId,
    })

    if (!result.ok) {
      if (result.code === "NO_PENDING") {
        return fail("NO_PENDING", "没有待处理的审批任务", 404)
      }
      if (result.code === "FORBIDDEN") {
        return fail("FORBIDDEN", "您无权处理该审批任务", 403)
      }
      if (result.code === "BAD_NODE") {
        return fail("BAD_NODE", "退回节点不存在或不属于该流程", 400)
      }
      if (result.code === "INVALID_RETURN") {
        return fail(
          "INVALID_RETURN",
          "仅能退回到当前节点之前的审批节点",
          400
        )
      }
      return fail("UNKNOWN", "操作失败", 400)
    }

    return ok({
      recordId: result.recordId,
      returned: result.returned,
      message: result.returned
        ? "已退回至所选节点，并生成新的待办"
        : "已驳回，关联预算（若为 BudgetHeader）将标记为已驳回",
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
