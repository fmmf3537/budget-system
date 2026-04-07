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
  error: { message: string }
}

type Row = {
  id: string
  code: string
  name: string
  sortOrder: number
  isActive: boolean
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
  const [saving, setSaving] = React.useState(false)

  const [cCode, setCCode] = React.useState("")
  const [cName, setCName] = React.useState("")
  const [cSort, setCSort] = React.useState("0")
  const [eCode, setECode] = React.useState("")
  const [eName, setEName] = React.useState("")
  const [eSort, setESort] = React.useState("0")
  const [eActive, setEActive] = React.useState(true)

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
      setItems(json.data.items)
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
      const u8 = await writeSimpleExcelBuffer([
        {
          name: "部门成本中心",
          headers: ["编码", "名称", "排序", "状态"],
          rows: items.map((r) => [
            r.code,
            r.name,
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

  function openCreate() {
    setCCode("")
    setCName("")
    setCSort("0")
    setCreateOpen(true)
  }

  function openEdit(row: Row) {
    setEditRow(row)
    setECode(row.code)
    setEName(row.name)
    setESort(String(row.sortOrder))
    setEActive(row.isActive)
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
          <p>需要系统设置权限（通常为 ADMIN）。请切换模拟角色或使用具备该权限的账号。</p>
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
          编码写入预算明细「部门/成本中心」列；删除前需无预算行引用该编码。
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
                <TableHead className="text-center">排序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-[100px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-24 text-center text-sm"
                  >
                    暂无数据，请新建或从编制页使用自由文本（未维护字典时）
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
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
            <DialogDescription>编码在本组织内唯一。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
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
          </DialogHeader>
          <div className="grid gap-4 py-2">
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
    </div>
  )
}
