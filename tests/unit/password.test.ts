import { describe, expect, it } from "vitest"

import { hashPassword, verifyPassword } from "@/lib/auth/password"

describe("password helpers", () => {
  it("verifies correct plain text against stored hash", () => {
    const hash = hashPassword("CorrectHorseBattery99!")
    expect(verifyPassword("CorrectHorseBattery99!", hash)).toBe(true)
  })

  it("rejects wrong password", () => {
    const hash = hashPassword("secret-one")
    expect(verifyPassword("secret-two", hash)).toBe(false)
  })

  it("returns false when hash is missing", () => {
    expect(verifyPassword("any", null)).toBe(false)
    expect(verifyPassword("any", undefined)).toBe(false)
  })
})
