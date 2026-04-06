import { z } from "zod"
import { BudgetStatus } from "@/generated/prisma/enums"

const money = z.union([z.number(), z.string()]).transform((v) => String(v))

const optionalIsoDateTime = z
  .string()
  .datetime({ offset: true })
  .optional()
  .nullable()

export const budgetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(BudgetStatus).optional(),
  fiscalYear: z.coerce.number().int().min(1900).max(2100).optional(),
  q: z.string().trim().max(200).optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "name", "fiscalYear", "status", "version"])
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

export const budgetCreateBodySchema = z.object({
  fiscalYear: z.coerce.number().int().min(1900).max(2100),
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(64).optional().nullable(),
  currency: z.string().trim().max(8).optional(),
  periodStart: optionalIsoDateTime,
  periodEnd: optionalIsoDateTime,
  compilationMethod: budgetCompilationMethodSchema,
  approvalProcessId: z.string().min(1).max(64).optional().nullable(),
  lines: z.array(budgetLineInputSchema).optional().default([]),
})

export const budgetUpdateBodySchema = z
  .object({
    fiscalYear: z.coerce.number().int().min(1900).max(2100).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().max(64).optional().nullable(),
    currency: z.string().trim().max(8).optional(),
    periodStart: optionalIsoDateTime,
    periodEnd: optionalIsoDateTime,
    compilationMethod: budgetCompilationMethodSchema,
    approvalProcessId: z.string().min(1).max(64).optional().nullable(),
    lines: z.array(budgetLineInputSchema).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "至少需要提供一个可更新字段",
  })
