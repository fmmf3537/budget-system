import { z } from "zod"

import { OrgStatus } from "@/generated/prisma/enums"

const codeSchema = z
  .string()
  .trim()
  .max(64)
  .optional()
  .nullable()
  .transform((s) => (s && s.length > 0 ? s : null))

export const organizationSettingsCreateSchema = z.object({
  name: z.string().trim().min(1, "请输入组织名称").max(200),
  code: codeSchema,
  parentId: z.string().trim().min(1, "请选择上级组织"),
})

export const organizationSettingsUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    code: codeSchema,
    status: z.nativeEnum(OrgStatus).optional(),
    /** 变更上级时必须仍为树内节点；不支持改为「无上级」（避免拆租户树） */
    parentId: z.string().trim().min(1).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "请至少提供一个要修改的字段",
  })
