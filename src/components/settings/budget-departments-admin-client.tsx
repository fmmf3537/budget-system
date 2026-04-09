"use client"

import * as React from "react"
import Link from "next/link"
import {
  DownloadIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"

import { buildMockHeaders } from "@/lib/api/mock-headers"
import { downloadXlsxUint8 } from "@/lib/excel/download-xlsx"
import { readSimpleExcelBuffer, writeSimpleExcelBuffer } from "@/lib/excel/simple-sheet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useBudgetStore } from "@/stores/budget-store"

const ROOT_PARENT_VALUE = "__root__"

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { message: string }
}

type Row = {
  id: string
  parentId: string | null
  code: string
  name: string
  sortOrder: number
  isActive: boolean
}

/** 节点层级：顶级=1（最多三级） */
function clientLevelOf(items: Row[], id: string): number {
  let n = 1
  let cur = items.find((x) => x.id === id)
  while (cur?.parentId) {
    n++
    cur = items.find((x) => x.id === cur!.parentId)
  }
  return n
}

function descendantIds(items: Row[], rootId: string): Set<string> {
  const byParent = new Map<string | null, Row[]>()
  for (const r of items) {
    const p = r.parentId ?? null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(r)
  }
  const out = new Set<string>()
  function walk(xid: string) {
    out.add(xid)
    for (const c of byParent.get(xid) ?? []) walk(c.id)
  }
  walk(rootId)
  return out
}

/** 以 id 为根的子树高度（含自身），与接口侧 subtreeHeight 一致 */
function subtreeHeightClient(items: Row[], id: string): number {
  const children = items.filter((r) => r.parentId === id)
  if (children.length === 0) return 1
  return 1 + Math.max(...children.map((c) => subtreeHeightClient(items, c.id)))
}

