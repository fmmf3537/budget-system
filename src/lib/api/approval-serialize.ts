import type {
  ApprovalNode,
  ApprovalProcess,
  ApprovalRecord,
} from "@/generated/prisma/client"

function dec(v: unknown) {
  if (v == null) return null
  return String(v)
}

export function serializeApprovalNode(n: ApprovalNode) {
  return {
    id: n.id,
    processId: n.processId,
    sortOrder: n.sortOrder,
    name: n.name,
    approverUserId: n.approverUserId,
    approverRole: n.approverRole,
    isParallelGroup: n.isParallelGroup,
    minTotalAmount: dec(n.minTotalAmount),
    maxTotalAmount: dec(n.maxTotalAmount),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }
}

export function serializeApprovalProcess(
  p: ApprovalProcess,
  nodes?: ApprovalNode[]
) {
  return {
    id: p.id,
    organizationId: p.organizationId,
    name: p.name,
    bizType: p.bizType,
    version: p.version,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    ...(nodes !== undefined
      ? { nodes: [...nodes].sort((a, b) => a.sortOrder - b.sortOrder).map(serializeApprovalNode) }
      : {}),
  }
}

export function serializeApprovalRecord(
  r: ApprovalRecord,
  extras?: { process?: { name: string }; node?: { name: string; sortOrder: number } | null }
) {
  return {
    id: r.id,
    processId: r.processId,
    processName: extras?.process?.name,
    nodeId: r.nodeId,
    nodeName: extras?.node?.name,
    nodeSortOrder: extras?.node?.sortOrder,
    actorUserId: r.actorUserId,
    action: r.action,
    comment: r.comment,
    entityType: r.entityType,
    entityId: r.entityId,
    actedAt: r.actedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}
