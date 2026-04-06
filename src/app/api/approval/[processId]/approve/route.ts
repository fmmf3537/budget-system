import { approvalEntityBodySchema } from "@/lib/api/approval-schemas"
import { runApprove } from "@/lib/api/approval-workflow"
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

    const parsed = approvalEntityBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const resolvedActorId = await resolveActorUserId(auth)
    if (!resolvedActorId) {
      return fail(
        "NO_DB_USER",
        "当前模拟用户在数据库中不存在，无法执行审批（请使用已存在的 User.id 作为 x-mock-user-id）",
        403
      )
    }

    const result = await runApprove({
      processId,
      organizationId: auth.organizationId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      resolvedActorId,
      comment: parsed.data.comment,
    })

    if (!result.ok) {
      if (result.code === "NO_PENDING") {
        return fail("NO_PENDING", "没有待处理的审批任务", 404)
      }
      if (result.code === "FORBIDDEN") {
        return fail("FORBIDDEN", "您无权处理该审批任务", 403)
      }
      if (result.code === "NOT_FOUND") {
        return fail("NOT_FOUND", "审批流程不存在", 404)
      }
      return fail("UNKNOWN", "操作失败", 400)
    }

    return ok({
      recordId: result.recordId,
      flowCompleted: result.completed === true,
      message: result.completed
        ? "审批流程已完成"
        : "已同意，已流转至下一节点",
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
