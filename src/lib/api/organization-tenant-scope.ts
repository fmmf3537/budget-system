import { prisma } from "@/lib/prisma"

/**
 * 从用户所在组织沿 parent 链找到树根，再收集该根下整棵子树。
 * 用于「本租户」组织管理：同一公司树下各分公司可见、可维护。
 */
export async function getTenantOrganizationScope(userOrganizationId: string): Promise<{
  rootId: string
  ids: string[]
}> {
  let currentId: string | null = userOrganizationId
  let rootId = userOrganizationId
  const upVisited = new Set<string>()
  while (currentId && !upVisited.has(currentId)) {
    upVisited.add(currentId)
    rootId = currentId
    const row: { parentId: string | null } | null =
      await prisma.organization.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      })
    currentId = row?.parentId ?? null
  }

  const ids = new Set<string>([rootId])
  let frontier = [rootId]
  while (frontier.length > 0) {
    const children = await prisma.organization.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    })
    frontier = []
    for (const c of children) {
      if (!ids.has(c.id)) {
        ids.add(c.id)
        frontier.push(c.id)
      }
    }
  }

  return { rootId, ids: [...ids] }
}

export async function collectDescendantOrganizationIds(
  rootId: string
): Promise<Set<string>> {
  const out = new Set<string>()
  let frontier = [rootId]
  while (frontier.length > 0) {
    const children = await prisma.organization.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    })
    frontier = []
    for (const c of children) {
      out.add(c.id)
      frontier.push(c.id)
    }
  }
  return out
}

/** 将节点设为 newParentId 是否会产生指向自身的环 */
export async function organizationParentWouldCycle(
  organizationId: string,
  newParentId: string | null
): Promise<boolean> {
  if (newParentId == null) return false
  let cur: string | null = newParentId
  const seen = new Set<string>()
  while (cur) {
    if (cur === organizationId) return true
    if (seen.has(cur)) break
    seen.add(cur)
    const row: { parentId: string | null } | null =
      await prisma.organization.findUnique({
        where: { id: cur },
        select: { parentId: true },
      })
    cur = row?.parentId ?? null
  }
  return false
}
