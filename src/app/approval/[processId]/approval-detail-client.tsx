"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { ApprovalAction, ApprovalBizType } from "@/generated/prisma/enums"
import {
  ENTITY_BUDGET_ADJUSTMENT,
  ENTITY_BUDGET_HEADER,
} from "@/lib/api/approval-constants"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
import { Timeline, TimelineItem } from "@/components/ui/timeline"
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

const ACTION_LABEL: Record<string, string> = {
  [ApprovalAction.PENDING]: "待处理",
  [ApprovalAction.APPROVED]: "同意",
  [ApprovalAction.REJECTED]: "驳回 / 退回",
  [ApprovalAction.TRANSFERRED]: "转交",
  [ApprovalAction.CANCELLED]: "已取消",
}

function actionBadgeVariant(
  a: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (a) {
    case ApprovalAction.APPROVED:
      return "default"
    case ApprovalAction.REJECTED:
      return "destructive"
    case ApprovalAction.TRANSFERRED:
      return "secondary"
    case ApprovalAction.PENDING:
      return "outline"
    default:
      return "outline"
  }
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return "—"
  return iso.replace("T", " ").slice(0, 19)
}

type ProcessNode = {
  id: string
  sortOrder: number
  name: string
  approverUserId: string | null
}

type HistoryRow = {
  id: string
  action: string
  comment: string | null
  createdAt: string
  actedAt: string | null
  nodeName?: string
  actorName: string | null
}

type BudgetLineRow = {
  id: string
  subjectId: string
  subject: { code: string; name: string } | null
  amount: string
  departmentCode: string | null
  dimension1: string | null
  dimension2: string | null
}

type BudgetDetail = {
  id: string
  name: string
  fiscalYear: number
  status: string
  totalAmount: string | null
  currency: string
  lines: BudgetLineRow[]
}

type AdjustmentDetailLine = {
  id: string
  sourceSubjectId: string | null
  targetSubjectId: string | null
  sourceProject: string | null
  targetProject: string | null
  amountDelta: string | null
  remark: string | null
  sourceSubject: { code: string; name: string } | null
  targetSubject: { code: string; name: string } | null
}

type AdjustmentDetailPayload = {
  adjustment: {
    id: string
    title: string | null
    reason: string
    kind: string
    status: string
    totalDelta: string | null
    hasAttachment: boolean
    attachmentName: string | null
    details: AdjustmentDetailLine[]
    requesterName: string | null
    approvalProcessId: string | null
  }
  budgetHeader: {
    id: string
    name: string
    fiscalYear: number
    status: string
    totalAmount: string | null
    currency: string
  } | null
  budgetLinesBefore: Array<{
    id: string
    subjectId: string
    subject: { code: string; name: string } | null
    amount: string | null
  }>
  comparison: {
    rows: Array<{
      subjectId: string
      subjectCode: string | null
      subjectName: string | null
      beforeAmount: string
      afterAmount: string
      delta: string
    }>
    totalBefore: string
    totalAfter: string
    totalDelta: string
    note: string
  } | null
}

const ADJ_KIND_LABEL: Record<string, string> = {
  INCREASE: "追加",
  DECREASE: "调减",
  SUBJECT_TRANSFER: "科目调整",
  ROLLING: "滚动",
}

type DetailPayload = {
  process: {
    id: string
    name: string
    bizType: string
    nodes: ProcessNode[]
  }
  entityType: string
  entityId: string
  budget: BudgetDetail | null
  adjustmentDetail: AdjustmentDetailPayload | null
  history: HistoryRow[]
  pending: {
    id: string
    nodeId: string | null
    nodeName: string | null
    nodeSortOrder: number | null
  } | null
  canAct: boolean
  usersInOrg: { id: string; name: string; email: string }[]
}

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { message: string }
}

