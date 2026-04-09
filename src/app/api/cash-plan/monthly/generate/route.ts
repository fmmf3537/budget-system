import { prisma } from "@/lib/prisma"
import { cashPlanMonthlyGenerateBodySchema } from "@/lib/api/cash-plan-schemas"
import { serializeCashPlanHeader } from "@/lib/api/cash-plan-serialize"
import { planInclude } from "@/lib/api/cash-plan-queries"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { validateRootDepartmentCode } from "@/lib/api/cash-plan-department-scope"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError } from "@/lib/api/response"
import { UserRole } from "@/lib/auth/roles"

function monthRange(month: string) {
  const [yStr, mStr] = month.split("-")
  const y = Number(yStr)
  const m = Number(mStr)
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
  return { start, end }
}

export async function POST(request: Request) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    if (auth.role !== UserRole.ADMIN) {
      return fail("FORBIDDEN", "Only admin can generate monthly master plan", 403)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "Request body must be JSON", 400)
    }

    const parsed = cashPlanMonthlyGenerateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const data = parsed.data
    if (!data.rootDepartmentCode?.trim()) {
      return fail("VALIDATION_ERROR", "必须选择顶级部门范围", 400)
    }
    const rootScope = await validateRootDepartmentCode(
      auth.organizationId,
      data.rootDepartmentCode
    )
    if (!rootScope.ok) {
      return fail("VALIDATION_ERROR", rootScope.message, 400)
    }

    const { start, end } = monthRange(data.month)

    const dup = await prisma.cashPlanHeader.findFirst({
      where: {
        organizationId: auth.organizationId,
        periodStart: start,
        periodEnd: end,
        rootDepartmentCode: rootScope.code,
      },
      select: { id: true },
    })
    if (dup) {
      return fail("DUPLICATE", "Master plan for this month/scope already exists", 409)
    }

    const actorId = await resolveActorUserId(auth)
    const plan = await prisma.cashPlanHeader.create({
      data: {
        organizationId: auth.organizationId,
        name: data.name?.trim() || `${data.month} Monthly Master Cash Plan`,
        rootDepartmentCode: rootScope.code,
        periodStart: start,
        periodEnd: end,
        approvalProcessId: data.approvalProcessId ?? null,
        createdById: actorId,
      },
      include: planInclude,
    })

    return created(
      serializeCashPlanHeader(
        plan,
        { incomes: plan.incomes, expenses: plan.expenses },
        { includeBalance: true }
      )
    )
  } catch (e) {
    return handleRouteError(e)
  }
}
