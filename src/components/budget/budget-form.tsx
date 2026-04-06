"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  FileSpreadsheetIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"

import { BUDGET_COMPILATION_METHODS } from "@/lib/api/budget-schemas"
import { buildMockHeaders as buildMockAuthHeaders } from "@/lib/api/mock-headers"
import { computeBudgetPeriod } from "@/lib/budget/period"
import {
  BudgetCompilationGranularity,
  BudgetStatus,
} from "@/generated/prisma/enums"
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
import { useBudgetStore } from "@/stores/budget-store"

const COMPILATION_LABEL: Record<(typeof BUDGET_COMPILATION_METHODS)[number], string> =
  {
    ZERO_BASE: "零基预算",
    INCREMENTAL: "增量预算",
    ROLLING: "滚动预算",
    HYBRID: "混合编制",
  }

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已提交",
  APPROVED: "已批准",
  REJECTED: "已驳回",
  CLOSED: "已关闭",
}

const GRANULARITY_LABEL: Record<BudgetCompilationGranularity, string> = {
  ANNUAL: "年度",
  QUARTERLY: "季度",
  MONTHLY: "月度",
}

const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => 2018 + i)

const moneyString = z
  .string()
  .min(1, "请输入金额")
  .refine((s) => {
    const n = Number(s)
    return !Number.isNaN(n) && Number.isFinite(n) && n >= 0
  }, "金额为有效非负数")

const budgetFormSchema = z
  .object({
    name: z.string().trim().min(1, "请输入预算名称").max(200),
    fiscalYear: z.number().int().min(1900).max(2100),
    compilationGranularity: z.nativeEnum(BudgetCompilationGranularity),
    periodUnit: z.number().int().min(1).max(12).nullable(),
    code: z.string().trim().max(64).optional(),
    currency: z.string().trim().min(1, "请输入币种").max(8),
    compilationMethod: z
      .enum(BUDGET_COMPILATION_METHODS)
      .optional()
      .nullable(),
    lines: z.array(
      z.object({
        clientKey: z.string(),
        subjectId: z.string().min(1, "请选择科目"),
        amount: moneyString,
        amountYtd: z.string().optional(),
        remark: z.string().max(500).optional(),
        departmentCode: z.string().max(64).optional(),
        dimension1: z.string().max(128).optional(),
        dimension2: z.string().max(128).optional(),
      })
    ),
  })
  .superRefine((d, ctx) => {
    if (d.compilationGranularity === BudgetCompilationGranularity.ANNUAL) return
    if (d.periodUnit == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请选择季度或月份",
        path: ["periodUnit"],
      })
      return
    }
    if (
      d.compilationGranularity === BudgetCompilationGranularity.QUARTERLY &&
      (d.periodUnit < 1 || d.periodUnit > 4)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请选择 Q1～Q4",
        path: ["periodUnit"],
      })
    }
  })

export type BudgetFormValues = z.infer<typeof budgetFormSchema>

type SubjectOption = {
  id: string
  code: string
  name: string
  parentId: string | null
}

type BudgetDetailResponse = {
  id: string
  status: string
  version: number
  name: string
  fiscalYear: number
  compilationGranularity: BudgetCompilationGranularity
  periodUnit: number | null
  periodLabel: string
  code: string | null
  currency: string
  compilationMethod: string | null
  periodStart: string | null
  periodEnd: string | null
  totalAmount: string | null
  lines: Array<{
    id: string
    subjectId: string
    amount: string
    amountYtd: string | null
    remark: string | null
    departmentCode: string | null
    dimension1: string | null
    dimension2: string | null
    subject: { id: string; code: string; name: string } | null
  }>
}

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { code: string; message: string }
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function emptyLine(): BudgetFormValues["lines"][number] {
  return {
    clientKey: uuidv4(),
    subjectId: "",
    amount: "0",
    amountYtd: "",
    remark: "",
    departmentCode: "",
    dimension1: "",
    dimension2: "",
  }
}

