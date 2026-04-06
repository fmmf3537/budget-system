import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  cashPlanIncome: {
    create: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/api/request-auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/api/cash-plan-queries", () => ({
  findCashPlanHeaderOnly: vi.fn(),
}))

import { POST } from "@/app/api/cash-plan/[id]/income/route"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { requireAuth } from "@/lib/api/request-auth"
import { CashPlanStatus } from "@/generated/prisma/enums"

const authCtx = {
  userId: "user-1",
  organizationId: "org-1",
  role: "ADMIN" as const,
}

describe("POST /api/cash-plan/[id]/income", () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue(authCtx)
    vi.mocked(findCashPlanHeaderOnly).mockResolvedValue({
      id: "plan-1",
      organizationId: "org-1",
      status: CashPlanStatus.DRAFT,
    } as never)
    vi.mocked(prismaMock.cashPlanIncome.create).mockResolvedValue({
      id: "inc-1",
      headerId: "plan-1",
      category: "CAT",
      amount: { toString: () => "100.00" },
      expectedDate: new Date("2026-01-15T00:00:00.000Z"),
      remark: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
  })

  it("returns 201 for valid line body", async () => {
    const req = new Request("http://localhost/api/cash-plan/plan-1/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "CAT",
        amount: "100",
        expectedDate: "2026-01-15T00:00:00.000Z",
        remark: null,
      }),
    })
    const res = await POST(req, {
      params: Promise.resolve({ id: "plan-1" }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { success: boolean }
    expect(body.success).toBe(true)
  })

  it("returns 409 when plan is not DRAFT", async () => {
    vi.mocked(findCashPlanHeaderOnly).mockResolvedValue({
      id: "plan-1",
      organizationId: "org-1",
      status: CashPlanStatus.APPROVED,
    } as never)

    const req = new Request("http://localhost/api/cash-plan/plan-1/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "1" }),
    })
    const res = await POST(req, {
      params: Promise.resolve({ id: "plan-1" }),
    })
    expect(res.status).toBe(409)
  })
})
