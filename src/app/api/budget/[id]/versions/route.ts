import { findBudgetHeaderOnly } from "@/lib/api/budget-queries"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * 当前库表未单独存历史版本时，仅返回当前头表上的 `version` 快照。
 * 后续可引入 `budget_header_revision` 等表扩展为多条记录。
 */
export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    const header = await findBudgetHeaderOnly(id, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "预算不存在或无权访问", 404)

    return ok({
      versions: [
        {
          version: header.version,
          isCurrent: true,
          status: header.status,
          name: header.name,
          fiscalYear: header.fiscalYear,
          totalAmount: header.totalAmount?.toString() ?? null,
          createdAt: header.createdAt.toISOString(),
          updatedAt: header.updatedAt.toISOString(),
          submittedAt: header.submittedAt?.toISOString() ?? null,
          approvedAt: header.approvedAt?.toISOString() ?? null,
        },
      ],
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