function flatTreeRows(items: Row[]): { row: Row; depth: number }[] {
  const byParent = new Map<string | null, Row[]>()
  for (const r of items) {
    const p = r.parentId ?? null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(r)
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)
    )
  }
  const out: { row: Row; depth: number }[] = []
  function walk(parentId: string | null, depth: number) {
    for (const r of byParent.get(parentId) ?? []) {
      out.push({ row: r, depth })
      walk(r.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export function BudgetDepartmentsAdminClient() {
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const baseHeaders = React.useMemo(
    () => buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
    [mockOrgId, mockUserId, mockUserRole]
  )

  const [items, setItems] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(true)
  const [forbidden, setForbidden] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<Row | null>(null)
  const [deleteRow, setDeleteRow] = React.useState<Row | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [cCode, setCCode] = React.useState("")
  const [cName, setCName] = React.useState("")
  const [cSort, setCSort] = React.useState("0")
  const [cParentId, setCParentId] = React.useState(ROOT_PARENT_VALUE)
  const [eCode, setECode] = React.useState("")
  const [eName, setEName] = React.useState("")
  const [eSort, setESort] = React.useState("0")
  const [eActive, setEActive] = React.useState(true)
  const [eParentId, setEParentId] = React.useState(ROOT_PARENT_VALUE)

  const treeRows = React.useMemo(() => flatTreeRows(items), [items])
  const createParentCandidates = React.useMemo(
    () => items.filter((r) => clientLevelOf(items, r.id) < 3),
    [items]
  )
  const editExcluded = React.useMemo(() => {
    if (!editRow) return new Set<string>()
    return descendantIds(items, editRow.id)
  }, [items, editRow])
  const editParentCandidates = React.useMemo(() => {
    if (!editRow) return []
    const h = subtreeHeightClient(items, editRow.id)
    return items.filter((r) => {
      if (editExcluded.has(r.id)) return false
      const anchor = clientLevelOf(items, r.id) + 1
      return anchor + h - 1 <= 3
    })
  }, [items, editRow, editExcluded])

  const codeById = React.useMemo(
    () => new Map(items.map((x) => [x.id, x.code])),
    [items]
  )

  const loadIdRef = React.useRef(0)

  async function load() {
    const requestId = ++loadIdRef.current
    setLoading(true)
    setForbidden(false)
    try {
      const res = await fetch("/api/master-data/departments?manage=1", {
        credentials: "include",
        headers: baseHeaders,
      })
      if (requestId !== loadIdRef.current) return
      const json = (await res.json()) as ApiSuccess<{ items: Row[] }> | ApiFail
      if (requestId !== loadIdRef.current) return
      if (!json.success) {
        if (res.status === 403) {
          setForbidden(true)
          setItems([])
          return
        }
        toast.error(json.error.message)
        setItems([])
        return
      }
      setItems(
        json.data.items.map((x) => ({
          ...x,
          parentId: x.parentId ?? null,
        }))
      )
    } catch {
      if (requestId !== loadIdRef.current) return
      toast.error("加载失败")
      setItems([])
    } finally {
      if (requestId === loadIdRef.current) {
        setLoading(false)
      }
    }
  }

  React.useEffect(() => {
    void load()
  }, [mockOrgId, mockUserId, mockUserRole])

  async function exportExcel() {
    try {
      const codeById = new Map(items.map((x) => [x.id, x.code]))
      const u8 = await writeSimpleExcelBuffer([
        {
          name: "部门成本中心",
          headers: ["编码", "名称", "上级编码", "排序", "状态"],
          rows: items.map((r) => [
            r.code,
            r.name,
            r.parentId ? (codeById.get(r.parentId) ?? "") : "",
            r.sortOrder,
            r.isActive ? "启用" : "停用",
          ]),
        },
      ])
      downloadXlsxUint8(u8, "部门成本中心.xlsx")
      toast.success("已导出")
    } catch {
      toast.error("导出失败")
    }
  }

  async function downloadTemplate() {
    try {
      const u8 = await writeSimpleExcelBuffer([
        {
          name: "部门成本中心",
          headers: ["编码", "名称", "上级编码", "排序", "状态"],
          rows: [
            ["D001", "总部", "", 10, "启用"],
            ["D002", "销售中心", "D001", 20, "启用"],
            ["D003", "研发中心", "D001", 30, "启用"],
            ["D004", "运营支持", "", 40, "停用"],
            ["D005", "华北销售部", "D002", 50, "启用"],
          ],
        },
      ])
      downloadXlsxUint8(u8, "部门成本中心_导入模板.xlsx")
      toast.success("模板已下载")
    } catch {
      toast.error("模板下载失败")
    }
  }

  async function onImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setImporting(true)
    try {
      const sheets = await readSimpleExcelBuffer(await file.arrayBuffer())
      const first = sheets[0]
      if (!first) {
        toast.error("Excel 为空")
        return
      }
      const codeIdx = first.headers.findIndex((h) => h === "编码")
      const nameIdx = first.headers.findIndex((h) => h === "名称")
      const sortIdx = first.headers.findIndex((h) => h === "排序")
      const statusIdx = first.headers.findIndex((h) => h === "状态")
      const parentIdx = first.headers.findIndex(
        (h) => h === "上级编码" || h === "上级"
      )
      if (codeIdx < 0 || nameIdx < 0) {
        toast.error("模板不匹配：缺少「编码/名称」列")
        return
      }

      type Parsed = {
        code: string
        name: string
        parentCode: string | null
        sortOrder: number
        isActive: boolean
      }
      const parsed: Parsed[] = []
      for (const row of first.rows) {
        const code = (row[codeIdx] ?? "").trim()
        const name = (row[nameIdx] ?? "").trim()
        if (!code || !name) continue
        const sortOrder =
          sortIdx >= 0 ? Number.parseInt((row[sortIdx] ?? "").trim(), 10) || 0 : 0
        const isActive =
          statusIdx >= 0 ? (row[statusIdx] ?? "").trim() !== "停用" : true
        const pc =
          parentIdx >= 0 ? (row[parentIdx] ?? "").trim() || null : null
        parsed.push({ code, name, parentCode: pc, sortOrder, isActive })
      }

      const idByCode = new Map(items.map((x) => [x.code, x.id]))
      let createdCount = 0
      let updatedCount = 0

      if (parentIdx < 0) {
        const byCode = new Map(items.map((x) => [x.code, x]))
        for (const pr of parsed) {
          const old = byCode.get(pr.code)
          if (old) {
            const res = await fetch(`/api/master-data/departments/${old.id}`, {
              method: "PUT",
              credentials: "include",
              headers: { ...baseHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({
                code: pr.code,
                name: pr.name,
                sortOrder: pr.sortOrder,
                isActive: pr.isActive,
              }),
            })
            const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
            if (!json.success) throw new Error(json.error.message)
            updatedCount += 1
          } else {
            const res = await fetch("/api/master-data/departments", {
              method: "POST",
              credentials: "include",
              headers: { ...baseHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({
                code: pr.code,
                name: pr.name,
                sortOrder: pr.sortOrder,
                parentId: null,
              }),
            })
            const json = (await res.json()) as ApiSuccess<{ id: string }> | ApiFail
            if (!json.success) throw new Error(json.error.message)
            idByCode.set(pr.code, json.data.id)
            createdCount += 1
          }
        }
      } else {
        let pending = [...parsed]
        let guard = 0
        while (pending.length > 0 && guard < 500) {
          guard += 1
          const sizeBefore = pending.length
          const next: Parsed[] = []
          for (const pr of pending) {
            const pc = pr.parentCode
            if (pc && !idByCode.has(pc)) {
              next.push(pr)
              continue
            }
            const parentId = pc ? idByCode.get(pc) ?? null : null
            if (pc && parentId == null) {
              next.push(pr)
              continue
            }
            const existingId = idByCode.get(pr.code)
            if (existingId) {
              const res = await fetch(
                `/api/master-data/departments/${existingId}`,
                {
                  method: "PUT",
                  credentials: "include",
                  headers: { ...baseHeaders, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    code: pr.code,
                    name: pr.name,
                    sortOrder: pr.sortOrder,
                    isActive: pr.isActive,
                    parentId,
                  }),
                }
              )
              const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
              if (!json.success) throw new Error(json.error.message)
              updatedCount += 1
            } else {
              const res = await fetch("/api/master-data/departments", {
                method: "POST",
                credentials: "include",
                headers: { ...baseHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({
                  code: pr.code,
                  name: pr.name,
                  sortOrder: pr.sortOrder,
                  parentId,
                }),
              })
              const json = (await res.json()) as ApiSuccess<{ id: string }> | ApiFail
              if (!json.success) throw new Error(json.error.message)
              idByCode.set(pr.code, json.data.id)
              createdCount += 1
            }
          }
          pending = next
          if (pending.length === sizeBefore) break
        }
        if (pending.length > 0) {
          throw new Error(
            "部分行未导入：请检查「上级编码」是否在本表或系统中已存在，且不超过三级"
          )
        }
      }

      await load()
      setImportOpen(false)
      toast.success(`导入完成：新增 ${createdCount}，更新 ${updatedCount}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败")
    } finally {
      setImporting(false)
    }
  }

  function openCreate() {
    setCCode("")
    setCName("")
    setCSort("0")
    setCParentId(ROOT_PARENT_VALUE)
    setCreateOpen(true)
  }

  function openEdit(row: Row) {
    setEditRow(row)
    setECode(row.code)
    setEName(row.name)
    setESort(String(row.sortOrder))
    setEActive(row.isActive)
    setEParentId(row.parentId ?? ROOT_PARENT_VALUE)
  }

  async function submitCreate() {
    setSaving(true)
    try {
      const res = await fetch("/api/master-data/departments", {
        method: "POST",
        credentials: "include",
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cCode.trim(),
          name: cName.trim(),
          sortOrder: Number.parseInt(cSort, 10) || 0,
          parentId:
            cParentId === ROOT_PARENT_VALUE ? null : cParentId,
        }),
      })
      const json = (await res.json()) as ApiSuccess<{ id: string }> | ApiFail
      if (!json.success) {
        toast.error(json.error.message)
        return
      }
      toast.success("已创建")
      setCreateOpen(false)
      await load()
    } catch {
      toast.error("创建失败")
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit() {
    if (!editRow) return
    setSaving(true)
    try {
      const res = await fetch(`/api/master-data/departments/${editRow.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: eCode.trim(),
          name: eName.trim(),
          sortOrder: Number.parseInt(eSort, 10) || 0,
          isActive: eActive,
          parentId:
            eParentId === ROOT_PARENT_VALUE ? null : eParentId,
        }),
      })
      const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
      if (!json.success) {
        toast.error(json.error.message)
        return
      }
      toast.success("已保存")
      setEditRow(null)
      await load()
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function submitDelete() {
    if (!deleteRow) return
    setSaving(true)
    try {
      const res = await fetch(`/api/master-data/departments/${deleteRow.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: baseHeaders,
      })
      const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
      if (!json.success) {
        toast.error(json.error.message)
        return
      }
      toast.success("已删除")
      setDeleteRow(null)
      await load()
    } catch {
      toast.error("删除失败")
    } finally {
      setSaving(false)
    }
  }

  if (forbidden) {
    return (
      <Alert variant="destructive">
        <AlertTitle>无权限</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>需要系统设置权限（通常为 ADMIN）。请切换角色或使用具备该权限的账号登录。</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/master-data">返回主数据管理</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>说明</AlertTitle>
        <AlertDescription className="text-sm">
          支持最多三级树形结构（顶级→子级→孙级）；上级为空表示顶级。编码写入预算明细「部门/成本中心」列；删除前需无预算行引用，且不能有下级部门。
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={loading || forbidden}
          onClick={() => void exportExcel()}
        >
          <DownloadIcon className="mr-2 size-4" />
          导出 Excel
        </Button>
        <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
          <UploadIcon className="mr-2 size-4" />
          导入 Excel
        </Button>
        <Button onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          新建
        </Button>
      </div>

      <div className="rounded-md border">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
            <Loader2Icon className="size-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>编码</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>上级编码</TableHead>
                <TableHead className="text-center">排序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-[100px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-24 text-center text-sm"
                  >
                    暂无数据，请新建或从编制页使用自由文本（未维护字典时）
                  </TableCell>
                </TableRow>
              ) : (
                treeRows.map(({ row, depth }) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell
                      className="font-medium"
                      style={{ paddingLeft: `${12 + depth * 16}px` }}
                    >
                      {row.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {row.parentId
                        ? (codeById.get(row.parentId) ?? "—")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {row.sortOrder}
                    </TableCell>
                    <TableCell>
                      {row.isActive ? (
                        <Badge variant="secondary">启用</Badge>
                      ) : (
                        <Badge variant="outline">停用</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="编辑"
                          onClick={() => openEdit(row)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="删除"
                          onClick={() => setDeleteRow(row)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建部门/成本中心</DialogTitle>
            <DialogDescription>
              编码在本组织内唯一；第三级部门不可再选为别人的上级。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="bd-c-parent">上级</Label>
              <Select value={cParentId} onValueChange={setCParentId}>
                <SelectTrigger id="bd-c-parent">
                  <SelectValue placeholder="选择上级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_PARENT_VALUE}>无（顶级）</SelectItem>
                  {createParentCandidates.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.code} {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bd-c-code">编码</Label>
              <Input
                id="bd-c-code"
                value={cCode}
                onChange={(e) => setCCode(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bd-c-name">名称</Label>
              <Input
                id="bd-c-name"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bd-c-sort">排序</Label>
              <Input
                id="bd-c-sort"
                type="number"
                min={0}
                value={cSort}
                onChange={(e) => setCSort(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void submitCreate()}>
              {saving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRow != null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑</DialogTitle>
            <DialogDescription>
              调整上级时不能选自己或下级，且整棵子树深度不超过三级。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="bd-e-parent">上级</Label>
              <Select value={eParentId} onValueChange={setEParentId}>
                <SelectTrigger id="bd-e-parent">
                  <SelectValue placeholder="选择上级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_PARENT_VALUE}>无（顶级）</SelectItem>
                  {editParentCandidates.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.code} {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bd-e-code">编码</Label>
              <Input
                id="bd-e-code"
                value={eCode}
                onChange={(e) => setECode(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bd-e-name">名称</Label>
              <Input
                id="bd-e-name"
                value={eName}
                onChange={(e) => setEName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bd-e-sort">排序</Label>
              <Input
                id="bd-e-sort"
                type="number"
                min={0}
                value={eSort}
                onChange={(e) => setESort(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="border-input size-4 rounded"
                checked={eActive}
                onChange={(e) => setEActive(e.target.checked)}
              />
              启用
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void submitEdit()}>
              {saving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteRow != null} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除？</DialogTitle>
            <DialogDescription>
              将删除「{deleteRow?.code} {deleteRow?.name}」。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => void submitDelete()}
            >
              {saving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                "删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>导入部门/成本中心</DialogTitle>
            <DialogDescription>
              模板含「上级编码」列，留空表示顶级；父子需在同一表中按依赖顺序填写，或先在系统中维护上级。整体不超过三级。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => void downloadTemplate()}>
              下载模板
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? <Loader2Icon className="size-4 animate-spin" /> : "选择并导入"}
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
