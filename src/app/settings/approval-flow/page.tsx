"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ApprovalBizType } from "@/generated/prisma/enums"
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
import { buildMockHeaders } from "@/lib/api/mock-headers"
import { downloadXlsxUint8 } from "@/lib/excel/download-xlsx"
import { readSimpleExcelBuffer, writeSimpleExcelBuffer } from "@/lib/excel/simple-sheet"
import { useBudgetStore } from "@/stores/budget-store"

const BIZ_LABEL: Record<string, string> = {
  [ApprovalBizType.BUDGET]: "预算",
  [ApprovalBizType.BUDGET_ADJUSTMENT]: "预算调整",
  [ApprovalBizType.CASH_PLAN]: "资金计划",
  [ApprovalBizType.OTHER]: "其他",
}

type UserOpt = { id: string; name: string; email: string }

type ProcessSummary = {
  id: string
  name: string
  bizType: string
  isActive: boolean
  version: number
  nodeCount: number
  recordCount: number
  updatedAt: string
}

type ApiNode = {
  id: string
  sortOrder: number
  name: string
  approverUserId: string | null
  approverRole: string | null
  isParallelGroup: boolean
  minTotalAmount: string | null
  maxTotalAmount: string | null
}

type ProcessDetail = {
  id: string
  name: string
  bizType: string
  isActive: boolean
  nodes: ApiNode[]
}

type NodeForm = {
  clientKey: string
  id?: string
  sortOrder: number
  name: string
  approverUserId: string | null
  approverRole: string
  isParallelGroup: boolean
  minTotalAmount: string
  maxTotalAmount: string
}

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = { success: false; data: null; error: { message: string } }

function newKey() {
  return `k-${Math.random().toString(36).slice(2, 10)}`
}

function emptyNode(order: number): NodeForm {
  return {
    clientKey: newKey(),
    sortOrder: order,
    name: `审批节点 ${order + 1}`,
    approverUserId: null,
    approverRole: "",
    isParallelGroup: false,
    minTotalAmount: "",
    maxTotalAmount: "",
  }
}

