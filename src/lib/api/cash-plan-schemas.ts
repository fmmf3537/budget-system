import { z } from "zod"
import { CashPlanStatus } from "@/generated/prisma/enums"

const optionalIsoDateTime = z
  .string()
  .datetime({ offset: true })
  .optional()
  .nullable()

const money = z.union([z.number(), z.string()]).transform((v) => String(v))

const lineAttachmentSchema = z
  .object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(255).optional().nullable(),
  dataBase64: z.string().min(1).optional(),
  url: z.string().url().optional(),
  size: z.coerce.number().int().min(0).optional().nullable(),
  })
  .refine((o) => Boolean(o.dataBase64 || o.url), {
    message: "附件需包含 dataBase64 或 url",
  })

export const cashPlanListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(CashPlanStatus).optional(),
  q: z.string().trim().max(200).optional(),
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "name",
      "periodStart",
      "periodEnd",
      "status",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export const cashPlanCreateBodySchema = z.object({
  name: z.string().trim().max(200).optional().nullable(),
  periodStart: z.string().datetime({ offset: true }),
  periodEnd: z.string().datetime({ offset: true }),
  approvalProcessId: z.string().min(1).max(64).optional().nullable(),
  rootDepartmentCode: z.string().trim().max(64).optional().nullable(),
})

export const cashPlanUpdateBodySchema = z
  .object({
    name: z.string().trim().max(200).optional().nullable(),
    periodStart: z.string().datetime({ offset: true }).optional(),
    periodEnd: z.string().datetime({ offset: true }).optional(),
    approvalProcessId: z.string().min(1).max(64).optional().nullable(),
    rootDepartmentCode: z.string().trim().max(64).optional().nullable(),
    openingBalance: z.union([money, z.null()]).optional(),
    safetyWaterLevel: z.union([money, z.null()]).optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), {
    message: "至少需要提供一个可更新字段",
  })

export const cashPlanLineBodySchema = z.object({
  category: z.string().trim().max(128).optional().nullable(),
  amount: money,
  expectedDate: optionalIsoDateTime,
  remark: z.string().trim().max(500).optional().nullable(),
  attachment: lineAttachmentSchema.optional().nullable(),
})

export const cashPlanLinePatchSchema = z
  .object({
    category: z.string().trim().max(128).optional().nullable(),
    amount: money.optional(),
    expectedDate: optionalIsoDateTime,
    remark: z.string().trim().max(500).optional().nullable(),
    attachment: lineAttachmentSchema.optional().nullable(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), {
    message: "至少需要提供一个可更新字段",
  })

export const cashPlanForecastQuerySchema = z.object({
  openingBalance: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : String(v))),
})

export const cashPlanWarningsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  includeResolved: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
})

export const cashPlanSubPlanCreateSchema = z.object({
  scopeDepartmentCode: z.string().trim().min(1).max(64),
  name: z.string().trim().max(200).optional().nullable(),
  approvalProcessId: z.string().trim().max(64).optional().nullable(),
  incomes: z.array(cashPlanLineBodySchema).default([]),
  expenses: z.array(cashPlanLineBodySchema).default([]),
})

export const cashPlanSubPlanUpdateSchema = z
  .object({
    scopeDepartmentCode: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().max(200).optional().nullable(),
    approvalProcessId: z.string().trim().max(64).optional().nullable(),
    incomes: z.array(cashPlanLineBodySchema).optional(),
    expenses: z.array(cashPlanLineBodySchema).optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), {
    message: "至少需要提供一个可更新字段",
  })

export const cashPlanMonthlyGenerateBodySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month 必须为 YYYY-MM"),
  name: z.string().trim().max(200).optional().nullable(),
  approvalProcessId: z.string().min(1).max(64).optional().nullable(),
  rootDepartmentCode: z.string().trim().min(1, "必须选择顶级部门").max(64),
})
