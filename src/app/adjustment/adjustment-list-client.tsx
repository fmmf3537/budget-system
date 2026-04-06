"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AdjustmentStatus } from "@/generated/prisma/enums"
import { ENTITY_BUDGET_ADJUSTMENT } from "@/lib/api/approval-constants"
import type { AdjustmentDetailApiPayload } from "@/lib/api/adjustment-detail"
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
import { Can } from "@/components/auth/can"
import { buildMockHeaders } from "@/lib/api/mock-headers"
import { Permission } from "@/lib/auth/permissions"
import { useBudgetStore } from "@/stores/budget-store"

const STATUS_LABEL: Record<string, string> = {
  [AdjustmentStatus.DRAFT]: "草稿",
  [AdjustmentStatus.SUBMITTED]: "已提交",
  [AdjustmentStatus.APPROVED]: "已批准",
  [AdjustmentStatus.REJECTED]: "已驳回",
  [AdjustmentStatus.APPLIED]: "已应用",
}

const KIND_LABEL: Record<string, string> = {
  INCREASE: "追加",
  DECREASE: "调减",
  SUBJECT_TRANSFER: "科目调整",
  ROLLING: "滚动",
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case AdjustmentStatus.DRAFT:
      return "secondary"
    case AdjustmentStatus.SUBMITTED:
      return "default"
    case AdjustmentStatus.APPROVED:
      return "outline"
    case AdjustmentStatus.REJECTED:
      return "destructive"
    case AdjustmentStatus.APPLIED:
      return "outline"
    default:
      return "outline"
  }
}

