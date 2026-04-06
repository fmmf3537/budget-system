import { z } from "zod"

import { CashPlanCategoryKind } from "@/generated/prisma/enums"

export const budgetDepartmentCreateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).max(999_999).optional().default(0),
})

export const budgetDepartmentUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.coerce.number().int().min(0).max(999_999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "至少需要提供一个可更新字段",
  })

export const budgetDimensionValueCreateSchema = z.object({
  slot: z.union([z.literal(1), z.literal(2)]),
  code: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).max(999_999).optional().default(0),
})

export const budgetDimensionValueUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(128).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.coerce.number().int().min(0).max(999_999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "至少需要提供一个可更新字段",
  })

export const cashPlanCategoryKindSchema = z.nativeEnum(CashPlanCategoryKind)

export const cashPlanCategoryCreateSchema = z.object({
  kind: cashPlanCategoryKindSchema,
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).max(999_999).optional().default(0),
})

export const cashPlanCategoryUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.coerce.number().int().min(0).max(999_999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "至少需要提供一个可更新字段",
  })
