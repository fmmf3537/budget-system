import {
  organizationSettingsUpdateSchema,
} from "@/lib/api/organization-settings-schemas"
import {
  collectDescendantOrganizationIds,
  getTenantOrganizationScope,
  organizationParentWouldCycle,
} from "@/lib/api/organization-tenant-scope"
import { requireApiPermission } from "@/lib/api/require-permission"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"
import { Permission } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"

type RouteCtx = { params: Promise<{ id: string }> }

function serializeOrg(row: {
  id: string
  code: string | null
  name: string
  parentId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}, parentName: string | null) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    parentName,
  }
}

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireApiPermission(request, Permission.ORG_MANAGE)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const { id } = await ctx.params
    const { ids } = await getTenantOrganizationScope(auth.organizationId)
    if (!ids.includes(id)) {
      return fail("NOT_FOUND", "组织不存在", 404)
    }

    const row = await prisma.organization.findFirst({
      where: { id },
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
    if (!row) return fail("NOT_FOUND", "组织不存在", 404)

    let parentName: string | null = null
    if (row.parentId) {
      const p = await prisma.organization.findUnique({
        where: { id: row.parentId },
        select: { name: true },
      })
      parentName = p?.name ?? null
    }

    return ok({ organization: serializeOrg(row, parentName) })
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireApiPermission(request, Permission.ORG_MANAGE)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const { id } = await ctx.params
    const { ids } = await getTenantOrganizationScope(auth.organizationId)
    const allowed = new Set(ids)
    if (!allowed.has(id)) {
      return fail("NOT_FOUND", "组织不存在", 404)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = organizationSettingsUpdateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const d = parsed.data

    const existingRow = await prisma.organization.findUnique({
      where: { id },
      select: { parentId: true },
    })
    if (!existingRow) return fail("NOT_FOUND", "组织不存在", 404)

    if (d.parentId !== undefined) {
      if (existingRow.parentId === null) {
        return fail(
          "VALIDATION_ERROR",
          "租户根组织不能修改上级",
          400
        )
      }
      if (d.parentId === id) {
        return fail("VALIDATION_ERROR", "不能将上级设为自己", 400)
      }
      if (!allowed.has(d.parentId)) {
        return fail("FORBIDDEN", "上级组织不在本租户范围内", 403)
      }
      const descendants = await collectDescendantOrganizationIds(id)
      if (descendants.has(d.parentId)) {
        return fail("VALIDATION_ERROR", "不能将上级设为自己的下级", 400)
      }
      if (await organizationParentWouldCycle(id, d.parentId)) {
        return fail("VALIDATION_ERROR", "不能形成循环的上级关系", 400)
      }
    }

    if (d.code !== undefined && d.code !== null) {
      const dup = await prisma.organization.findFirst({
        where: {
          code: d.code,
          NOT: { id },
        },
        select: { id: true },
      })
      if (dup) {
        return fail("DUPLICATE", "组织编码已被使用", 409)
      }
    }

    const data: {
      name?: string
      code?: string | null
      status?: (typeof d)["status"]
      parentId?: string
    } = {}
    if (d.name !== undefined) data.name = d.name
    if (d.code !== undefined) data.code = d.code
    if (d.status !== undefined) data.status = d.status
    if (d.parentId !== undefined && existingRow.parentId !== null) {
      data.parentId = d.parentId
    }

    const row = await prisma.organization.update({
      where: { id },
      data,
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

    let parentName: string | null = null
    if (row.parentId) {
      const p = await prisma.organization.findUnique({
        where: { id: row.parentId },
        select: { name: true },
      })
      parentName = p?.name ?? null
    }

    return ok({ organization: serializeOrg(row, parentName) })
  } catch (e) {
    return handleRouteError(e)
  }
}
