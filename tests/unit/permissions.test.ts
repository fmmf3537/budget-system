import { describe, expect, it } from "vitest"

import { Permission, hasPermission, hasAnyPermission } from "@/lib/auth/permissions"
import { UserRole } from "@/lib/auth/roles"

describe("hasPermission", () => {
  it("grants ADMIN every permission key", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.USER_MANAGE)).toBe(true)
    expect(hasPermission(UserRole.ADMIN, Permission.BUDGET_CREATE)).toBe(true)
    expect(hasPermission(UserRole.ADMIN, Permission.SETTINGS_MANAGE)).toBe(true)
  })

  it("denies VIEWER user management", () => {
    expect(hasPermission(UserRole.VIEWER, Permission.USER_MANAGE)).toBe(false)
    expect(hasPermission(UserRole.VIEWER, Permission.CASH_PLAN_DELETE)).toBe(
      false
    )
  })

  it("grants BUDGET_MANAGER budget create and cash plan edit", () => {
    expect(hasPermission(UserRole.BUDGET_MANAGER, Permission.BUDGET_CREATE)).toBe(
      true
    )
    expect(hasPermission(UserRole.BUDGET_MANAGER, Permission.CASH_PLAN_EDIT)).toBe(
      true
    )
    expect(
      hasPermission(UserRole.BUDGET_MANAGER, Permission.CASH_PLAN_DELETE)
    ).toBe(true)
  })

  it("denies BUDGET_MANAGER approval approve", () => {
    expect(hasPermission(UserRole.BUDGET_MANAGER, Permission.APPROVAL_APPROVE)).toBe(
      false
    )
  })

  it("grants APPROVER approval view and approve", () => {
    expect(hasPermission(UserRole.APPROVER, Permission.APPROVAL_VIEW)).toBe(true)
    expect(hasPermission(UserRole.APPROVER, Permission.APPROVAL_APPROVE)).toBe(true)
  })
})

describe("hasAnyPermission", () => {
  it("returns true when one of multiple keys matches", () => {
    expect(
      hasAnyPermission(UserRole.VIEWER, [
        Permission.USER_MANAGE,
        Permission.BUDGET_VIEW,
      ])
    ).toBe(true)
  })
})
