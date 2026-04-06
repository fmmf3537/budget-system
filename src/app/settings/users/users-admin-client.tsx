"use client"

import * as React from "react"
import { Loader2Icon, PencilIcon, UserPlusIcon } from "lucide-react"
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
import { ROLE_LABEL, USER_ROLE_VALUES, type UserRoleType } from "@/lib/auth/roles"
import { UserStatus } from "@/generated/prisma/enums"

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { code?: string; message: string }
}

type UserRow = {
  id: string
  email: string
  name: string
  role: UserRoleType | null
  status: UserStatus
  createdAt: string
  updatedAt: string
}

const STATUS_LABEL: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: "正常",
  [UserStatus.INACTIVE]: "停用",
}

export function UsersAdminClient() {
  const [items, setItems] = React.useState<UserRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<UserRow | null>(null)

  const [cEmail, setCEmail] = React.useState("")
  const [cName, setCName] = React.useState("")
  const [cRole, setCRole] = React.useState<UserRoleType>("VIEWER")
  const [cPassword, setCPassword] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const [eName, setEName] = React.useState("")
  const [eRole, setERole] = React.useState<UserRoleType>("VIEWER")
  const [eStatus, setEStatus] = React.useState<UserStatus>(UserStatus.ACTIVE)
  const [ePassword, setEPassword] = React.useState("")

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/users", { credentials: "include" })
      const json = (await res.json()) as
        | ApiSuccess<{ items: UserRow[] }>
        | ApiFail
      if (!json.success) {
        toast.error(json.error.message)
        setItems([])
        return
      }
      setItems(json.data.items)
    } catch {
      toast.error("加载用户列表失败")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    void load()
  }, [])

  function openEdit(row: UserRow) {
    setEditRow(row)
    setEName(row.name)
    setERole(row.role ?? "VIEWER")
    setEStatus(row.status)
    setEPassword("")
  }

  async function submitCreate() {
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cEmail,
          name: cName,
          role: cRole,
          password: cPassword,
        }),
      })
      const json = (await res.json()) as ApiSuccess<{ user: UserRow }> | ApiFail
      if (!json.success) {
        toast.error(json.error.message)
        return
      }
      toast.success("用户已创建")
      setCreateOpen(false)
      setCEmail("")
      setCName("")
      setCRole("VIEWER")
      setCPassword("")
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
      const body: Record<string, unknown> = {
        name: eName,
        role: eRole,
        status: eStatus,
      }
      if (ePassword.trim().length > 0) body.password = ePassword

      const res = await fetch(`/api/users/${editRow.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiSuccess<{ user: UserRow }> | ApiFail
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

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>说明</AlertTitle>
        <AlertDescription className="text-sm">
          仅系统管理员可管理<strong>本组织</strong>内用户；支持分配角色（编制、审批、访客等）与停用账号。新建用户须设置初始密码，用户首次登录后建议修改密码。
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlusIcon className="mr-2 size-4" />
          新建用户
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
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                    暂无用户数据
                  </TableCell>
                </TableRow>
              ) : (
                items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      {u.role ? ROLE_LABEL[u.role] : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.status === UserStatus.ACTIVE ? "secondary" : "outline"
                        }
                      >
                        {STATUS_LABEL[u.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="编辑"
                        onClick={() => openEdit(u)}
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
            <DialogTitle>新建用户</DialogTitle>
            <DialogDescription>
              用户将归属当前管理员所在组织，邮箱全局唯一。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="cu-email">邮箱</Label>
              <Input
                id="cu-email"
                type="email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-name">姓名</Label>
              <Input
                id="cu-name"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={cRole}
                onValueChange={(v) => setCRole(v as UserRoleType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLE_VALUES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-pw">初始密码（至少 8 位）</Label>
              <Input
                id="cu-pw"
                type="password"
                value={cPassword}
                onChange={(e) => setCPassword(e.target.value)}
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

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>{editRow?.email}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="eu-name">姓名</Label>
              <Input
                id="eu-name"
                value={eName}
                onChange={(e) => setEName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={eRole}
                onValueChange={(v) => setERole(v as UserRoleType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLE_VALUES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={eStatus}
                onValueChange={(v) => setEStatus(v as UserStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserStatus.ACTIVE}>正常</SelectItem>
                  <SelectItem value={UserStatus.INACTIVE}>停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eu-pw">重置密码（留空则不修改）</Label>
              <Input
                id="eu-pw"
                type="password"
                value={ePassword}
                onChange={(e) => setEPassword(e.target.value)}
              />
            </div>
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
