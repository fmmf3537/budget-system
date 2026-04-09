import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/api/require-permission", () => ({
  requireApiPermission: vi.fn(),
}))

vi.mock("@/lib/api/cash-plan-queries", () => ({
  findCashPlanHeaderOnly: vi.fn(),
}))

vi.mock("@/lib/api/cash-plan-department-scope", () => ({
  validateSubPlanDepartmentScope: vi.fn(),
}))

vi.mock("@/lib/api/budget-queries", () => ({
  resolveActorUserId: vi.fn(),
}))

import { POST } from "@/app/api/cash-plan/[id]/sub-plans/route"
import { CashPlanStatus } from "@/generated/prisma/enums"
import { requireApiPermission } from "@/lib/api/require-permission"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"
import { validateSubPlanDepartmentScope } from "@/lib/api/cash-plan-department-scope"
import { resolveActorUserId } from "@/lib/api/budget-queries"

const authCtx = {
  userId: "u-1",
  organizationId: "org-1",
  role: "ADMIN" as const,
}

describe("POST /api/cash-plan/[id]/sub-plans", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireApiPermission).mockResolvedValue(authCtx)
    vi.mocked(findCashPlanHeaderOnly).mockResolvedValue({
      id: "plan-1",
      organizationId: "org-1",
      status: CashPlanStatus.DRAFT,
      rootDepartmentCode: null,
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-30T23:59:59.999Z"),
      approvalProcessId: null,
    } as never)
    vi.mocked(validateSubPlanDepartmentScope).mockResolvedValue({ ok: true })
    vi.mocked(resolveActorUserId).mockResolvedValue("u-1")
  })

  it("returns 400 when any line amount <= 0", async () => {
    const req = new Request("http://localhost/api/cash-plan/plan-1/sub-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeDepartmentCode: "D001",
        incomes: [{ amount: "0", category: null, expectedDate: null, remark: null }],
        expenses: [],
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: "plan-1" }) })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { success: boolean; error?: { message?: string } }
    expect(body.success).toBe(false)
    expect(body.error?.message).toBeTruthy()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("returns 400 when any line date is out of parent period", async () => {
    const req = new Request("http://localhost/api/cash-plan/plan-1/sub-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeDepartmentCode: "D001",
        incomes: [
          {
            amount: "10",
            category: null,
            expectedDate: "2026-05-01T00:00:00.000Z",
            remark: null,
          },
        ],
        expenses: [],
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: "plan-1" }) })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { success: boolean; error?: { message?: string } }
    expect(body.success).toBe(false)
    expect(body.error?.message).toBeTruthy()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
