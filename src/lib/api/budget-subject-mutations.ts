import { prisma } from "@/lib/prisma"

/** 不包含 rootId 本身，仅子树 */
export async function collectDescendantSubjectIds(
  rootId: string
): Promise<Set<string>> {
  const out = new Set<string>()
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    const kids = await prisma.budgetSubject.findMany({
      where: { parentId: id },
      select: { id: true },
    })
    for (const k of kids) {
      if (!out.has(k.id)) {
        out.add(k.id)
        queue.push(k.id)
      }
    }
  }
  return out
}

/** 在根节点 level 已更新后，向下刷新子节点 level */
export async function propagateLevelsUnder(rootId: string) {
  const root = await prisma.budgetSubject.findUnique({
    where: { id: rootId },
    select: { level: true },
  })
  if (root?.level == null) return

  async function walk(parentId: string, parentLevel: number) {
    const children = await prisma.budgetSubject.findMany({
      where: { parentId },
      select: { id: true },
    })
    const nl = parentLevel + 1
    for (const c of children) {
      await prisma.budgetSubject.update({
        where: { id: c.id },
        data: { level: nl },
      })
      await walk(c.id, nl)
    }
  }

  await walk(rootId, root.level)
}
