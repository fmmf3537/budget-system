import { prisma } from "@/lib/prisma"
import { cashPlanCategoryCreateSchema } from "@/lib/api/master-data-schemas"
import { requireAuth } from "@/lib/api/request-auth"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import { CashPlanCategoryKind } from "@/generated/prisma/enums"

function parseKind(raw: string | null): CashPlanCategoryKind | null {
  if (raw === "INCOME" || raw === "EXPENSE") return raw as CashPlanCategoryKind
  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const manage = searchParams.get("manage") === "1"
    const kindParam = searchParams.get("kind")
    const kind = kindParam ? parseKind(kindParam) : null

    if (!manage && kind == null) {
      return fail("VALIDATION_ERROR", "请指定 kind=INCOME 或 kind=EXPENSE", 400)
    }
    if (kindParam && kind == null) {
      return fail("VALIDATION_ERROR", "kind 须为 INCOME 或 EXPENSE", 400)
    }

    const authOr = manage
      ? await requireApiPermission(request, Permission.SETTINGS_MANAGE)
      : await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const items = await prisma.cashPlanCategory.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(kind != null ? { kind } : {}),
        ...(manage ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        kind: true,
        code: true,
        name: true,
        sortOrder: true,
        isActive: true,
      },
    })
    return ok({ items })
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(request: Request) {
  try {
    const authOr = await requireApiPermission(request, Permission.SETTINGS_MANAGE)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = cashPlanCategoryCreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const d = parsed.data
    const dup = await prisma.cashPlanCategory.findFirst({
      where: {
        organizationId: auth.organizationId,
        kind: d.kind,
        code: d.code,
      },
    })
    if (dup) return fail("DUPLICATE", "该类型下编码已存在", 409)

    const row = await prisma.cashPlanCategory.create({
      data: {
        organizationId: auth.organizationId,
        kind: d.kind,
        code: d.code,
        name: d.name,
        sortOrder: d.sortOrder ?? 0,
        isActive: true,
      },
      select: {
        id: true,
        kind: true,
        code: true,
        name: true,
        sortOrder: true,
        isActive: true,
      },
    })
    return created(row)
  } catch (e) {
    return handleRouteError(e)
  }
}
