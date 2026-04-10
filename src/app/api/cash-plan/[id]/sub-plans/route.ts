import { CashPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { cashPlanSubPlanCreateSchema } from "@/lib/api/cash-plan-schemas"
import {
  findCashPlanHeaderOnly,
  listCashPlanSubPlans,
} from "@/lib/api/cash-plan-queries"
import { serializeCashPlanSubPlan } from "@/lib/api/cash-plan-serialize"
import { validateSubPlanDepartmentScope } from "@/lib/api/cash-plan-department-scope"
import { resolveActorUserId } from "@/lib/api/budget-queries"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import { UserRole } from "@/lib/auth/roles"

type RouteCtx = { params: Promise<{ id: string }> }

function parsePositiveAmount(value: string): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function withinPeriod(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_VIEW)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const parent = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!parent) return fail("NOT_FOUND", "Master cash plan not found", 404)

    const actorId = await resolveActorUserId(auth)
    const rows =
      auth.role === UserRole.ADMIN
        ? await listCashPlanSubPlans(id, auth.organizationId)
        : await prisma.cashPlanSubPlan.findMany({
            where: {
              parentHeaderId: id,
              organizationId: auth.organizationId,
              ...(actorId ? { createdById: actorId } : { id: "__none__" }),
            },
            orderBy: { createdAt: "desc" },
            include: {
              incomes: { orderBy: { expectedDate: "asc" } },
              expenses: { orderBy: { expectedDate: "asc" } },
              createdBy: { select: { id: true, name: true, email: true } },
            },
          })
    return ok({
      items: rows.map((s) =>
        serializeCashPlanSubPlan(s, {
          incomes: s.incomes,
          expenses: s.expenses,
        })
      ),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const authOrErr = await requireApiPermission(request, Permission.CASH_PLAN_EDIT)
    if (authOrErr instanceof Response) return authOrErr
    const auth = authOrErr
    const { id } = await ctx.params

    const parent = await findCashPlanHeaderOnly(id, auth.organizationId)
    if (!parent) return fail("NOT_FOUND", "Master cash plan not found", 404)
    if (parent.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "Only DRAFT master plan can create sub-plan", 409)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "Request body must be JSON", 400)
    }

    const parsed = cashPlanSubPlanCreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const d = parsed.data
    for (const line of [...d.incomes, ...d.expenses]) {
      if (parsePositiveAmount(line.amount) == null) {
        return fail("VALIDATION_ERROR", "Sub-plan line amount must be greater than 0", 400)
      }
      if (line.expectedDate) {
        const dt = new Date(line.expectedDate)
        if (!withinPeriod(dt, parent.periodStart, parent.periodEnd)) {
          return fail(
            "VALIDATION_ERROR",
            "Sub-plan line date must be within master plan period",
            400
          )
        }
      }
    }

    const scopeOk = await validateSubPlanDepartmentScope({
      organizationId: auth.organizationId,
      rootDepartmentCode: parent.rootDepartmentCode,
      scopeDepartmentCode: d.scopeDepartmentCode,
    })
    if (!scopeOk.ok) return fail("VALIDATION_ERROR", scopeOk.message, 400)

    const actorId = await resolveActorUserId(auth)

    const row = await prisma.$transaction(async (tx) => {
      const sub = await tx.cashPlanSubPlan.create({
        data: {
          organizationId: auth.organizationId,
          parentHeaderId: id,
          scopeDepartmentCode: d.scopeDepartmentCode,
          name: d.name ?? null,
          approvalProcessId: d.approvalProcessId ?? parent.approvalProcessId ?? null,
          createdById: actorId,
        },
      })

      if (d.incomes.length > 0) {
        await tx.cashPlanSubPlanIncome.createMany({
          data: d.incomes.map((r) => ({
            subPlanId: sub.id,
            category: r.category ?? null,
            amount: r.amount,
            expectedDate: r.expectedDate ? new Date(r.expectedDate) : null,
            remark: r.remark ?? null,
          })),
        })
      }

      if (d.expenses.length > 0) {
        await tx.cashPlanSubPlanExpense.createMany({
          data: d.expenses.map((r) => ({
            subPlanId: sub.id,
            category: r.category ?? null,
            amount: r.amount,
            expectedDate: r.expectedDate ? new Date(r.expectedDate) : null,
            remark: r.remark ?? null,
          })),
        })
      }

      return tx.cashPlanSubPlan.findFirstOrThrow({
        where: { id: sub.id },
        include: {
          incomes: { orderBy: { expectedDate: "asc" } },
          expenses: { orderBy: { expectedDate: "asc" } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })
    })

    return created(
      serializeCashPlanSubPlan(row, {
        incomes: row.incomes,
        expenses: row.expenses,
      })
    )
  } catch (e) {
    return handleRouteError(e)
  }
}
