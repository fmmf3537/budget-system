import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  budgetHeader: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/api/require-permission", () => ({
  requireApiPermission: vi.fn(),
}))

vi.mock("@/lib/api/budget-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/budget-queries")>()
  return {
    ...actual,
    validateSubjectIdsForOrg: vi.fn().mockResolvedValue(true),
    resolveActorUserId: vi.fn().mockResolvedValue("actor-1"),
    replaceBudgetLinesInTransaction: vi.fn().mockResolvedValue(undefined),
  }
})

import { BudgetCompilationGranularity, BudgetStatus } from "@/generated/prisma/enums"
import { GET, POST } from "@/app/api/budget/route"
import { PUT } from "@/app/api/budget/[id]/route"
import { requireApiPermission } from "@/lib/api/require-permission"

const authCtx = {
  userId: "user-1",
  organizationId: "org-1",
  role: "ADMIN" as const,
}

function json(res: Response) {
  return res.json() as Promise<{
    success: boolean
    data?: Record<string, unknown>
    error?: { message?: string }
  }>
}

describe("GET /api/budget — 编制粒度筛选（回归：年度+季度/月）", () => {
  beforeEach(() => {
    vi.mocked(requireApiPermission).mockResolvedValue(authCtx)
    vi.mocked(prismaMock.budgetHeader.count).mockResolvedValue(1)
    vi.mocked(prismaMock.budgetHeader.findMany).mockResolvedValue([])
  })

  it("applies compilationGranularity and periodUnit to Prisma where", async () => {
    let captured: unknown
    vi.mocked(prismaMock.budgetHeader.findMany).mockImplementation(
      async (args: { where?: unknown }) => {
        captured = args.where
        return []
      }
    )

    const url = new URL("http://localhost/api/budget")
    url.searchParams.set("page", "1")
    url.searchParams.set("pageSize", "20")
    url.searchParams.set("fiscalYear", "2026")
    url.searchParams.set(
      "compilationGranularity",
      BudgetCompilationGranularity.QUARTERLY
    )
    url.searchParams.set("periodUnit", "2")

    const res = await GET(new Request(url.toString()))
    expect(res.status).toBe(200)
    expect(captured).toMatchObject({
      organizationId: "org-1",
      fiscalYear: 2026,
      compilationGranularity: BudgetCompilationGranularity.QUARTERLY,
      periodUnit: 2,
    })
  })
})

