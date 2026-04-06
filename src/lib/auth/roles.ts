/**
 * 与数据库 User.role 字符串对齐的应用角色（大小写不敏感，归一化后比较）。
 */
export const UserRole = {
  ADMIN: "ADMIN",
  BUDGET_MANAGER: "BUDGET_MANAGER",
  APPROVER: "APPROVER",
  VIEWER: "VIEWER",
} as const

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole]

export const USER_ROLE_VALUES = Object.values(UserRole) as UserRoleType[]

/** 新建会话默认角色（与历史 Mock 行为兼容：具备编制能力） */
export const DEFAULT_USER_ROLE: UserRoleType = UserRole.BUDGET_MANAGER

export const ROLE_LABEL: Record<UserRoleType, string> = {
  [UserRole.ADMIN]: "系统管理员",
  [UserRole.BUDGET_MANAGER]: "预算编制",
  [UserRole.APPROVER]: "审批人",
  [UserRole.VIEWER]: "只读访客",
}

export function normalizeRole(
  raw: string | null | undefined
): UserRoleType {
  const v = raw?.trim().toUpperCase()
  for (const r of USER_ROLE_VALUES) {
    if (v === r) return r
  }
  return DEFAULT_USER_ROLE
}

export function isUserRoleString(v: string): v is UserRoleType {
  return USER_ROLE_VALUES.includes(v as UserRoleType)
}
