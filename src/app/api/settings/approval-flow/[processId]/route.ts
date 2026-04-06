import { prisma } from "@/lib/prisma"
import { approvalProcessUpdateBodySchema } from "@/lib/api/approval-schemas"
import { findProcessForOrg } from "@/lib/api/approval-workflow"
import { serializeApprovalProcess } from "@/lib/api/approval-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ processId: string }> }

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { processId } = await ctx.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = approvalProcessUpdateBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const patch = parsed.data

    const existing = await prisma.approvalProcess.findFirst({
      where: { id: processId, organizationId: auth.organizationId },
      include: { nodes: true },
    })
    if (!existing) return fail("NOT_FOUND", "流程不存在或无权访问", 404)

    let payloadIds = new Set<string>()
    if (patch.nodes !== undefined) {
      const existingIds = new Set(existing.nodes.map((n) => n.id))
      payloadIds = new Set(
        patch.nodes.filter((n) => n.id).map((n) => n.id as string)
      )

      for (const id of payloadIds) {
        if (!existingIds.has(id)) {
          return fail("BAD_REFERENCE", `节点 id 无效：${id}`, 400)
        }
      }

      for (const node of existing.nodes) {
        if (payloadIds.has(node.id)) continue
        const cnt = await prisma.approvalRecord.count({
          where: { nodeId: node.id },
        })
        if (cnt > 0) {
          return fail(
            "NODE_IN_USE",
            `节点「${node.name}」已有审批记录，无法删除`,
            409
          )
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.approvalProcess.update({
        where: { id: processId },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.bizType !== undefined ? { bizType: patch.bizType } : {}),
          ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
          ...(patch.nodes !== undefined ? { version: { increment: 1 } } : {}),
        },
      })

      if (patch.nodes === undefined) return

      for (const node of existing.nodes) {
        if (payloadIds.has(node.id)) continue
        await tx.approvalNode.delete({ where: { id: node.id } })
      }

      for (const n of patch.nodes) {
        const data = {
          sortOrder: n.sortOrder,
          name: n.name,
          approverUserId: n.approverUserId ?? null,
          approverRole: n.approverRole?.trim() ? n.approverRole.trim() : null,
          isParallelGroup: n.isParallelGroup ?? false,
          minTotalAmount: n.minTotalAmount ?? null,
          maxTotalAmount: n.maxTotalAmount ?? null,
        }
        if (n.id) {
          await tx.approvalNode.update({
            where: { id: n.id, processId },
            data,
          })
        } else {
          await tx.approvalNode.create({
            data: { processId, ...data },
          })
        }
      }
    })

    const updated = await findProcessForOrg(processId, auth.organizationId)
    if (!updated) return fail("NOT_FOUND", "流程不存在", 404)

    return ok(serializeApprovalProcess(updated, updated.nodes))
  } catch (e) {
    return handleRouteError(e)
  }
}
