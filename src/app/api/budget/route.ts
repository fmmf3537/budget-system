import { prisma } from "@/lib/prisma"
import {
  budgetCreateBodySchema,
  budgetListQuerySchema,
} from "@/lib/api/budget-schemas"
import {
  budgetLinesInclude,
  resolveActorUserId,
  validateSubjectIdsForOrg,
} from "@/lib/api/budget-queries"
import { serializeBudgetDetail, serializeBudgetHeader } from "@/lib/api/budget-serialize"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import type { Prisma } from "@/generated/prisma/client"

function orderByFromQuery(
  sortBy: string,
  sortOrder: "asc" | "desc"
): Prisma.BudgetHeaderOrderByWithRelationInput {
  switch (sortBy) {
    case "updatedAt":
      return { updatedAt: sortOrder }
    case "name":
      return { name: sortOrder }
    case "fiscalYear":
      return { fiscalYear: sortOrder }
    case "status":
      return { status: sortOrder }
    case "version":
      return { version: sortOrder }
    default:
      return { createdAt: sortOrder }
  }
}

export async function GET(request: Request) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.BUDGET_VIEW)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const raw = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = budgetListQuerySchema.safeParse(raw)
    if (!parsed.success) return fromZodError(parsed.error)

    const { page, pageSize, status, fiscalYear, q, sortBy, sortOrder } =
      parsed.data
    const skip = (page - 1) * pageSize

    const where: Prisma.BudgetHeaderWhereInput = {
      organizationId: auth.organizationId,
      ...(status !== undefined ? { status } : {}),
      ...(fiscalYear !== undefined ? { fiscalYear } : {}),
      ...(q
        ? {
            name: { contains: q, mode: "insensitive" },
          }
        : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.budgetHeader.count({ where }),
      prisma.budgetHeader.findMany({
        where,
        orderBy: orderByFromQuery(sortBy, sortOrder),
        skip,
        take: pageSize,
      }),
    ])

    return ok({
      items: rows.map((h) => serializeBudgetHeader(h)),
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
    const authOrErr = await requireApiPermission(request, Permission.BUDGET_CREATE)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = budgetCreateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const data = parsed.data
    if (data.periodStart && data.periodEnd && data.periodStart > data.periodEnd) {
      return fail("VALIDATION_ERROR", "periodStart 不能晚于 periodEnd", 400)
    }

    const subjectIds = data.lines.map((l) => l.subjectId)
    const subjectsOk = await validateSubjectIdsForOrg(
      auth.organizationId,
      subjectIds
    )
    if (!subjectsOk) {
      return fail(
        "BAD_REFERENCE",
        "部分预算科目不存在或不属于当前组织",
        400
      )
    }

    const actorId = await resolveActorUserId(auth)

    const header = await prisma.$transaction(async (tx) => {
      const h = await tx.budgetHeader.create({
        data: {
          organizationId: auth.organizationId,
          fiscalYear: data.fiscalYear,
          name: data.name,
          code: data.code ?? null,
          currency: data.currency ?? "CNY",
          periodStart: data.periodStart ? new Date(data.periodStart) : null,
          periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
          compilationMethod: data.compilationMethod ?? null,
          approvalProcessId: data.approvalProcessId ?? null,
          createdById: actorId,
          totalAmount: 0,
        },
      })

      if (data.lines.length > 0) {
        await tx.budgetLine.createMany({
          data: data.lines.map((l) => ({
            headerId: h.id,
            subjectId: l.subjectId,
            amount: l.amount,
            amountYtd: l.amountYtd ?? null,
            remark: l.remark ?? null,
            departmentCode: l.departmentCode ?? null,
            dimension1: l.dimension1 ?? null,
            dimension2: l.dimension2 ?? null,
          })),
        })
      }

      const agg = await tx.budgetLine.aggregate({
        where: { headerId: h.id },
        _sum: { amount: true },
      })
      await tx.budgetHeader.update({
        where: { id: h.id },
        data: { totalAmount: agg._sum.amount ?? 0 },
      })

      return tx.budgetHeader.findFirstOrThrow({
        where: { id: h.id },
        include: { lines: budgetLinesInclude },
      })
    })

    return created(serializeBudgetDetail(header))
  } catch (e) {
    return handleRouteError(e)
  }
}
