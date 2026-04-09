"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ApprovalBizType } from "@/generated/prisma/enums"
import { CashPlanStatus } from "@/generated/prisma/enums"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Can } from "@/components/auth/can"
import { buildMockHeaders } from "@/lib/api/mock-headers"
import { Permission } from "@/lib/auth/permissions"
import { UserRole } from "@/lib/auth/roles"
import { useBudgetStore } from "@/stores/budget-store"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

const STATUS_LABEL: Record<string, string> = {
  [CashPlanStatus.DRAFT]: "编制中",
  [CashPlanStatus.SUBMITTED]: "已提交",
  [CashPlanStatus.APPROVED]: "已锁定",
  [CashPlanStatus.CLOSED]: "已关闭",
}

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "全部" },
  { value: CashPlanStatus.DRAFT, label: "编制中" },
  { value: CashPlanStatus.SUBMITTED, label: "已提交" },
  { value: CashPlanStatus.APPROVED, label: "已锁定" },
]

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case CashPlanStatus.DRAFT:
      return "secondary"
    case CashPlanStatus.SUBMITTED:
      return "default"
    case CashPlanStatus.APPROVED:
      return "outline"
    case CashPlanStatus.CLOSED:
      return "destructive"
    default:
      return "outline"
  }
}

type ListItem = {
  id: string
  name: string | null
  rootDepartmentCode: string | null
  periodStart: string
  periodEnd: string
  status: string
  approvalProcessId: string | null
  createdAt: string
  updatedAt: string
}

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { message: string }
}

type MonthlyBoardPayload = {
  overview: {
    matchedMainPlanCount: number
    matchedSubPlanCount: number
    mainSubmittedInflow: string
    mainSubmittedOutflow: string
    subSubmittedInflow: string
    subSubmittedOutflow: string
    totalInflow: string
    totalOutflow: string
    netFlow: string
  }
  trend: Array<{
    key: string
    label: string
    inflow: string
    outflow: string
    net: string
  }>
  note: string
}

type MonthlyBoardScope =
  | "submitted_only"
  | "submitted_and_approved"
  | "approved_only"
type MonthlyBoardDepartmentScope = "__org__" | string

function formatPeriod(isoStart: string, isoEnd: string) {
  const a = isoStart.slice(0, 10)
  const b = isoEnd.slice(0, 10)
  return `${a} ~ ${b}`
}

function fmtMoney(v: string) {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const NONE = "__none__"

const createPlanSchema = z
  .object({
    name: z.string().max(200).optional(),
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "请选择月份"),
    approvalProcessId: z.string().optional(),
    rootDepartmentCode: z.string().min(1, "请选择顶级部门"),
  })

type CreatePlanValues = z.infer<typeof createPlanSchema>

