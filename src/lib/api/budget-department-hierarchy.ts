import { prisma } from "@/lib/prisma"

/** 部门树最大层级：根=1，最深可到 3 */
export const MAX_DEPARTMENT_TREE_LEVEL = 3

/** 节点所在层级：顶级=1，沿 parent 链向上计数 */
export async function getDepartmentLevel(
  organizationId: string,
  id: string
): Promise<number> {
  let level = 1
  let cur: { parentId: string | null } | null =
    await prisma.budgetDepartment.findFirst({
      where: { id, organizationId },
      select: { parentId: true },
    })
  if (!cur) return 0
  while (cur.parentId) {
    level++
    if (level > MAX_DEPARTMENT_TREE_LEVEL + 2) break
    const parent: { parentId: string | null } | null =
      await prisma.budgetDepartment.findFirst({
        where: { id: cur.parentId, organizationId },
        select: { parentId: true },
      })
    if (!parent) break
    cur = parent
  }
  return level
}

/** 以 id 为根的子树高度（含自身，叶为 1） */
export async function subtreeHeight(
  organizationId: string,
  id: string
): Promise<number> {
  const children = await prisma.budgetDepartment.findMany({
    where: { organizationId, parentId: id },
    select: { id: true },
  })
  if (children.length === 0) return 1
  const depths = await Promise.all(
    children.map((c) => subtreeHeight(organizationId, c.id))
  )
  return 1 + Math.max(...depths)
}

export async function assertValidParentForNewChild(
  organizationId: string,
  parentId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!parentId) return { ok: true }
  const parent = await prisma.budgetDepartment.findFirst({
    where: { id: parentId, organizationId },
    select: { id: true },
  })
  if (!parent) return { ok: false, message: "上级部门不存在" }
  const parentLevel = await getDepartmentLevel(organizationId, parentId)
  if (parentLevel >= MAX_DEPARTMENT_TREE_LEVEL) {
    return {
      ok: false,
      message: "上级已在第三级，无法再添加子部门（最多三级）",
    }
  }
  return { ok: true }
}

export async function assertCanReparent(
  organizationId: string,
  nodeId: string,
  newParentId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (newParentId === nodeId) {
    return { ok: false, message: "不能将自己设为上级" }
  }
  let cur: string | null = newParentId
  while (cur) {
    if (cur === nodeId) {
      return { ok: false, message: "不能将部门移动到其下级之下" }
    }
    const row = await prisma.budgetDepartment.findFirst({
      where: { id: cur, organizationId },
      select: { parentId: true },
    })
    cur = row?.parentId ?? null
  }
  const anchorLevel = newParentId
    ? (await getDepartmentLevel(organizationId, newParentId)) + 1
    : 1
  const height = await subtreeHeight(organizationId, nodeId)
  if (anchorLevel + height - 1 > MAX_DEPARTMENT_TREE_LEVEL) {
    return {
      ok: false,
      message: "调整后超过三级结构，请先调整子级或更换上级",
    }
  }
  return { ok: true }
}
