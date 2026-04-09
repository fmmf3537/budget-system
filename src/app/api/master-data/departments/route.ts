import { assertValidParentForNewChild } from "@/lib/api/budget-department-hierarchy"
import { budgetDepartmentCreateSchema } from "@/lib/api/master-data-schemas"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api/request-auth"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const manage = searchParams.get("manage") === "1"

    const authOr = manage
      ? await requireApiPermission(request, Permission.SETTINGS_MANAGE)
      : await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const items = await prisma.budgetDepartment.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(manage ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        parentId: true,
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

    const parsed = budgetDepartmentCreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const d = parsed.data
    const parentId = d.parentId ?? null
    const parentOk = await assertValidParentForNewChild(
      auth.organizationId,
      parentId
    )
    if (!parentOk.ok) {
      return fail("VALIDATION_ERROR", parentOk.message, 400)
    }

    const dup = await prisma.budgetDepartment.findFirst({
      where: { organizationId: auth.organizationId, code: d.code },
    })
    if (dup) return fail("DUPLICATE", "编码已存在", 409)

    const row = await prisma.budgetDepartment.create({
      data: {
        organizationId: auth.organizationId,
        parentId,
        code: d.code,
        name: d.name,
        sortOrder: d.sortOrder ?? 0,
        isActive: true,
      },
      select: {
        id: true,
        parentId: true,
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
