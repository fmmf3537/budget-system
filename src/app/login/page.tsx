"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Brand } from "@/components/brand/brand"
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
      router.replace("/budget")
      router.refresh()
    } catch {
      toast.error("网络异常")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background relative flex min-h-[calc(100vh-3.5rem)] items-stretch">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
      >
        <div className="from-primary/10 via-primary/0 to-primary/10 absolute inset-0 bg-gradient-to-br" />
        <div className="absolute inset-0 [background:radial-gradient(60%_40%_at_20%_10%,hsl(var(--primary)/0.16),transparent_60%),radial-gradient(60%_40%_at_80%_30%,hsl(var(--primary)/0.12),transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-6 px-4 py-10 md:flex-row md:items-stretch md:py-14">
        <section className="hidden w-full flex-1 flex-col justify-between rounded-2xl border bg-card/50 p-8 shadow-sm backdrop-blur md:flex">
          <div className="space-y-5">
            <Brand href="/login" size="lg" showFullName />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                预算管理平台
              </h1>
              <p className="text-muted-foreground text-sm leading-6">
                覆盖预算编制、审批流转、预算调整与资金计划，全流程可追溯。
              </p>
            </div>
          </div>
          <div className="text-muted-foreground text-xs leading-5">
            <p>建议使用现代浏览器（Chrome / Edge）以获得最佳体验。</p>
            <p>如需开通账号，请联系系统管理员。</p>
          </div>
        </section>

        <section className="flex w-full flex-col justify-center md:w-[420px]">
          <Card className="w-full shadow-sm">
            <CardHeader className="space-y-2">
              <div className="md:hidden">
                <Brand href="/login" size="md" showFullName />
              </div>
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
                  <Link href="/budget">直接进入系统</Link>
                </Button>
              </CardFooter>
            </form>
          </Card>
          <p className="text-muted-foreground mt-4 text-center text-xs leading-5">
            登录即表示你同意系统的安全与使用规范。
          </p>
        </section>
      </div>
    </div>
  )
}
