import { prisma } from "@/lib/prisma"
import {
  AdjustmentStatus,
  ApprovalAction,
  BudgetStatus,
  CashPlanStatus,
  CashPlanSubPlanStatus,
} from "@/generated/prisma/enums"
import type { Prisma } from "@/generated/prisma/client"
import {
  ENTITY_BUDGET_ADJUSTMENT,
  ENTITY_BUDGET_HEADER,
  ENTITY_CASH_PLAN_HEADER,
  ENTITY_CASH_PLAN_SUB_PLAN,
} from "@/lib/api/approval-constants"
import {
  getEntityTotalAmountForRouting,
  nodeMatchesTotalAmount,
} from "@/lib/api/approval-routing"

export async function assertUserInOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const n = await prisma.user.count({
    where: { id: userId, organizationId },
  })
  return n > 0
}

export function canActorHandlePending(
  resolvedActorId: string | null,
  record: {
    actorUserId: string | null
    node: { approverUserId: string | null } | null
  }
): boolean {
  if (!resolvedActorId) return false
  if (record.actorUserId && record.actorUserId === resolvedActorId) return true
  if (!record.actorUserId && record.node?.approverUserId === resolvedActorId)
    return true
  if (
    !record.actorUserId &&
    !record.node?.approverUserId
  ) {
    return true
  }
  return false
}

export async function findProcessForOrg(processId: string, organizationId: string) {
  return prisma.approvalProcess.findFirst({
    where: { id: processId, organizationId },
    include: {
      nodes: { orderBy: { sortOrder: "asc" } },
    },
  })
}

