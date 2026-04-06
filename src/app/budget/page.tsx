"use client"

import * as React from "react"
import Link from "next/link"
import {
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  BudgetCompilationGranularity,
  BudgetStatus,
} from "@/generated/prisma/enums"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardAction,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Permission } from "@/lib/auth/permissions"
import type { BudgetListItem } from "@/stores/budget-store"
import { useBudgetStore } from "@/stores/budget-store"

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已提交",
  APPROVED: "已批准",
  REJECTED: "已驳回",
  CLOSED: "已关闭",
}

const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => 2018 + i)

const GRANULARITY_LABEL: Record<BudgetCompilationGranularity, string> = {
  ANNUAL: "年度",
  QUARTERLY: "季度",
  MONTHLY: "月度",
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case BudgetStatus.DRAFT:
      return "secondary"
    case BudgetStatus.SUBMITTED:
      return "default"
    case BudgetStatus.APPROVED:
      return "outline"
    case BudgetStatus.REJECTED:
      return "destructive"
    default:
      return "outline"
  }
}

function formatShortDate(iso: string | null) {
  if (!iso) return "—"
  return iso.slice(0, 10)
}

export default function BudgetListPage() {
  const items = useBudgetStore((s) => s.items)
  const loading = useBudgetStore((s) => s.loading)
  const error = useBudgetStore((s) => s.error)
  const page = useBudgetStore((s) => s.page)
  const pageSize = useBudgetStore((s) => s.pageSize)
  const total = useBudgetStore((s) => s.total)
  const totalPages = useBudgetStore((s) => s.totalPages)
  const draftNameQuery = useBudgetStore((s) => s.draftNameQuery)
  const status = useBudgetStore((s) => s.status)
  const fiscalYear = useBudgetStore((s) => s.fiscalYear)
  const compilationGranularityFilter = useBudgetStore(
    (s) => s.compilationGranularityFilter
  )
  const periodUnitFilter = useBudgetStore((s) => s.periodUnitFilter)
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)

  const setDraftNameQuery = useBudgetStore((s) => s.setDraftNameQuery)
  const setStatus = useBudgetStore((s) => s.setStatus)
  const setFiscalYear = useBudgetStore((s) => s.setFiscalYear)
  const setCompilationGranularityFilter = useBudgetStore(
    (s) => s.setCompilationGranularityFilter
  )
  const setPeriodUnitFilter = useBudgetStore((s) => s.setPeriodUnitFilter)
  const setMockOrgId = useBudgetStore((s) => s.setMockOrgId)
  const setMockUserId = useBudgetStore((s) => s.setMockUserId)
  const applyFilters = useBudgetStore((s) => s.applyFilters)
  const fetchList = useBudgetStore((s) => s.fetchList)
  const goToPage = useBudgetStore((s) => s.goToPage)
  const changePageSize = useBudgetStore((s) => s.changePageSize)
  const deleteBudget = useBudgetStore((s) => s.deleteBudget)
  const submitBudget = useBudgetStore((s) => s.submitBudget)

  const [confirm, setConfirm] = React.useState<
    | { kind: "delete"; row: BudgetListItem }
    | { kind: "submit"; row: BudgetListItem }
    | null
  >(null)
  const [confirmLoading, setConfirmLoading] = React.useState(false)

  React.useEffect(() => {
    void useBudgetStore.getState().fetchList()
  }, [])

  const onConfirm = async () => {
    if (!confirm) return
    setConfirmLoading(true)
    try {
      if (confirm.kind === "delete") {
        const r = await deleteBudget(confirm.row.id)
        if (r.ok) toast.success(r.message)
        else toast.error(r.message)
      } else {
        const r = await submitBudget(confirm.row.id)
        if (r.ok) toast.success(r.message)
        else toast.error(r.message)
      }
      setConfirm(null)
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">预算编制</h1>
        <p className="text-muted-foreground text-sm">
          列表数据来自{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            GET /api/budget
          </code>
          ，组织与用户通过请求头模拟。
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>
            按预算年度与编制粒度（月/季/年）筛选；组织、用户对应{" "}
            <code className="text-xs">x-mock-org-id</code> /{" "}
            <code className="text-xs">x-mock-user-id</code>。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="grid gap-2">
              <Label htmlFor="bq-name">名称搜索</Label>
              <div className="relative">
                <SearchIcon className="text-muted-foreground absolute top-2.5 left-2 size-4" />
                <Input
                  id="bq-name"
                  className="pl-8"
                  placeholder="预算名称关键字"
                  value={draftNameQuery}
                  onChange={(e) => setDraftNameQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void applyFilters()
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>预算年度</Label>
              <Select
                value={fiscalYear == null ? "all" : String(fiscalYear)}
                onValueChange={(v) =>
                  setFiscalYear(v === "all" ? null : Number.parseInt(v, 10))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部年度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部年度</SelectItem>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y} 年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>编制粒度</Label>
              <Select
                value={compilationGranularityFilter ?? "all"}
                onValueChange={(v) =>
                  setCompilationGranularityFilter(
                    v === "all" ? null : (v as BudgetCompilationGranularity)
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部粒度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部粒度</SelectItem>
                  {(
                    Object.values(
                      BudgetCompilationGranularity
                    ) as BudgetCompilationGranularity[]
                  ).map((g) => (
                    <SelectItem key={g} value={g}>
                      {GRANULARITY_LABEL[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>
                {compilationGranularityFilter ===
                BudgetCompilationGranularity.QUARTERLY
                  ? "季度"
                  : compilationGranularityFilter ===
                      BudgetCompilationGranularity.MONTHLY
                    ? "月份"
                    : "季度/月"}
              </Label>
              <Select
                value={
                  periodUnitFilter == null ? "all" : String(periodUnitFilter)
                }
                onValueChange={(v) =>
                  setPeriodUnitFilter(
                    v === "all" ? null : Number.parseInt(v, 10)
                  )
                }
                disabled={
                  compilationGranularityFilter == null ||
                  compilationGranularityFilter ===
                    BudgetCompilationGranularity.ANNUAL
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      compilationGranularityFilter ===
                      BudgetCompilationGranularity.QUARTERLY
                        ? "全部季度"
                        : compilationGranularityFilter ===
                            BudgetCompilationGranularity.MONTHLY
                          ? "全部月份"
                          : "先选粒度"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {compilationGranularityFilter ===
                    BudgetCompilationGranularity.QUARTERLY
                      ? "全部季度"
                      : compilationGranularityFilter ===
                          BudgetCompilationGranularity.MONTHLY
                        ? "全部月份"
                        : "不限"}
                  </SelectItem>
                  {compilationGranularityFilter ===
                  BudgetCompilationGranularity.QUARTERLY
                    ? [1, 2, 3, 4].map((q) => (
                        <SelectItem key={q} value={String(q)}>
                          Q{q}
                        </SelectItem>
                      ))
                    : compilationGranularityFilter ===
                        BudgetCompilationGranularity.MONTHLY
                      ? Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (m) => (
                            <SelectItem key={m} value={String(m)}>
                              {m} 月
                            </SelectItem>
                          )
                        )
                      : null}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={status ?? "all"}
                onValueChange={(v) =>
                  setStatus(v === "all" ? null : (v as BudgetStatus))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {(Object.values(BudgetStatus) as BudgetStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {STATUS_LABEL[k] ?? k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bq-org">组织（mock）</Label>
              <Input
                id="bq-org"
                placeholder="x-mock-org-id"
                value={mockOrgId}
                onChange={(e) => setMockOrgId(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2 xl:col-span-6">
              <Label htmlFor="bq-user">用户（mock）</Label>
              <Input
                id="bq-user"
                placeholder="x-mock-user-id，需与数据库 User.id 一致以便审批等"
                value={mockUserId}
                onChange={(e) => setMockUserId(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30">
          <Button
            type="button"
            onClick={() => void applyFilters()}
            disabled={loading}
          >
            {loading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              "应用筛选"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchList()}
            disabled={loading}
          >
            刷新
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>预算列表</CardTitle>
          <CardDescription>
            共 {total} 条 · 第 {page} / {totalPages} 页
          </CardDescription>
          <CardAction>
            <Can permission={Permission.BUDGET_CREATE}>
              <Button asChild>
                <Link href="/budget/new">
                  <PlusIcon className="size-4" />
                  新建预算
                </Link>
              </Button>
            </Can>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <div className="relative">
            {loading ? (
              <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2Icon className="size-5 animate-spin" />
                  加载中…
                </div>
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>年度</TableHead>
                  <TableHead>编制期间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead className="w-[72px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground h-24 text-center"
                    >
                      暂无数据，可调整筛选条件或新建预算
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.code ?? "—"}
                      </TableCell>
                      <TableCell>{row.fiscalYear}</TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        <div className="text-foreground font-medium">
                          {row.periodLabel}
                        </div>
                        <div className="text-muted-foreground">
                          {formatShortDate(row.periodStart)} ~{" "}
                          {formatShortDate(row.periodEnd)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totalAmount != null
                          ? `${row.totalAmount} ${row.currency}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          row={row}
                          onDelete={() => setConfirm({ kind: "delete", row })}
                          onSubmit={() => setConfirm({ kind: "submit", row })}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">每页</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => void changePageSize(Number.parseInt(v, 10))}
              disabled={loading}
            >
              <SelectTrigger className="w-[88px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => void goToPage(page - 1)}
            >
              上一页
            </Button>
            <span className="text-muted-foreground text-sm tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || page >= totalPages}
              onClick={() => void goToPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog
        open={confirm != null}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "delete" ? "确认删除" : "确认提交审批"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "delete"
                ? `将永久删除预算「${confirm.row.name}」，此操作不可恢复。`
                : `将提交预算「${confirm?.row.name}」进入审批流程。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirm(null)}
              disabled={confirmLoading}
            >
              取消
            </Button>
            <Button
              type="button"
              variant={confirm?.kind === "delete" ? "destructive" : "default"}
              onClick={() => void onConfirm()}
              disabled={confirmLoading}
            >
              {confirmLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : confirm?.kind === "delete" ? (
                "删除"
              ) : (
                "提交"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RowActions({
  row,
  onDelete,
  onSubmit,
}: {
  row: BudgetListItem
  onDelete: () => void
  onSubmit: () => void
}) {
  const canEdit =
    row.status === BudgetStatus.DRAFT || row.status === BudgetStatus.REJECTED
  const canDelete = row.status === BudgetStatus.DRAFT
  const canSubmit = row.status === BudgetStatus.DRAFT

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="更多操作">
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/budget/${row.id}`}>查看</Link>
        </DropdownMenuItem>
        {canEdit ? (
          <Can permission={Permission.BUDGET_EDIT}>
            <DropdownMenuItem asChild>
              <Link href={`/budget/${row.id}/edit`}>编辑</Link>
            </DropdownMenuItem>
          </Can>
        ) : null}
        {canSubmit ? (
          <Can permission={Permission.BUDGET_SUBMIT}>
            <DropdownMenuItem onClick={onSubmit}>提交审批</DropdownMenuItem>
          </Can>
        ) : null}
        {canDelete ? (
          <Can permission={Permission.BUDGET_DELETE}>
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                删除
              </DropdownMenuItem>
            </>
          </Can>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
