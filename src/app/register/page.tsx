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

type RegisterOk = {
  success: true
  data: { message?: string }
}

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [passwordConfirm, setPasswordConfirm] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, passwordConfirm }),
      })
      const json = (await res.json()) as RegisterOk | { success: false; error?: { message?: string } }
      if (!res.ok || !json.success) {
        toast.error(
          "success" in json && json.success === false
            ? json.error?.message ?? "注册失败"
            : "注册失败"
        )
        return
      }
      toast.success(
        json.data.message ?? "注册申请已提交，请等待管理员审批后登录"
      )
      router.replace("/login")
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
            <Brand href="/register" size="lg" showFullName />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                账号注册
              </h1>
              <p className="text-muted-foreground text-sm leading-6">
                注册后默认进入待审批状态，由系统管理员审核通过后方可登录系统。
              </p>
            </div>
          </div>
        </section>

        <section className="flex w-full flex-col justify-center md:w-[420px]">
          <Card className="w-full shadow-sm">
            <CardHeader className="space-y-2">
              <div className="md:hidden">
                <Brand href="/register" size="md" showFullName />
              </div>
              <CardTitle className="text-xl">用户注册</CardTitle>
              <CardDescription>
                填写姓名、邮箱与密码。提交后需管理员审批。
              </CardDescription>
            </CardHeader>
            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">姓名</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码（至少 8 位）</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordConfirm">确认密码</Label>
                  <Input
                    id="passwordConfirm"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "提交中…" : "提交注册申请"}
                </Button>
                <Button variant="link" asChild className="text-xs">
                  <Link href="/login">返回登录</Link>
                </Button>
              </CardFooter>
            </form>
          </Card>
        </section>
      </div>
    </div>
  )
}
