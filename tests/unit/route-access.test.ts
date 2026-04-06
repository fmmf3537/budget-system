import { describe, expect, it } from "vitest"

import { Permission } from "@/lib/auth/permissions"
import {
  isPublicPath,
  requiredPermissionForPath,
} from "@/lib/auth/route-access"

describe("isPublicPath", () => {
  it("marks home, login and unauthorized as public", () => {
    expect(isPublicPath("/")).toBe(true)
    expect(isPublicPath("/login")).toBe(true)
    expect(isPublicPath("/unauthorized")).toBe(true)
  })

  it("marks budget as non-public", () => {
    expect(isPublicPath("/budget")).toBe(false)
  })
})

describe("requiredPermissionForPath", () => {
  it("returns null for public paths", () => {
    expect(requiredPermissionForPath("/login")).toBeNull()
  })

  it("requires USER_MANAGE for settings users before generic settings", () => {
    expect(requiredPermissionForPath("/settings/users")).toBe(
      Permission.USER_MANAGE
    )
    expect(requiredPermissionForPath("/settings/approval-flow")).toBe(
      Permission.SETTINGS_MANAGE
    )
  })

  it("requires BUDGET_VIEW for budget list", () => {
    expect(requiredPermissionForPath("/budget")).toBe(Permission.BUDGET_VIEW)
  })

  it("requires BUDGET_CREATE for new budget", () => {
    expect(requiredPermissionForPath("/budget/new")).toBe(
      Permission.BUDGET_CREATE
    )
  })

  it("requires BUDGET_EDIT for edit route", () => {
    expect(requiredPermissionForPath("/budget/abc123/edit")).toBe(
      Permission.BUDGET_EDIT
    )
  })

  it("defaults to BUDGET_VIEW for unknown app paths", () => {
    expect(requiredPermissionForPath("/unknown-module")).toBe(
      Permission.BUDGET_VIEW
    )
  })
})
