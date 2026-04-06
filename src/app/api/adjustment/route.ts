import { ApprovalBizType } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import {
  adjustmentCreateBodySchema,
  adjustmentListQuerySchema,
} from "@/lib/api/adjustment-schemas"
import {
  adjustmentWithDetailsInclude,
  computeLineAmountDelta,
  computeTotalNetDelta,
  serializeAdjustment,
  serializeAdjustmentListItem,
} from "@/lib/api/adjustment-serialize"
import {
  findBudgetHeaderOnly,
  resolveActorUserId,
  validateSubjectIdsForOrg,
} from "@/lib/api/budget-queries"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import type { Prisma } from "@/generated/prisma/client"

const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024

function stripDataUrlBase64(raw: string): string {
  const s = raw.trim()
  const idx = s.indexOf("base64,")
  if (idx !== -1) return s.slice(idx + 7)
  return s
}

export async function GET(request: Request) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const raw = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = adjustmentListQuerySchema.safeParse(raw)
    if (!parsed.success) return fromZodError(parsed.error)

    const { page, pageSize, status, q, sortBy, sortOrder } = parsed.data
    const skip = (page - 1) * pageSize

    const where: Prisma.BudgetAdjustmentWhereInput = {
      organizationId: auth.organizationId,
      ...(status !== undefined ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { reason: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const orderBy: Prisma.BudgetAdjustmentOrderByWithRelationInput =
      sortBy === "createdAt"
        ? { createdAt: sortOrder }
        : { updatedAt: sortOrder }

    const [total, rows] = await Promise.all([
      prisma.budgetAdjustment.count({ where }),
      prisma.budgetAdjustment.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          budgetHeader: {
            select: {
              name: true,
              fiscalYear: true,
              compilationGranularity: true,
              periodUnit: true,
            },
          },
        },
      }),
    ])

    return ok({
      items: rows.map((r) => serializeAdjustmentListItem(r)),
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

export async function POST(request: Request) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = adjustmentCreateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const data = parsed.data

    const header = await findBudgetHeaderOnly(
      data.budgetHeaderId,
      auth.organizationId
    )
    if (!header) {
      return fail("NOT_FOUND", "原预算不存在或无权访问", 404)
    }

    if (data.approvalProcessId?.trim()) {
      const proc = await prisma.approvalProcess.findFirst({
        where: {
          id: data.approvalProcessId.trim(),
          organizationId: auth.organizationId,
          isActive: true,
          bizType: ApprovalBizType.BUDGET_ADJUSTMENT,
        },
      })
      if (!proc) {
        return fail(
          "BAD_REFERENCE",
          "审批流程不存在、未启用或业务类型不是「预算调整」",
          400
        )
      }
    }

    const subjectIds = new Set<string>()
    for (const d of data.details) {
      const s = d.sourceSubjectId?.trim()
      const t = d.targetSubjectId?.trim()
      if (s) subjectIds.add(s)
      if (t) subjectIds.add(t)
    }
    const subjectsOk = await validateSubjectIdsForOrg(
      auth.organizationId,
      [...subjectIds]
    )
    if (!subjectsOk) {
      return fail(
        "BAD_REFERENCE",
        "部分预算科目不存在或不属于当前组织",
        400
      )
    }

    let attachmentName: string | null = null
    let attachmentMime: string | null = null
    let attachmentDataBase64: string | null = null
    if (data.attachment) {
      const b64 = stripDataUrlBase64(data.attachment.dataBase64)
      const approxBytes = (b64.length * 3) / 4
      if (approxBytes > ATTACHMENT_MAX_BYTES) {
        return fail("PAYLOAD_TOO_LARGE", "附件过大（演示环境上限 2MB）", 400)
      }
      attachmentName = data.attachment.name.trim()
      attachmentMime = data.attachment.mime?.trim() || null
      attachmentDataBase64 = b64
    }

    const amounts = data.details.map((d) => Number(d.amount))
    const totalNet = computeTotalNetDelta(data.kind, amounts)

    const actorId = await resolveActorUserId(auth)

    const row = await prisma.budgetAdjustment.create({
      data: {
        organizationId: auth.organizationId,
        budgetHeaderId: data.budgetHeaderId,
        title: data.title?.trim() || null,
        reason: data.reason.trim(),
        kind: data.kind,
        totalDelta: totalNet,
        requesterId: actorId,
        approvalProcessId: data.approvalProcessId?.trim() || null,
        attachmentName,
        attachmentMime,
        attachmentDataBase64,
        details: {
          create: data.details.map((d) => {
            const src = d.sourceSubjectId?.trim() || null
            const tgt = d.targetSubjectId?.trim() || null
            const amt = Number(d.amount)
            return {
              budgetLineId: d.budgetLineId?.trim() || null,
              sourceSubjectId: src,
              targetSubjectId: tgt,
              subjectId: src ?? tgt,
              sourceProject: d.sourceProject?.trim() || null,
              targetProject: d.targetProject?.trim() || null,
              amountDelta: computeLineAmountDelta(data.kind, amt),
              remark: d.remark?.trim() || null,
            }
          }),
        },
      },
      include: adjustmentWithDetailsInclude,
    })

    return created(serializeAdjustment(row))
  } catch (e) {
    return handleRouteError(e)
  }
}
