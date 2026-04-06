import { create } from "zustand"
import {
  BudgetCompilationGranularity,
  BudgetStatus,
} from "@/generated/prisma/enums"
import { DEFAULT_USER_ROLE } from "@/lib/auth/roles"
import type { UserRoleType } from "@/lib/auth/roles"
import { buildMockHeaders } from "@/lib/api/mock-headers"

export type BudgetListItem = {
  id: string
  organizationId: string
  fiscalYear: number
  compilationGranularity: BudgetCompilationGranularity
  periodUnit: number | null
  periodLabel: string
  code: string | null
  name: string
  status: string
  totalAmount: string | null
  currency: string
  periodStart: string | null
  periodEnd: string | null
  version: number
  createdById: string | null
  updatedById: string | null
  submittedAt: string | null
  approvedAt: string | null
  approvalProcessId: string | null
  createdAt: string
  updatedAt: string
}

type ListPayload = {
  items: BudgetListItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { code: string; message: string; details?: unknown }
}

type BudgetStoreState = {
  items: BudgetListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  loading: boolean
  error: string | null

  /** 名称搜索（应用筛选时生效） */
  nameQuery: string
  /** 草稿中的输入框 */
  draftNameQuery: string
  status: BudgetStatus | null
  fiscalYear: number | null
  /** 列表筛选：编制粒度；null 表示不限 */
  compilationGranularityFilter: BudgetCompilationGranularity | null
  /** 与筛选粒度配套：季度 1–4 或月份 1–12；年度粒度时忽略 */
  periodUnitFilter: number | null
  mockOrgId: string
  mockUserId: string
  mockUserRole: UserRoleType

  /** 登录会话：展示名与是否已登录（会话由 HttpOnly Cookie 维护） */
  profileDisplayName: string | null
  sessionActive: boolean

  setDraftNameQuery: (v: string) => void
  setStatus: (v: BudgetStatus | null) => void
  setFiscalYear: (v: number | null) => void
  setCompilationGranularityFilter: (
    v: BudgetCompilationGranularity | null
  ) => void
  setPeriodUnitFilter: (v: number | null) => void
  setMockOrgId: (v: string) => void
  setMockUserId: (v: string) => void
  setMockUserRole: (v: UserRoleType) => void
  setSessionFromServer: (p: {
    displayName: string
    organizationId: string
    userId: string
    role: UserRoleType
  }) => void
  clearSessionAndResetMock: () => void
  /** 未登录时仅清除会话展示状态，不改动 Mock 组织/用户（避免覆盖 Cookie 同步） */
  clearSessionProfileOnly: () => void
  setPage: (p: number) => void
  setPageSize: (n: number) => void
  goToPage: (p: number) => Promise<void>
  changePageSize: (n: number) => Promise<void>

  applyFilters: () => Promise<void>
  fetchList: () => Promise<void>

  deleteBudget: (id: string) => Promise<{ ok: boolean; message: string }>
  submitBudget: (id: string) => Promise<{ ok: boolean; message: string }>
}

export const useBudgetStore = create<BudgetStoreState>((set, get) => ({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
  loading: false,
  error: null,

  nameQuery: "",
  draftNameQuery: "",
  status: null,
  fiscalYear: null,
  compilationGranularityFilter: null,
  periodUnitFilter: null,
  mockOrgId: "demo-org",
  mockUserId: "demo-user",
  mockUserRole: DEFAULT_USER_ROLE,
  profileDisplayName: null,
  sessionActive: false,

  setDraftNameQuery: (draftNameQuery) => set({ draftNameQuery }),
  setStatus: (status) => set({ status }),
  setFiscalYear: (fiscalYear) => set({ fiscalYear }),
  setCompilationGranularityFilter: (compilationGranularityFilter) =>
    set({ compilationGranularityFilter, periodUnitFilter: null }),
  setPeriodUnitFilter: (periodUnitFilter) => set({ periodUnitFilter }),
  setMockOrgId: (mockOrgId) => set({ mockOrgId }),
  setMockUserId: (mockUserId) => set({ mockUserId }),
  setMockUserRole: (mockUserRole) => set({ mockUserRole }),
  setSessionFromServer: ({ displayName, organizationId, userId, role }) =>
    set({
      profileDisplayName: displayName,
      sessionActive: true,
      mockOrgId: organizationId,
      mockUserId: userId,
      mockUserRole: role,
    }),
  clearSessionAndResetMock: () =>
    set({
      profileDisplayName: null,
      sessionActive: false,
      mockOrgId: "demo-org",
      mockUserId: "demo-user",
      mockUserRole: DEFAULT_USER_ROLE,
    }),
  clearSessionProfileOnly: () =>
    set({ profileDisplayName: null, sessionActive: false }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  goToPage: async (page) => {
    set({ page })
    await get().fetchList()
  },
  changePageSize: async (pageSize) => {
    set({ pageSize, page: 1 })
    await get().fetchList()
  },

  applyFilters: async () => {
    const { draftNameQuery } = get()
    set({ nameQuery: draftNameQuery.trim(), page: 1 })
    await get().fetchList()
  },

  fetchList: async () => {
    const {
      page,
      pageSize,
      nameQuery,
      status,
      fiscalYear,
      compilationGranularityFilter,
      periodUnitFilter,
      mockOrgId,
      mockUserId,
      mockUserRole,
    } = get()
    set({ loading: true, error: null })
    try {
      const qs = new URLSearchParams()
      qs.set("page", String(page))
      qs.set("pageSize", String(pageSize))
      qs.set("sortBy", "updatedAt")
      qs.set("sortOrder", "desc")
      if (nameQuery) qs.set("q", nameQuery)
      if (status) qs.set("status", status)
      if (fiscalYear != null) qs.set("fiscalYear", String(fiscalYear))
      if (compilationGranularityFilter != null) {
        qs.set("compilationGranularity", compilationGranularityFilter)
        if (
          compilationGranularityFilter !== BudgetCompilationGranularity.ANNUAL &&
          periodUnitFilter != null
        ) {
          qs.set("periodUnit", String(periodUnitFilter))
        }
      }

      const res = await fetch(`/api/budget?${qs.toString()}`, {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<ListPayload> | ApiFail

      if (!json.success) {
        set({
          error: json.error?.message ?? "加载预算列表失败",
          loading: false,
        })
        return
      }

      const { items, pagination } = json.data
      set({
        items,
        total: pagination.total,
        totalPages: pagination.totalPages,
        loading: false,
        error: null,
      })
    } catch {
      set({ error: "网络异常，请稍后重试", loading: false })
    }
  },

  deleteBudget: async (id) => {
    const { mockOrgId, mockUserId, mockUserRole, fetchList } = get()
    try {
      const res = await fetch(`/api/budget/${id}`, {
        method: "DELETE",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
      if (!json.success) {
        return { ok: false, message: json.error?.message ?? "删除失败" }
      }
      await fetchList()
      return { ok: true, message: "已删除" }
    } catch {
      return { ok: false, message: "网络异常" }
    }
  },

  submitBudget: async (id) => {
    const { mockOrgId, mockUserId, mockUserRole, fetchList } = get()
    try {
      const res = await fetch(`/api/budget/${id}/submit`, {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
      if (!json.success) {
        return { ok: false, message: json.error?.message ?? "提交失败" }
      }
      await fetchList()
      return { ok: true, message: "已提交审批" }
    } catch {
      return { ok: false, message: "网络异常" }
    }
  },
}))