type ListItem = {
  id: string
  title: string | null
  reasonPreview: string
  kind: string
  status: string
  totalDelta: string | null
  budgetHeaderId: string | null
  budgetName: string | null
  fiscalYear: number | null
  budgetPeriodLabel: string | null
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

function formatShortDate(iso: string) {
  return iso.slice(0, 10)
}

export function AdjustmentListClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detail, setDetail] = React.useState<AdjustmentDetailApiPayload | null>(
    null
  )

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
      const res = await fetch(`/api/adjustment?${qs}`, {
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

  const loadDetail = React.useCallback(
    async (id: string) => {
      setDetailLoading(true)
      setDetail(null)
      try {
        const res = await fetch(`/api/adjustment/${id}`, {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        })
        const json = (await res.json()) as
          | ApiSuccess<AdjustmentDetailApiPayload>
          | ApiFail
        if (!json.success) {
          toast.error(json.error?.message ?? "加载详情失败")
          return
        }
        setDetail(json.data)
      } catch {
        toast.error("加载详情失败")
      } finally {
        setDetailLoading(false)
      }
    },
    [mockOrgId, mockUserId, mockUserRole]
  )

  const openDetail = React.useCallback(
    (id: string) => {
      setDetailOpen(true)
      void loadDetail(id)
    },
    [loadDetail]
  )

  const focusId = searchParams.get("id")
  React.useEffect(() => {
    if (focusId) openDetail(focusId)
  }, [focusId, openDetail])

  function closeDetail() {
    setDetailOpen(false)
    setDetail(null)
    if (searchParams.get("id")) router.replace("/adjustment", { scroll: false })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/budget">← 预算列表</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">预算调整记录</h1>
          <p className="text-muted-foreground text-sm">
            列表来自{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              GET /api/adjustment
            </code>
            ；每条记录可关联原预算。审批流与预算一致，使用「审批」进入与待办相同的审批页。
          </p>
        </div>
        <Can permission={Permission.ADJUSTMENT_CREATE}>
          <Button asChild>
            <Link href="/adjustment/new">
              <PlusIcon className="mr-2 size-4" />
              新建调整申请
            </Link>
          </Button>
        </Can>
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
          <CardDescription>按状态筛选调整单</CardDescription>
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
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {(Object.keys(STATUS_LABEL) as AdjustmentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>调整记录</CardTitle>
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
                  <TableHead>摘要</TableHead>
                  <TableHead>原预算</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">总净变动</TableHead>
                  <TableHead>更新日期</TableHead>
                  <TableHead className="w-[140px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground h-24 text-center"
                    >
                      暂无记录
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[220px]">
                        <div className="font-medium">
                          {row.title?.trim() || "（无标题）"}
                        </div>
                        <div className="text-muted-foreground line-clamp-2 text-xs">
                          {row.reasonPreview}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.budgetName ? (
                          <>
                            {row.budgetName}
                            {row.budgetPeriodLabel ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · {row.budgetPeriodLabel}
                              </span>
                            ) : row.fiscalYear != null ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · {row.fiscalYear} 年
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {KIND_LABEL[row.kind] ?? row.kind}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {row.totalDelta ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {formatShortDate(row.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openDetail(row.id)}
                          >
                            <EyeIcon className="mr-1 size-3.5" />
                            详情
                          </Button>
                          {row.status === AdjustmentStatus.SUBMITTED &&
                          row.approvalProcessId ? (
                            <Button asChild variant="secondary" size="sm">
                              <Link
                                href={`/approval/${row.approvalProcessId}?entityType=${encodeURIComponent(ENTITY_BUDGET_ADJUSTMENT)}&entityId=${encodeURIComponent(row.id)}`}
                              >
                                审批
                              </Link>
                            </Button>
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
            查看详情可浏览按科目汇总的调整前后对比与行级明细。
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

      <Dialog open={detailOpen} onOpenChange={(o) => !o && closeDetail()}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>调整详情</DialogTitle>
            <DialogDescription>
              含原预算行、按科目汇总对比及调整明细
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              加载中…
            </div>
          ) : detail ? (
            <div className="space-y-6">
              <Card>
                <CardHeader className="border-b pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {detail.adjustment.title?.trim() || "预算调整单"}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {KIND_LABEL[detail.adjustment.kind] ??
                          detail.adjustment.kind}
                      </Badge>
                      <Badge variant={statusBadgeVariant(detail.adjustment.status)}>
                        {STATUS_LABEL[detail.adjustment.status] ??
                          detail.adjustment.status}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    申请人：{detail.adjustment.requesterName ?? "—"} · 总净变动：{" "}
                    <span className="text-foreground font-medium tabular-nums">
                      {detail.adjustment.totalDelta ?? "—"}
                    </span>
                    {detail.budgetHeader ? (
                      <>
                        {" "}
                        · {detail.budgetHeader.periodLabel} · 币种{" "}
                        {detail.budgetHeader.currency}
                      </>
                    ) : null}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {detail.budgetHeader ? (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/budget/${detail.budgetHeader.id}`}>
                          打开原预算
                        </Link>
                      </Button>
                      {detail.adjustment.status ===
                        AdjustmentStatus.SUBMITTED &&
                      detail.adjustment.approvalProcessId ? (
                        <Button asChild size="sm">
                          <Link
                            href={`/approval/${detail.adjustment.approvalProcessId}?entityType=${encodeURIComponent(ENTITY_BUDGET_ADJUSTMENT)}&entityId=${encodeURIComponent(detail.adjustment.id)}`}
                          >
                            进入审批
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {detail.adjustment.hasAttachment ? (
                    <p className="text-muted-foreground text-sm">
                      附件：{detail.adjustment.attachmentName ?? "已上传"}
                    </p>
                  ) : null}
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs font-medium">
                      调整原因
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
                      {detail.adjustment.reason}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {detail.comparison ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      调整前后对比（按科目汇总）
                    </CardTitle>
                    <CardDescription>{detail.comparison.note}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 px-0">
                    <div className="text-muted-foreground flex flex-wrap gap-4 px-6 text-sm">
                      <span>
                        调整前合计：{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {detail.comparison.totalBefore}
                        </span>
                      </span>
                      <span>
                        模拟调整后：{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {detail.comparison.totalAfter}
                        </span>
                      </span>
                      <span>
                        差额：{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {detail.comparison.totalDelta}
                        </span>
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>科目</TableHead>
                          <TableHead className="text-right">调整前</TableHead>
                          <TableHead className="text-right">调整后</TableHead>
                          <TableHead className="text-right">变动</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.comparison.rows.map((r) => (
                          <TableRow key={r.subjectId}>
                            <TableCell className="max-w-[240px]">
                              <span className="text-muted-foreground font-mono text-xs">
                                {r.subjectCode}
                              </span>{" "}
                              {r.subjectName ?? r.subjectId}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.beforeAmount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.afterAmount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.delta}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">调整前行明细</CardTitle>
                  <CardDescription>当前预算中的行（调整前快照）</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>科目</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.budgetLinesBefore.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="text-muted-foreground h-14 text-center"
                          >
                            无原预算行或未关联预算
                          </TableCell>
                        </TableRow>
                      ) : (
                        detail.budgetLinesBefore.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>
                              <span className="text-muted-foreground font-mono text-xs">
                                {l.subject?.code}
                              </span>{" "}
                              {l.subject?.name ?? l.subjectId}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {l.amount ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">调整明细</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>原侧</TableHead>
                        <TableHead>新侧</TableHead>
                        <TableHead className="text-right">金额变动</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.adjustment.details.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="max-w-[180px] text-sm">
                            {d.sourceSubject ? (
                              <>
                                <span className="text-muted-foreground font-mono text-xs">
                                  {d.sourceSubject.code}
                                </span>{" "}
                                {d.sourceSubject.name}
                              </>
                            ) : (
                              "—"
                            )}
                            {d.sourceProject ? (
                              <div className="text-muted-foreground text-xs">
                                项目 {d.sourceProject}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[180px] text-sm">
                            {d.targetSubject ? (
                              <>
                                <span className="text-muted-foreground font-mono text-xs">
                                  {d.targetSubject.code}
                                </span>{" "}
                                {d.targetSubject.name}
                              </>
                            ) : (
                              "—"
                            )}
                            {d.targetProject ? (
                              <div className="text-muted-foreground text-xs">
                                项目 {d.targetProject}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.amountDelta ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">无法加载详情</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