function mapApiToForm(nodes: ApiNode[]): NodeForm[] {
  return [...nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((n, i) => ({
      clientKey: n.id,
      id: n.id,
      sortOrder: i,
      name: n.name,
      approverUserId: n.approverUserId,
      approverRole: n.approverRole ?? "",
      isParallelGroup: n.isParallelGroup,
      minTotalAmount: n.minTotalAmount ?? "",
      maxTotalAmount: n.maxTotalAmount ?? "",
    }))
}

function normalizeNodesForApi(rows: NodeForm[], includeIds: boolean) {
  return rows.map((r, i) => ({
    ...(includeIds && r.id ? { id: r.id } : {}),
    sortOrder: i,
    name: r.name.trim(),
    approverUserId: r.approverUserId?.trim() ? r.approverUserId : null,
    approverRole: r.approverRole.trim() || null,
    isParallelGroup: r.isParallelGroup,
    minTotalAmount: r.minTotalAmount.trim() || null,
    maxTotalAmount: r.maxTotalAmount.trim() || null,
  }))
}

export default function ApprovalFlowSettingsPage() {
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const [items, setItems] = React.useState<ProcessSummary[]>([])
  const [users, setUsers] = React.useState<UserOpt[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [pName, setPName] = React.useState("")
  const [pBiz, setPBiz] = React.useState<string>(ApprovalBizType.BUDGET)
  const [pActive, setPActive] = React.useState(true)
  const [nodes, setNodes] = React.useState<NodeForm[]>([emptyNode(0)])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/settings/approval-flow", {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<{
        items: ProcessSummary[]
        usersInOrg: UserOpt[]
      }> | ApiFail
      if (!json.success) {
        setError(json.error?.message ?? "加载失败")
        return
      }
      setItems(json.data.items)
      setUsers(json.data.usersInOrg)
    } catch {
      setError("网络异常")
    } finally {
      setLoading(false)
    }
  }, [mockOrgId, mockUserId, mockUserRole])

  React.useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditingId(null)
    setPName("")
    setPBiz(ApprovalBizType.BUDGET)
    setPActive(true)
    setNodes([emptyNode(0)])
    setDialogOpen(true)
  }

  async function openEdit(id: string) {
    setEditingId(id)
    setDialogOpen(true)
    setNodes([emptyNode(0)])
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/approval/${id}`, {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<ProcessDetail> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "加载流程失败")
        setDialogOpen(false)
        return
      }
      const d = json.data
      setPName(d.name)
      setPBiz(d.bizType)
      setPActive(d.isActive)
      setNodes(
        d.nodes.length > 0 ? mapApiToForm(d.nodes) : [emptyNode(0)]
      )
    } catch {
      toast.error("加载失败")
      setDialogOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  function moveNode(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= nodes.length) return
    setNodes((prev) => {
      const next = [...prev]
      const t = next[index]!
      next[index] = next[j]!
      next[j] = t
      return next.map((n, i) => ({ ...n, sortOrder: i }))
    })
  }

  function removeNode(index: number) {
    if (nodes.length <= 1) {
      toast.error("至少保留一个节点")
      return
    }
    setNodes((prev) =>
      prev.filter((_, i) => i !== index).map((n, i) => ({ ...n, sortOrder: i }))
    )
  }

  function addNode() {
    setNodes((prev) => [...prev, emptyNode(prev.length)])
  }

  async function saveProcess() {
    const name = pName.trim()
    if (!name) {
      toast.error("请填写流程名称")
      return
    }
    const trimmed = nodes.map((n) => ({
      ...n,
      name: n.name.trim(),
    }))
    if (trimmed.some((n) => !n.name)) {
      toast.error("每个节点必须有名称")
      return
    }
    setSaving(true)
    try {
      if (editingId == null) {
        const nodesPayload = normalizeNodesForApi(trimmed, false)
        const res = await fetch("/api/approval/create", {
          method: "POST",
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
          body: JSON.stringify({
            name,
            bizType: pBiz,
            isActive: pActive,
            nodes: nodesPayload,
          }),
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error?.message ?? "创建失败")
          return
        }
        toast.success("已创建流程")
      } else {
        const nodesPayload = normalizeNodesForApi(trimmed, true)
        const res = await fetch(`/api/settings/approval-flow/${editingId}`, {
          method: "PUT",
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
          body: JSON.stringify({
            name,
            bizType: pBiz,
            isActive: pActive,
            nodes: nodesPayload,
          }),
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error?.message ?? "保存失败")
          return
        }
        toast.success("已保存")
      }
      setDialogOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function exportExcel() {
    try {
      const rows: (string | number)[][] = []
      for (const p of items) {
        const res = await fetch(`/api/approval/${p.id}`, {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        })
        const json = (await res.json()) as ApiSuccess<ProcessDetail> | ApiFail
        if (!json.success) throw new Error(json.error.message)
        const nodes = [...json.data.nodes].sort((a, b) => a.sortOrder - b.sortOrder)
        if (nodes.length === 0) {
          rows.push([p.name, p.bizType, p.isActive ? "启用" : "停用", 1, "", "", "", "", ""])
        } else {
          for (const n of nodes) {
            rows.push([
              p.name,
              p.bizType,
              p.isActive ? "启用" : "停用",
              n.sortOrder + 1,
              n.name,
              n.approverUserId ?? "",
              n.approverRole ?? "",
              n.minTotalAmount ?? "",
              n.maxTotalAmount ?? "",
            ])
          }
        }
      }
      const u8 = await writeSimpleExcelBuffer([
        {
          name: "审批流程",
          headers: [
            "流程名称",
            "业务类型",
            "流程状态",
            "节点序号",
            "节点名称",
            "审批人ID",
            "角色规则",
            "金额下限",
            "金额上限",
          ],
          rows,
        },
      ])
      downloadXlsxUint8(u8, "审批流程_导出.xlsx")
      toast.success("已导出")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导出失败")
    }
  }

  async function downloadTemplate() {
    try {
      const u8 = await writeSimpleExcelBuffer([
        {
          name: "审批流程",
          headers: [
            "流程名称",
            "业务类型",
            "流程状态",
            "节点序号",
            "节点名称",
            "审批人ID",
            "角色规则",
            "金额下限",
            "金额上限",
          ],
          rows: [
            ["预算审批标准流", "BUDGET", "启用", 1, "部门负责人审批", "", "DEPT_HEAD", "", "100000"],
            ["预算审批标准流", "BUDGET", "启用", 2, "财务负责人审批", "", "FINANCE_MANAGER", "100000", ""],
            ["资金计划审批流", "CASH_PLAN", "启用", 1, "资金主管审批", "", "CASH_MANAGER", "", ""],
            ["预算调整审批流", "BUDGET_ADJUSTMENT", "停用", 1, "预算管理员审批", "", "BUDGET_MANAGER", "", ""],
            ["其他事项审批流", "OTHER", "启用", 1, "管理员审批", "", "ADMIN", "", ""],
          ],
        },
      ])
      downloadXlsxUint8(u8, "审批流程_导入模板.xlsx")
      toast.success("模板已下载")
    } catch {
      toast.error("模板下载失败")
    }
  }

  async function onImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setSaving(true)
    try {
      const sheets = await readSimpleExcelBuffer(await file.arrayBuffer())
      const first = sheets[0]
      if (!first) return
      const nameIdx = first.headers.findIndex((h) => h === "流程名称")
      const bizIdx = first.headers.findIndex((h) => h === "业务类型")
      const activeIdx = first.headers.findIndex((h) => h === "流程状态")
      const orderIdx = first.headers.findIndex((h) => h === "节点序号")
      const nodeNameIdx = first.headers.findIndex((h) => h === "节点名称")
      const approverIdx = first.headers.findIndex((h) => h === "审批人ID")
      const roleIdx = first.headers.findIndex((h) => h === "角色规则")
      const minIdx = first.headers.findIndex((h) => h === "金额下限")
      const maxIdx = first.headers.findIndex((h) => h === "金额上限")
      if (nameIdx < 0 || bizIdx < 0 || nodeNameIdx < 0) {
        toast.error("模板不匹配：缺少关键列")
        return
      }

      const grouped = new Map<
        string,
        {
          name: string
          bizType: string
          isActive: boolean
          nodes: NodeForm[]
        }
      >()
      for (const row of first.rows) {
        const name = (row[nameIdx] ?? "").trim()
        const bizType = (row[bizIdx] ?? "").trim()
        const nodeName = (row[nodeNameIdx] ?? "").trim()
        if (!name || !bizType || !nodeName) continue
        const key = `${name}__${bizType}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            name,
            bizType,
            isActive: activeIdx >= 0 ? (row[activeIdx] ?? "").trim() !== "停用" : true,
            nodes: [],
          })
        }
        grouped.get(key)!.nodes.push({
          clientKey: newKey(),
          sortOrder:
            orderIdx >= 0 ? Math.max(0, Number.parseInt((row[orderIdx] ?? "").trim(), 10) - 1 || 0) : grouped.get(key)!.nodes.length,
          name: nodeName,
          approverUserId: approverIdx >= 0 ? (row[approverIdx] ?? "").trim() || null : null,
          approverRole: roleIdx >= 0 ? (row[roleIdx] ?? "").trim() : "",
          isParallelGroup: false,
          minTotalAmount: minIdx >= 0 ? (row[minIdx] ?? "").trim() : "",
          maxTotalAmount: maxIdx >= 0 ? (row[maxIdx] ?? "").trim() : "",
        })
      }

      const existing = new Map(items.map((x) => [`${x.name}__${x.bizType}`, x]))
      let createdCount = 0
      let updatedCount = 0
      for (const [k, p] of grouped) {
        const sortedNodes = [...p.nodes].sort((a, b) => a.sortOrder - b.sortOrder)
        const old = existing.get(k)
        if (old) {
          const dRes = await fetch(`/api/approval/${old.id}`, {
            headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
          })
          const dJson = (await dRes.json()) as ApiSuccess<ProcessDetail> | ApiFail
          if (!dJson.success) throw new Error(dJson.error.message)
          const oldIds = [...dJson.data.nodes].sort((a, b) => a.sortOrder - b.sortOrder)
          const nodesPayload = sortedNodes.map((n, i) => ({
            ...(oldIds[i]?.id ? { id: oldIds[i].id } : {}),
            sortOrder: i,
            name: n.name.trim(),
            approverUserId: n.approverUserId?.trim() ? n.approverUserId : null,
            approverRole: n.approverRole.trim() || null,
            isParallelGroup: false,
            minTotalAmount: n.minTotalAmount.trim() || null,
            maxTotalAmount: n.maxTotalAmount.trim() || null,
          }))
          const res = await fetch(`/api/settings/approval-flow/${old.id}`, {
            method: "PUT",
            headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
            body: JSON.stringify({
              name: p.name,
              bizType: p.bizType,
              isActive: p.isActive,
              nodes: nodesPayload,
            }),
          })
          const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
          if (!json.success) throw new Error(json.error.message)
          updatedCount += 1
        } else {
          const res = await fetch("/api/approval/create", {
            method: "POST",
            headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
            body: JSON.stringify({
              name: p.name,
              bizType: p.bizType,
              isActive: p.isActive,
              nodes: normalizeNodesForApi(sortedNodes, false),
            }),
          })
          const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
          if (!json.success) throw new Error(json.error.message)
          createdCount += 1
        }
      }
      await load()
      setImportOpen(false)
      toast.success(`导入完成：新增 ${createdCount}，更新 ${updatedCount}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container max-w-5xl space-y-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/settings/budget-template">← 预算模板配置</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            审批流程配置
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            维护本组织审批模板、节点顺序与审批人；预算类流程可按总额区间路由节点。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void exportExcel()}>
            <DownloadIcon className="mr-2 size-4" />
            导出 Excel
          </Button>
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <UploadIcon className="mr-2 size-4" />
            导入 Excel
          </Button>
          <Button type="button" onClick={openCreate}>
            <PlusIcon className="size-4" />
            新建流程
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            {error}
            <Button size="sm" variant="outline" onClick={() => void load()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>流程模板列表</CardTitle>
          <CardDescription>
            已产生审批记录的节点不可删除，仅可编辑或停用流程。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="text-muted-foreground flex justify-center py-12 text-sm">
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>业务类型</TableHead>
                  <TableHead>节点数</TableHead>
                  <TableHead>审批记录</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground h-24 text-center"
                    >
                      暂无流程，请点击「新建流程」
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {BIZ_LABEL[row.bizType] ?? row.bizType}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.nodeCount}</TableCell>
                      <TableCell>{row.recordCount}</TableCell>
                      <TableCell>
                        {row.isActive ? (
                          <Badge>启用</Badge>
                        ) : (
                          <Badge variant="outline">停用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void openEdit(row.id)}
                        >
                          <PencilIcon className="size-4" />
                          编辑
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>金额条件（预算）</AlertTitle>
        <AlertDescription>
          节点可配置总额下限/上限（含）。提交审批后，引擎会按节点顺序选择<strong>第一个</strong>满足金额区间的节点作为当前/下一环节；留空表示不限制。非预算业务不受金额条件影响。
        </AlertDescription>
      </Alert>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,900px)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "编辑审批流程" : "新建审批流程"}
            </DialogTitle>
            <DialogDescription>
              使用上移/下移调整顺序；审批人可选固定用户，或填写角色编码由业务解析。
            </DialogDescription>
          </DialogHeader>

          {detailLoading && editingId ? (
            <div className="flex justify-center py-8">
              <Loader2Icon className="size-6 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-6 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>流程名称</Label>
                  <Input
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="例如：年度预算审批"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>业务类型</Label>
                  <Select value={pBiz} onValueChange={setPBiz}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(BIZ_LABEL) as (keyof typeof BIZ_LABEL)[]
                      ).map((k) => (
                        <SelectItem key={k} value={k}>
                          {BIZ_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="border-input size-4 rounded border"
                      checked={pActive}
                      onChange={(e) => setPActive(e.target.checked)}
                    />
                    启用流程
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">审批节点</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={addNode}
                  >
                    <PlusIcon className="size-4" />
                    添加节点
                  </Button>
                </div>

                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[52px]">顺序</TableHead>
                        <TableHead>节点名称</TableHead>
                        <TableHead>审批人</TableHead>
                        <TableHead>角色规则</TableHead>
                        <TableHead>金额下限</TableHead>
                        <TableHead>金额上限</TableHead>
                        <TableHead className="w-[100px]">并行</TableHead>
                        <TableHead className="w-[120px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nodes.map((n, index) => (
                        <TableRow key={n.clientKey}>
                          <TableCell className="align-top">
                            <div className="text-muted-foreground flex flex-col gap-1 pt-1 text-xs">
                              <span className="tabular-nums">#{index + 1}</span>
                              <div className="flex gap-0.5">
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  className="size-7"
                                  disabled={index === 0}
                                  onClick={() => moveNode(index, -1)}
                                  aria-label="上移"
                                >
                                  <ArrowUpIcon className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  className="size-7"
                                  disabled={index === nodes.length - 1}
                                  onClick={() => moveNode(index, 1)}
                                  aria-label="下移"
                                >
                                  <ArrowDownIcon className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              value={n.name}
                              onChange={(e) =>
                                setNodes((prev) =>
                                  prev.map((x, i) =>
                                    i === index
                                      ? { ...x, name: e.target.value }
                                      : x
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Select
                              value={n.approverUserId ?? "NONE"}
                              onValueChange={(v) =>
                                setNodes((prev) =>
                                  prev.map((x, i) =>
                                    i === index
                                      ? {
                                          ...x,
                                          approverUserId:
                                            v === "NONE" ? null : v,
                                        }
                                      : x
                                  )
                                )
                              }
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="指定用户" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">不指定</SelectItem>
                                {users.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              className="w-[120px]"
                              placeholder="如 DEPT_HEAD"
                              value={n.approverRole}
                              onChange={(e) =>
                                setNodes((prev) =>
                                  prev.map((x, i) =>
                                    i === index
                                      ? { ...x, approverRole: e.target.value }
                                      : x
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              className="w-[100px] tabular-nums"
                              inputMode="decimal"
                              placeholder="不限"
                              value={n.minTotalAmount}
                              onChange={(e) =>
                                setNodes((prev) =>
                                  prev.map((x, i) =>
                                    i === index
                                      ? {
                                          ...x,
                                          minTotalAmount: e.target.value,
                                        }
                                      : x
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              className="w-[100px] tabular-nums"
                              inputMode="decimal"
                              placeholder="不限"
                              value={n.maxTotalAmount}
                              onChange={(e) =>
                                setNodes((prev) =>
                                  prev.map((x, i) =>
                                    i === index
                                      ? {
                                          ...x,
                                          maxTotalAmount: e.target.value,
                                        }
                                      : x
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top pt-3">
                            <input
                              type="checkbox"
                              className="border-input size-4 rounded border"
                              checked={n.isParallelGroup}
                              onChange={(e) =>
                                setNodes((prev) =>
                                  prev.map((x, i) =>
                                    i === index
                                      ? {
                                          ...x,
                                          isParallelGroup: e.target.checked,
                                        }
                                      : x
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top pt-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => removeNode(index)}
                              aria-label="删除节点"
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void saveProcess()}>
              {saving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>导入审批流程</DialogTitle>
            <DialogDescription>请先下载模板并填写，再上传 Excel。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => void downloadTemplate()}>
              下载模板
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                取消
              </Button>
              <Button disabled={saving} onClick={() => fileInputRef.current?.click()}>
                {saving ? <Loader2Icon className="size-4 animate-spin" /> : "选择并导入"}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => void onImportFileSelected(e)}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