describe("POST /api/budget — 三种粒度与 periodLabel / 期间（回归：新建）", () => {
  beforeEach(() => {
    vi.mocked(requireApiPermission).mockResolvedValue(authCtx)
  })

  it("creates ANNUAL with full-year UTC bounds and periodLabel", async () => {
    vi.mocked(prismaMock.$transaction).mockImplementation(async (cb) => {
      const tx = {
        budgetHeader: {
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "h-annual",
            ...data,
            status: BudgetStatus.DRAFT,
            version: 1,
            totalAmount: null,
            submittedAt: null,
            approvedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          update: vi.fn(),
          findFirstOrThrow: vi.fn().mockImplementation(async () => ({
            id: "h-annual",
            organizationId: "org-1",
            fiscalYear: 2026,
            compilationGranularity: BudgetCompilationGranularity.ANNUAL,
            periodUnit: null,
            code: null,
            name: "年度预算",
            status: BudgetStatus.DRAFT,
            totalAmount: { toString: () => "0" },
            currency: "CNY",
            periodStart: new Date("2026-01-01T00:00:00.000Z"),
            periodEnd: new Date("2026-12-31T23:59:59.999Z"),
            compilationMethod: null,
            version: 1,
            createdById: "actor-1",
            updatedById: null,
            submittedAt: null,
            approvedAt: null,
            approvalProcessId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lines: [],
          })),
        },
        budgetLine: {
          createMany: vi.fn(),
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { amount: { toString: () => "0" } } }),
        },
      }
      return cb(tx as never)
    })

    const req = new Request("http://localhost/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiscalYear: 2026,
        name: "年度预算",
        compilationGranularity: BudgetCompilationGranularity.ANNUAL,
        lines: [],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.success).toBe(true)
    expect(body.data?.compilationGranularity).toBe(
      BudgetCompilationGranularity.ANNUAL
    )
    expect(body.data?.periodStart).toBe("2026-01-01T00:00:00.000Z")
    expect(body.data?.periodEnd).toBe("2026-12-31T23:59:59.999Z")
    expect(String(body.data?.periodLabel)).toContain("2026")
  })

  it("creates MONTHLY with March bounds", async () => {
    vi.mocked(prismaMock.$transaction).mockImplementation(async (cb) => {
      const tx = {
        budgetHeader: {
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "h-m3",
            ...data,
            status: BudgetStatus.DRAFT,
            version: 1,
            totalAmount: null,
            submittedAt: null,
            approvedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          update: vi.fn(),
          findFirstOrThrow: vi.fn().mockResolvedValue({
            id: "h-m3",
            organizationId: "org-1",
            fiscalYear: 2026,
            compilationGranularity: BudgetCompilationGranularity.MONTHLY,
            periodUnit: 3,
            code: null,
            name: "3月预算",
            status: BudgetStatus.DRAFT,
            totalAmount: { toString: () => "0" },
            currency: "CNY",
            periodStart: new Date("2026-03-01T00:00:00.000Z"),
            periodEnd: new Date("2026-03-31T23:59:59.999Z"),
            compilationMethod: null,
            version: 1,
            createdById: "actor-1",
            updatedById: null,
            submittedAt: null,
            approvedAt: null,
            approvalProcessId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lines: [],
          }),
        },
        budgetLine: {
          createMany: vi.fn(),
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { amount: { toString: () => "0" } } }),
        },
      }
      return cb(tx as never)
    })

    const req = new Request("http://localhost/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiscalYear: 2026,
        name: "3月预算",
        compilationGranularity: BudgetCompilationGranularity.MONTHLY,
        periodUnit: 3,
        lines: [],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.success).toBe(true)
    expect(body.data?.periodStart).toBe("2026-03-01T00:00:00.000Z")
    expect(body.data?.periodEnd).toBe("2026-03-31T23:59:59.999Z")
    expect(String(body.data?.periodLabel)).toContain("3")
  })

  it("creates QUARTERLY Q2 with April–June bounds", async () => {
    vi.mocked(prismaMock.$transaction).mockImplementation(async (cb) => {
      const tx = {
        budgetHeader: {
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "h-q2",
            ...data,
            status: BudgetStatus.DRAFT,
            version: 1,
            totalAmount: null,
            submittedAt: null,
            approvedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          update: vi.fn(),
          findFirstOrThrow: vi.fn().mockResolvedValue({
            id: "h-q2",
            organizationId: "org-1",
            fiscalYear: 2026,
            compilationGranularity: BudgetCompilationGranularity.QUARTERLY,
            periodUnit: 2,
            code: null,
            name: "Q2 预算",
            status: BudgetStatus.DRAFT,
            totalAmount: { toString: () => "0" },
            currency: "CNY",
            periodStart: new Date("2026-04-01T00:00:00.000Z"),
            periodEnd: new Date("2026-06-30T23:59:59.999Z"),
            compilationMethod: null,
            version: 1,
            createdById: "actor-1",
            updatedById: null,
            submittedAt: null,
            approvedAt: null,
            approvalProcessId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lines: [],
          }),
        },
        budgetLine: {
          createMany: vi.fn(),
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { amount: { toString: () => "0" } } }),
        },
      }
      return cb(tx as never)
    })

    const req = new Request("http://localhost/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiscalYear: 2026,
        name: "Q2 预算",
        compilationGranularity: BudgetCompilationGranularity.QUARTERLY,
        periodUnit: 2,
        lines: [],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.success).toBe(true)
    expect(body.data?.periodStart).toBe("2026-04-01T00:00:00.000Z")
    expect(body.data?.periodEnd).toBe("2026-06-30T23:59:59.999Z")
    expect(String(body.data?.periodLabel)).toMatch(/Q2|季度/)
  })
})

describe("PUT /api/budget/[id] — 仅改预算年度时重算期间（回归：编辑）", () => {
  beforeEach(() => {
    vi.mocked(requireApiPermission).mockResolvedValue(authCtx)
  })

  it("shifts MONTHLY period when fiscalYear changes", async () => {
    const existing = {
      id: "h1",
      organizationId: "org-1",
      fiscalYear: 2026,
      compilationGranularity: BudgetCompilationGranularity.MONTHLY,
      periodUnit: 3,
      periodStart: new Date("2026-03-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-31T23:59:59.999Z"),
      code: null,
      name: "M",
      status: BudgetStatus.DRAFT,
      totalAmount: null,
      currency: "CNY",
      compilationMethod: null,
      version: 1,
      createdById: null,
      updatedById: null,
      submittedAt: null,
      approvedAt: null,
      approvalProcessId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const updatedDetail = {
      ...existing,
      fiscalYear: 2027,
      periodStart: new Date("2027-03-01T00:00:00.000Z"),
      periodEnd: new Date("2027-03-31T23:59:59.999Z"),
      lines: [],
    }

    vi.mocked(prismaMock.budgetHeader.findFirst)
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(updatedDetail as never)

    vi.mocked(prismaMock.$transaction).mockImplementation(async (cb) => {
      const tx = {
        budgetHeader: {
          update: vi.fn().mockResolvedValue({}),
        },
      }
      return cb(tx as never)
    })

    const req = new Request("http://localhost/api/budget/h1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscalYear: 2027 }),
    })

    const res = await PUT(req, {
      params: Promise.resolve({ id: "h1" }),
    })
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.success).toBe(true)
    expect(body.data?.fiscalYear).toBe(2027)
    expect(body.data?.periodStart).toBe("2027-03-01T00:00:00.000Z")
    expect(body.data?.periodEnd).toBe("2027-03-31T23:59:59.999Z")
  })
})
