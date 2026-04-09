import {
  organizationSettingsCreateSchema,
} from "@/lib/api/organization-settings-schemas"
import {
  getTenantOrganizationScope,
} from "@/lib/api/organization-tenant-scope"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"
import { OrgStatus } from "@/generated/prisma/enums"

export async function GET(request: Request) {
  try {
    const authOr = await requireApiPermission(request, Permission.ORG_MANAGE)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const { rootId, ids } = await getTenantOrganizationScope(
      auth.organizationId
    )
    const items = await prisma.organization.findMany({
      where: { id: { in: ids } },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        parentId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    const nameById = new Map(items.map((i) => [i.id, i.name]))
    return ok({
      tenantRootId: rootId,
      items: items.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        parentName: i.parentId
          ? (nameById.get(i.parentId) ?? null)
          : null,
      })),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(request: Request) {
  try {
    const authOr = await requireApiPermission(request, Permission.ORG_MANAGE)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = organizationSettingsCreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const { rootId, ids } = await getTenantOrganizationScope(
      auth.organizationId
    )
    const allowed = new Set(ids)
    if (!allowed.has(parsed.data.parentId)) {
      return fail("FORBIDDEN", "上级组织不在本租户范围内", 403)
    }

    const parent = await prisma.organization.findFirst({
      where: { id: parsed.data.parentId },
      select: { id: true, status: true },
    })
    if (!parent || parent.status !== OrgStatus.ACTIVE) {
      return fail("BAD_REFERENCE", "上级组织不存在或已停用", 400)
    }

    if (parsed.data.code) {
      const dup = await prisma.organization.findFirst({
        where: { code: parsed.data.code },
        select: { id: true },
      })
      if (dup) {
        return fail("DUPLICATE", "组织编码已被使用", 409)
      }
    }

    const row = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        parentId: parsed.data.parentId,
        status: OrgStatus.ACTIVE,
      },
      select: {
        id: true,
        code: true,
        name: true,
        parentId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return created({
      tenantRootId: rootId,
      organization: {
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        parentName: null as string | null,
      },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
