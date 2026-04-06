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
} from "lucide-react"
import { toast } from "sonner"

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

function formatPeriod(isoStart: string, isoEnd: string) {
  const a = isoStart.slice(0, 10)
  const b = isoEnd.slice(0, 10)
  return `${a} ~ ${b}`
}

const NONE = "__none__"

const createPlanSchema = z
  .object({
    name: z.string().max(200).optional(),
    periodStart: z.string().min(1, "请选择开始日期"),
    periodEnd: z.string().min(1, "请选择结束日期"),
    approvalProcessId: z.string().optional(),
  })
  .refine(
    (d) => {
      if (!d.periodStart || !d.periodEnd) return true
      return d.periodStart <= d.periodEnd
    },
    { message: "结束日期不能早于开始日期", path: ["periodEnd"] }
  )

type CreatePlanValues = z.infer<typeof createPlanSchema>

export default function CashPlanListPage() {
  const router = useRouter()
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const [items, setItems] = React.useState<ListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(20)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createSubmitting, setCreateSubmitting] = React.useState(false)
  const [processes, setProcesses] = React.useState<
    { id: string; name: string; bizType: string; isActive: boolean }[]
  >([])
  const [processesLoading, setProcessesLoading] = React.useState(false)

  const createForm = useForm<CreatePlanValues>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: {
      name: "",
      periodStart: "",
      periodEnd: "",
      approvalProcessId: NONE,
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

  React.useEffect(() => {
    if (!createOpen) return
    let cancelled = false
    ;(async () => {
      setProcessesLoading(true)
      try {
        const res = await fetch("/api/settings/approval-flow", {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        })
        const json = (await res.json()) as
          | ApiSuccess<{
              items: {
                id: string
                name: string
                bizType: string
                isActive: boolean
              }[]
            }>
          | ApiFail
        if (cancelled) return
        if (!json.success) {
          setProcesses([])
          return
        }
        setProcesses(
          json.data.items.filter(
            (p) => p.bizType === ApprovalBizType.CASH_PLAN && p.isActive
          )
        )
      } catch {
        if (!cancelled) setProcesses([])
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
      const ps = `${values.periodStart}T00:00:00.000Z`
      const pe = `${values.periodEnd}T00:00:00.000Z`
      const approvalProcessId =
        values.approvalProcessId &&
        values.approvalProcessId !== NONE &&
        values.approvalProcessId.trim()
          ? values.approvalProcessId.trim()
          : null
      const body = {
        name: values.name?.trim() ? values.name.trim() : null,
        periodStart: ps,
        periodEnd: pe,
        approvalProcessId,
      }
      const res = await fetch("/api/cash-plan", {
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
        periodStart: "",
        periodEnd: "",
        approvalProcessId: NONE,
      })
      router.push(`/cash-plan/${json.data.id}`)
    } catch {
      toast.error("创建失败")
    } finally {
      setCreateSubmitting(false)
    }
  })

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
          <Button asChild type="button" variant="outline">
            <Link href="/cash-plan/dashboard">现金流看板</Link>
          </Button>
          <Can permission={Permission.CASH_PLAN_EDIT}>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="mr-2 size-4" />
              创建新计划
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
                  <TableHead>状态</TableHead>
                  <TableHead>更新日期</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
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
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {row.updatedAt.slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/cash-plan/${row.id}`}>
                            <EyeIcon className="mr-1 size-3.5" />
                            查看
                          </Link>
                        </Button>
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
            <DialogTitle>创建资金计划</DialogTitle>
            <DialogDescription>
              填写计划期间；名称与审批流程可选。
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
                      <Input placeholder="如：2026 年 Q1 资金计划" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>开始日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>结束日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
    </div>
  )
}