export async function findCurrentPendingRecord(
  processId: string,
  entityType: string,
  entityId: string,
  organizationId: string
) {
  return prisma.approvalRecord.findFirst({
    where: {
      processId,
      entityType,
      entityId,
      action: ApprovalAction.PENDING,
      process: { organizationId },
    },
    include: { node: true },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * 为业务单据创建第一条待办（按节点 sortOrder 取第一个）。
 * 幂等：若已存在 PENDING 则跳过。
 */
export async function startApprovalForEntity(params: {
  processId: string
  entityType: string
  entityId: string
  organizationId: string
}): Promise<{ created: boolean; reason?: string }> {
  const { processId, entityType, entityId, organizationId } = params

  const process = await prisma.approvalProcess.findFirst({
    where: { id: processId, organizationId, isActive: true },
    include: { nodes: { orderBy: { sortOrder: "asc" } } },
  })

  if (!process) return { created: false, reason: "流程不存在或未启用" }
  if (process.nodes.length === 0)
    return { created: false, reason: "流程未配置审批节点" }

  const dup = await prisma.approvalRecord.findFirst({
    where: {
      processId,
      entityType,
      entityId,
      action: ApprovalAction.PENDING,
    },
  })
  if (dup) return { created: false }

  const amount = await getEntityTotalAmountForRouting(
    entityType,
    entityId,
    organizationId
  )
  const sorted = [...process.nodes].sort((a, b) => a.sortOrder - b.sortOrder)
  const matching = sorted.filter((n) => nodeMatchesTotalAmount(n, amount))
  const first = matching[0]
  if (!first) {
    return {
      created: false,
      reason: "没有符合金额条件的起始审批节点，请检查节点金额区间",
    }
  }

  await prisma.approvalRecord.create({
    data: {
      processId,
      nodeId: first.id,
      entityType,
      entityId,
      action: ApprovalAction.PENDING,
      actorUserId: first.approverUserId ?? null,
    },
  })
  return { created: true }
}

export type WithdrawSubmissionResult =
  | { ok: true }
  | { ok: false; code: "HAS_APPROVED" | "INVALID_STATE" }

/**
 * 提交人撤回：将 PENDING 待办标为已取消，并把业务单据恢复为草稿。
 * 若本单据在审批链上已出现过「同意」，则拒绝撤回。
 */
export async function withdrawSubmittedEntity(params: {
  organizationId: string
  entityType: string
  entityId: string
  resolvedActorId: string | null
  cancelComment?: string | null
  finalizeDraft: (tx: Prisma.TransactionClient) => Promise<{ updated: boolean }>
}): Promise<WithdrawSubmissionResult> {
  const {
    organizationId,
    entityType,
    entityId,
    resolvedActorId,
    cancelComment,
    finalizeDraft,
  } = params
  const comment = (cancelComment?.trim() || "提交人撤回").slice(0, 2000)

  return prisma.$transaction(async (tx) => {
    const approved = await tx.approvalRecord.count({
      where: {
        entityType,
        entityId,
        action: ApprovalAction.APPROVED,
        process: { organizationId },
      },
    })
    if (approved > 0) {
      return { ok: false as const, code: "HAS_APPROVED" as const }
    }

    await tx.approvalRecord.updateMany({
      where: {
        entityType,
        entityId,
        action: ApprovalAction.PENDING,
        process: { organizationId },
      },
      data: {
        action: ApprovalAction.CANCELLED,
        actedAt: new Date(),
        comment,
        actorUserId: resolvedActorId,
      },
    })

    const { updated } = await finalizeDraft(tx)
    if (!updated) return { ok: false as const, code: "INVALID_STATE" as const }
    return { ok: true as const }
  })
}

async function finalizeBudgetApprovedTx(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string
) {
  if (entityType !== ENTITY_BUDGET_HEADER) return
  await tx.budgetHeader.updateMany({
    where: { id: entityId, status: BudgetStatus.SUBMITTED },
    data: {
      status: BudgetStatus.APPROVED,
      approvedAt: new Date(),
    },
  })
}

async function finalizeBudgetRejectedTx(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string
) {
  if (entityType !== ENTITY_BUDGET_HEADER) return
  await tx.budgetHeader.updateMany({
    where: { id: entityId, status: BudgetStatus.SUBMITTED },
    data: { status: BudgetStatus.REJECTED },
  })
}

async function finalizeAdjustmentApprovedTx(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string
) {
  if (entityType !== ENTITY_BUDGET_ADJUSTMENT) return
  await tx.budgetAdjustment.updateMany({
    where: { id: entityId, status: AdjustmentStatus.SUBMITTED },
    data: { status: AdjustmentStatus.APPROVED },
  })
}

async function finalizeAdjustmentRejectedTx(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string
) {
  if (entityType !== ENTITY_BUDGET_ADJUSTMENT) return
  await tx.budgetAdjustment.updateMany({
    where: { id: entityId, status: AdjustmentStatus.SUBMITTED },
    data: { status: AdjustmentStatus.REJECTED },
  })
}

async function finalizeCashPlanApprovedTx(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string
) {
  if (entityType !== ENTITY_CASH_PLAN_HEADER) return
  await tx.cashPlanHeader.updateMany({
    where: { id: entityId, status: CashPlanStatus.SUBMITTED },
    data: { status: CashPlanStatus.APPROVED },
  })
}

async function finalizeCashPlanRejectedTx(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string
) {
  if (entityType !== ENTITY_CASH_PLAN_HEADER) return
  await tx.cashPlanHeader.updateMany({
    where: { id: entityId, status: CashPlanStatus.SUBMITTED },
    data: { status: CashPlanStatus.DRAFT },
  })
}

async function finalizeCashPlanSubPlanApprovedTx(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string
) {
  if (entityType !== ENTITY_CASH_PLAN_SUB_PLAN) return
  await tx.cashPlanSubPlan.updateMany({
    where: { id: entityId, status: CashPlanSubPlanStatus.SUBMITTED },
    data: { status: CashPlanSubPlanStatus.APPROVED },
  })
}

async function finalizeCashPlanSubPlanRejectedTx(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string
) {
  if (entityType !== ENTITY_CASH_PLAN_SUB_PLAN) return
  await tx.cashPlanSubPlan.updateMany({
    where: { id: entityId, status: CashPlanSubPlanStatus.SUBMITTED },
    data: { status: CashPlanSubPlanStatus.DRAFT },
  })
}

export async function runApprove(params: {
  processId: string
  organizationId: string
  entityType: string
  entityId: string
  resolvedActorId: string
  comment?: string | null
}) {
  const { processId, organizationId, entityType, entityId, resolvedActorId, comment } =
    params

  const actorInOrg = await assertUserInOrganization(
    resolvedActorId,
    organizationId
  )
  if (!actorInOrg) return { ok: false as const, code: "FORBIDDEN" as const }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const record = await tx.approvalRecord.findFirst({
      where: {
        processId,
        entityType,
        entityId,
        action: ApprovalAction.PENDING,
        process: { organizationId },
      },
      include: { node: true },
      orderBy: { createdAt: "desc" },
    })

    if (!record) return { ok: false as const, code: "NO_PENDING" as const }

    if (!canActorHandlePending(resolvedActorId, record)) {
      return { ok: false as const, code: "FORBIDDEN" as const }
    }

    await tx.approvalRecord.update({
      where: { id: record.id },
      data: {
        action: ApprovalAction.APPROVED,
        actorUserId: resolvedActorId,
        actedAt: new Date(),
        comment: comment ?? null,
      },
    })

    const process = await tx.approvalProcess.findFirst({
      where: { id: processId, organizationId },
      include: { nodes: { orderBy: { sortOrder: "asc" } } },
    })
    if (!process) return { ok: false as const, code: "NOT_FOUND" as const }

    const amount = await getEntityTotalAmountForRouting(
      entityType,
      entityId,
      organizationId,
      tx
    )
    const currentOrder = record.node?.sortOrder ?? -1
    const candidates = process.nodes
      .filter((n) => n.sortOrder > currentOrder)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const nextNode = candidates.find((n) => nodeMatchesTotalAmount(n, amount))

    if (nextNode) {
      await tx.approvalRecord.create({
        data: {
          processId,
          nodeId: nextNode.id,
          entityType,
          entityId,
          action: ApprovalAction.PENDING,
          actorUserId: nextNode.approverUserId ?? null,
        },
      })
      return { ok: true as const, completed: false as const, recordId: record.id }
    }

    await finalizeBudgetApprovedTx(tx, entityType, entityId)
    await finalizeAdjustmentApprovedTx(tx, entityType, entityId)
    await finalizeCashPlanApprovedTx(tx, entityType, entityId)
    await finalizeCashPlanSubPlanApprovedTx(tx, entityType, entityId)
    return { ok: true as const, completed: true as const, recordId: record.id }
  })
}

export async function runReject(params: {
  processId: string
  organizationId: string
  entityType: string
  entityId: string
  resolvedActorId: string
  comment?: string | null
  /** 若指定，则驳回到该节点并生成新的待办（预算不标记为已驳回） */
  returnToNodeId?: string | null
}) {
  const {
    processId,
    organizationId,
    entityType,
    entityId,
    resolvedActorId,
    comment,
    returnToNodeId: rawReturn,
  } = params

  const returnToNodeId = rawReturn?.trim() || null

  const actorInOrg = await assertUserInOrganization(
    resolvedActorId,
    organizationId
  )
  if (!actorInOrg) return { ok: false as const, code: "FORBIDDEN" as const }

  if (returnToNodeId) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const record = await tx.approvalRecord.findFirst({
        where: {
          processId,
          entityType,
          entityId,
          action: ApprovalAction.PENDING,
          process: { organizationId },
        },
        include: { node: true },
        orderBy: { createdAt: "desc" },
      })

      if (!record) return { ok: false as const, code: "NO_PENDING" as const }
      if (!canActorHandlePending(resolvedActorId, record)) {
        return { ok: false as const, code: "FORBIDDEN" as const }
      }

      const targetNode = await tx.approvalNode.findFirst({
        where: { id: returnToNodeId, processId },
      })
      if (!targetNode) return { ok: false as const, code: "BAD_NODE" as const }

      const currentOrder = record.node?.sortOrder ?? 999_999
      if (targetNode.sortOrder >= currentOrder) {
        return { ok: false as const, code: "INVALID_RETURN" as const }
      }

      const tail = `退回至节点：${targetNode.name}`
      const mergedComment =
        [comment?.trim() || null, tail].filter(Boolean).join(" | ") || tail

      await tx.approvalRecord.update({
        where: { id: record.id },
        data: {
          action: ApprovalAction.REJECTED,
          actorUserId: resolvedActorId,
          actedAt: new Date(),
          comment: mergedComment,
        },
      })

      await tx.approvalRecord.create({
        data: {
          processId,
          nodeId: targetNode.id,
          entityType,
          entityId,
          action: ApprovalAction.PENDING,
          actorUserId: targetNode.approverUserId ?? null,
        },
      })

      return { ok: true as const, recordId: record.id, returned: true as const }
    })
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const record = await tx.approvalRecord.findFirst({
      where: {
        processId,
        entityType,
        entityId,
        action: ApprovalAction.PENDING,
        process: { organizationId },
      },
      include: { node: true },
      orderBy: { createdAt: "desc" },
    })

    if (!record) return { ok: false as const, code: "NO_PENDING" as const }
    if (!canActorHandlePending(resolvedActorId, record)) {
      return { ok: false as const, code: "FORBIDDEN" as const }
    }

    await tx.approvalRecord.update({
      where: { id: record.id },
      data: {
        action: ApprovalAction.REJECTED,
        actorUserId: resolvedActorId,
        actedAt: new Date(),
        comment: comment ?? null,
      },
    })

    await finalizeBudgetRejectedTx(tx, entityType, entityId)
    await finalizeAdjustmentRejectedTx(tx, entityType, entityId)
    await finalizeCashPlanRejectedTx(tx, entityType, entityId)
    await finalizeCashPlanSubPlanRejectedTx(tx, entityType, entityId)
    return {
      ok: true as const,
      recordId: record.id,
      returned: false as const,
    }
  })
}

