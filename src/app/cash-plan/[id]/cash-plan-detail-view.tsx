"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  FileSpreadsheetIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { CashPlanStatus } from "@/generated/prisma/enums"
import { WarningSeverity } from "@/generated/prisma/enums"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { buildMockHeaders } from "@/lib/api/mock-headers"
import type {
  CashPlanExcelRowError,
  CashPlanLineImportDto,
} from "@/lib/cash-plan/excel-cash-plan-lines"
import { useBudgetStore } from "@/stores/budget-store"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

const STATUS_LABEL: Record<string, string> = {
  [CashPlanStatus.DRAFT]: "编制中",
  [CashPlanStatus.SUBMITTED]: "已提交",
  [CashPlanStatus.APPROVED]: "已锁定",
  [CashPlanStatus.CLOSED]: "已关闭",
}

const SEVERITY_LABEL: Record<string, string> = {
  [WarningSeverity.INFO]: "信息",
  [WarningSeverity.LOW]: "低",
  [WarningSeverity.MEDIUM]: "中",
  [WarningSeverity.HIGH]: "高",
  [WarningSeverity.CRITICAL]: "严重",
}

type LineRow = {
  id: string
  category: string | null
  amount: string | null
  expectedDate: string | null
  remark: string | null
}

type PlanDetail = {
  id: string
  name: string | null
  periodStart: string
  periodEnd: string
  status: string
  openingBalance: string | null
  safetyWaterLevel: string | null
  incomes: LineRow[]
  expenses: LineRow[]
}

type ForecastPayload = {
  planPeriod: { periodStart: string; periodEnd: string }
  computed: {
    openingBalance: string
    openingBalanceSource: string
    totalInflow: string
    totalOutflow: string
    netFlow: string
    closingBalance: string
    safetyCheck: {
      safetyWaterLevel: string
      closingBalance: string
      isBelowSafety: boolean
    } | null
    note: string
  }
  storedForecasts: Array<{
    id: string
    periodStart: string
    periodEnd: string
    openingBalance: string | null
    inflowTotal: string | null
    outflowTotal: string | null
    closingBalance: string | null
    source: string | null
  }>
}

type WarningRow = {
  id: string
  severity: string
  type: string
  message: string
  isResolved: boolean
  createdAt: string
}

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { message: string }
}

function isoDateOnly(iso: string | null | undefined) {
  if (!iso) return ""
  return iso.slice(0, 10)
}

function toIsoDateEndOfDay(dateStr: string) {
  if (!dateStr) return null
  return `${dateStr}T23:59:59.999Z`
}

type CatOpt = { code: string; name: string }

const CP_CAT_NONE = "__none__"
const CP_CAT_ORPHAN = "__orphan__"

async function loadCashPlanExcelModule() {
  return import("@/lib/cash-plan/excel-cash-plan-lines")
}

function CashPlanCategorySelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: CatOpt[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  if (options.length === 0) {
    return (
      <FormControl>
        <Input placeholder="选填" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
      </FormControl>
    )
  }
  const trimmed = value ?? ""
  const inList = Boolean(trimmed && options.some((o) => o.code === trimmed))
  const selectValue =
    !trimmed ? CP_CAT_NONE : inList ? trimmed : `${CP_CAT_ORPHAN}${trimmed}`

  return (
    <Select
      disabled={disabled}
      value={selectValue}
      onValueChange={(v) => {
        if (v === CP_CAT_NONE) onChange("")
        else if (v.startsWith(CP_CAT_ORPHAN))
          onChange(v.slice(CP_CAT_ORPHAN.length))
        else onChange(v)
      }}
    >
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder="选填" />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value={CP_CAT_NONE}>（空）</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.code} value={o.code}>
            {o.code} · {o.name}
          </SelectItem>
        ))}
        {!inList && trimmed ? (
          <SelectItem value={`${CP_CAT_ORPHAN}${trimmed}`}>
            未登记：{trimmed}
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  )
}

function categoryDisplay(code: string | null, map: Map<string, string>) {
  if (!code) return "—"
  const n = map.get(code)
  return n ? `${n}（${code}）` : code
}

