"use client"

import * as React from "react"
import Link from "next/link"
import {
  DownloadIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { buildMockHeaders } from "@/lib/api/mock-headers"
import { downloadXlsxUint8 } from "@/lib/excel/download-xlsx"
import { writeSimpleExcelBuffer } from "@/lib/excel/simple-sheet"
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

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { code?: string; message: string }
}

type SubjectRow = {
  id: string
  code: string
  name: string
  parentId: string | null
  level: number | null
  sortOrder: number
  isActive: boolean
  organizationId: string | null
}

const NONE = "__none__"

function parentLabel(rows: SubjectRow[], parentId: string | null) {
  if (!parentId) return "—"
  const p = rows.find((r) => r.id === parentId)
  return p ? `${p.code} ${p.name}` : parentId
}

export function BudgetSubjectsAdminClient() {
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const baseHeaders = React.useMemo(
    () => buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
    [mockOrgId, mockUserId, mockUserRole]
  )

  const [items, setItems] = React.useState<SubjectRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [forbidden, setForbidden] = React.useState(false)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<SubjectRow | null>(null)
  const [deleteRow, setDeleteRow] = React.useState<SubjectRow | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [cCode, setCCode] = React.useState("")
  const [cName, setCName] = React.useState("")
  const [cParent, setCParent] = React.useState<string>(NONE)
  const [cSort, setCSort] = React.useState("0")

  const [eCode, setECode] = React.useState("")
  const [eName, setEName] = React.useState("")
  const [eParent, setEParent] = React.useState<string>(NONE)
  const [eSort, setESort] = React.useState("0")
  const [eActive, setEActive] = React.useState(true)

  async function load() {
    setLoading(true)
    setForbidden(false)
    try {
      const res = await fetch("/api/budget-subjects?manage=1", {
        credentials: "include",
        headers: baseHeaders,
      })
      const json = (await res.json()) as ApiSuccess<{ items: SubjectRow[] }> | ApiFail
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
      setItems(json.data.items)
    } catch {
      toast.error("加载科目失败")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    void load()
  }, [mockOrgId, mockUserId, mockUserRole])

  async function exportExcel() {
    try {
      const parentCodeOf = (parentId: string | null) => {
        if (!parentId) return ""
        return items.find((r) => r.id === parentId)?.code ?? ""
      }
      const u8 = await writeSimpleExcelBuffer([
        {
          name: "预算科目",
          headers: [
            "编码",
            "名称",
            "上级科目编码",
            "层级",
            "排序",
            "状态",
            "范围",
          ],
          rows: items.map((r) => [
            r.code,
            r.name,
            parentCodeOf(r.parentId),
            r.level ?? "",
            r.sortOrder,
            r.isActive ? "启用" : "停用",
            r.organizationId == null ? "预置" : "本组织",
          ]),
        },
      ])
      downloadXlsxUint8(u8, "预算科目.xlsx")
      toast.success("已导出")
    } catch {
      toast.error("导出失败")
    }
  }

  function openCreate() {
    setCCode("")
    setCName("")
    setCParent(NONE)
    setCSort("0")
    setCreateOpen(true)
  }

  function openEdit(row: SubjectRow) {
    setEditRow(row)
    setECode(row.code)
    setEName(row.name)
    setEParent(row.parentId ?? NONE)
    setESort(String(row.sortOrder))
    setEActive(row.isActive)
  }

  const orgSubjects = items.filter((r) => r.organizationId != null)
  /** 上级可选预置科目或本组织科目（与 API subjectInOrgScope 一致） */
  const parentOptionsCreate = items
  const parentOptionsEdit = items.filter((r) => r.id !== editRow?.id)

  async function submitCreate() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        code: cCode.trim(),
        name: cName.trim(),
        sortOrder: Number.parseInt(cSort, 10) || 0,
      }
      if (cParent !== NONE) body.parentId = cParent

      const res = await fetch("/api/budget-subjects", {
        method: "POST",
        credentials: "include",
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiSuccess<{ id: string }> | ApiFail
      if (!json.success) {
        toast.error(json.error.message)
        return
      }
      toast.success("科目已创建")
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
      const body = {
        code: eCode.trim(),
        name: eName.trim(),
        parentId: eParent === NONE ? null : eParent,
        sortOrder: Number.parseInt(eSort, 10) || 0,
        isActive: eActive,
      }
      const res = await fetch(`/api/budget-subjects/${editRow.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      const res = await fetch(`/api/budget-subjects/${deleteRow.id}`, {
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
          <p>
            管理预算科目需要「系统设置」权限（通常为{" "}
            <strong>ADMIN</strong>）。请通过顶栏将模拟角色切换为管理员，或使用具备该权限的账号登录。
          </p>
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
          标记为「预置」的科目为全局数据，不可在此修改或删除；本组织自建科目可完整维护。删除前请确保无子科目且未被预算明细引用。
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
        <Button onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          新建科目
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
                <TableHead>上级</TableHead>
                <TableHead className="text-center">层级</TableHead>
                <TableHead className="text-center">排序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>范围</TableHead>
                <TableHead className="w-[120px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-muted-foreground h-24 text-center text-sm"
                  >
                    暂无科目数据
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => {
                  const isGlobal = row.organizationId == null
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm">{row.code}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                        {parentLabel(items, row.parentId)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.level ?? "—"}
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
                      <TableCell>
                        {isGlobal ? (
                          <Badge variant="outline">预置</Badge>
                        ) : (
                          <Badge>本组织</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isGlobal}
                            title={isGlobal ? "预置科目不可编辑" : "编辑"}
                            onClick={() => !isGlobal && openEdit(row)}
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isGlobal}
                            title={isGlobal ? "预置科目不可删除" : "删除"}
                            onClick={() => !isGlobal && setDeleteRow(row)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建预算科目</DialogTitle>
            <DialogDescription>
              编码在本组织内唯一；可选择上级形成层级。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="sub-c-code">编码</Label>
              <Input
                id="sub-c-code"
                value={cCode}
                onChange={(e) => setCCode(e.target.value)}
                placeholder="如 60101"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-c-name">名称</Label>
              <Input
                id="sub-c-name"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="科目名称"
              />
            </div>
            <div className="grid gap-2">
              <Label>上级科目（可选）</Label>
              <Select value={cParent} onValueChange={setCParent}>
                <SelectTrigger>
                  <SelectValue placeholder="无（顶级）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>无（顶级）</SelectItem>
                  {parentOptionsCreate.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.organizationId == null ? "「预置」 " : ""}
                      {r.code} {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-c-sort">排序</Label>
              <Input
                id="sub-c-sort"
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
            <DialogTitle>编辑预算科目</DialogTitle>
            <DialogDescription>修改编码、名称、层级与启用状态。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="sub-e-code">编码</Label>
              <Input
                id="sub-e-code"
                value={eCode}
                onChange={(e) => setECode(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-e-name">名称</Label>
              <Input
                id="sub-e-name"
                value={eName}
                onChange={(e) => setEName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>上级科目</Label>
              <Select value={eParent} onValueChange={setEParent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>无（顶级）</SelectItem>
                  {parentOptionsEdit.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.organizationId == null ? "「预置」 " : ""}
                      {r.code} {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-e-sort">排序</Label>
              <Input
                id="sub-e-sort"
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
            <DialogTitle>删除科目？</DialogTitle>
            <DialogDescription>
              将永久删除「{deleteRow?.code} {deleteRow?.name}」。若有子科目或已被预算引用，操作将失败。
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
    </div>
  )
}
