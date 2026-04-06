"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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

type LoginOk = {
  success: true
  data: {
    user: {
      id: string
      email: string
      name: string
      role: UserRoleType
      organizationId: string
    }
  }
}

export default function LoginPage() {
  const router = useRouter()
  const setSessionFromServer = useBudgetStore((s) => s.setSessionFromServer)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      const json = (await res.json()) as LoginOk | { success: false; error?: { message?: string } }
      if (!res.ok || !json.success) {
        toast.error(
          "success" in json && json.success === false
            ? (json as { error?: { message?: string } }).error?.message ??
                "登录失败"
            : "登录失败"
        )
        return
      }
      const u = json.data.user
      setSessionFromServer({
        displayName: u.name,
        organizationId: u.organizationId,
        userId: u.id,
        role: u.role,
      })
      toast.success("登录成功")
      router.replace("/")
      router.refresh()
    } catch {
      toast.error("网络异常")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">用户登录</CardTitle>
          <CardDescription>
            请输入企业账号邮箱与密码。种子数据默认密码为{" "}
            <span className="text-foreground font-medium">ChangeMe123!</span>
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中…" : "登录"}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              未开放注册，用户由系统管理员在「用户管理」中维护。
            </p>
            <Button variant="link" asChild className="text-xs">
              <Link href="/">返回首页</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
