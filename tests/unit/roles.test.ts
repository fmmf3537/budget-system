import { describe, expect, it } from "vitest"

import {
  DEFAULT_USER_ROLE,
  ROLE_LABEL,
  UserRole,
  USER_ROLE_VALUES,
  isUserRoleString,
  normalizeRole,
} from "@/lib/auth/roles"

describe("normalizeRole", () => {
  it("normalizes lowercase and surrounding whitespace", () => {
    expect(normalizeRole("  admin  ")).toBe(UserRole.ADMIN)
    expect(normalizeRole("viewer")).toBe(UserRole.VIEWER)
  })

  it("falls back to default for unknown strings", () => {
    expect(normalizeRole("unknown")).toBe(DEFAULT_USER_ROLE)
    expect(normalizeRole(undefined)).toBe(DEFAULT_USER_ROLE)
  })

  it("accepts all canonical role values", () => {
    for (const r of USER_ROLE_VALUES) {
      expect(normalizeRole(r)).toBe(r)
    }
  })
})

describe("isUserRoleString", () => {
  it("recognizes valid role literals", () => {
    expect(isUserRoleString("ADMIN")).toBe(true)
    expect(isUserRoleString("INVALID")).toBe(false)
  })
})

describe("ROLE_LABEL", () => {
  it("defines a label for every role", () => {
    for (const r of USER_ROLE_VALUES) {
      expect(ROLE_LABEL[r].length).toBeGreaterThan(0)
    }
  })
})