const lineFormSchema = z.object({
  category: z.string().max(128).optional(),
  amount: z
    .string()
    .min(1, "请输入金额")
    .refine((s) => {
      const n = Number(s)
      return !Number.isNaN(n) && Number.isFinite(n) && n >= 0
    }, "金额为有效非负数"),
  expectedDate: z.string().optional(),
  remark: z.string().max(500).optional(),
})

type LineFormValues = z.infer<typeof lineFormSchema>

const basicFormSchema = z.object({
  openingBalance: z.string().optional(),
  safetyWaterLevel: z.string().optional(),
})

type BasicFormValues = z.infer<typeof basicFormSchema>

export function CashPlanDetailView() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? ""

  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const [plan, setPlan] = React.useState<PlanDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [forecast, setForecast] = React.useState<ForecastPayload | null>(null)
  const [forecastLoading, setForecastLoading] = React.useState(false)
  const [forecastOverride, setForecastOverride] = React.useState("")
  const forecastOverrideRef = React.useRef(forecastOverride)
  forecastOverrideRef.current = forecastOverride

  const [warnings, setWarnings] = React.useState<WarningRow[]>([])
  const [warningsLoading, setWarningsLoading] = React.useState(false)

  const [lineDialog, setLineDialog] = React.useState<
    | { kind: "income"; mode: "add" }
    | { kind: "income"; mode: "edit"; row: LineRow }
    | { kind: "expense"; mode: "add" }
    | { kind: "expense"; mode: "edit"; row: LineRow }
    | null
  >(null)
  const [lineSubmitting, setLineSubmitting] = React.useState(false)

  const [basicSaving, setBasicSaving] = React.useState(false)

  const [cashExcelOpen, setCashExcelOpen] = React.useState(false)
  const [cashExcelBusy, setCashExcelBusy] = React.useState(false)
  const [cashExcelErrors, setCashExcelErrors] = React.useState<
    CashPlanExcelRowError[] | null
  >(null)
  const [cashExcelParsed, setCashExcelParsed] = React.useState<{
    income: CashPlanLineImportDto[]
    expense: CashPlanLineImportDto[]
  } | null>(null)
  const cashExcelFileRef = React.useRef<HTMLInputElement>(null)

  const [incomeCategoryOpts, setIncomeCategoryOpts] = React.useState<CatOpt[]>(
    []
  )
  const [expenseCategoryOpts, setExpenseCategoryOpts] = React.useState<CatOpt[]>(
    []
  )

  const incomeCatMap = React.useMemo(
    () => new Map(incomeCategoryOpts.map((o) => [o.code, o.name])),
    [incomeCategoryOpts]
  )
  const expenseCatMap = React.useMemo(
    () => new Map(expenseCategoryOpts.map((o) => [o.code, o.name])),
    [expenseCategoryOpts]
  )

  const basicForm = useForm<BasicFormValues>({
    resolver: zodResolver(basicFormSchema),
    defaultValues: { openingBalance: "", safetyWaterLevel: "" },
  })

  const lineForm = useForm<LineFormValues>({
    resolver: zodResolver(lineFormSchema),
    defaultValues: {
      category: "",
      amount: "",
      expectedDate: "",
      remark: "",
    },
  })

  const editable = plan?.status === CashPlanStatus.DRAFT

  const loadPlan = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cash-plan/${id}`, {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<PlanDetail> | ApiFail
      if (!json.success) {
        setError(json.error?.message ?? "加载失败")
        setPlan(null)
        return
      }
      setPlan(json.data)
      basicForm.reset({
        openingBalance: json.data.openingBalance ?? "",
        safetyWaterLevel: json.data.safetyWaterLevel ?? "",
      })
    } catch {
      setError("网络异常")
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }, [id, mockOrgId, mockUserId, mockUserRole])

  React.useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  React.useEffect(() => {
    let cancelled = false
    const headers = buildMockHeaders(mockOrgId, mockUserId, mockUserRole)
    const mapOpts = (json: unknown): CatOpt[] => {
      const j = json as
        | ApiSuccess<{ items: { code: string; name: string }[] }>
        | ApiFail
      if (!j.success) return []
      return j.data.items.map((r) => ({ code: r.code, name: r.name }))
    }
    ;(async () => {
      try {
        const [iRes, eRes] = await Promise.all([
          fetch("/api/master-data/cash-plan-categories?kind=INCOME", {
            headers,
          }),
          fetch("/api/master-data/cash-plan-categories?kind=EXPENSE", {
            headers,
          }),
        ])
        const [iJson, eJson] = await Promise.all([iRes.json(), eRes.json()])
        if (cancelled) return
        setIncomeCategoryOpts(mapOpts(iJson))
        setExpenseCategoryOpts(mapOpts(eJson))
      } catch {
        if (!cancelled) {
          setIncomeCategoryOpts([])
          setExpenseCategoryOpts([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mockOrgId, mockUserId, mockUserRole])

  const loadForecast = React.useCallback(async () => {
    if (!id) return
    setForecastLoading(true)
    try {
      const qs = new URLSearchParams()
      const o = forecastOverrideRef.current.trim()
      if (o) qs.set("openingBalance", o)
      const res = await fetch(
        `/api/cash-plan/${id}/forecast?${qs.toString()}`,
        { headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole) }
      )
      const json = (await res.json()) as ApiSuccess<ForecastPayload> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "预测加载失败")
        setForecast(null)
        return
      }
      setForecast(json.data)
    } catch {
      toast.error("预测加载失败")
      setForecast(null)
    } finally {
      setForecastLoading(false)
    }
  }, [id, mockOrgId, mockUserId, mockUserRole])

  const loadWarnings = React.useCallback(async () => {
    if (!id) return
    setWarningsLoading(true)
    try {
      const res = await fetch(
        `/api/cash-plan/${id}/warnings?page=1&pageSize=50&includeResolved=true`,
        { headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole) }
      )
      const json = (await res.json()) as
        | ApiSuccess<{ items: WarningRow[] }>
        | ApiFail
      if (!json.success) {
        setWarnings([])
        return
      }
      setWarnings(json.data.items)
    } catch {
      setWarnings([])
    } finally {
      setWarningsLoading(false)
    }
  }, [id, mockOrgId, mockUserId, mockUserRole])

  React.useEffect(() => {
    if (plan) void loadForecast()
  }, [plan, loadForecast])

  function openLineDialog(
    spec:
      | { kind: "income" | "expense"; mode: "add" }
      | {
          kind: "income" | "expense"
          mode: "edit"
          row: LineRow
        }
  ) {
    if (spec.mode === "add") {
      lineForm.reset({
        category: "",
        amount: "",
        expectedDate: "",
        remark: "",
      })
      setLineDialog({ kind: spec.kind, mode: "add" })
    } else {
      lineForm.reset({
        category: spec.row.category ?? "",
        amount: spec.row.amount ?? "",
        expectedDate: isoDateOnly(spec.row.expectedDate),
        remark: spec.row.remark ?? "",
      })
      setLineDialog({ kind: spec.kind, mode: "edit", row: spec.row })
    }
  }

  const submitLine = lineForm.handleSubmit(async (values) => {
    if (!lineDialog || !id) return
    setLineSubmitting(true)
    try {
      const body = {
        category: values.category?.trim() || null,
        amount: values.amount.trim(),
        expectedDate: values.expectedDate?.trim()
          ? toIsoDateEndOfDay(values.expectedDate.trim())
          : null,
        remark: values.remark?.trim() || null,
      }
      if (lineDialog.mode === "add") {
        const path =
          lineDialog.kind === "income"
            ? `/api/cash-plan/${id}/income`
            : `/api/cash-plan/${id}/expense`
        const res = await fetch(path, {
          method: "POST",
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
          body: JSON.stringify(body),
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error?.message ?? "保存失败")
          return
        }
        toast.success("已添加")
      } else {
        const path =
          lineDialog.kind === "income"
            ? `/api/cash-plan/${id}/income/${lineDialog.row.id}`
            : `/api/cash-plan/${id}/expense/${lineDialog.row.id}`
        const res = await fetch(path, {
          method: "PUT",
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
          body: JSON.stringify(body),
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error?.message ?? "保存失败")
          return
        }
        toast.success("已更新")
      }
      setLineDialog(null)
      await loadPlan()
      await loadForecast()
    } catch {
      toast.error("保存失败")
    } finally {
      setLineSubmitting(false)
    }
  })

  function triggerDownloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCashPlanExportExcel() {
    if (!plan) return
    setCashExcelBusy(true)
    try {
      const excel = await loadCashPlanExcelModule()
      const u8 = await excel.writeCashPlanExcelBuffer(plan.incomes, plan.expenses)
      const blob = new Blob([Uint8Array.from(u8)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const name =
        plan.name?.trim().replace(/[/\\?%*:|"<>]/g, "_") || "资金计划"
      triggerDownloadBlob(blob, `${name}_明细.xlsx`)
      toast.success("已导出")
    } catch {
      toast.error("导出失败")
    } finally {
      setCashExcelBusy(false)
    }
  }

  async function handleCashPlanTemplateDownload() {
    setCashExcelBusy(true)
    try {
      const excel = await loadCashPlanExcelModule()
      const u8 = await excel.buildEmptyCashPlanTemplateBuffer()
      const blob = new Blob([Uint8Array.from(u8)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      triggerDownloadBlob(blob, "资金计划明细模板.xlsx")
      toast.success("已下载模板")
    } catch {
      toast.error("下载模板失败")
    } finally {
      setCashExcelBusy(false)
    }
  }

  async function onCashExcelFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setCashExcelBusy(true)
    setCashExcelErrors(null)
    setCashExcelParsed(null)
    try {
      const buf = await file.arrayBuffer()
      const excel = await loadCashPlanExcelModule()
      const result = await excel.readCashPlanLinesFromExcelBuffer(buf)
      if (!result.ok) {
        setCashExcelErrors(result.errors)
        toast.error("解析失败")
        return
      }
      setCashExcelParsed({
        income: result.income,
        expense: result.expense,
      })
      toast.success(
        `已解析：流入 ${result.income.length} 行，流出 ${result.expense.length} 行`
      )
    } catch {
      toast.error("读取文件失败")
    } finally {
      setCashExcelBusy(false)
    }
  }

  function onCashExcelDialogOpenChange(open: boolean) {
    setCashExcelOpen(open)
    if (!open) {
      setCashExcelErrors(null)
      setCashExcelParsed(null)
    }
  }

  async function applyCashExcelImport() {
    if (!id || !plan || !editable || !cashExcelParsed) return
    setCashExcelBusy(true)
    try {
      const h = buildMockHeaders(mockOrgId, mockUserId, mockUserRole)
      const hj = { ...h, "Content-Type": "application/json" }

      for (const row of plan.incomes) {
        const res = await fetch(`/api/cash-plan/${id}/income/${row.id}`, {
          method: "DELETE",
          headers: h,
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error.message ?? "删除流入明细失败")
          return
        }
      }
      for (const row of plan.expenses) {
        const res = await fetch(`/api/cash-plan/${id}/expense/${row.id}`, {
          method: "DELETE",
          headers: h,
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error.message ?? "删除流出明细失败")
          return
        }
      }

      for (const line of cashExcelParsed.income) {
        const res = await fetch(`/api/cash-plan/${id}/income`, {
          method: "POST",
          headers: hj,
          body: JSON.stringify({
            category: line.category,
            amount: line.amount,
            expectedDate: line.expectedDate,
            remark: line.remark,
          }),
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error.message ?? "写入流入明细失败")
          return
        }
      }
      for (const line of cashExcelParsed.expense) {
        const res = await fetch(`/api/cash-plan/${id}/expense`, {
          method: "POST",
          headers: hj,
          body: JSON.stringify({
            category: line.category,
            amount: line.amount,
            expectedDate: line.expectedDate,
            remark: line.remark,
          }),
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error.message ?? "写入流出明细失败")
          return
        }
      }

      toast.success("已按 Excel 替换全部明细")
      onCashExcelDialogOpenChange(false)
      await loadPlan()
      await loadForecast()
    } catch {
      toast.error("导入失败")
    } finally {
      setCashExcelBusy(false)
    }
  }

  async function deleteLine(kind: "income" | "expense", row: LineRow) {
    if (!id || !editable) return
    if (!window.confirm("确定删除该明细？")) return
    try {
      const path =
        kind === "income"
          ? `/api/cash-plan/${id}/income/${row.id}`
          : `/api/cash-plan/${id}/expense/${row.id}`
      const res = await fetch(path, {
        method: "DELETE",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "删除失败")
        return
      }
      toast.success("已删除")
      await loadPlan()
      await loadForecast()
    } catch {
      toast.error("删除失败")
    }
  }

  const saveBasic = basicForm.handleSubmit(async (values) => {
    if (!id || !editable) return
    setBasicSaving(true)
    try {
      const ob = values.openingBalance?.trim()
      const sw = values.safetyWaterLevel?.trim()
      const body: Record<string, unknown> = {}
      if (ob !== undefined) {
        body.openingBalance = ob === "" ? null : ob
      }
      if (sw !== undefined) {
        body.safetyWaterLevel = sw === "" ? null : sw
      }
      if (Object.keys(body).length === 0) {
        toast.message("无变更")
        return
      }
      const res = await fetch(`/api/cash-plan/${id}`, {
        method: "PUT",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiSuccess<PlanDetail> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "保存失败")
        return
      }
      toast.success("已保存")
      setPlan(json.data)
      await loadForecast()
    } catch {
      toast.error("保存失败")
    } finally {
      setBasicSaving(false)
    }
  })

  if (!id) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>无效路由</AlertTitle>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => router.push("/cash-plan")}
          >
            ← 资金计划列表
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {plan?.name?.trim() || "资金计划详情"}
          </h1>
          {plan ? (
            <p className="text-muted-foreground mt-1 text-sm tabular-nums">
              {plan.periodStart.slice(0, 10)} ~ {plan.periodEnd.slice(0, 10)}{" "}
              ·{" "}
              <Badge variant="outline" className="ml-1 align-middle">
                {STATUS_LABEL[plan.status] ?? plan.status}
              </Badge>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadPlan()
              void loadForecast()
              void loadWarnings()
            }}
            disabled={loading}
          >
            <RefreshCwIcon className="mr-2 size-4" />
            刷新
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!plan || cashExcelBusy}
            onClick={() => void handleCashPlanExportExcel()}
          >
            <FileSpreadsheetIcon className="mr-2 size-4" />
            Excel 导出
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!plan || !editable || cashExcelBusy}
            onClick={() => setCashExcelOpen(true)}
          >
            <FileSpreadsheetIcon className="mr-2 size-4" />
            Excel 导入
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !plan ? (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          加载中…
        </div>
      ) : plan ? (
        <Tabs defaultValue="basic" className="gap-4">
          <TabsList className="flex flex-wrap h-auto min-h-10">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="inflow">资金流入</TabsTrigger>
            <TabsTrigger value="outflow">资金流出</TabsTrigger>
            <TabsTrigger value="forecast">现金流预测</TabsTrigger>
            <TabsTrigger
              value="warnings"
              onClick={() => {
                void loadWarnings()
              }}
            >
              预警
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>
                  期初余额与安全水位用于预测与风险判断；仅编制中可修改。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...basicForm}>
                  <form onSubmit={saveBasic} className="grid max-w-md gap-4">
                    <FormField
                      control={basicForm.control}
                      name="openingBalance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>期初余额</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="0.00"
                              disabled={!editable}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={basicForm.control}
                      name="safetyWaterLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>安全水位</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="低于期末余额时提示风险"
                              disabled={!editable}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {editable ? (
                      <Button type="submit" disabled={basicSaving}>
                        {basicSaving ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          "保存"
                        )}
                      </Button>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        当前状态不可编辑基本信息。
                      </p>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inflow">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle>资金流入明细</CardTitle>
                  <CardDescription>编制中可增删改</CardDescription>
                </div>
                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openLineDialog({ kind: "income", mode: "add" })}
                  >
                    <PlusIcon className="mr-1 size-4" />
                    新增
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>类别</TableHead>
                      <TableHead>预计日期</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.incomes.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground h-16 text-center"
                        >
                          暂无流入明细
                        </TableCell>
                      </TableRow>
                    ) : (
                      plan.incomes.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {categoryDisplay(row.category, incomeCatMap)}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {isoDateOnly(row.expectedDate) || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.amount ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                            {row.remark ?? "—"}
                          </TableCell>
                          <TableCell>
                            {editable ? (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    openLineDialog({
                                      kind: "income",
                                      mode: "edit",
                                      row,
                                    })
                                  }
                                  aria-label="编辑"
                                >
                                  <PencilIcon className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => void deleteLine("income", row)}
                                  aria-label="删除"
                                >
                                  <Trash2Icon className="size-4" />
                                </Button>
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outflow">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle>资金流出明细</CardTitle>
                  <CardDescription>编制中可增删改</CardDescription>
                </div>
                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      openLineDialog({ kind: "expense", mode: "add" })
                    }
                  >
                    <PlusIcon className="mr-1 size-4" />
                    新增
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>类别</TableHead>
                      <TableHead>预计日期</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.expenses.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground h-16 text-center"
                        >
                          暂无流出明细
                        </TableCell>
                      </TableRow>
                    ) : (
                      plan.expenses.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {categoryDisplay(row.category, expenseCatMap)}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {isoDateOnly(row.expectedDate) || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.amount ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                            {row.remark ?? "—"}
                          </TableCell>
                          <TableCell>
                            {editable ? (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    openLineDialog({
                                      kind: "expense",
                                      mode: "edit",
                                      row,
                                    })
                                  }
                                  aria-label="编辑"
                                >
                                  <PencilIcon className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => void deleteLine("expense", row)}
                                  aria-label="删除"
                                >
                                  <Trash2Icon className="size-4" />
                                </Button>
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forecast">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>计算参数</CardTitle>
                  <CardDescription>
                    默认使用计划保存的期初；可在此输入临时期初试算（仅影响本页展示）。
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-wrap items-end gap-2 border-t pt-6">
                  <div className="grid gap-2">
                    <Label htmlFor="fc-override">试算期初（可选）</Label>
                    <Input
                      id="fc-override"
                      placeholder="留空则按计划期初"
                      value={forecastOverride}
                      onChange={(e) => setForecastOverride(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void loadForecast()}
                    disabled={forecastLoading}
                  >
                    {forecastLoading ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      "重新计算"
                    )}
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>预测结果</CardTitle>
                  <CardDescription>
                    {forecast?.computed.note ?? "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  {forecastLoading && !forecast ? (
                    <div className="text-muted-foreground flex justify-center py-8 text-sm">
                      <Loader2Icon className="size-4 animate-spin" />
                    </div>
                  ) : forecast ? (
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="text-muted-foreground">
                            使用期初来源
                          </TableCell>
                          <TableCell className="font-medium">
                            {forecast.computed.openingBalanceSource === "query"
                              ? "试算参数"
                              : forecast.computed.openingBalanceSource === "plan"
                                ? "计划保存"
                                : "默认 0"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">
                            期初余额
                          </TableCell>
                          <TableCell className="tabular-nums font-medium">
                            {forecast.computed.openingBalance}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">
                            流入合计
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {forecast.computed.totalInflow}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">
                            流出合计
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {forecast.computed.totalOutflow}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">
                            净流量
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {forecast.computed.netFlow}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">
                            预测期末余额
                          </TableCell>
                          <TableCell className="tabular-nums text-lg font-semibold">
                            {forecast.computed.closingBalance}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground px-6 py-4 text-sm">
                      暂无数据
                    </p>
                  )}
                </CardContent>
              </Card>

              {forecast?.computed.safetyCheck ? (
                <Card
                  className={
                    forecast.computed.safetyCheck.isBelowSafety
                      ? "border-destructive/60"
                      : ""
                  }
                >
                  <CardHeader>
                    <CardTitle className="text-base">安全水位校验</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      安全水位：{" "}
                      <span className="font-medium tabular-nums">
                        {forecast.computed.safetyCheck.safetyWaterLevel}
                      </span>
                    </div>
                    <div>
                      预测期末：{" "}
                      <span className="font-medium tabular-nums">
                        {forecast.computed.safetyCheck.closingBalance}
                      </span>
                    </div>
                    {forecast.computed.safetyCheck.isBelowSafety ? (
                      <Alert variant="destructive">
                        <AlertTitle>风险</AlertTitle>
                        <AlertDescription>
                          预测期末余额低于安全水位，请关注流动性。
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <p className="text-muted-foreground">
                        预测期末不低于安全水位。
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {forecast && forecast.storedForecasts.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>历史预测记录（库内）</CardTitle>
                    <CardDescription>
                      与计划期间有交集的已存预测快照
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>期间</TableHead>
                          <TableHead className="text-right">期初</TableHead>
                          <TableHead className="text-right">流入</TableHead>
                          <TableHead className="text-right">流出</TableHead>
                          <TableHead className="text-right">期末</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecast.storedForecasts.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="text-xs tabular-nums">
                              {f.periodStart.slice(0, 10)} ~{" "}
                              {f.periodEnd.slice(0, 10)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {f.openingBalance ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {f.inflowTotal ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {f.outflowTotal ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {f.closingBalance ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="warnings">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>预警记录</CardTitle>
                  <CardDescription>
                    绑定本计划（entity）的预警；可包含已处理记录
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadWarnings()}
                  disabled={warningsLoading}
                >
                  {warningsLoading ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "刷新"
                  )}
                </Button>
              </CardHeader>
              <CardContent className="px-0">
                {forecast?.computed.safetyCheck?.isBelowSafety ? (
                  <Alert variant="destructive" className="mx-6 mb-4">
                    <AlertTitle>当前预测触发水位风险</AlertTitle>
                    <AlertDescription>
                      详见「现金流预测」页签中的安全水位校验。
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>级别</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>说明</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warnings.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground h-16 text-center"
                        >
                          {warningsLoading
                            ? "加载中…"
                            : "暂无预警记录"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      warnings.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {SEVERITY_LABEL[w.severity] ?? w.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{w.type}</TableCell>
                          <TableCell className="max-w-[280px] text-sm">
                            {w.message}
                          </TableCell>
                          <TableCell>
                            {w.isResolved ? (
                              <Badge variant="secondary">已处理</Badge>
                            ) : (
                              <Badge>待处理</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs tabular-nums">
                            {w.createdAt.slice(0, 19).replace("T", " ")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}

      <Dialog open={cashExcelOpen} onOpenChange={onCashExcelDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excel 导入</DialogTitle>
            <DialogDescription>
              文件须含两个工作表：「流入」与「流出」，首行为表头（类别编码、金额、预计日期、备注）。导入将
              <strong> 删除并重建 </strong>
              两侧全部明细行。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={cashExcelBusy}
                onClick={() => void handleCashPlanTemplateDownload()}
              >
                下载空模板
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cashExcelBusy}
                onClick={() => cashExcelFileRef.current?.click()}
              >
                选择 Excel 文件
              </Button>
              <input
                ref={cashExcelFileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => void onCashExcelFileSelected(e)}
              />
            </div>
            {cashExcelBusy ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                处理中…
              </p>
            ) : null}
            {cashExcelErrors?.length ? (
              <div className="space-y-2">
                <p className="text-destructive text-sm font-medium">
                  解析错误：
                </p>
                <ScrollArea className="h-40 rounded-md border p-2 text-sm">
                  <ul className="space-y-1 pr-3">
                    {cashExcelErrors.map((err, i) => (
                      <li key={`${err.sheet}-${err.excelRow}-${i}`}>
                        {err.sheet ? `【${err.sheet}】` : ""}
                        {err.excelRow > 0 ? `第 ${err.excelRow} 行：` : ""}
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            ) : null}
            {cashExcelParsed ? (
              <p className="text-muted-foreground text-sm">
                流入 {cashExcelParsed.income.length} 行，流出{" "}
                {cashExcelParsed.expense.length} 行。确认后将覆盖服务器上的明细。
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onCashExcelDialogOpenChange(false)}
            >
              关闭
            </Button>
            <Button
              type="button"
              disabled={cashExcelParsed === null || cashExcelBusy}
              onClick={() => void applyCashExcelImport()}
            >
              替换全部明细
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={lineDialog !== null}
        onOpenChange={(o) => {
          if (!o) setLineDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lineDialog?.mode === "add" ? "新增" : "编辑"}
              {lineDialog?.kind === "income" ? "流入" : "流出"}
            </DialogTitle>
            <DialogDescription>金额为非负数</DialogDescription>
          </DialogHeader>
          <Form {...lineForm}>
            <form onSubmit={submitLine} className="grid gap-4">
              <FormField
                control={lineForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>类别</FormLabel>
                    <CashPlanCategorySelect
                      options={
                        lineDialog?.kind === "income"
                          ? incomeCategoryOpts
                          : expenseCategoryOpts
                      }
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={!editable}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={lineForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>金额</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={lineForm.control}
                name="expectedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>预计日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={lineForm.control}
                name="remark"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="选填" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLineDialog(null)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={lineSubmitting}>
                  {lineSubmitting ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "保存"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
