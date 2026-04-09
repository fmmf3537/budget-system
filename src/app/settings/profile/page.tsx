"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UserRoleType } from "@/lib/auth/roles"
import { useBudgetStore } from "@/stores/budget-store"

type MeUser = {
  id: string
  email: string
  name: string
  role: UserRoleType
  organizationId: string
}

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: {
    message: string
    details?: {
      fieldErrors?: Record<string, string[]>
    }
  }
}

export default function ProfileSettingsPage() {
  const setSessionFromServer = useBudgetStore((s) => s.setSessionFromServer)

  const [loading, setLoading] = React.useState(true)
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [savingPassword, setSavingPassword] = React.useState(false)

  const [me, setMe] = React.useState<MeUser | null>(null)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")

  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = React.useState("")

  async function loadMe() {
    setLoading(true)
    try {
      const res = await fetch("/api/users/me", { credentials: "include" })
      const json = (await res.json()) as ApiSuccess<{ user: MeUser }> | ApiFail
      if (!json.success) {
        toast.error(json.error.message)
        setMe(null)
        return
      }
      setMe(json.data.user)
      setName(json.data.user.name)
      setEmail(json.data.user.email)
    } catch {
      toast.error("加载个人信息失败")
      setMe(null)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    void loadMe()
  }, [])

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      const json = (await res.json()) as ApiSuccess<{ user: MeUser }> | ApiFail
      if (!json.success) {
        toast.error(json.error.message)
        return
      }
      setMe(json.data.user)
      setSessionFromServer({
        displayName: json.data.user.name,
        organizationId: json.data.user.organizationId,
        userId: json.data.user.id,
        role: json.data.user.role,
      })
      toast.success("个人信息已保存")
    } catch {
      toast.error("保存失败")
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    setSavingPassword(true)
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          newPasswordConfirm,
        }),
      })
      const json = (await res.json()) as ApiSuccess<{ user: MeUser }> | ApiFail
      if (!json.success) {
        const fieldErrors = json.error.details?.fieldErrors
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const firstField = Object.keys(fieldErrors)[0]
          const firstError = fieldErrors[firstField]?.[0]
          toast.error(firstError || json.error.message)
        } else {
          toast.error(json.error.message)
        }
        return
      }
      setCurrentPassword("")
      setNewPassword("")
      setNewPasswordConfirm("")
      toast.success("密码修改成功")
    } catch {
      toast.error("修改密码失败")
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center gap-2 text-sm">
        <Loader2Icon className="size-5 animate-spin" />
        加载中…
      </div>
    )
  }

  if (!me) {
    return (
      <div className="container max-w-lg py-12">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>未获取到当前用户信息，请刷新后重试。</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">个人信息</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          支持维护当前登录账号的基本信息与密码。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基础信息</CardTitle>
          <CardDescription>可修改姓名和邮箱。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="p-name">姓名</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-email">邮箱</Label>
            <Input
              id="p-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled={savingProfile} onClick={() => void saveProfile()}>
            {savingProfile ? <Loader2Icon className="size-4 animate-spin" /> : "保存基础信息"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>请先输入原密码，并两次输入新密码。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="p-current">原密码</Label>
            <Input
              id="p-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-new">新密码（至少 8 位）</Label>
            <Input
              id="p-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-new2">确认新密码</Label>
            <Input
              id="p-new2"
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled={savingPassword} onClick={() => void savePassword()}>
            {savingPassword ? <Loader2Icon className="size-4 animate-spin" /> : "修改密码"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
