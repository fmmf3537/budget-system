"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  Loader2Icon,
  RefreshCwIcon,
  WalletIcon,
} from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { WarningSeverity } from "@/generated/prisma/enums"
import { ClientErrorBoundary } from "@/components/error/client-error-boundary"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buildMockHeaders } from "@/lib/api/mock-headers"
import { UserRole } from "@/lib/auth/roles"
import { useBudgetStore } from "@/stores/budget-store"

const SEVERITY_LABEL: Record<string, string> = {
  [WarningSeverity.INFO]: "信息",
  [WarningSeverity.LOW]: "低",
  [WarningSeverity.MEDIUM]: "中",
  [WarningSeverity.HIGH]: "高",
  [WarningSeverity.CRITICAL]: "严重",
}

type Overview = {
  periodYear: number
  periodMonth: number
  periodStart: string
  periodEnd: string
  inflowTotal: string
  outflowTotal: string
  netInflow: string
  baseBalanceUsed: string
  estimatedClosing: string
  note: string
}

type TrendPoint = {
  key: string
  label: string
  inflow: string
  outflow: string
  net: string
}

type WarningRow = {
  id: string
  severity: string
  type: string
  message: string
  createdAt: string
}

type LargeRow = {
  id: string
  direction: "inflow" | "outflow"
  amount: string
  category: string | null
  expectedDate: string | null
  remark: string | null
  planId: string
  planName: string | null
}

type DashboardPayload = {
  overview: Overview
  trendMonths: TrendPoint[]
  warnings: WarningRow[]
  largeItems: LargeRow[]
}

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { message: string }
}

