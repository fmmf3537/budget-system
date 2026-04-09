import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  cashPlanSubPlan: { findMany: vi.fn() },
  cashPlanSubPlanIncome: { aggregate: vi.fn() },
  cashPlanSubPlanExpense: { aggregate: vi.fn() },
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

import { GET } from "@/app/api/cash-plan/[id]/sub-plans/aggregate/route"
import { requireApiPermission } from "@/lib/api/require-permission"
import { findCashPlanHeaderOnly } from "@/lib/api/cash-plan-queries"

const authCtx = {
  userId: "u-1",
  organizationId: "org-1",
  role: "ADMIN" as const,
}

describe("GET /api/cash-plan/[id]/sub-plans/aggregate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireApiPermission).mockResolvedValue(authCtx)
    vi.mocked(findCashPlanHeaderOnly).mockResolvedValue({
      id: "plan-1",
      organizationId: "org-1",
    } as never)
  })

  it("returns zero summary when no approved sub plans", async () => {
    vi.mocked(prismaMock.cashPlanSubPlan.findMany).mockResolvedValue([])

    const res = await GET(
      new Request("http://localhost/api/cash-plan/plan-1/sub-plans/aggregate"),
      { params: Promise.resolve({ id: "plan-1" }) }
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { totalInflow: string; netFlow: string } }
    expect(body.data.totalInflow).toBe("0")
    expect(body.data.netFlow).toBe("0")
  })

  it("returns aggregated inflow/outflow/net", async () => {
    vi.mocked(prismaMock.cashPlanSubPlan.findMany).mockResolvedValue([
      { id: "s1" },
      { id: "s2" },
    ] as never)
    vi.mocked(prismaMock.cashPlanSubPlanIncome.aggregate).mockResolvedValue({
      _sum: { amount: { toString: () => "120.5" } },
    } as never)
    vi.mocked(prismaMock.cashPlanSubPlanExpense.aggregate).mockResolvedValue({
      _sum: { amount: { toString: () => "20.5" } },
    } as never)

    const res = await GET(
      new Request("http://localhost/api/cash-plan/plan-1/sub-plans/aggregate"),
      { params: Promise.resolve({ id: "plan-1" }) }
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { approvedSubPlanCount: number; totalInflow: string; totalOutflow: string; netFlow: string }
    }
    expect(body.data.approvedSubPlanCount).toBe(2)
    expect(body.data.totalInflow).toBe("120.50")
    expect(body.data.totalOutflow).toBe("20.50")
    expect(body.data.netFlow).toBe("100.00")
  })
})
