import { getAdjustmentDetailPayload } from "@/lib/api/adjustment-detail"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    const payload = await getAdjustmentDetailPayload(id, auth.organizationId)
    if (!payload) return fail("NOT_FOUND", "调整单不存在或无权访问", 404)

    return ok(payload)
  } catch (e) {
    return handleRouteError(e)
  }
}
