import { z } from "zod"
import { BUDGET_COMPILATION_METHODS } from "@/lib/api/budget-schemas"

const compilationMethodEnum = z.enum(BUDGET_COMPILATION_METHODS)

export const budgetSubjectCreateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  parentId: z.string().min(1).max(64).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(999_999).optional().default(0),
})

export const budgetSubjectUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    parentId: z.string().min(1).max(64).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).max(999_999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "至少需要提供一个可更新字段",
  })

export const orgBudgetTemplateSettingsPutSchema = z.object({
  departmentFieldLabel: z.string().trim().max(64).optional().nullable(),
  dimension1Label: z.string().trim().max(64).optional().nullable(),
  dimension2Label: z.string().trim().max(64).optional().nullable(),
  enabledCompilationMethods: z
    .array(compilationMethodEnum)
    .min(1, "至少启用一种编制方法"),
})

export type OrgBudgetTemplateSettingsDto = z.infer<
  typeof orgBudgetTemplateSettingsPutSchema
>
