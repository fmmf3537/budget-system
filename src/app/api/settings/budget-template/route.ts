import { prisma } from "@/lib/prisma"
import { BUDGET_COMPILATION_METHODS } from "@/lib/api/budget-schemas"
import { orgBudgetTemplateSettingsPutSchema } from "@/lib/api/budget-subject-schemas"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"

const DEFAULT_METHODS = [...BUDGET_COMPILATION_METHODS]

function defaultPayload() {
  return {
    departmentFieldLabel: null as string | null,
    dimension1Label: null as string | null,
    dimension2Label: null as string | null,
    enabledCompilationMethods: DEFAULT_METHODS,
  }
}

export async function GET(request: Request) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const row = await prisma.orgBudgetTemplateSettings.findUnique({
      where: { organizationId: auth.organizationId },
    })

    if (!row) {
      return ok(defaultPayload())
    }

    return ok({
      departmentFieldLabel: row.departmentFieldLabel,
      dimension1Label: row.dimension1Label,
      dimension2Label: row.dimension2Label,
      enabledCompilationMethods:
        row.enabledCompilationMethods.length > 0
          ? row.enabledCompilationMethods
          : DEFAULT_METHODS,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PUT(request: Request) {
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

    const parsed = orgBudgetTemplateSettingsPutSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const d = parsed.data

    const row = await prisma.orgBudgetTemplateSettings.upsert({
      where: { organizationId: auth.organizationId },
      create: {
        organizationId: auth.organizationId,
        departmentFieldLabel: d.departmentFieldLabel ?? null,
        dimension1Label: d.dimension1Label ?? null,
        dimension2Label: d.dimension2Label ?? null,
        enabledCompilationMethods: d.enabledCompilationMethods,
      },
      update: {
        departmentFieldLabel: d.departmentFieldLabel ?? null,
        dimension1Label: d.dimension1Label ?? null,
        dimension2Label: d.dimension2Label ?? null,
        enabledCompilationMethods: d.enabledCompilationMethods,
      },
    })

    return ok({
      departmentFieldLabel: row.departmentFieldLabel,
      dimension1Label: row.dimension1Label,
      dimension2Label: row.dimension2Label,
      enabledCompilationMethods: row.enabledCompilationMethods,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
