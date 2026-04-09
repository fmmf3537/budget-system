"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2Icon, EyeIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { ApprovalBizType } from "@/generated/prisma/enums"
import {
  ENTITY_BUDGET_ADJUSTMENT,
  ENTITY_BUDGET_HEADER,
} from "@/lib/api/approval-constants"
import { ENTITY_CASH_PLAN_HEADER } from "@/lib/api/cash-plan-constants"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Can } from "@/components/auth/can"
import { buildMockHeaders } from "@/lib/api/mock-headers"
import { Permission } from "@/lib/auth/permissions"
import { useBudgetStore } from "@/stores/budget-store"

const BIZ_LABEL: Record<string, string> = {
  [ApprovalBizType.BUDGET]: "预算",
  [ApprovalBizType.BUDGET_ADJUSTMENT]: "预算调整",
  [ApprovalBizType.CASH_PLAN]: "资金计划",
  [ApprovalBizType.OTHER]: "其他",
}

const ENTITY_LABEL: Record<string, string> = {
  [ENTITY_BUDGET_HEADER]: "预算",
  [ENTITY_CASH_PLAN_HEADER]: "资金计划",
  [ENTITY_BUDGET_ADJUSTMENT]: "预算调整",
}

type TodoItem = {
  id: string
  processId: string
  processName?: string
  processBizType: string
  nodeName?: string
  entityType: string
  entityId: string
  entityTitle: string | null
  applicantName: string | null
  applicationTime: string
  createdAt: string
}

type ListPayload = {
  items: TodoItem[]
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
  error: { code: string; message: string }
}

function formatDateTime(iso: string) {
  if (!iso) return "—"
  return iso.replace("T", " ").slice(0, 19)
}

