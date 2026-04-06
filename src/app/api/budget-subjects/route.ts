import { prisma } from "@/lib/prisma"
import { budgetSubjectCreateSchema } from "@/lib/api/budget-subject-schemas"
import { requireAuth } from "@/lib/api/request-auth"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

function subjectInOrgScope(id: string, organizationId: string) {
  return prisma.budgetSubject.findFirst({
    where: {
      id,
      OR: [{ organizationId }, { organizationId: null }],
    },
  })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const manage = searchParams.get("manage") === "1"

    const authOr = manage
      ? await requireApiPermission(request, Permission.SETTINGS_MANAGE)
      : await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const items = await prisma.budgetSubject.findMany({
      where: {
        OR: [{ organizationId: auth.organizationId }, { organizationId: null }],
        ...(manage ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: manage
        ? {
            id: true,
            code: true,
            name: true,
            parentId: true,
            level: true,
            sortOrder: true,
            isActive: true,
            organizationId: true,
          }
        : {
            id: true,
            code: true,
            name: true,
            parentId: true,
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

    const parsed = budgetSubjectCreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const data = parsed.data
    const parentId =
      data.parentId && data.parentId.trim() !== "" ? data.parentId.trim() : null

    if (parentId) {
      const parent = await subjectInOrgScope(parentId, auth.organizationId)
      if (!parent) {
        return fail("BAD_REFERENCE", "上级科目不存在或不可选", 400)
      }
    }

    const dup = await prisma.budgetSubject.findFirst({
      where: { organizationId: auth.organizationId, code: data.code },
    })
    if (dup) return fail("DUPLICATE", "科目编码已存在", 409)

    let level = 1
    if (parentId) {
      const p = await prisma.budgetSubject.findUnique({
        where: { id: parentId },
        select: { level: true },
      })
      level = (p?.level ?? 0) + 1
    }

    const row = await prisma.budgetSubject.create({
      data: {
        organizationId: auth.organizationId,
        parentId,
        code: data.code.trim(),
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? 0,
        level,
        isActive: true,
      },
      select: {
        id: true,
        organizationId: true,
        parentId: true,
        code: true,
        name: true,
        level: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
      },
    })

    return created(row)
  } catch (e) {
    return handleRouteError(e)
  }
}
