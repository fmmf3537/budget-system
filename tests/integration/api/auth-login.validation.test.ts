import { describe, expect, it, vi, beforeEach } from "vitest"

const findFirst = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst,
    },
  },
}))

const verifyPasswordMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: verifyPasswordMock,
}))

import { POST } from "@/app/api/auth/login/route"
import { UserStatus } from "@/generated/prisma/enums"

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    findFirst.mockReset()
    verifyPasswordMock.mockReset()
    verifyPasswordMock.mockReturnValue(true)
  })

  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { success: boolean; error?: { code?: string } }
    expect(json.success).toBe(false)
    expect(json.error?.code).toBe("INVALID_JSON")
  })

  it("returns 400 when email or password fails zod", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-email", password: "" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { success: boolean; error?: { code?: string } }
    expect(json.success).toBe(false)
    expect(json.error?.code).toBe("VALIDATION_ERROR")
  })

  it("returns 401 when user does not exist", async () => {
    findFirst.mockResolvedValue(null)
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "anypassword1",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = (await res.json()) as { success: boolean; error?: { code?: string } }
    expect(json.success).toBe(false)
    expect(json.error?.code).toBe("AUTH_FAILED")
  })

  it("returns 401 when password does not match", async () => {
    findFirst.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      name: "U",
      status: UserStatus.ACTIVE,
      passwordHash: "hash",
      role: "ADMIN",
      organizationId: "org1",
      organization: { id: "org1", name: "Org", code: "O1" },
    })
    verifyPasswordMock.mockReturnValue(false)
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "wrong-password",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 401 when user is inactive", async () => {
    findFirst.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      name: "U",
      status: UserStatus.INACTIVE,
      passwordHash: "hash",
      role: "ADMIN",
      organizationId: "org1",
      organization: { id: "org1", name: "Org", code: "O1" },
    })
    verifyPasswordMock.mockReturnValue(true)
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "validpass12",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
