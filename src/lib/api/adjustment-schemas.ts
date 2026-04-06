import { z } from "zod"
import { AdjustmentKind, AdjustmentStatus } from "@/generated/prisma/enums"

export const adjustmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(AdjustmentStatus).optional(),
  q: z.string().trim().max(200).optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

const moneyPositive = z
  .string()
  .min(1, "请输入金额")
  .refine((s) => {
    const n = Number(s)
    return !Number.isNaN(n) && Number.isFinite(n) && n > 0
  }, "金额须为大于 0 的数字")

export const adjustmentDetailInputSchema = z.object({
  budgetLineId: z.string().trim().max(64).optional().nullable(),
  sourceSubjectId: z.string().trim().max(64).optional().nullable(),
  targetSubjectId: z.string().trim().max(64).optional().nullable(),
  sourceProject: z.string().trim().max(200).optional().nullable(),
  targetProject: z.string().trim().max(200).optional().nullable(),
  amount: moneyPositive,
  remark: z.string().trim().max(500).optional().nullable(),
})

export const adjustmentAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(256),
  mime: z.string().trim().max(128).optional().nullable(),
  dataBase64: z.string().min(1),
})

export const adjustmentCreateBodySchema = z
  .object({
    budgetHeaderId: z.string().trim().min(1),
    title: z.string().trim().max(200).optional().nullable(),
    kind: z.nativeEnum(AdjustmentKind),
    reason: z.string().trim().min(1, "请填写调整原因").max(2000),
    approvalProcessId: z.string().trim().max(64).optional().nullable(),
    details: z.array(adjustmentDetailInputSchema).min(1, "至少一条调整明细"),
    attachment: adjustmentAttachmentSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    data.details.forEach((d, i) => {
      const src = d.sourceSubjectId?.trim() || null
      const tgt = d.targetSubjectId?.trim() || null
      switch (data.kind) {
        case AdjustmentKind.INCREASE:
          if (!tgt) {
            ctx.addIssue({
              code: "custom",
              message: "追加时须选择新科目",
              path: ["details", i, "targetSubjectId"],
            })
          }
          break
        case AdjustmentKind.DECREASE:
          if (!src) {
            ctx.addIssue({
              code: "custom",
              message: "调减时须选择原科目",
              path: ["details", i, "sourceSubjectId"],
            })
          }
          break
        case AdjustmentKind.SUBJECT_TRANSFER:
        case AdjustmentKind.ROLLING:
          if (!src) {
            ctx.addIssue({
              code: "custom",
              message: "请选择原科目",
              path: ["details", i, "sourceSubjectId"],
            })
          }
          if (!tgt) {
            ctx.addIssue({
              code: "custom",
              message: "请选择新科目",
              path: ["details", i, "targetSubjectId"],
            })
          }
          break
        default:
          break
      }
    })
  })

export type AdjustmentCreateBody = z.infer<typeof adjustmentCreateBodySchema>
