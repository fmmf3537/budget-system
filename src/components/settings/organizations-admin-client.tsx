"use client"

import * as React from "react"
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

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
import { OrgStatus } from "@/generated/prisma/enums"

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { code?: string; message: string }
}

type OrgRow = {
  id: string
  code: string | null
  name: string
  parentId: string | null
  parentName: string | null
  status: OrgStatus
  createdAt: string
  updatedAt: string
}

const STATUS_LABEL: Record<OrgStatus, string> = {
  [OrgStatus.ACTIVE]: "正常",
  [OrgStatus.INACTIVE]: "停用",
}

function descendantsOf(
  items: { id: string; parentId: string | null }[],
  root: string
): Set<string> {
  const children = new Map<string, string[]>()
  for (const i of items) {
    const p = i.parentId
    if (!p) continue
    if (!children.has(p)) children.set(p, [])
    children.get(p)!.push(i.id)
  }
  const out = new Set<string>()
  const stack = [...(children.get(root) ?? [])]
  while (stack.length) {
    const x = stack.pop()!
    out.add(x)
    stack.push(...(children.get(x) ?? []))
  }
  return out
}

export function OrganizationsAdminClient() {
  const [tenantRootId, setTenantRootId] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<OrgRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [forbidden, setForbidden] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<OrgRow | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [cName, setCName] = React.useState("")
  const [cCode, setCCode] = React.useState("")
  const [cParentId, setCParentId] = React.useState("")

  const [eName, setEName] = React.useState("")
  const [eCode, setECode] = React.useState("")
  const [eStatus, setEStatus] = React.useState<OrgStatus>(OrgStatus.ACTIVE)
  const [eParentId, setEParentId] = React.useState("")

  async function load() {
    setLoading(true)
    setForbidden(false)
    try {
      const res = await fetch("/api/settings/organizations", {
        credentials: "include",
      })
      const json = (await res.json()) as
        | ApiSuccess<{ tenantRootId: string; items: OrgRow[] }>
        | ApiFail
      if (!json.success) {
        if (res.status === 403) {
          setForbidden(true)
          setItems([])
          setTenantRootId(null)
          return
        }
        toast.error(json.error.message)
        setItems([])
        return
      }
      setTenantRootId(json.data.tenantRootId)
      setItems(json.data.items)
    } catch {
      toast.error("加载组织列表失败")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    void load()
  }, [])

  const editExcluded = React.useMemo(() => {
    if (!editRow) return new Set<string>()
    return new Set([editRow.id, ...descendantsOf(items, editRow.id)])
  }, [items, editRow])

  const editParentCandidates = React.useMemo(
    () => items.filter((r) => !editExcluded.has(r.id)),
    [items, editExcluded]
  )

  function openCreate() {
    setCName("")
    setCCode("")
    setCParentId(items[0]?.id ?? "")
    setCreateOpen(true)
  }

  function openEdit(row: OrgRow) {
    setEditRow(row)
    setEName(row.name)
    setECode(row.code ?? "")
    setEStatus(row.status)
    setEParentId(row.parentId ?? "")
  }

  async function submitCreate() {
    if (!cParentId) {
      toast.error("请选择上级组织")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/settings/organizations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cName.trim(),
          code: cCode.trim() || null,
          parentId: cParentId,
        }),
      })
      const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
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
    if (editRow.parentId != null && !eParentId) {
      toast.error("请选择上级组织")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: eName.trim(),
        code: eCode.trim() || null,
        status: eStatus,
      }
      if (editRow.parentId != null) {
        body.parentId = eParentId
      }
      const res = await fetch(`/api/settings/organizations/${editRow.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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

  if (forbidden) {
    return (
      <Alert variant="destructive">
        <AlertTitle>无权限</AlertTitle>
        <AlertDescription className="text-sm">
          仅系统管理员可维护本租户组织树。请使用管理员账号登录。
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>说明</AlertTitle>
        <AlertDescription className="text-sm">
          此处展示从您所在组织向上追溯到集团根节点后的<strong>整棵组织树</strong>
          （本租户范围）。可新增下级组织、修改名称/编码/状态与调整上级；不提供删除以避免关联数据破坏。
          {tenantRootId ? (
            <span className="text-muted-foreground mt-1 block text-xs">
              租户根节点 ID：<span className="font-mono">{tenantRootId}</span>
            </span>
          ) : null}
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button type="button" onClick={openCreate} disabled={loading || items.length === 0}>
          <PlusIcon className="mr-2 size-4" />
          新增下级组织
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
                <TableHead>名称</TableHead>
                <TableHead>编码</TableHead>
                <TableHead>上级</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-[88px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-24 text-center text-sm"
                  >
                    暂无组织数据
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {row.code ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.parentName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === OrgStatus.ACTIVE ? "secondary" : "outline"
                        }
                      >
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="编辑"
                        onClick={() => openEdit(row)}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
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
            <DialogTitle>新增下级组织</DialogTitle>
            <DialogDescription>
              新组织将归属所选上级之下；编码可选，全局唯一。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="org-c-parent">上级组织</Label>
              <Select value={cParentId} onValueChange={setCParentId}>
                <SelectTrigger id="org-c-parent">
                  <SelectValue placeholder="选择上级" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.code ? ` (${r.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-c-name">名称</Label>
              <Input
                id="org-c-name"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-c-code">编码（可选）</Label>
              <Input
                id="org-c-code"
                value={cCode}
                onChange={(e) => setCCode(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void submitCreate()}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRow != null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑组织</DialogTitle>
            <DialogDescription>
              上级不能选自己或自己的下级；停用后请谨慎用于仍有关联业务的组织。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="org-e-name">名称</Label>
              <Input
                id="org-e-name"
                value={eName}
                onChange={(e) => setEName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-e-code">编码（可选）</Label>
              <Input
                id="org-e-code"
                value={eCode}
                onChange={(e) => setECode(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={eStatus}
                onValueChange={(v) => setEStatus(v as OrgStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OrgStatus.ACTIVE}>正常</SelectItem>
                  <SelectItem value={OrgStatus.INACTIVE}>停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editRow != null && editRow.parentId != null ? (
              <div className="grid gap-2">
                <Label htmlFor="org-e-parent">上级组织</Label>
                <Select value={eParentId} onValueChange={setEParentId}>
                  <SelectTrigger id="org-e-parent">
                    <SelectValue placeholder="选择上级" />
                  </SelectTrigger>
                  <SelectContent>
                    {editParentCandidates.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                        {r.code ? ` (${r.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : editRow != null ? (
              <p className="text-muted-foreground text-sm">
                本节点为租户根组织，不设上级。
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              取消
            </Button>
            <Button disabled={saving} onClick={() => void submitEdit()}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
