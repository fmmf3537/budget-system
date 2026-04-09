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
import { Can } from "@/components/auth/can"
import { Permission } from "@/lib/auth/permissions"
import { UserRole } from "@/lib/auth/roles"
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
  rootDepartmentCode: string | null
  periodStart: string
  periodEnd: string
  status: string
  openingBalance?: string | null
  safetyWaterLevel?: string | null
  approvalProcessId: string | null
  incomes: LineRow[]
  expenses: LineRow[]
}

type SubPlanDetail = {
  id: string
  parentHeaderId: string
  scopeDepartmentCode: string
  name: string | null
  status: string
  approvalProcessId: string | null
  incomes: LineRow[]
  expenses: LineRow[]
}

type SubPlanAggregate = {
  approvedSubPlanCount: number
  totalInflow: string
  totalOutflow: string
  netFlow: string
}

type SubPlanLineDraft = {
  category: string
  amount: string
  expectedDate: string
  remark: string
}

type ForecastPayload = {
  planPeriod: { periodStart: string; periodEnd: string }
  computed: {
    openingBalance: string | null
    openingBalanceSource: string
    totalInflow: string
    totalOutflow: string
    netFlow: string
    closingBalance: string | null
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

function mapLineToSubPlanDraft(line: LineRow): SubPlanLineDraft {
  return {
    category: line.category ?? "",
    amount: line.amount ?? "",
    expectedDate: isoDateOnly(line.expectedDate),
    remark: line.remark ?? "",
  }
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
  useFormControl = false,
}: {
  options: CatOpt[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  useFormControl?: boolean
}) {
  if (options.length === 0) {
    return (
      <Input
        placeholder="选填"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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
      {useFormControl ? (
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="选填" />
          </SelectTrigger>
        </FormControl>
      ) : (
        <SelectTrigger>
          <SelectValue placeholder="选填" />
        </SelectTrigger>
      )}
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
  const isAdmin = mockUserRole === UserRole.ADMIN

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
  const [subPlans, setSubPlans] = React.useState<SubPlanDetail[]>([])
  const [subPlanLoading, setSubPlanLoading] = React.useState(false)
  const [subPlanCreating, setSubPlanCreating] = React.useState(false)
  const [subPlanAgg, setSubPlanAgg] = React.useState<SubPlanAggregate | null>(null)
  const [subPlanEditOpen, setSubPlanEditOpen] = React.useState(false)
  const [subPlanSaving, setSubPlanSaving] = React.useState(false)
  const [editingSubPlan, setEditingSubPlan] = React.useState<SubPlanDetail | null>(null)
  const [subPlanViewOpen, setSubPlanViewOpen] = React.useState(false)
  const [viewingSubPlan, setViewingSubPlan] = React.useState<SubPlanDetail | null>(null)
  const [subPlanDraftName, setSubPlanDraftName] = React.useState("")
  const [subPlanDraftIncomes, setSubPlanDraftIncomes] = React.useState<
    SubPlanLineDraft[]
  >([])
  const [subPlanDraftExpenses, setSubPlanDraftExpenses] = React.useState<
    SubPlanLineDraft[]
  >([])

  const [lineDialog, setLineDialog] = React.useState<
    | { kind: "income"; mode: "add" }
    | { kind: "income"; mode: "edit"; row: LineRow }
    | { kind: "expense"; mode: "add" }
    | { kind: "expense"; mode: "edit"; row: LineRow }
    | null
  >(null)
  const [lineSubmitting, setLineSubmitting] = React.useState(false)

  const [basicSaving, setBasicSaving] = React.useState(false)

  const [submitOpen, setSubmitOpen] = React.useState(false)
  const [submitLoading, setSubmitLoading] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)
  const [withdrawLoading, setWithdrawLoading] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

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
  const [deptOpts, setDeptOpts] = React.useState<CatOpt[]>([])

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
        const [iRes, eRes, dRes] = await Promise.all([
          fetch("/api/master-data/cash-plan-categories?kind=INCOME", {
            headers,
          }),
          fetch("/api/master-data/cash-plan-categories?kind=EXPENSE", {
            headers,
          }),
          fetch("/api/master-data/departments", { headers }),
        ])
        const [iJson, eJson, dJson] = await Promise.all([
          iRes.json(),
          eRes.json(),
          dRes.json(),
        ])
        if (cancelled) return
        setIncomeCategoryOpts(mapOpts(iJson))
        setExpenseCategoryOpts(mapOpts(eJson))
        const d = dJson as
          | ApiSuccess<{ items: { code: string; name: string }[] }>
          | ApiFail
        if (d.success) {
          setDeptOpts(d.data.items.map((r) => ({ code: r.code, name: r.name })))
        } else {
          setDeptOpts([])
        }
      } catch {
        if (!cancelled) {
          setIncomeCategoryOpts([])
          setExpenseCategoryOpts([])
          setDeptOpts([])
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

  const loadSubPlans = React.useCallback(async () => {
    if (!id) return
    setSubPlanLoading(true)
    try {
      const res = await fetch(`/api/cash-plan/${id}/sub-plans`, {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as
        | ApiSuccess<{ items: SubPlanDetail[] }>
        | ApiFail
      if (!json.success) {
        setSubPlans([])
        return
      }
      setSubPlans(json.data.items)
    } catch {
      setSubPlans([])
    } finally {
      setSubPlanLoading(false)
    }
  }, [id, mockOrgId, mockUserId, mockUserRole])

  const loadSubPlanAggregate = React.useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/cash-plan/${id}/sub-plans/aggregate`, {
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<SubPlanAggregate> | ApiFail
      if (!json.success) {
        setSubPlanAgg(null)
        return
      }
      setSubPlanAgg(json.data)
    } catch {
      setSubPlanAgg(null)
    }
  }, [id, mockOrgId, mockUserId, mockUserRole])

  React.useEffect(() => {
    if (plan) void loadForecast()
  }, [plan, loadForecast])

  React.useEffect(() => {
    void loadSubPlans()
  }, [loadSubPlans])

  React.useEffect(() => {
    void loadSubPlanAggregate()
  }, [loadSubPlanAggregate])

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
      const approvedSubPlans = subPlans.filter((s) => s.status === "APPROVED")
      const approvedSubIncomes = approvedSubPlans.flatMap((s) => s.incomes)
      const approvedSubExpenses = approvedSubPlans.flatMap((s) => s.expenses)
      const exportIncomes = [...plan.incomes, ...approvedSubIncomes]
      const exportExpenses = [...plan.expenses, ...approvedSubExpenses]
      const u8 = await excel.writeCashPlanExcelBuffer(exportIncomes, exportExpenses)
      const blob = new Blob([Uint8Array.from(u8)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const name =
        plan.name?.trim().replace(/[/\\?%*:|"<>]/g, "_") || "资金计划"
      triggerDownloadBlob(blob, `${name}_明细.xlsx`)
      if (approvedSubPlans.length > 0) {
        toast.success(
          `已导出（包含主计划明细 + ${approvedSubPlans.length} 个已审批子计划明细）`
        )
      } else {
        toast.success("已导出")
      }
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

  async function postSubmitForApproval() {
    if (!id || !plan) return
    setSubmitLoading(true)
    try {
      const res = await fetch(`/api/cash-plan/${id}/submit`, {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<{
        message: string
        approval?: { created: boolean; reason?: string } | null
      }> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "提交失败")
        return
      }
      toast.success(json.data.message)
      if (json.data.approval && !json.data.approval.created && json.data.approval.reason) {
        toast.message(json.data.approval.reason)
      }
      setSubmitOpen(false)
      await loadPlan()
      void loadForecast()
      void loadWarnings()
    } catch {
      toast.error("提交失败")
    } finally {
      setSubmitLoading(false)
    }
  }

  async function postWithdrawSubmission() {
    if (!id || !plan) return
    setWithdrawLoading(true)
    try {
      const res = await fetch(`/api/cash-plan/${id}/withdraw`, {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<{ message: string }> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "撤回失败")
        return
      }
      toast.success(json.data.message)
      setWithdrawOpen(false)
      await loadPlan()
      void loadForecast()
      void loadWarnings()
    } catch {
      toast.error("撤回失败")
    } finally {
      setWithdrawLoading(false)
    }
  }

  async function postDeletePlan() {
    if (!id || !plan) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/cash-plan/${id}`, {
        method: "DELETE",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "删除失败")
        return
      }
      toast.success("已删除资金计划")
      setDeleteOpen(false)
      router.push("/cash-plan")
    } catch {
      toast.error("删除失败")
    } finally {
      setDeleteLoading(false)
    }
  }

  async function createSubPlan(deptCode: string) {
    if (!id || !deptCode) return
    setSubPlanCreating(true)
    try {
      const res = await fetch(`/api/cash-plan/${id}/sub-plans`, {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify({
          scopeDepartmentCode: deptCode,
          name: `${deptCode} 子计划`,
          incomes: [],
          expenses: [],
        }),
      })
      const json = (await res.json()) as ApiSuccess<SubPlanDetail> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "创建子计划失败")
        return
      }
      toast.success("已创建子计划")
      await loadSubPlans()
      await loadSubPlanAggregate()
    } catch {
      toast.error("创建子计划失败")
    } finally {
      setSubPlanCreating(false)
    }
  }

  async function actionSubPlan(subId: string, action: "submit" | "withdraw" | "delete") {
    const method = action === "delete" ? "DELETE" : "POST"
    const endpoint =
      action === "submit"
        ? `/api/cash-plan/sub-plan/${subId}/submit`
        : action === "withdraw"
          ? `/api/cash-plan/sub-plan/${subId}/withdraw`
          : `/api/cash-plan/sub-plan/${subId}`
    const res = await fetch(endpoint, {
      method,
      headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
    })
    const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
    if (!json.success) {
      toast.error(json.error?.message ?? "操作失败")
      return
    }
    toast.success("操作成功")
    await loadSubPlans()
    await loadSubPlanAggregate()
  }

  function openSubPlanEdit(s: SubPlanDetail) {
    setEditingSubPlan(s)
    setSubPlanDraftName(s.name?.trim() || "")
    setSubPlanDraftIncomes(s.incomes.map(mapLineToSubPlanDraft))
    setSubPlanDraftExpenses(s.expenses.map(mapLineToSubPlanDraft))
    setSubPlanEditOpen(true)
  }

  function openSubPlanView(s: SubPlanDetail) {
    setViewingSubPlan(s)
    setSubPlanViewOpen(true)
  }

  async function saveSubPlanEdit() {
    if (!editingSubPlan) return
    setSubPlanSaving(true)
    try {
      const normalize = (rows: SubPlanLineDraft[]) =>
        rows
          .map((r) => ({
            category: r.category.trim() || null,
            amount: r.amount.trim(),
            expectedDate: r.expectedDate.trim()
              ? toIsoDateEndOfDay(r.expectedDate.trim())
              : null,
            remark: r.remark.trim() || null,
          }))
          .filter((r) => r.amount !== "")
      const res = await fetch(`/api/cash-plan/sub-plan/${editingSubPlan.id}`, {
        method: "PUT",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify({
          name: subPlanDraftName.trim() || null,
          scopeDepartmentCode: editingSubPlan.scopeDepartmentCode,
          incomes: normalize(subPlanDraftIncomes),
          expenses: normalize(subPlanDraftExpenses),
        }),
      })
      const json = (await res.json()) as ApiSuccess<SubPlanDetail> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "保存子计划失败")
        return
      }
      toast.success("子计划已保存")
      setSubPlanEditOpen(false)
      setEditingSubPlan(null)
      await loadSubPlans()
      await loadSubPlanAggregate()
    } catch {
      toast.error("保存子计划失败")
    } finally {
      setSubPlanSaving(false)
    }
  }

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
              <span className="ml-2">
                范围：{plan.rootDepartmentCode ?? "全组织"}
              </span>
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
          {plan?.status === CashPlanStatus.DRAFT ? (
            <Can permission={Permission.CASH_PLAN_DELETE}>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleteLoading || loading || cashExcelBusy}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="mr-2 size-4" />
                删除计划
              </Button>
            </Can>
          ) : null}
          <Can permission={Permission.CASH_PLAN_SUBMIT}>
            <Button
              type="button"
              size="sm"
              disabled={
                !plan || plan.status !== CashPlanStatus.DRAFT || submitLoading
              }
              onClick={() => setSubmitOpen(true)}
            >
              {submitLoading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              提交审批
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !plan ||
                plan.status !== CashPlanStatus.SUBMITTED ||
                withdrawLoading
              }
              onClick={() => setWithdrawOpen(true)}
            >
              {withdrawLoading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              撤回提交
            </Button>
          </Can>
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
            <TabsTrigger value="subplans">月度子计划</TabsTrigger>
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

          <TabsContent value="subplans">
            <Card>
              <CardHeader>
                <CardTitle>月度子计划</CardTitle>
                <CardDescription>
                  子计划部门需在主计划范围内；子计划审批通过后并入主计划汇总。
                </CardDescription>
                {!isAdmin ? (
                  <p className="text-muted-foreground text-xs">
                    当前仅展示您本人发起的子计划。
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-muted-foreground">已审批子计划</div>
                    <div className="font-medium tabular-nums">
                      {subPlanAgg?.approvedSubPlanCount ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">汇总流入</div>
                    <div className="font-medium tabular-nums">
                      {subPlanAgg?.totalInflow ?? "0"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">汇总流出</div>
                    <div className="font-medium tabular-nums">
                      {subPlanAgg?.totalOutflow ?? "0"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">净流量</div>
                    <div className="font-medium tabular-nums">
                      {subPlanAgg?.netFlow ?? "0"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    onValueChange={(v) => {
                      void createSubPlan(v)
                    }}
                    disabled={!editable || subPlanCreating || deptOpts.length === 0}
                  >
                    <SelectTrigger className="w-[320px]">
                      <SelectValue placeholder="选择部门并创建子计划" />
                    </SelectTrigger>
                    <SelectContent>
                      {deptOpts.map((d) => (
                        <SelectItem key={d.code} value={d.code}>
                          {d.code} · {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {subPlanCreating ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>部门</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subPlanLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-14 text-center">
                          <Loader2Icon className="mx-auto size-4 animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : subPlans.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-muted-foreground h-14 text-center"
                        >
                          暂无子计划
                        </TableCell>
                      </TableRow>
                    ) : (
                      subPlans.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.name?.trim() || "未命名子计划"}</TableCell>
                          <TableCell>{s.scopeDepartmentCode}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{s.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSubPlanView(s)}
                              >
                                详情
                              </Button>
                              {s.status === "DRAFT" ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openSubPlanEdit(s)}
                                  >
                                    编辑
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => void actionSubPlan(s.id, "submit")}
                                  >
                                    提交
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => void actionSubPlan(s.id, "delete")}
                                  >
                                    删除
                                  </Button>
                                </>
                              ) : null}
                              {s.status === "SUBMITTED" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void actionSubPlan(s.id, "withdraw")}
                                >
                                  撤回
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inflow">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle>资金流入明细</CardTitle>
                  <CardDescription>
                    编制中可增删改（含已审批子计划汇总：{subPlanAgg?.totalInflow ?? "0"}）
                  </CardDescription>
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
              {subPlanAgg ? (
                <CardContent className="border-b py-3 text-sm">
                  <div className="text-muted-foreground">
                    已审批子计划汇总流入：
                    <span className="text-foreground ml-1 tabular-nums font-medium">
                      {subPlanAgg.totalInflow}
                    </span>
                  </div>
                </CardContent>
              ) : null}
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
                  <CardDescription>
                    编制中可增删改（含已审批子计划汇总：{subPlanAgg?.totalOutflow ?? "0"}）
                  </CardDescription>
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
              {subPlanAgg ? (
                <CardContent className="border-b py-3 text-sm">
                  <div className="text-muted-foreground">
                    已审批子计划汇总流出：
                    <span className="text-foreground ml-1 tabular-nums font-medium">
                      {subPlanAgg.totalOutflow}
                    </span>
                  </div>
                </CardContent>
              ) : null}
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除资金计划？</DialogTitle>
            <DialogDescription>
              将永久删除「{plan?.name?.trim() || "该计划"}」及其全部流入/流出明细，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteLoading}
              onClick={() => void postDeletePlan()}
            >
              {deleteLoading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认撤回提交</DialogTitle>
            <DialogDescription>
              将资金计划从「已提交」撤回到编制中，进行中的审批待办将被取消。若审批链上已有节点同意，将无法撤回。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWithdrawOpen(false)}
              disabled={withdrawLoading}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={withdrawLoading}
              onClick={() => void postWithdrawSubmission()}
            >
              {withdrawLoading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              确认撤回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认提交审批</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                将「{plan?.name?.trim() || "资金计划"}」标记为已提交。
                {plan?.approvalProcessId
                  ? " 系统将按绑定的审批流程尝试生成待办。"
                  : " 当前未绑定审批流程，提交后不会产生审批待办；可在编辑计划基本信息时绑定流程后再次从编制中提交。"}
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitOpen(false)}
              disabled={submitLoading}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={submitLoading}
              onClick={() => void postSubmitForApproval()}
            >
              {submitLoading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              确认提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        open={subPlanViewOpen}
        onOpenChange={(o) => {
          setSubPlanViewOpen(o)
          if (!o) setViewingSubPlan(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>子计划详情</DialogTitle>
            <DialogDescription>
              {viewingSubPlan?.name?.trim() || "未命名子计划"} · 部门{" "}
              {viewingSubPlan?.scopeDepartmentCode ?? "—"} · 状态{" "}
              {viewingSubPlan?.status ?? "—"}
            </DialogDescription>
          </DialogHeader>
          {viewingSubPlan ? (
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm font-medium">
                  流入明细（{viewingSubPlan.incomes.length}）
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>类别</TableHead>
                      <TableHead>预计日期</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingSubPlan.incomes.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-muted-foreground h-12 text-center"
                        >
                          无流入明细
                        </TableCell>
                      </TableRow>
                    ) : (
                      viewingSubPlan.incomes.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{categoryDisplay(r.category, incomeCatMap)}</TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {isoDateOnly(r.expectedDate) || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.amount ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[220px] truncate text-sm">
                            {r.remark ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">
                  流出明细（{viewingSubPlan.expenses.length}）
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>类别</TableHead>
                      <TableHead>预计日期</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingSubPlan.expenses.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-muted-foreground h-12 text-center"
                        >
                          无流出明细
                        </TableCell>
                      </TableRow>
                    ) : (
                      viewingSubPlan.expenses.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{categoryDisplay(r.category, expenseCatMap)}</TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {isoDateOnly(r.expectedDate) || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.amount ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[220px] truncate text-sm">
                            {r.remark ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setSubPlanViewOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={subPlanEditOpen}
        onOpenChange={(o) => {
          setSubPlanEditOpen(o)
          if (!o) setEditingSubPlan(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>编辑子计划</DialogTitle>
            <DialogDescription>
              仅草稿子计划可编辑；金额必须大于 0，日期必须在主计划期间内。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>名称</Label>
              <Input
                value={subPlanDraftName}
                onChange={(e) => setSubPlanDraftName(e.target.value)}
                placeholder="子计划名称（可选）"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>流入明细</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSubPlanDraftIncomes((prev) => [
                      ...prev,
                      { category: "", amount: "", expectedDate: "", remark: "" },
                    ])
                  }
                >
                  新增流入行
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类别</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subPlanDraftIncomes.map((r, idx) => (
                    <TableRow key={`in-${idx}`}>
                      <TableCell>
                        <CashPlanCategorySelect
                          options={incomeCategoryOpts}
                          value={r.category}
                          onChange={(v) =>
                            setSubPlanDraftIncomes((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, category: v } : x
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.amount}
                          onChange={(e) =>
                            setSubPlanDraftIncomes((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, amount: e.target.value } : x
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={r.expectedDate}
                          onChange={(e) =>
                            setSubPlanDraftIncomes((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, expectedDate: e.target.value }
                                  : x
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.remark}
                          onChange={(e) =>
                            setSubPlanDraftIncomes((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, remark: e.target.value } : x
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setSubPlanDraftIncomes((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          删
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>流出明细</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSubPlanDraftExpenses((prev) => [
                      ...prev,
                      { category: "", amount: "", expectedDate: "", remark: "" },
                    ])
                  }
                >
                  新增流出行
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类别</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subPlanDraftExpenses.map((r, idx) => (
                    <TableRow key={`out-${idx}`}>
                      <TableCell>
                        <CashPlanCategorySelect
                          options={expenseCategoryOpts}
                          value={r.category}
                          onChange={(v) =>
                            setSubPlanDraftExpenses((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, category: v } : x
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.amount}
                          onChange={(e) =>
                            setSubPlanDraftExpenses((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, amount: e.target.value } : x
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={r.expectedDate}
                          onChange={(e) =>
                            setSubPlanDraftExpenses((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, expectedDate: e.target.value }
                                  : x
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.remark}
                          onChange={(e) =>
                            setSubPlanDraftExpenses((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, remark: e.target.value } : x
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setSubPlanDraftExpenses((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          删
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubPlanEditOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={subPlanSaving}
              onClick={() => void saveSubPlanEdit()}
            >
              {subPlanSaving ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              保存
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
                      useFormControl
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