export default function CashPlanListPage() {
  const router = useRouter()
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)
  const canGenerateMonthly = mockUserRole === UserRole.ADMIN
  const canViewBoard = mockUserRole === UserRole.ADMIN

  const [items, setItems] = React.useState<ListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(20)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [board, setBoard] = React.useState<MonthlyBoardPayload | null>(null)
  const [boardLoading, setBoardLoading] = React.useState(false)
  const [boardScope, setBoardScope] = React.useState<MonthlyBoardScope>("submitted_only")
  const [boardDepartmentScope, setBoardDepartmentScope] =
    React.useState<MonthlyBoardDepartmentScope>("__org__")

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createSubmitting, setCreateSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ListItem | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)
  const [processes, setProcesses] = React.useState<
    { id: string; name: string; bizType: string; isActive: boolean }[]
  >([])
  const [processesLoading, setProcessesLoading] = React.useState(false)
  const [topDepartments, setTopDepartments] = React.useState<
    { code: string; name: string }[]
  >([])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const depRes = await fetch("/api/master-data/departments", {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        })
        const depJson = (await depRes.json()) as
          | ApiSuccess<{
              items: {
                parentId: string | null
                code: string
                name: string
                isActive: boolean
              }[]
            }>
          | ApiFail
        if (cancelled) return
        if (!depJson.success) {
          setTopDepartments([])
          return
        }
        setTopDepartments(
          depJson.data.items
            .filter((d) => d.isActive && d.parentId == null)
            .map((d) => ({ code: d.code, name: d.name }))
        )
      } catch {
        if (!cancelled) setTopDepartments([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mockOrgId, mockUserId, mockUserRole])

  const createForm = useForm<CreatePlanValues>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: {
      name: "",
      month: new Date().toISOString().slice(0, 7),
      approvalProcessId: NONE,
      rootDepartmentCode: "",
    },
  })

  const fetchList = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: "updatedAt",
        sortOrder: "desc",
      })
      if (statusFilter !== "all") qs.set("status", statusFilter)
      const res = await fetch(`/api/cash-plan?${qs}`, {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as
        | ApiSuccess<{
            items: ListItem[]
            pagination: {
              page: number
              pageSize: number
              total: number
              totalPages: number
            }
          }>
        | ApiFail
      if (!json.success) {
        setError(json.error?.message ?? "加载失败")
        setItems([])
        return
      }
      setItems(json.data.items)
      setTotalPages(json.data.pagination.totalPages)
      setTotal(json.data.pagination.total)
    } catch {
      setError("网络异常")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [mockOrgId, mockUserId, mockUserRole, page, pageSize, statusFilter])

  React.useEffect(() => {
    void fetchList()
  }, [fetchList])

  const fetchBoard = React.useCallback(async () => {
    setBoardLoading(true)
    try {
      const res = await fetch(
        `/api/cash-plan/monthly-board?months=6&scope=${boardScope}&departmentScope=${encodeURIComponent(
          boardDepartmentScope
        )}`,
        {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        }
      )
      const json = (await res.json()) as ApiSuccess<MonthlyBoardPayload> | ApiFail
      if (!json.success) {
        setBoard(null)
        return
      }
      setBoard(json.data)
    } catch {
      setBoard(null)
    } finally {
      setBoardLoading(false)
    }
  }, [mockOrgId, mockUserId, mockUserRole, boardScope, boardDepartmentScope])

  React.useEffect(() => {
    void fetchBoard()
  }, [fetchBoard])

  React.useEffect(() => {
    if (!createOpen) return
    let cancelled = false
    ;(async () => {
      setProcessesLoading(true)
      try {
        const [flowRes, depRes] = await Promise.all([
          fetch("/api/settings/approval-flow", {
            headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
          }),
          fetch("/api/master-data/departments", {
            headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
          }),
        ])
        const [json, depJson] = (await Promise.all([
          flowRes.json(),
          depRes.json(),
        ])) as [
          | ApiSuccess<{
              items: {
                id: string
                name: string
                bizType: string
                isActive: boolean
              }[]
            }>
          | ApiFail,
          ApiSuccess<{
            items: {
              parentId: string | null
              code: string
              name: string
              isActive: boolean
            }[]
          }> | ApiFail,
        ]
        if (cancelled) return
        if (!json.success) {
          setProcesses([])
        } else {
          setProcesses(
            json.data.items.filter(
              (p) => p.bizType === ApprovalBizType.CASH_PLAN && p.isActive
            )
          )
        }
        if (!depJson.success) {
          setTopDepartments([])
        } else {
          setTopDepartments(
            depJson.data.items
              .filter((d) => d.isActive && d.parentId == null)
              .map((d) => ({ code: d.code, name: d.name }))
          )
        }
      } catch {
        if (!cancelled) {
          setProcesses([])
          setTopDepartments([])
        }
      } finally {
        if (!cancelled) setProcessesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [createOpen, mockOrgId, mockUserId, mockUserRole])

  const onCreate = createForm.handleSubmit(async (values) => {
    setCreateSubmitting(true)
    try {
      const approvalProcessId =
        values.approvalProcessId &&
        values.approvalProcessId !== NONE &&
        values.approvalProcessId.trim()
          ? values.approvalProcessId.trim()
          : null
      const rootDepartmentCode =
        values.rootDepartmentCode &&
        values.rootDepartmentCode.trim()
          ? values.rootDepartmentCode.trim()
          : ""
      const body = {
        name: values.name?.trim() ? values.name.trim() : null,
        month: values.month,
        approvalProcessId,
        rootDepartmentCode,
      }
      const res = await fetch("/api/cash-plan/monthly/generate", {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiSuccess<ListItem> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "创建失败")
        return
      }
      toast.success("已创建资金计划")
      setCreateOpen(false)
      createForm.reset({
        name: "",
        month: new Date().toISOString().slice(0, 7),
        approvalProcessId: NONE,
        rootDepartmentCode: "",
      })
      router.push(`/cash-plan/${json.data.id}`)
    } catch {
      toast.error("创建失败")
    } finally {
      setCreateSubmitting(false)
    }
  })

  async function confirmDeletePlan() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/cash-plan/${deleteTarget.id}`, {
        method: "DELETE",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "删除失败")
        return
      }
      toast.success("已删除资金计划")
      setDeleteTarget(null)
      void fetchList()
    } catch {
      toast.error("删除失败")
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/budget">← 预算列表</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">资金计划</h1>
          <p className="text-muted-foreground text-sm">
            数据来自{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              GET /api/cash-plan
            </code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewBoard ? (
            <Button asChild type="button" variant="outline">
              <Link href="/cash-plan/dashboard">现金流看板</Link>
            </Button>
          ) : null}
          <Can permission={Permission.CASH_PLAN_EDIT}>
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={!canGenerateMonthly}
            >
              <PlusIcon className="mr-2 size-4" />
              生成月度主计划
            </Button>
          </Can>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {canViewBoard ? (
      <Card>
        <CardHeader>
          <CardTitle>提交中资金看板</CardTitle>
          <CardDescription>
            主计划与子计划状态为「已提交」的流入/流出图表汇总
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm">统计口径</Label>
            <Select
              value={boardScope}
              onValueChange={(v) => setBoardScope(v as MonthlyBoardScope)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted_only">仅已提交</SelectItem>
                <SelectItem value="submitted_and_approved">已提交+已审批</SelectItem>
                <SelectItem value="approved_only">仅已审批</SelectItem>
              </SelectContent>
            </Select>
            <Label className="text-sm">部门范围</Label>
            <Select
              value={boardDepartmentScope}
              onValueChange={(v) => setBoardDepartmentScope(v)}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__org__">组织本身</SelectItem>
                {topDepartments.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.code} · {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {boardLoading && !board ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              看板加载中…
            </div>
          ) : board ? (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                <div className="rounded-md border px-2.5 py-2">
                  <div className="text-muted-foreground text-[11px] leading-4">总流入</div>
                  <div className="tabular-nums text-base font-semibold text-emerald-600">
                    {fmtMoney(board.overview.totalInflow)}
                  </div>
                </div>
                <div className="rounded-md border px-2.5 py-2">
                  <div className="text-muted-foreground text-[11px] leading-4">总流出</div>
                  <div className="tabular-nums text-base font-semibold text-rose-600">
                    {fmtMoney(board.overview.totalOutflow)}
                  </div>
                </div>
                <div className="rounded-md border px-2.5 py-2">
                  <div className="text-muted-foreground text-[11px] leading-4">净流量</div>
                  <div className="tabular-nums text-base font-semibold">
                    {fmtMoney(board.overview.netFlow)}
                  </div>
                </div>
                <div className="rounded-md border px-2.5 py-2">
                  <div className="text-muted-foreground text-[11px] leading-4">命中主计划数</div>
                  <div className="tabular-nums text-base font-semibold">
                    {board.overview.matchedMainPlanCount}
                  </div>
                </div>
                <div className="rounded-md border px-2.5 py-2">
                  <div className="text-muted-foreground text-[11px] leading-4">命中子计划数</div>
                  <div className="tabular-nums text-base font-semibold">
                    {board.overview.matchedSubPlanCount}
                  </div>
                </div>
              </div>
              <div className="h-[260px] w-full rounded-md border p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={board.trend.map((t) => ({
                      ...t,
                      inflowN: Number(t.inflow),
                      outflowN: Number(t.outflow),
                    }))}
                    margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} width={56} />
                    <Tooltip />
                    <Bar dataKey="inflowN" name="流入" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflowN" name="流出" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-muted-foreground text-xs">{board.note}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">暂无看板数据</p>
          )}
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>筛选</CardTitle>
          <CardDescription>按状态筛选；「已锁定」对应流程中已批准状态</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="grid gap-2">
            <Label>状态</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>计划列表</CardTitle>
          <CardDescription>
            共 {total} 条 · 第 {page} / {totalPages} 页
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              加载中…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>计划期间</TableHead>
                  <TableHead>范围</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新日期</TableHead>
                  <TableHead className="min-w-[148px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground h-24 text-center"
                    >
                      暂无资金计划
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.name?.trim() || "（未命名）"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {formatPeriod(row.periodStart, row.periodEnd)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.rootDepartmentCode ?? "全组织"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {row.updatedAt.slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/cash-plan/${row.id}`}>
                              <EyeIcon className="mr-1 size-3.5" />
                              查看
                            </Link>
                          </Button>
                          {row.status === CashPlanStatus.DRAFT ? (
                            <Can permission={Permission.CASH_PLAN_DELETE}>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2Icon className="mr-1 size-3.5" />
                                删除
                              </Button>
                            </Can>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2 border-t">
          <p className="text-muted-foreground text-sm">
            编制中可编辑；提交/锁定状态以业务规则为准。
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-muted-foreground text-sm tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>生成月度主计划</DialogTitle>
            <DialogDescription>
              按月份生成主计划；必须选择组织内顶级部门作为范围。
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={onCreate} className="grid gap-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称（可选）</FormLabel>
                    <FormControl>
                    <Input placeholder="如：2026-04 主计划" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>月份</FormLabel>
                    <FormControl>
                      <Input type="month" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="rootDepartmentCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>顶级部门（必选）</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      disabled={processesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择顶级部门" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {topDepartments.map((d) => (
                          <SelectItem key={d.code} value={d.code}>
                            {d.code} · {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      生成月度主计划必须指定一个顶级部门，不支持“全组织”。
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="approvalProcessId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>审批流程（可选）</FormLabel>
                    <Select
                      value={field.value || NONE}
                      onValueChange={field.onChange}
                      disabled={processesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="不绑定" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>不绑定</SelectItem>
                        {processes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={createSubmitting}>
                  {createSubmitting ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "创建"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除资金计划？</DialogTitle>
            <DialogDescription>
              将永久删除「
              {deleteTarget?.name?.trim() || "该计划"}」及其全部流入/流出明细，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteLoading}
              onClick={() => void confirmDeletePlan()}
            >
              {deleteLoading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
