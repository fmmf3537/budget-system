import { findProcessForOrg } from "@/lib/api/approval-workflow"
import { serializeApprovalProcess } from "@/lib/api/approval-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ processId: string }> }

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { processId } = await ctx.params

    const process = await findProcessForOrg(processId, auth.organizationId)
    if (!process) return fail("NOT_FOUND", "审批流程不存在或无权访问", 404)

    return ok(serializeApprovalProcess(process, process.nodes))
  } catch (e) {
    return handleRouteError(e)
  }
}
