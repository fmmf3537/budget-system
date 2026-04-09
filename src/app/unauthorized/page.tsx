import Link from "next/link"

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

type Props = {
  searchParams?: Promise<{ from?: string }>
}

export default async function UnauthorizedPage({ searchParams }: Props) {
  const from = (await searchParams)?.from ?? ""

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>无权访问</CardTitle>
          <CardDescription>
            当前账号没有进入该页面的权限，请切换角色或联系管理员。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>路由已拦截</AlertTitle>
            <AlertDescription>
              {from ? (
                <>
                  目标路径：<code className="text-xs">{from}</code>
                </>
              ) : (
                "未指定来源路径。"
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/">返回首页</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/budget">预算列表</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/login">切换账号登录</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