export default function ApprovalTodoPage() {
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const [items, setItems] = React.useState<TodoItem[]>([])
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [detailRow, setDetailRow] = React.useState<TodoItem | null>(null)
  const [batchOpen, setBatchOpen] = React.useState(false)
  const [batchComment, setBatchComment] = React.useState("")
  const [batchRunning, setBatchRunning] = React.useState(false)

  const fetchList = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      const res = await fetch(`/api/approval/todo?${qs}`, {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<ListPayload> | ApiFail
      if (!json.success) {
        setError(json.error?.message ?? "加载待办失败")
        setItems([])
        return
      }
      setItems(json.data.items as TodoItem[])
      setTotal(json.data.pagination.total)
      setTotalPages(json.data.pagination.totalPages)
      setSelected(new Set())
    } catch {
      setError("网络异常，请稍后重试")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [mockOrgId, mockUserId, mockUserRole, page, pageSize])

  React.useEffect(() => {
    void fetchList()
  }, [fetchList])

  const allPageSelected =
    items.length > 0 && items.every((r) => selected.has(r.id))

  function toggleAllPage() {
    if (allPageSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(items.map((r) => r.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedRows = React.useMemo(
    () => items.filter((r) => selected.has(r.id)),
    [items, selected]
  )

  async function runApprove(row: TodoItem, comment: string | null) {
    const res = await fetch(`/api/approval/${row.processId}/approve`, {
      method: "POST",
      headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      body: JSON.stringify({
        entityType: row.entityType,
        entityId: row.entityId,
        comment: comment?.trim() ? comment.trim() : null,
      }),
    })
    const json = (await res.json()) as ApiSuccess<{ message?: string }> | ApiFail
    if (!json.success) {
      return { ok: false as const, message: json.error?.message ?? "操作失败" }
    }
    return { ok: true as const, message: json.data?.message ?? "已同意" }
  }

  async function handleBatchApprove() {
    if (selectedRows.length === 0) {
      toast.error("请先勾选待办")
      return
    }
    setBatchRunning(true)
    let ok = 0
    let fail = 0
    const errors: string[] = []
    const comment = batchComment.trim() ? batchComment.trim() : null
    for (const row of selectedRows) {
      const r = await runApprove(row, comment)
      if (r.ok) ok += 1
      else {
        fail += 1
        errors.push(`${row.entityTitle ?? row.entityId}: ${r.message}`)
      }
    }
    setBatchRunning(false)
    setBatchOpen(false)
    setBatchComment("")
    if (ok) toast.success(`已通过 ${ok} 条`)
    if (fail) toast.error(`失败 ${fail} 条`, { description: errors.slice(0, 3).join("\n") })
    await fetchList()
  }

  async function handleQuickApprove(row: TodoItem) {
    const r = await runApprove(row, null)
    if (!r.ok) {
      toast.error(r.message)
      return
    }
    toast.success(r.message)
    await fetchList()
  }

  function detailHref(row: TodoItem) {
    if (row.entityType === ENTITY_BUDGET_HEADER) return `/budget/${row.entityId}`
    if (row.entityType === ENTITY_BUDGET_ADJUSTMENT)
      return `/adjustment?id=${encodeURIComponent(row.entityId)}`
    return null
  }

  function approvalDetailHref(row: TodoItem) {
    const qs = new URLSearchParams({
      entityType: row.entityType,
      entityId: row.entityId,
    })
    return `/approval/${row.processId}?${qs.toString()}`
  }

  return (
    <div className="container max-w-6xl space-y-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/budget">← 预算列表</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">审批待办</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            当前账号可处理的审批任务；支持批量同意。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void fetchList()}
          >
            <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
            刷新
          </Button>
          <Can permission={Permission.APPROVAL_APPROVE}>
            <Button
              type="button"
              size="sm"
              disabled={selectedRows.length === 0 || loading}
              onClick={() => setBatchOpen(true)}
            >
              <CheckCircle2Icon className="size-4" />
              批量同意 ({selectedRows.length})
            </Button>
          </Can>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>无法加载待办</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>待办列表</CardTitle>
          <CardDescription>
            共 {total} 条 · 第 {page} / {totalPages} 页
          </CardDescription>
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
                  <TableHead className="w-[44px]">
                    <span className="sr-only">全选</span>
                    <input
                      type="checkbox"
                      className="border-input size-4 rounded border"
                      checked={allPageSelected}
                      disabled={items.length === 0 || loading}
                      onChange={toggleAllPage}
                      aria-label="全选本页"
                    />
                  </TableHead>
                  <TableHead>预算/单据名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>申请人</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead>当前节点</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground h-24 text-center"
                    >
                      暂无待办
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="border-input size-4 rounded border"
                          checked={selected.has(row.id)}
                          disabled={loading}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`选择 ${row.entityTitle ?? row.entityId}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-[220px] font-medium">
                        <div className="truncate">
                          {row.entityTitle ?? (
                            <span className="text-muted-foreground">
                              {row.entityType} · {row.entityId.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">
                            {BIZ_LABEL[row.processBizType] ??
                              row.processBizType}
                          </Badge>
                          <Badge variant="outline">
                            {ENTITY_LABEL[row.entityType] ?? row.entityType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[140px] truncate">
                        {row.applicantName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums text-sm">
                        {formatDateTime(row.applicationTime)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[140px] truncate text-sm">
                        {row.nodeName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailRow(row)}
                          >
                            <EyeIcon className="size-4" />
                            查看
                          </Button>
                          {detailHref(row) ? (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={detailHref(row)!}>打开单据</Link>
                            </Button>
                          ) : null}
                          <Button asChild variant="secondary" size="sm">
                            <Link href={approvalDetailHref(row)}>审批详情</Link>
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            disabled={loading}
                            onClick={() => void handleQuickApprove(row)}
                          >
                            同意
                          </Button>
                        </div>
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
              onValueChange={(v) => {
                setPageSize(Number.parseInt(v, 10))
                setPage(1)
              }}
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
              onClick={() => setPage((p) => p - 1)}
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
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={detailRow !== null} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>待办详情</DialogTitle>
            <DialogDescription>
              审批记录与关联单据摘要
            </DialogDescription>
          </DialogHeader>
          {detailRow ? (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">名称</dt>
                <dd className="font-medium">
                  {detailRow.entityTitle ?? "—"}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted-foreground">流程类型</dt>
                  <dd>
                    <Badge variant="secondary">
                      {BIZ_LABEL[detailRow.processBizType] ??
                        detailRow.processBizType}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">实体类型</dt>
                  <dd>
                    <Badge variant="outline">
                      {ENTITY_LABEL[detailRow.entityType] ??
                        detailRow.entityType}
                    </Badge>
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-muted-foreground">流程 / 节点</dt>
                <dd>
                  {detailRow.processName ?? "—"} ·{" "}
                  {detailRow.nodeName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">申请人</dt>
                <dd>{detailRow.applicantName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">申请时间</dt>
                <dd className="tabular-nums">
                  {formatDateTime(detailRow.applicationTime)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">实体 ID</dt>
                <dd className="font-mono text-xs break-all">{detailRow.entityId}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            {detailRow ? (
              <Button asChild variant="default">
                <Link href={approvalDetailHref(detailRow)}>进入审批详情</Link>
              </Button>
            ) : null}
            {detailRow && detailHref(detailRow) ? (
              <Button asChild variant="outline">
                <Link href={detailHref(detailRow)!}>打开单据</Link>
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setDetailRow(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量同意</DialogTitle>
            <DialogDescription>
              将对已选中的 {selectedRows.length}{" "}
              条待办依次调用同意接口；每条使用同一审批意见（可选）。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="batch-cmt">审批意见（可选）</Label>
            <Textarea
              id="batch-cmt"
              rows={3}
              value={batchComment}
              onChange={(e) => setBatchComment(e.target.value)}
              placeholder="同意。"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchOpen(false)}
              disabled={batchRunning}
            >
              取消
            </Button>
            <Button disabled={batchRunning} onClick={() => void handleBatchApprove()}>
              {batchRunning ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              确认批量同意
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
