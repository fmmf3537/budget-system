import { UserRole, type UserRoleType } from "./roles"

/** 细粒度权限码（接口与按钮共用） */
export const Permission = {
  SETTINGS_MANAGE: "settings:manage",
  /** 用户与角色管理（系统管理员） */
  USER_MANAGE: "users:manage",
  BUDGET_VIEW: "budget:view",
  BUDGET_CREATE: "budget:create",
  BUDGET_EDIT: "budget:edit",
  BUDGET_DELETE: "budget:delete",
  BUDGET_SUBMIT: "budget:submit",
  APPROVAL_VIEW: "approval:view",
  APPROVAL_APPROVE: "approval:approve",
  ADJUSTMENT_VIEW: "adjustment:view",
  ADJUSTMENT_CREATE: "adjustment:create",
  CASH_PLAN_VIEW: "cash_plan:view",
  CASH_PLAN_EDIT: "cash_plan:edit",
} as const

export type PermissionKey = (typeof Permission)[keyof typeof Permission]

const ALL_PERMISSIONS: PermissionKey[] = Object.values(Permission)

const ROLE_PERMISSIONS: Record<UserRoleType, ReadonlySet<PermissionKey>> = {
  [UserRole.ADMIN]: new Set(ALL_PERMISSIONS),
  [UserRole.BUDGET_MANAGER]: new Set([
    Permission.BUDGET_VIEW,
    Permission.BUDGET_CREATE,
    Permission.BUDGET_EDIT,
    Permission.BUDGET_DELETE,
    Permission.BUDGET_SUBMIT,
    Permission.ADJUSTMENT_VIEW,
    Permission.ADJUSTMENT_CREATE,
    Permission.CASH_PLAN_VIEW,
    Permission.CASH_PLAN_EDIT,
  ]),
  [UserRole.APPROVER]: new Set([
    Permission.BUDGET_VIEW,
    Permission.APPROVAL_VIEW,
    Permission.APPROVAL_APPROVE,
    Permission.CASH_PLAN_VIEW,
  ]),
  [UserRole.VIEWER]: new Set([
    Permission.BUDGET_VIEW,
    Permission.CASH_PLAN_VIEW,
    Permission.ADJUSTMENT_VIEW,
  ]),
}

/**
 * 是否具备某权限（ADMIN 含全部）。
 */
export function hasPermission(role: UserRoleType, key: PermissionKey): boolean {
  if (role === UserRole.ADMIN) return true
  return ROLE_PERMISSIONS[role].has(key)
}

/**
 * 是否具备任一权限。
 */
export function hasAnyPermission(
  role: UserRoleType,
  keys: PermissionKey[]
): boolean {
  return keys.some((k) => hasPermission(role, k))
}

/**
 * 是否具备全部列出权限。
 */
export function hasEveryPermission(
  role: UserRoleType,
  keys: PermissionKey[]
): boolean {
  return keys.every((k) => hasPermission(role, k))
}