export function ApprovalDetailClient({ processId }: { processId: string }) {
  const searchParams = useSearchParams()
  const entityType = searchParams.get("entityType")?.trim() ?? ""
  const entityId = searchParams.get("entityId")?.trim() ?? ""

  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const [data, setData] = React.useState<DetailPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [approveOpen, setApproveOpen] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [transferOpen, setTransferOpen] = React.useState(false)
  const [comment, setComment] = React.useState("")
  const [rejectMode, setRejectMode] = React.useState<"final" | "return">("final")
  const [returnNodeId, setReturnNodeId] = React.useState<string>("")
  const [targetUserId, setTargetUserId] = React.useState<string>("")
  const [actionLoading, setActionLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!entityType || !entityId) {
      setLoading(false)
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ entityType, entityId })
      const res = await fetch(
        `/api/approval/${processId}/detail?${qs.toString()}`,
        { headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole) }
      )
      const json = (await res.json()) as ApiSuccess<DetailPayload> | ApiFail
      if (!json.success) {
        setError(json.error?.message ?? "加载失败")
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError("网络异常")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [processId, entityType, entityId, mockOrgId, mockUserId, mockUserRole])

  React.useEffect(() => {
    void load()
  }, [load])

  const returnableNodes = React.useMemo(() => {
    if (!data?.pending || data.pending.nodeSortOrder == null) return []
    const cur = data.pending.nodeSortOrder
    return [...data.process.nodes].filter((n) => n.sortOrder < cur)
  }, [data])

  React.useEffect(() => {
    if (returnableNodes.length === 0) return
    setReturnNodeId((prev) =>
      returnableNodes.some((n) => n.id === prev)
        ? prev
        : returnableNodes[0]!.id
    )
  }, [returnableNodes])

  async function postApprove() {
    if (!data) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/approval/${processId}/approve`, {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify({
          entityType: data.entityType,
          entityId: data.entityId,
          comment: comment.trim() || null,
        }),
      })
      const json = (await res.json()) as ApiSuccess<{ message?: string }> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "操作失败")
        return
      }
      toast.success(json.data?.message ?? "已同意")
      setApproveOpen(false)
      setComment("")
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  async function postReject() {
    if (!data) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/approval/${processId}/reject`, {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify({
          entityType: data.entityType,
          entityId: data.entityId,
          comment: comment.trim() || null,
          returnToNodeId:
            rejectMode === "return" && returnNodeId ? returnNodeId : null,
        }),
      })
      const json = (await res.json()) as ApiSuccess<{ message?: string }> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "操作失败")
        return
      }
      toast.success(json.data?.message ?? "已处理")
      setRejectOpen(false)
      setComment("")
      setRejectMode("final")
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  async function postTransfer() {
    if (!data || !targetUserId) {
      toast.error("请选择转交对象")
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/approval/${processId}/transfer`, {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify({
          entityType: data.entityType,
          entityId: data.entityId,
          targetUserId,
          comment: comment.trim() || null,
        }),
      })
      const json = (await res.json()) as ApiSuccess<{ message?: string }> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "操作失败")
        return
      }
      toast.success(json.data?.message ?? "已转交")
      setTransferOpen(false)
      setComment("")
      setTargetUserId("")
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  if (!entityType || !entityId) {
    return (
      <div className="container max-w-lg py-12">
        <Alert>
          <AlertTitle>缺少业务参数</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              请在 URL 中携带 <code className="text-xs">entityType</code> 与{" "}
              <code className="text-xs">entityId</code>，例如从{" "}
              <Link href="/approval/todo" className="text-primary underline">
                审批待办
              </Link>{" "}
              进入。
            </p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center gap-2 text-sm">
        <Loader2Icon className="size-5 animate-spin" />
        加载审批详情…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container max-w-lg py-12">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            {error ?? "未知错误"}
            <Button size="sm" variant="outline" onClick={() => void load()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const nodesSorted = [...data.process.nodes].sort(
    (a, b) => a.sortOrder - b.sortOrder
  )

  const transferUsers = data.usersInOrg.filter((u) => u.id !== mockUserId)

  return (
    <div className="container max-w-5xl space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/approval/todo">← 审批待办</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">审批详情</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.process.name} ·{" "}
            {BIZ_LABEL[data.process.bizType] ?? data.process.bizType}
          </p>
        </div>
        {data.canAct && data.pending ? (
          <Can
            permission={Permission.APPROVAL_APPROVE}
            fallback={
              <Badge variant="outline">当前角色无审批操作权限</Badge>
            }
          >
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setApproveOpen(true)}>
                同意
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setRejectOpen(true)}
              >
                驳回
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransferOpen(true)}
              >
                转交
              </Button>
            </div>
          </Can>
        ) : (
          <Badge variant="secondary">
            {data.pending ? "您当前不可处理此待办" : "暂无进行中的待办"}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>审批流程</CardTitle>
          <CardDescription>
            按节点顺序展示；当前待办节点高亮。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex min-w-max items-stretch gap-2 pb-2">
            {nodesSorted.map((n, i) => {
              const active = data.pending?.nodeId === n.id
              return (
                <React.Fragment key={n.id}>
                  {i > 0 ? (
                    <div className="text-muted-foreground flex items-center px-1">
                      →
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "bg-card max-w-[160px] shrink-0 rounded-lg border px-3 py-2 text-sm shadow-sm",
                      active &&
                        "border-primary ring-primary/30 ring-2 ring-offset-2 ring-offset-background"
                    )}
                  >
                    <div className="text-muted-foreground text-xs">
                      步骤 {n.sortOrder + 1}
                    </div>
                    <div className="mt-0.5 font-medium leading-snug">
                      {n.name}
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {data.entityType === ENTITY_BUDGET_HEADER && data.budget ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b">
            <div>
              <CardTitle>预算单据</CardTitle>
              <CardDescription>
                {data.budget.name} · {data.budget.fiscalYear} 年度
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.budget.status}</Badge>
              <Button asChild variant="outline" size="sm">
                <Link href={`/budget/${data.budget.id}`}>打开预算页</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pt-4">
            <div className="text-muted-foreground mb-3 px-6 text-sm">
              合计：{" "}
              <span className="text-foreground font-medium tabular-nums">
                {data.budget.totalAmount ?? "—"} {data.budget.currency}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>科目</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>维度1</TableHead>
                  <TableHead>维度2</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.budget.lines.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground h-16 text-center"
                    >
                      无明细行
                    </TableCell>
                  </TableRow>
                ) : (
                  data.budget.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="max-w-[200px]">
                        <span className="text-muted-foreground font-mono text-xs">
                          {line.subject?.code}
                        </span>{" "}
                        {line.subject?.name ?? line.subjectId}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {line.departmentCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {line.dimension1 ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {line.dimension2 ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.amount}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : data.entityType === ENTITY_BUDGET_HEADER ? (
        <Card>
          <CardHeader>
            <CardTitle>预算单据</CardTitle>
            <CardDescription>未找到对应预算或无权访问。</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {data.entityType === ENTITY_BUDGET_ADJUSTMENT &&
      data.adjustmentDetail ? (
        <>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b">
              <div>
                <CardTitle>预算调整单</CardTitle>
                <CardDescription>
                  {data.adjustmentDetail.adjustment.title?.trim() ||
                    data.adjustmentDetail.budgetHeader?.name ||
                    "无标题"}{" "}
                  ·{" "}
                  {ADJ_KIND_LABEL[data.adjustmentDetail.adjustment.kind] ??
                    data.adjustmentDetail.adjustment.kind}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {data.adjustmentDetail.adjustment.status}
                </Badge>
                {data.adjustmentDetail.budgetHeader ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/budget/${data.adjustmentDetail.budgetHeader.id}`}
                    >
                      打开原预算
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/adjustment?id=${data.adjustmentDetail.adjustment.id}`}>
                    调整记录页
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="text-muted-foreground text-sm">
                申请人：{" "}
                <span className="text-foreground">
                  {data.adjustmentDetail.adjustment.requesterName ?? "—"}
                </span>
                <span className="mx-2">·</span>
                总净变动：{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {data.adjustmentDetail.adjustment.totalDelta ?? "—"}
                </span>
                {data.adjustmentDetail.budgetHeader ? (
                  <>
                    <span className="mx-2">·</span>
                    币种{" "}
                    {data.adjustmentDetail.budgetHeader.currency}
                  </>
                ) : null}
              </div>
              {data.adjustmentDetail.adjustment.hasAttachment ? (
                <p className="text-muted-foreground text-sm">
                  附件：{data.adjustmentDetail.adjustment.attachmentName ?? "已上传"}
                </p>
              ) : null}
              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                  调整原因
                </div>
                <p className="text-sm whitespace-pre-wrap">
                  {data.adjustmentDetail.adjustment.reason}
                </p>
              </div>
            </CardContent>
          </Card>

          {data.adjustmentDetail.comparison ? (
            <Card>
              <CardHeader>
                <CardTitle>调整前后对比（按科目汇总）</CardTitle>
                <CardDescription>
                  {data.adjustmentDetail.comparison.note}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pt-2">
                <div className="text-muted-foreground mb-3 flex flex-wrap gap-4 px-6 text-sm">
                  <span>
                    调整前合计：{" "}
                    <span className="text-foreground font-medium tabular-nums">
                      {data.adjustmentDetail.comparison.totalBefore}
                    </span>
                  </span>
                  <span>
                    模拟调整后：{" "}
                    <span className="text-foreground font-medium tabular-nums">
                      {data.adjustmentDetail.comparison.totalAfter}
                    </span>
                  </span>
                  <span>
                    差额：{" "}
                    <span className="text-foreground font-medium tabular-nums">
                      {data.adjustmentDetail.comparison.totalDelta}
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
                    {data.adjustmentDetail.comparison.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-muted-foreground h-14 text-center"
                        >
                          无对比行
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.adjustmentDetail.comparison.rows.map((r) => (
                        <TableRow key={r.subjectId}>
                          <TableCell className="max-w-[220px]">
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>调整明细</CardTitle>
              <CardDescription>行级原科目 / 项目 → 新科目 / 项目</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>原侧</TableHead>
                    <TableHead>新侧</TableHead>
                    <TableHead className="text-right">金额变动</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.adjustmentDetail.adjustment.details.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-muted-foreground h-14 text-center"
                      >
                        无明细
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.adjustmentDetail.adjustment.details.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="max-w-[200px] text-sm">
                          <div>
                            {d.sourceSubject ? (
                              <>
                                <span className="text-muted-foreground font-mono text-xs">
                                  {d.sourceSubject.code}
                                </span>{" "}
                                {d.sourceSubject.name}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                          {d.sourceProject ? (
                            <div className="text-muted-foreground text-xs">
                              项目：{d.sourceProject}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm">
                          <div>
                            {d.targetSubject ? (
                              <>
                                <span className="text-muted-foreground font-mono text-xs">
                                  {d.targetSubject.code}
                                </span>{" "}
                                {d.targetSubject.name}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                          {d.targetProject ? (
                            <div className="text-muted-foreground text-xs">
                              项目：{d.targetProject}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.amountDelta ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : data.entityType === ENTITY_BUDGET_ADJUSTMENT ? (
        <Card>
          <CardHeader>
            <CardTitle>预算调整单</CardTitle>
            <CardDescription>未找到对应调整单或无权访问。</CardDescription>
          </CardHeader>
        </Card>
      ) : data.entityType !== ENTITY_BUDGET_HEADER ? (
        <Card>
          <CardHeader>
            <CardTitle>业务实体</CardTitle>
            <CardDescription>
              类型 {data.entityType} · ID{" "}
              <span className="font-mono text-xs">{data.entityId}</span>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>审批历史</CardTitle>
          <CardDescription>按时间顺序展示本流程实例下的全部记录</CardDescription>
        </CardHeader>
        <CardContent>
          {data.history.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无记录</p>
          ) : (
            <Timeline>
              {data.history.map((h) => (
                <TimelineItem key={h.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={actionBadgeVariant(h.action)}>
                      {ACTION_LABEL[h.action] ?? h.action}
                    </Badge>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatDt(h.actedAt ?? h.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">节点：</span>
                    {h.nodeName ?? "—"}
                    <span className="text-muted-foreground mx-2">·</span>
                    <span className="text-muted-foreground">处理人：</span>
                    {h.actorName ?? "—"}
                  </div>
                  {h.comment ? (
                    <p className="text-muted-foreground text-sm">{h.comment}</p>
                  ) : null}
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </CardContent>
      </Card>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>同意</DialogTitle>
            <DialogDescription>可选填写审批意见</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="同意。"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              取消
            </Button>
            <Button disabled={actionLoading} onClick={() => void postApprove()}>
              {actionLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              确认同意
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(o) => {
          setRejectOpen(o)
          if (!o) {
            setComment("")
            setRejectMode("final")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>驳回</DialogTitle>
            <DialogDescription>
              终审驳回将结束流程并可能将预算标为已驳回；退回仅将待办发回更早节点。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>驳回方式</Label>
              <Select
                value={rejectMode}
                onValueChange={(v) => setRejectMode(v as "final" | "return")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="final">终审驳回（结束流程）</SelectItem>
                  <SelectItem
                    value="return"
                    disabled={returnableNodes.length === 0}
                  >
                    退回至节点
                    {returnableNodes.length === 0 ? "（无可退节点）" : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rejectMode === "return" && returnableNodes.length > 0 ? (
              <div className="grid gap-2">
                <Label>退回节点</Label>
                <Select value={returnNodeId} onValueChange={setReturnNodeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择节点" />
                  </SelectTrigger>
                  <SelectContent>
                    {returnableNodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        步骤 {n.sortOrder + 1} · {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="rej-cmt">意见（可选）</Label>
              <Textarea
                id="rej-cmt"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={actionLoading}
              onClick={() => void postReject()}
            >
              {actionLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferOpen}
        onOpenChange={(o) => {
          setTransferOpen(o)
          if (!o) {
            setComment("")
            setTargetUserId("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>转交</DialogTitle>
            <DialogDescription>
              将当前待办转交给同组织其他用户
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>转交给</Label>
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  {transferUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferUsers.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  暂无可选用户（或仅您一人）
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>意见（可选）</Label>
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              取消
            </Button>
            <Button
              disabled={actionLoading || !targetUserId}
              onClick={() => void postTransfer()}
            >
              {actionLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              确认转交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
