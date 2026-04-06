import { prisma } from "@/lib/prisma"
import { ENTITY_CASH_PLAN_HEADER } from "@/lib/api/cash-plan-constants"
import { cashPlanWarningsQuerySchema } from "@/lib/api/cash-plan-schemas"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { serializeWarningRecord } from "@/lib/api/cash-plan-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import type { Prisma } from "@/generated/prisma/client"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id } = await ctx.params

    const raw = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = cashPlanWarningsQuerySchema.safeParse(raw)
    if (!parsed.success) return fromZodError(parsed.error)

    const header = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)

    const { page, pageSize, includeResolved } = parsed.data
    const skip = (page - 1) * pageSize

    const where: Prisma.WarningRecordWhereInput = {
      organizationId: auth.organizationId,
      entityType: ENTITY_CASH_PLAN_HEADER,
      entityId: id,
      ...(includeResolved ? {} : { isResolved: false }),
    }

    const [total, rows] = await Promise.all([
      prisma.warningRecord.count({ where }),
      prisma.warningRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ])

    return ok({
      items: rows.map(serializeWarningRecord),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
