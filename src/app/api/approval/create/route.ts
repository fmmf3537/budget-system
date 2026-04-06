import { prisma } from "@/lib/prisma"
import { approvalCreateBodySchema } from "@/lib/api/approval-schemas"
import { serializeApprovalProcess } from "@/lib/api/approval-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError } from "@/lib/api/response"

export async function POST(request: Request) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = approvalCreateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const { name, bizType, isActive, nodes } = parsed.data

    const process = await prisma.approvalProcess.create({
      data: {
        organizationId: auth.organizationId,
        name,
        bizType,
        isActive,
        nodes: {
          create: nodes.map((n) => ({
            sortOrder: n.sortOrder,
            name: n.name,
            approverUserId: n.approverUserId ?? null,
            approverRole: n.approverRole ?? null,
            isParallelGroup: n.isParallelGroup,
            minTotalAmount: n.minTotalAmount ?? null,
            maxTotalAmount: n.maxTotalAmount ?? null,
          })),
        },
      },
      include: { nodes: true },
    })

    return created(serializeApprovalProcess(process, process.nodes))
  } catch (e) {
    return handleRouteError(e)
  }
}
