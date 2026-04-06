import { describe, expect, it } from "vitest"

import {
  userCreateBodySchema,
  userUpdateBodySchema,
} from "@/lib/api/user-schemas"
import { UserRole } from "@/lib/auth/roles"
import { UserStatus } from "@/generated/prisma/enums"

describe("userCreateBodySchema", () => {
  it("accepts valid payload", () => {
    const r = userCreateBodySchema.safeParse({
      email: "user@example.com",
      name: "张三",
      role: UserRole.VIEWER,
      password: "abcdefgh",
    })
    expect(r.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const r = userCreateBodySchema.safeParse({
      email: "not-an-email",
      name: "A",
      role: UserRole.ADMIN,
      password: "abcdefgh",
    })
    expect(r.success).toBe(false)
  })

  it("rejects short password", () => {
    const r = userCreateBodySchema.safeParse({
      email: "a@b.co",
      name: "A",
      role: UserRole.ADMIN,
      password: "short",
    })
    expect(r.success).toBe(false)
  })

  it("rejects empty name", () => {
    const r = userCreateBodySchema.safeParse({
      email: "a@b.co",
      name: "   ",
      role: UserRole.ADMIN,
      password: "abcdefgh",
    })
    expect(r.success).toBe(false)
  })
})

describe("userUpdateBodySchema", () => {
  it("rejects empty patch object", () => {
    const r = userUpdateBodySchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it("accepts status-only update", () => {
    const r = userUpdateBodySchema.safeParse({
      status: UserStatus.INACTIVE,
    })
    expect(r.success).toBe(true)
  })

  it("allows empty string password as optional clear-no-op", () => {
    const r = userUpdateBodySchema.safeParse({ password: "" })
    expect(r.success).toBe(true)
  })
})