export function BudgetForm({
  mode,
  budgetId,
}: {
  mode: "create" | "edit"
  budgetId?: string
}) {
  const router = useRouter()
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const [subjects, setSubjects] = React.useState<SubjectOption[]>([])
  const [subjectsLoading, setSubjectsLoading] = React.useState(true)
  const [detailLoading, setDetailLoading] = React.useState(mode === "edit")
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [serverVersion, setServerVersion] = React.useState<number | null>(null)
  const [serverStatus, setServerStatus] = React.useState<string | null>(null)
  const [serverTotal, setServerTotal] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [excelOpen, setExcelOpen] = React.useState(false)
  const [removeIndex, setRemoveIndex] = React.useState<number | null>(null)

  const resolvedIdRef = React.useRef<string | undefined>(budgetId)

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      name: "",
      fiscalYear: new Date().getFullYear(),
      compilationGranularity: BudgetCompilationGranularity.ANNUAL,
      periodUnit: null,
      code: "",
      currency: "CNY",
      compilationMethod: null,
      lines: [emptyLine()],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  })

  const watchedLines = useWatch({ control: form.control, name: "lines" })
  const watchedFiscalYear = useWatch({ control: form.control, name: "fiscalYear" })
  const watchedGranularity = useWatch({
    control: form.control,
    name: "compilationGranularity",
  })
  const watchedPeriodUnit = useWatch({ control: form.control, name: "periodUnit" })

  const periodPreview = React.useMemo(() => {
    const y = watchedFiscalYear ?? new Date().getFullYear()
    const g =
      watchedGranularity ??
      BudgetCompilationGranularity.ANNUAL
    const u = g === BudgetCompilationGranularity.ANNUAL ? null : watchedPeriodUnit
    if (g !== BudgetCompilationGranularity.ANNUAL && u == null) return null
    try {
      const { periodStart, periodEnd } = computeBudgetPeriod(y, g, u)
      return {
        start: periodStart.toISOString().slice(0, 10),
        end: periodEnd.toISOString().slice(0, 10),
      }
    } catch {
      return null
    }
  }, [watchedFiscalYear, watchedGranularity, watchedPeriodUnit])

  const lineSum = React.useMemo(() => {
    const list = watchedLines ?? []
    return list.reduce((acc, row) => acc + (Number(row?.amount) || 0), 0)
  }, [watchedLines])

  const isEditable =
    mode === "create" ||
    serverStatus === BudgetStatus.DRAFT ||
    serverStatus === BudgetStatus.REJECTED

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setSubjectsLoading(true)
      try {
        const res = await fetch("/api/budget-subjects", {
          headers: buildMockAuthHeaders(mockOrgId, mockUserId, mockUserRole),
        })
        const json = (await res.json()) as
          | ApiSuccess<{ items: SubjectOption[] }>
          | ApiFail
        if (cancelled) return
        if (!json.success) {
          toast.error(json.error?.message ?? "加载科目失败")
          setSubjects([])
          return
        }
        setSubjects(json.data.items)
      } catch {
        if (!cancelled) toast.error("加载科目失败")
      } finally {
        if (!cancelled) setSubjectsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mockOrgId, mockUserId, mockUserRole])

  React.useEffect(() => {
    if (mode !== "edit" || !budgetId) return
    let cancelled = false
    ;(async () => {
      setDetailLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/budget/${budgetId}`, {
          headers: buildMockAuthHeaders(mockOrgId, mockUserId, mockUserRole),
        })
        const json = (await res.json()) as
          | ApiSuccess<BudgetDetailResponse>
          | ApiFail
        if (cancelled) return
        if (!json.success) {
          setLoadError(json.error?.message ?? "加载预算失败")
          return
        }
        const d = json.data
        setServerVersion(d.version)
        setServerStatus(d.status)
        setServerTotal(d.totalAmount)
        resolvedIdRef.current = d.id
        form.reset({
          name: d.name,
          fiscalYear: d.fiscalYear,
          compilationGranularity: d.compilationGranularity,
          periodUnit: d.periodUnit,
          code: d.code ?? "",
          currency: d.currency,
          compilationMethod:
            d.compilationMethod &&
            (BUDGET_COMPILATION_METHODS as readonly string[]).includes(
              d.compilationMethod
            )
              ? (d.compilationMethod as BudgetFormValues["compilationMethod"])
              : null,
          lines:
            d.lines.length > 0
              ? d.lines.map((l) => ({
                  clientKey: l.id,
                  subjectId: l.subjectId,
                  amount: String(l.amount ?? "0"),
                  amountYtd: l.amountYtd ?? "",
                  remark: l.remark ?? "",
                  departmentCode: l.departmentCode ?? "",
                  dimension1: l.dimension1 ?? "",
                  dimension2: l.dimension2 ?? "",
                }))
              : [emptyLine()],
        })
      } catch {
        if (!cancelled) setLoadError("网络异常，请稍后重试")
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, budgetId, mockOrgId, mockUserId, mockUserRole, form])

  async function persistDetail(
    values: BudgetFormValues,
    targetId: string | undefined
  ): Promise<{ ok: boolean; id?: string; message?: string }> {
    const linesPayload = values.lines.map((l) => ({
      subjectId: l.subjectId,
      amount: l.amount,
      amountYtd: l.amountYtd?.trim() ? l.amountYtd : null,
      remark: l.remark?.trim() ? l.remark : null,
      departmentCode: l.departmentCode?.trim() ? l.departmentCode : null,
      dimension1: l.dimension1?.trim() ? l.dimension1 : null,
      dimension2: l.dimension2?.trim() ? l.dimension2 : null,
    }))

    const codeTrim = values.code?.trim()
    const gran = values.compilationGranularity
    const pu =
      gran === BudgetCompilationGranularity.ANNUAL ? null : values.periodUnit
    const bodyBase = {
      name: values.name.trim(),
      fiscalYear: values.fiscalYear,
      compilationGranularity: gran,
      periodUnit: pu,
      code: codeTrim ? codeTrim : null,
      currency: values.currency.trim(),
      compilationMethod: values.compilationMethod ?? null,
      lines: linesPayload,
    }

    if (!targetId) {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: buildMockAuthHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify(bodyBase),
      })
      const json = (await res.json()) as ApiSuccess<BudgetDetailResponse> | ApiFail
      if (!json.success) {
        return { ok: false, message: json.error?.message ?? "保存失败" }
      }
      return { ok: true, id: json.data.id }
    }

    const res = await fetch(`/api/budget/${targetId}`, {
      method: "PUT",
      headers: buildMockAuthHeaders(mockOrgId, mockUserId, mockUserRole),
      body: JSON.stringify(bodyBase),
    })
    const json = (await res.json()) as ApiSuccess<BudgetDetailResponse> | ApiFail
    if (!json.success) {
      return { ok: false, message: json.error?.message ?? "保存失败" }
    }
    const d = json.data
    setServerVersion(d.version)
    setServerStatus(d.status)
    setServerTotal(d.totalAmount)
    form.reset({
      name: d.name,
      fiscalYear: d.fiscalYear,
      compilationGranularity: d.compilationGranularity,
      periodUnit: d.periodUnit,
      code: d.code ?? "",
      currency: d.currency,
      compilationMethod:
        d.compilationMethod &&
        (BUDGET_COMPILATION_METHODS as readonly string[]).includes(
          d.compilationMethod
        )
          ? (d.compilationMethod as BudgetFormValues["compilationMethod"])
          : null,
      lines: d.lines.map((l) => ({
        clientKey: l.id,
        subjectId: l.subjectId,
        amount: String(l.amount ?? "0"),
        amountYtd: l.amountYtd ?? "",
        remark: l.remark ?? "",
        departmentCode: l.departmentCode ?? "",
        dimension1: l.dimension1 ?? "",
        dimension2: l.dimension2 ?? "",
      })),
    })
    return { ok: true, id: json.data.id }
  }

  const onSaveDraft = form.handleSubmit(async (values) => {
    if (!isEditable) return
    setSaving(true)
    try {
      const id = resolvedIdRef.current
      const result = await persistDetail(values, id)
      if (!result.ok) {
        toast.error(result.message ?? "保存失败")
        return
      }
      if (result.id && mode === "create") {
        resolvedIdRef.current = result.id
        toast.success("已保存草稿")
        router.replace(`/budget/${result.id}`)
        return
      }
      toast.success("已保存草稿")
    } finally {
      setSaving(false)
    }
  })

  const onSubmitApproval = form.handleSubmit(async (values) => {
    if (!isEditable) return
    setSaving(true)
    try {
      let id = resolvedIdRef.current
      const saveResult = await persistDetail(values, id)
      if (!saveResult.ok) {
        toast.error(saveResult.message ?? "保存失败")
        return
      }
      id = saveResult.id ?? id
      if (!id) {
        toast.error("缺少预算 ID")
        return
      }
      resolvedIdRef.current = id

      const subRes = await fetch(`/api/budget/${id}/submit`, {
        method: "POST",
        headers: buildMockAuthHeaders(mockOrgId, mockUserId, mockUserRole),
      })
      const subJson = (await subRes.json()) as ApiSuccess<{ message?: string }> | ApiFail
      if (!subJson.success) {
        toast.error(subJson.error?.message ?? "提交审批失败")
        return
      }
      toast.success(subJson.data?.message ?? "已提交审批")
      router.push("/budget")
    } finally {
      setSaving(false)
    }
  })

  function confirmRemove() {
    if (removeIndex === null) return
    if (fields.length <= 1) {
      form.setValue(`lines.${removeIndex}`, emptyLine())
    } else {
      remove(removeIndex)
    }
    setRemoveIndex(null)
  }

  const showInitialSpinner =
    subjectsLoading || (mode === "edit" && detailLoading)

  if (showInitialSpinner && !loadError) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center gap-2 text-sm">
        <Loader2Icon className="size-5 animate-spin" />
        加载中…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="container mx-auto max-w-lg py-10">
        <Alert variant="destructive">
          <AlertTitle>无法加载预算</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{loadError}</span>
            <Button asChild variant="outline" size="sm">
              <Link href="/budget">返回预算列表</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/budget">← 预算列表</Link>
            </Button>
            {serverStatus ? (
              <Badge variant="secondary">
                {STATUS_LABEL[serverStatus] ?? serverStatus}
              </Badge>
            ) : null}
            {serverVersion != null ? (
              <span className="text-muted-foreground text-sm">
                版本 v{serverVersion}
              </span>
            ) : mode === "create" ? (
              <span className="text-muted-foreground text-sm">
                新建 · 保存后生成版本号
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "create" ? "新建预算" : "编辑预算"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!isEditable || saving}
            onClick={() => setExcelOpen(true)}
          >
            <FileSpreadsheetIcon className="size-4" />
            Excel 导入
          </Button>
        </div>
      </div>

      {!isEditable ? (
        <Alert>
          <AlertTitle>当前为只读</AlertTitle>
          <AlertDescription>
            仅草稿或已驳回状态可编辑。您仍可查看明细与合计。
          </AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>
                预算名称、编制粒度（月/季/年）、预算年度与编制方式；系统将自动计算期间起止
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>预算名称</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：2026 年度运营预算"
                        disabled={!isEditable}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fiscalYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>预算年度</FormLabel>
                    <Select
                      disabled={!isEditable}
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number.parseInt(v, 10))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择年度" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {YEAR_OPTIONS.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y} 年
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="compilationGranularity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>编制粒度</FormLabel>
                    <Select
                      disabled={!isEditable}
                      value={field.value}
                      onValueChange={(v: BudgetCompilationGranularity) => {
                        field.onChange(v)
                        if (v === BudgetCompilationGranularity.ANNUAL) {
                          form.setValue("periodUnit", null)
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择粒度" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(
                          Object.values(BudgetCompilationGranularity) as BudgetCompilationGranularity[]
                        ).map((g) => (
                          <SelectItem key={g} value={g}>
                            {GRANULARITY_LABEL[g]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodUnit"
                render={({ field }) => {
                  const g = form.watch("compilationGranularity")
                  if (g === BudgetCompilationGranularity.ANNUAL) {
                    return (
                      <FormItem>
                        <FormLabel>期间细分</FormLabel>
                        <p className="text-muted-foreground text-sm">
                          年度编制涵盖整年，无需选择季/月
                        </p>
                      </FormItem>
                    )
                  }
                  if (g === BudgetCompilationGranularity.QUARTERLY) {
                    return (
                      <FormItem>
                        <FormLabel>季度</FormLabel>
                        <Select
                          disabled={!isEditable}
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) =>
                            field.onChange(Number.parseInt(v, 10))
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择季度" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4].map((q) => (
                              <SelectItem key={q} value={String(q)}>
                                Q{q}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )
                  }
                  return (
                    <FormItem>
                      <FormLabel>月份</FormLabel>
                      <Select
                        disabled={!isEditable}
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(v) =>
                          field.onChange(Number.parseInt(v, 10))
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择月份" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            (m) => (
                              <SelectItem key={m} value={String(m)}>
                                {m} 月
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
              <div className="grid gap-2 sm:col-span-2">
                <Label>期间预览（UTC 日历边界）</Label>
                <p className="text-muted-foreground text-sm">
                  {periodPreview
                    ? `${periodPreview.start} ～ ${periodPreview.end}`
                    : "请选择编制粒度与季度/月份"}
                </p>
              </div>
              <FormField
                control={form.control}
                name="compilationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>编制方法</FormLabel>
                    <Select
                      disabled={!isEditable}
                      value={field.value ?? "NONE"}
                      onValueChange={(v) =>
                        field.onChange(v === "NONE" ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择编制方法" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NONE">未选择</SelectItem>
                        {BUDGET_COMPILATION_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {COMPILATION_LABEL[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>预算编码（可选）</FormLabel>
                    <FormControl>
                      <Input disabled={!isEditable} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>币种</FormLabel>
                    <FormControl>
                      <Input disabled={!isEditable} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b">
              <div>
                <CardTitle>预算明细</CardTitle>
                <CardDescription>
                  按科目与组织维度（部门编码、维度字段）填报；金额列自动汇总。
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!isEditable || saving}
                onClick={() => append(emptyLine())}
              >
                <PlusIcon className="size-4" />
                新增行
              </Button>
            </CardHeader>
            <CardContent className="px-0 pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">预算科目</TableHead>
                      <TableHead className="min-w-[120px]">
                        部门编码
                      </TableHead>
                      <TableHead className="min-w-[120px]">维度1</TableHead>
                      <TableHead className="min-w-[120px]">维度2</TableHead>
                      <TableHead className="min-w-[120px] text-right">
                        金额
                      </TableHead>
                      <TableHead className="min-w-[120px] text-right">
                        累计 YTD
                      </TableHead>
                      <TableHead className="min-w-[160px]">备注</TableHead>
                      <TableHead className="w-[72px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.subjectId`}
                            render={({ field: f }) => (
                              <FormItem>
                                <Select
                                  disabled={!isEditable}
                                  value={f.value || undefined}
                                  onValueChange={f.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full min-w-[180px]">
                                      <SelectValue placeholder="选择科目" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {subjects.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.code} · {s.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.departmentCode`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    disabled={!isEditable}
                                    placeholder="组织/部门"
                                    {...f}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.dimension1`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    disabled={!isEditable}
                                    placeholder="维度1"
                                    {...f}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.dimension2`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    disabled={!isEditable}
                                    placeholder="维度2"
                                    {...f}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.amount`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    className="text-right tabular-nums"
                                    disabled={!isEditable}
                                    inputMode="decimal"
                                    {...f}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.amountYtd`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    className="text-right tabular-nums"
                                    disabled={!isEditable}
                                    inputMode="decimal"
                                    placeholder="可选"
                                    {...f}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.remark`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    disabled={!isEditable}
                                    placeholder="备注"
                                    {...f}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={!isEditable || saving}
                            aria-label="删除行"
                            onClick={() => setRemoveIndex(index)}
                          >
                            <Trash2Icon className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 border-t sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground space-y-1 text-sm">
                <div>
                  明细合计（表单）：{" "}
                  <span className="text-foreground font-medium tabular-nums">
                    {formatMoney(lineSum)} {form.watch("currency")}
                  </span>
                </div>
                {serverTotal != null ? (
                  <div>
                    已保存合计（服务器）：{" "}
                    <span className="text-foreground font-medium tabular-nums">
                      {serverTotal} {form.watch("currency")}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isEditable || saving}
                  onClick={onSaveDraft}
                >
                  {saving ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  保存草稿
                </Button>
                <Button
                  type="button"
                  disabled={!isEditable || saving}
                  onClick={onSubmitApproval}
                >
                  {saving ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  保存并提交审批
                </Button>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>

      <Dialog open={excelOpen} onOpenChange={setExcelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excel 导入</DialogTitle>
            <DialogDescription>
              该功能正在规划中：将支持下载模板、校验列映射并批量生成明细行。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setExcelOpen(false)}>
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeIndex !== null}
        onOpenChange={(o) => !o && setRemoveIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除明细行？</DialogTitle>
            <DialogDescription>
              若仅剩一行，将清空为默认空行而非删除表格结构。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveIndex(null)}
            >
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemove}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