function fmtMoney(s: string) {
  const n = Number(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function CashFlowDashboardPage() {
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)
  const canViewDashboard = mockUserRole === UserRole.ADMIN

  const now = new Date()
  const [year, setYear] = React.useState(now.getUTCFullYear())
  const [month, setMonth] = React.useState(now.getUTCMonth() + 1)
  const [trendN, setTrendN] = React.useState(6)
  const [baseBalance, setBaseBalance] = React.useState("0")
  const [largeMin, setLargeMin] = React.useState("50000")

  const [data, setData] = React.useState<DashboardPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        periodYear: String(year),
        periodMonth: String(month),
        trendMonths: String(trendN),
        largeAmountMin: largeMin.trim() || "0",
      })
      if (baseBalance.trim() !== "") {
        qs.set("baseBalance", baseBalance.trim())
      }
      const res = await fetch(`/api/cash-plan/dashboard?${qs}`, {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<DashboardPayload> | ApiFail
      if (!json.success) {
        setError(json.error?.message ?? "加载失败")
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError("网络异常")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [mockOrgId, mockUserId, mockUserRole, year, month, trendN, baseBalance, largeMin])

  React.useEffect(() => {
    void load()
  }, [load])

  const chartData = React.useMemo(() => {
    if (!data) return []
    return data.trendMonths.map((r) => ({
      ...r,
      inflowN: Number(r.inflow),
      outflowN: Number(r.outflow),
      netN: Number(r.net),
    }))
  }, [data])

  if (!canViewDashboard) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <Alert variant="destructive">
          <AlertTitle>无权限访问</AlertTitle>
          <AlertDescription>现金流看板仅管理员可查看。</AlertDescription>
        </Alert>
        <div>
          <Button asChild variant="outline">
            <Link href="/cash-plan">返回资金计划</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/cash-plan">← 资金计划列表</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">现金流看板</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            数据来自{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              GET /api/cash-plan/dashboard
            </code>
            ；概览与趋势均按明细「预计日期」汇总（无预计日期的行不计入）。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="mr-2 size-4" />
          )}
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">参数</CardTitle>
          <CardDescription>调整概览月份、趋势月数、余额基数与大额阈值</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 pt-4">
          <div className="grid gap-2">
            <Label htmlFor="dash-year">年</Label>
            <Input
              id="dash-year"
              type="number"
              className="w-28"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dash-month">月</Label>
            <Input
              id="dash-month"
              type="number"
              min={1}
              max={12}
              className="w-24"
              value={month}
              onChange={(e) =>
                setMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dash-trend">未来月数</Label>
            <Input
              id="dash-trend"
              type="number"
              min={2}
              max={24}
              className="w-24"
              value={trendN}
              onChange={(e) =>
                setTrendN(Math.min(24, Math.max(2, Number(e.target.value) || 6)))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dash-base">期初基数（估算期末）</Label>
            <Input
              id="dash-base"
              placeholder="0"
              className="w-36"
              value={baseBalance}
              onChange={(e) => setBaseBalance(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dash-large">大额下限</Label>
            <Input
              id="dash-large"
              className="w-36"
              value={largeMin}
              onChange={(e) => setLargeMin(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !data ? (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          加载中…
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">本期流入</CardTitle>
                <ArrowDownRightIcon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtMoney(data.overview.inflowTotal)}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {data.overview.periodYear} 年 {data.overview.periodMonth} 月
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">本期流出</CardTitle>
                <ArrowUpRightIcon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  {fmtMoney(data.overview.outflowTotal)}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  同上统计口径
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">净流入</CardTitle>
                <WalletIcon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    Number(data.overview.netInflow) >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {fmtMoney(data.overview.netInflow)}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  流入 − 流出
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">估算期末余额</CardTitle>
                <WalletIcon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {fmtMoney(data.overview.estimatedClosing)}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  基数 {fmtMoney(data.overview.baseBalanceUsed)} + 净流入
                </p>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <AlertTitle>统计说明</AlertTitle>
            <AlertDescription>{data.overview.note}</AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>未来 {trendN} 月趋势</CardTitle>
              <CardDescription>
                自 {data.overview.periodYear} 年 {data.overview.periodMonth} 月
                的次月起，按预计日期汇总（单位与列表一致）
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] w-full pt-2">
              <ClientErrorBoundary title="趋势图渲染失败">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      width={56}
                    />
                    <Tooltip
                      formatter={(value) => {
                        if (value == null) return ""
                        const n =
                          typeof value === "number" ? value : Number(value)
                        return Number.isFinite(n)
                          ? n.toLocaleString("zh-CN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : String(value)
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="inflowN"
                      name="流入"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="outflowN"
                      name="流出"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="netN"
                      name="净额"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      strokeDasharray="4 4"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ClientErrorBoundary>
            </CardContent>
            <CardFooter className="text-muted-foreground text-xs">
              使用 Recharts 折线图；可在上方调整「未来月数」。
            </CardFooter>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>预警信息</CardTitle>
                <CardDescription>本组织未处理预警</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>级别</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.warnings.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-muted-foreground h-16 text-center text-sm"
                        >
                          暂无未处理预警
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.warnings.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {SEVERITY_LABEL[w.severity] ?? w.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{w.type}</TableCell>
                          <TableCell className="max-w-[220px] text-sm">
                            {w.message}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs tabular-nums">
                            {w.createdAt.slice(0, 10)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>大额收支</CardTitle>
                <CardDescription>
                  金额 ≥ 设定下限的流入/流出明细（按金额降序）
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>方向</TableHead>
                      <TableHead>金额</TableHead>
                      <TableHead>类别</TableHead>
                      <TableHead>预计日</TableHead>
                      <TableHead>计划</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.largeItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground h-16 text-center text-sm"
                        >
                          暂无达到阈值的明细
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.largeItems.map((r) => (
                        <TableRow key={`${r.direction}-${r.id}`}>
                          <TableCell>
                            <Badge
                              variant={
                                r.direction === "inflow" ? "default" : "secondary"
                              }
                            >
                              {r.direction === "inflow" ? "流入" : "流出"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {fmtMoney(r.amount)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.category ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs tabular-nums">
                            {r.expectedDate?.slice(0, 10) ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Link
                              href={`/cash-plan/${r.planId}`}
                              className="text-primary hover:underline"
                            >
                              {r.planName?.trim() || "未命名"}
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
