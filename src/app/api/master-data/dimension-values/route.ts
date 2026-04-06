import { prisma } from "@/lib/prisma"
import { budgetDimensionValueCreateSchema } from "@/lib/api/master-data-schemas"
import { requireAuth } from "@/lib/api/request-auth"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"

function parseSlot(raw: string | null): 1 | 2 | null {
  if (raw === "1") return 1
  if (raw === "2") return 2
  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const manage = searchParams.get("manage") === "1"
    const slot = parseSlot(searchParams.get("slot"))

    if (slot == null) {
      return fail("VALIDATION_ERROR", "请指定 slot=1 或 slot=2", 400)
    }

    const authOr = manage
      ? await requireApiPermission(request, Permission.SETTINGS_MANAGE)
      : await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const items = await prisma.budgetDimensionValue.findMany({
      where: {
        organizationId: auth.organizationId,
        slot,
        ...(manage ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        slot: true,
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

    const parsed = budgetDimensionValueCreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const d = parsed.data
    const dup = await prisma.budgetDimensionValue.findFirst({
      where: {
        organizationId: auth.organizationId,
        slot: d.slot,
        code: d.code,
      },
    })
    if (dup) return fail("DUPLICATE", "该维度下编码已存在", 409)

    const row = await prisma.budgetDimensionValue.create({
      data: {
        organizationId: auth.organizationId,
        slot: d.slot,
        code: d.code,
        name: d.name,
        sortOrder: d.sortOrder ?? 0,
        isActive: true,
      },
      select: {
        id: true,
        slot: true,
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
