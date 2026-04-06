import { z } from "zod"
import { ApprovalBizType } from "@/generated/prisma/enums"

const moneyOptional = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null) return null
    const s = String(v).trim()
    if (!s) return null
    return s
  })

const nodeSchema = z
  .object({
    sortOrder: z.coerce.number().int().min(0),
    name: z.string().trim().min(1).max(200),
    approverUserId: z.string().min(1).max(64).optional().nullable(),
    approverRole: z.string().trim().max(64).optional().nullable(),
    isParallelGroup: z.coerce.boolean().optional().default(false),
    minTotalAmount: moneyOptional,
    maxTotalAmount: moneyOptional,
  })
  .superRefine((n, ctx) => {
    if (n.minTotalAmount == null || n.maxTotalAmount == null) return
    const a = Number(n.minTotalAmount)
    const b = Number(n.maxTotalAmount)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return
    if (a > b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "金额下限不能大于上限",
        path: ["maxTotalAmount"],
      })
    }
  })

export const approvalCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  bizType: z.nativeEnum(ApprovalBizType),
  isActive: z.coerce.boolean().optional().default(true),
  nodes: z.array(nodeSchema).min(1),
})

const updateNodeSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    sortOrder: z.coerce.number().int().min(0),
    name: z.string().trim().min(1).max(200),
    approverUserId: z.string().min(1).max(64).optional().nullable(),
    approverRole: z.string().trim().max(64).optional().nullable(),
    isParallelGroup: z.coerce.boolean().optional().default(false),
    minTotalAmount: moneyOptional,
    maxTotalAmount: moneyOptional,
  })
  .superRefine((n, ctx) => {
    if (n.minTotalAmount == null || n.maxTotalAmount == null) return
    const a = Number(n.minTotalAmount)
    const b = Number(n.maxTotalAmount)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return
    if (a > b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "金额下限不能大于上限",
        path: ["maxTotalAmount"],
      })
    }
  })

export const approvalProcessUpdateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    bizType: z.nativeEnum(ApprovalBizType).optional(),
    isActive: z.coerce.boolean().optional(),
    nodes: z.array(updateNodeSchema).min(1),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "至少需要提供一个可更新字段",
  })

export const approvalEntityBodySchema = z.object({
  entityType: z.string().trim().min(1).max(64),
  entityId: z.string().trim().min(1).max(64),
  comment: z.string().trim().max(2000).optional().nullable(),
})

export const approvalTransferBodySchema = approvalEntityBodySchema.extend({
  targetUserId: z.string().min(1).max(64),
})

/** 驳回：可选退回至流程中更早的节点（不结束流程、预算保持已提交） */
export const approvalRejectBodySchema = approvalEntityBodySchema.extend({
  returnToNodeId: z.string().min(1).max(64).optional().nullable(),
})

export const approvalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  processId: z
    .string()
    .min(1)
    .optional()
    .transform((s) => s || undefined),
  entityType: z
    .string()
    .max(64)
    .optional()
    .transform((s) => (s && s.trim() ? s.trim() : undefined)),
})