export async function runTransfer(params: {
  processId: string
  organizationId: string
  entityType: string
  entityId: string
  resolvedActorId: string
  targetUserId: string
  comment?: string | null
}) {
  const {
    processId,
    organizationId,
    entityType,
    entityId,
    resolvedActorId,
    targetUserId,
    comment,
  } = params

  const targetOk = await assertUserInOrganization(targetUserId, organizationId)
  if (!targetOk) return { ok: false as const, code: "BAD_TARGET" as const }

  const actorInOrg = await assertUserInOrganization(
    resolvedActorId,
    organizationId
  )
  if (!actorInOrg) return { ok: false as const, code: "FORBIDDEN" as const }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const record = await tx.approvalRecord.findFirst({
      where: {
        processId,
        entityType,
        entityId,
        action: ApprovalAction.PENDING,
        process: { organizationId },
      },
      include: { node: true },
      orderBy: { createdAt: "desc" },
    })

    if (!record) return { ok: false as const, code: "NO_PENDING" as const }
    if (!canActorHandlePending(resolvedActorId, record)) {
      return { ok: false as const, code: "FORBIDDEN" as const }
    }

    if (!record.nodeId) return { ok: false as const, code: "NO_NODE" as const }

    await tx.approvalRecord.update({
      where: { id: record.id },
      data: {
        action: ApprovalAction.TRANSFERRED,
        actorUserId: resolvedActorId,
        actedAt: new Date(),
        comment:
          [comment, `转交给用户 ${targetUserId}`].filter(Boolean).join(" | ") ||
          `转交给用户 ${targetUserId}`,
      },
    })

    await tx.approvalRecord.create({
      data: {
        processId,
        nodeId: record.nodeId,
        entityType,
        entityId,
        action: ApprovalAction.PENDING,
        actorUserId: targetUserId,
      },
    })

    return { ok: true as const, recordId: record.id }
  })
}
