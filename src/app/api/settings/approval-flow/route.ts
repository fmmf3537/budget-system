import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { ok } from "@/lib/api/response"
import { UserStatus } from "@/generated/prisma/enums"

export async function GET(request: Request) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    const [items, usersInOrg] = await Promise.all([
      prisma.approvalProcess.findMany({
        where: { organizationId: auth.organizationId },
        include: {
          _count: { select: { nodes: true, records: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.user.findMany({
        where: {
          organizationId: auth.organizationId,
          status: UserStatus.ACTIVE,
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 300,
      }),
    ])

    return ok({
      items: items.map((p) => ({
        id: p.id,
        name: p.name,
        bizType: p.bizType,
        isActive: p.isActive,
        version: p.version,
        nodeCount: p._count.nodes,
        recordCount: p._count.records,
        updatedAt: p.updatedAt.toISOString(),
      })),
      usersInOrg,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
