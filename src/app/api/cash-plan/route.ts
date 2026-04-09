import { prisma } from "@/lib/prisma"
import {
  cashPlanCreateBodySchema,
  cashPlanListQuerySchema,
} from "@/lib/api/cash-plan-schemas"
import { serializeCashPlanHeader } from "@/lib/api/cash-plan-serialize"
import { planInclude } from "@/lib/api/cash-plan-queries"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import type { Prisma } from "@/generated/prisma/client"
import { UserRole } from "@/lib/auth/roles"
import { validateRootDepartmentCode } from "@/lib/api/cash-plan-department-scope"

function orderByFromQuery(
  sortBy: string,
  sortOrder: "asc" | "desc"
): Prisma.CashPlanHeaderOrderByWithRelationInput {
  switch (sortBy) {
    case "updatedAt":
      return { updatedAt: sortOrder }
    case "name":
      return { name: sortOrder }
    case "periodStart":
      return { periodStart: sortOrder }
    case "periodEnd":
      return { periodEnd: sortOrder }
    case "status":
      return { status: sortOrder }
    default:
      return { createdAt: sortOrder }
  }
}

export async function GET(request: Request) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_VIEW)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const raw = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = cashPlanListQuerySchema.safeParse(raw)
    if (!parsed.success) return fromZodError(parsed.error)

    const { page, pageSize, status, q, sortBy, sortOrder } = parsed.data
    const skip = (page - 1) * pageSize

    const where: Prisma.CashPlanHeaderWhereInput = {
      organizationId: auth.organizationId,
      ...(status !== undefined ? { status } : {}),
      ...(q
        ? {
            name: { contains: q, mode: "insensitive" },
          }
        : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.cashPlanHeader.count({ where }),
      prisma.cashPlanHeader.findMany({
        where,
        orderBy: orderByFromQuery(sortBy, sortOrder),
        skip,
        take: pageSize,
      }),
    ])

    return ok({
      items: rows.map((h) =>
        serializeCashPlanHeader(h, undefined, {
          includeBalance: auth.role === UserRole.ADMIN,
        })
      ),
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
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_EDIT)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = cashPlanCreateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const data = parsed.data
    const ps = new Date(data.periodStart)
    const pe = new Date(data.periodEnd)
    if (ps > pe) {
      return fail("VALIDATION_ERROR", "periodStart 不能晚于 periodEnd", 400)
    }

    const actorId = await resolveActorUserId(auth)
    const rootScope = await validateRootDepartmentCode(
      auth.organizationId,
      data.rootDepartmentCode
    )
    if (!rootScope.ok) {
      return fail("VALIDATION_ERROR", rootScope.message, 400)
    }

    const plan = await prisma.cashPlanHeader.create({
      data: {
        organizationId: auth.organizationId,
        name: data.name ?? null,
        rootDepartmentCode: rootScope.code,
        periodStart: ps,
        periodEnd: pe,
        approvalProcessId: data.approvalProcessId ?? null,
        createdById: actorId,
      },
      include: planInclude,
    })

    return created(
      serializeCashPlanHeader(
        plan,
        { incomes: plan.incomes, expenses: plan.expenses },
        { includeBalance: auth.role === UserRole.ADMIN }
      )
    )
  } catch (e) {
    return handleRouteError(e)
  }
}
