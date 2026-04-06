import { ApprovalAction } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { approvalListQuerySchema } from "@/lib/api/approval-schemas"
import { enrichApprovalTodoRows } from "@/lib/api/approval-todo-enrich"
import { serializeApprovalRecord } from "@/lib/api/approval-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import type { Prisma } from "@/generated/prisma/client"

export async function GET(request: Request) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const raw = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = approvalListQuerySchema.safeParse(raw)
    if (!parsed.success) return fromZodError(parsed.error)

    const { page, pageSize, processId, entityType } = parsed.data
    const skip = (page - 1) * pageSize

    const resolvedActorId = await resolveActorUserId(auth)
    if (!resolvedActorId) {
      return fail(
        "NO_DB_USER",
        "当前模拟用户在数据库中不存在，无法查询待办（请使用已存在的 User.id 作为 x-mock-user-id）",
        403
      )
    }

    const assigneeOrOpen: Prisma.ApprovalRecordWhereInput = {
      OR: [
        { actorUserId: resolvedActorId },
        {
          AND: [
            { actorUserId: null },
            { node: { approverUserId: resolvedActorId } },
          ],
        },
        {
          AND: [
            { actorUserId: null },
            { node: { approverUserId: null } },
          ],
        },
      ],
    }

    const where: Prisma.ApprovalRecordWhereInput = {
      action: ApprovalAction.PENDING,
      process: { organizationId: auth.organizationId },
      ...assigneeOrOpen,
      ...(processId ? { processId } : {}),
      ...(entityType ? { entityType } : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.approvalRecord.count({ where }),
      prisma.approvalRecord.findMany({
        where,
        include: {
          process: { select: { name: true, bizType: true } },
          node: { select: { name: true, sortOrder: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ])

    const enrichMap = await enrichApprovalTodoRows(
      rows.map((r) => ({
        entityType: r.entityType,
        entityId: r.entityId,
        createdAt: r.createdAt,
      })),
      auth.organizationId
    )

    return ok({
      items: rows.map((r) => {
        const key = `${r.entityType}:${r.entityId}`
        const e = enrichMap.get(key)
        return {
          ...serializeApprovalRecord(r, {
            process: r.process,
            node: r.node,
          }),
          processBizType: r.process.bizType,
          entityTitle: e?.entityTitle ?? null,
          applicantName: e?.applicantName ?? null,
          applicationTime: e?.applicationTime ?? r.createdAt.toISOString(),
        }
      }),
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
