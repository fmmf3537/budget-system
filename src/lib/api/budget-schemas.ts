import { z } from "zod"
import {
  BudgetCompilationGranularity,
  BudgetStatus,
} from "@/generated/prisma/enums"

const money = z.union([z.number(), z.string()]).transform((v) => String(v))

export const budgetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(BudgetStatus).optional(),
  fiscalYear: z.coerce.number().int().min(1900).max(2100).optional(),
  compilationGranularity: z.nativeEnum(BudgetCompilationGranularity).optional(),
  periodUnit: z.coerce.number().int().min(1).max(12).optional(),
  q: z.string().trim().max(200).optional(),
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "name",
      "fiscalYear",
      "status",
      "version",
      "compilationGranularity",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export const budgetLineInputSchema = z.object({
  subjectId: z.string().min(1).max(64),
  amount: money,
  amountYtd: money.optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
  departmentCode: z.string().max(64).optional().nullable(),
  dimension1: z.string().max(128).optional().nullable(),
  dimension2: z.string().max(128).optional().nullable(),
})

export const BUDGET_COMPILATION_METHODS = [
  "ZERO_BASE",
  "INCREMENTAL",
  "ROLLING",
  "HYBRID",
] as const

export const budgetCompilationMethodSchema = z
  .enum(BUDGET_COMPILATION_METHODS)
  .optional()
  .nullable()

export const budgetCreateBodySchema = z
  .object({
    fiscalYear: z.coerce.number().int().min(1900).max(2100),
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().max(64).optional().nullable(),
    currency: z.string().trim().max(8).optional(),
    compilationGranularity: z
      .nativeEnum(BudgetCompilationGranularity)
      .optional()
      .default(BudgetCompilationGranularity.ANNUAL),
    periodUnit: z.coerce.number().int().min(1).max(12).optional().nullable(),
    compilationMethod: budgetCompilationMethodSchema,
    approvalProcessId: z.string().min(1).max(64).optional().nullable(),
    lines: z.array(budgetLineInputSchema).optional().default([]),
  })
  .superRefine((val, ctx) => {
    if (val.compilationGranularity === BudgetCompilationGranularity.ANNUAL) {
      if (val.periodUnit != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "年度编制不需填写 periodUnit",
          path: ["periodUnit"],
        })
      }
      return
    }
    if (val.periodUnit == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "季度或月度编制必须指定 periodUnit",
        path: ["periodUnit"],
      })
      return
    }
    if (val.compilationGranularity === BudgetCompilationGranularity.QUARTERLY) {
      if (val.periodUnit < 1 || val.periodUnit > 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "季度编制 periodUnit 须为 1～4",
          path: ["periodUnit"],
        })
      }
    }
  })

export const budgetUpdateBodySchema = z
  .object({
    fiscalYear: z.coerce.number().int().min(1900).max(2100).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().max(64).optional().nullable(),
    currency: z.string().trim().max(8).optional(),
    compilationGranularity: z
      .nativeEnum(BudgetCompilationGranularity)
      .optional(),
    periodUnit: z.coerce.number().int().min(1).max(12).optional().nullable(),
    compilationMethod: budgetCompilationMethodSchema,
    approvalProcessId: z.string().min(1).max(64).optional().nullable(),
    lines: z.array(budgetLineInputSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (Object.keys(val).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "至少需要提供一个可更新字段",
      })
      return
    }
    const g = val.compilationGranularity
    const u = val.periodUnit
    if (g === BudgetCompilationGranularity.ANNUAL && u != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "年度编制不需填写 periodUnit",
        path: ["periodUnit"],
      })
    }
    if (
      g === BudgetCompilationGranularity.QUARTERLY &&
      u != null &&
      (u < 1 || u > 4)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "季度编制 periodUnit 须为 1～4",
        path: ["periodUnit"],
      })
    }
    if (
      g === BudgetCompilationGranularity.MONTHLY &&
      u != null &&
      (u < 1 || u > 12)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "月度编制 periodUnit 须为 1～12",
        path: ["periodUnit"],
      })
    }
  })
