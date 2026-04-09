import { prisma } from "@/lib/prisma"

export async function resolveTopDepartmentByCode(
  organizationId: string,
  code: string
) {
  return prisma.budgetDepartment.findFirst({
    where: { organizationId, code, parentId: null },
    select: { id: true, code: true, name: true },
  })
}

/**
 * Validate master plan scope department.
 * null means whole organization; non-null must be a top-level department code.
 */
export async function validateRootDepartmentCode(
  organizationId: string,
  raw: string | null | undefined
): Promise<{ ok: true; code: string | null } | { ok: false; message: string }> {
  const code = raw?.trim() || null
  if (!code) return { ok: true, code: null }
  const top = await resolveTopDepartmentByCode(organizationId, code)
  if (!top) {
    return { ok: false, message: "Master plan scope must be a top-level department code" }
  }
  return { ok: true, code: top.code }
}

async function findDepartmentByCode(
  organizationId: string,
  code: string
): Promise<{ id: string; code: string; parentId: string | null } | null> {
  return prisma.budgetDepartment.findFirst({
    where: { organizationId, code, isActive: true },
    select: { id: true, code: true, parentId: true },
  })
}

/**
 * Validate sub-plan department scope:
 * - when rootDepartmentCode is null, any active department is allowed
 * - when rootDepartmentCode is set, selected department must be root itself or its descendants
 */
export async function validateSubPlanDepartmentScope(params: {
  organizationId: string
  rootDepartmentCode: string | null
  scopeDepartmentCode: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { organizationId, rootDepartmentCode, scopeDepartmentCode } = params
  const target = await findDepartmentByCode(organizationId, scopeDepartmentCode)
  if (!target) {
    return { ok: false, message: "Department not found or inactive" }
  }
  if (!rootDepartmentCode) return { ok: true }

  const root = await findDepartmentByCode(organizationId, rootDepartmentCode)
  if (!root || root.parentId !== null) {
    return { ok: false, message: "Master plan department scope is invalid" }
  }
  if (target.code === root.code) return { ok: true }

  let parentId = target.parentId
  let hops = 0
  while (parentId && hops < 16) {
    const p = await prisma.budgetDepartment.findFirst({
      where: { id: parentId, organizationId },
      select: { id: true, code: true, parentId: true },
    })
    if (!p) break
    if (p.code === root.code) return { ok: true }
    parentId = p.parentId
    hops += 1
  }
  return { ok: false, message: "Selected department is outside master plan scope" }
}
