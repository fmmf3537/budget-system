import { z } from "zod"

import { UserRole } from "@/lib/auth/roles"
import { UserStatus } from "@/generated/prisma/enums"

const roleSchema = z.enum([
  UserRole.ADMIN,
  UserRole.BUDGET_MANAGER,
  UserRole.APPROVER,
  UserRole.VIEWER,
])

export const userCreateBodySchema = z.object({
  email: z.string().trim().email("邮箱格式不正确"),
  name: z.string().trim().min(1, "姓名为必填").max(120),
  role: roleSchema,
  password: z.string().min(8, "密码至少 8 位"),
})

export const userRegisterBodySchema = z.object({
  email: z.string().trim().email("邮箱格式不正确"),
  name: z.string().trim().min(1, "姓名为必填").max(120),
  password: z.string().min(8, "密码至少 8 位"),
  passwordConfirm: z.string().min(8, "确认密码至少 8 位"),
})

export const userUpdateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: roleSchema.optional(),
    status: z.nativeEnum(UserStatus).optional(),
    password: z.union([z.string().min(8, "密码至少 8 位"), z.literal("")]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "至少提供一项要修改的字段" })

export type UserCreateBody = z.infer<typeof userCreateBodySchema>
export type UserRegisterBody = z.infer<typeof userRegisterBodySchema>
export type UserUpdateBody = z.infer<typeof userUpdateBodySchema>
