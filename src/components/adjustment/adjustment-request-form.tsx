"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"

import { AdjustmentKind, ApprovalBizType } from "@/generated/prisma/enums"
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
import { Textarea } from "@/components/ui/textarea"
import { buildMockHeaders } from "@/lib/api/mock-headers"
import { useBudgetStore } from "@/stores/budget-store"

const NONE = "__none__" as const

const KIND_LABEL: Record<AdjustmentKind, string> = {
  [AdjustmentKind.INCREASE]: "追加",
  [AdjustmentKind.DECREASE]: "调减",
  [AdjustmentKind.SUBJECT_TRANSFER]: "科目调整",
  [AdjustmentKind.ROLLING]: "滚动",
}

const moneyPositive = z
  .string()
  .min(1, "请输入金额")
  .refine((s) => {
    const n = Number(s)
    return !Number.isNaN(n) && Number.isFinite(n) && n > 0
  }, "金额须为大于 0 的数字")

function normSubject(v: string) {
  return v === NONE || !v?.trim() ? null : v.trim()
}

const detailRowSchema = z.object({
  clientKey: z.string(),
  sourceSubjectId: z.string(),
  targetSubjectId: z.string(),
  sourceProject: z.string().optional(),
  targetProject: z.string().optional(),
  amount: moneyPositive,
  remark: z.string().optional(),
})

const adjustmentFormSchema = z
  .object({
    budgetHeaderId: z.string().min(1, "请选择原预算"),
    kind: z.nativeEnum(AdjustmentKind),
    title: z.string().optional(),
    reason: z.string().trim().min(1, "请填写调整原因").max(2000),
    approvalProcessId: z.string().optional(),
    details: z.array(detailRowSchema).min(1, "至少一条调整明细"),
  })
  .superRefine((data, ctx) => {
    data.details.forEach((d, i) => {
      const src = normSubject(d.sourceSubjectId)
      const tgt = normSubject(d.targetSubjectId)
      switch (data.kind) {
        case AdjustmentKind.INCREASE:
          if (!tgt) {
            ctx.addIssue({
              code: "custom",
              message: "追加时须选择新科目",
              path: ["details", i, "targetSubjectId"],
            })
          }
          break
        case AdjustmentKind.DECREASE:
          if (!src) {
            ctx.addIssue({
              code: "custom",
              message: "调减时须选择原科目",
              path: ["details", i, "sourceSubjectId"],
            })
          }
          break
        case AdjustmentKind.SUBJECT_TRANSFER:
        case AdjustmentKind.ROLLING:
          if (!src) {
            ctx.addIssue({
              code: "custom",
              message: "请选择原科目",
              path: ["details", i, "sourceSubjectId"],
            })
          }
          if (!tgt) {
            ctx.addIssue({
              code: "custom",
              message: "请选择新科目",
              path: ["details", i, "targetSubjectId"],
            })
          }
          break
        default:
          break
      }
    })
  })

type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>

type SubjectOption = { id: string; code: string; name: string; parentId: string | null }

type BudgetListItem = {
  id: string
  name: string
  fiscalYear: number
  status: string
  totalAmount: string | null
}

type ProcessItem = { id: string; name: string; bizType: string; isActive: boolean }

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { code: string; message: string }
}

type AdjustmentCreateResponse = {
  id: string
  status: string
  totalDelta: string | null
  details: unknown[]
}

function emptyDetailRow(): AdjustmentFormValues["details"][number] {
  return {
    clientKey: uuidv4(),
    sourceSubjectId: NONE,
    targetSubjectId: NONE,
    sourceProject: "",
    targetProject: "",
    amount: "",
    remark: "",
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const res = r.result
      if (typeof res !== "string") reject(new Error("读取失败"))
      else resolve(res)
    }
    r.onerror = () => reject(r.error ?? new Error("读取失败"))
    r.readAsDataURL(file)
  })
}

function SubjectSelect({
  value,
  onChange,
  subjects,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  subjects: SubjectOption[]
  disabled?: boolean
  placeholder: string
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[min(100%,12rem)]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>（无）</SelectItem>
        {subjects.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.code} {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AdjustmentRequestForm() {
  const router = useRouter()
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const [budgets, setBudgets] = React.useState<BudgetListItem[]>([])
  const [budgetsLoading, setBudgetsLoading] = React.useState(true)
  const [subjects, setSubjects] = React.useState<SubjectOption[]>([])
  const [subjectsLoading, setSubjectsLoading] = React.useState(true)
  const [processes, setProcesses] = React.useState<ProcessItem[]>([])
  const [processesLoading, setProcessesLoading] = React.useState(true)
  const [file, setFile] = React.useState<File | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: {
      budgetHeaderId: "",
      kind: AdjustmentKind.INCREASE,
      title: "",
      reason: "",
      approvalProcessId: NONE,
      details: [emptyDetailRow()],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "details",
  })

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setBudgetsLoading(true)
      try {
        const res = await fetch(
          "/api/budget?page=1&pageSize=100&sortBy=updatedAt&sortOrder=desc",
          { headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole) }
        )
        const json = (await res.json()) as
          | ApiSuccess<{ items: BudgetListItem[] }>
          | ApiFail
        if (cancelled) return
        if (!json.success) {
          toast.error(json.error?.message ?? "加载预算列表失败")
          setBudgets([])
          return
        }
        setBudgets(json.data.items)
      } catch {
        if (!cancelled) toast.error("加载预算列表失败")
      } finally {
        if (!cancelled) setBudgetsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mockOrgId, mockUserId, mockUserRole])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setSubjectsLoading(true)
      try {
        const res = await fetch("/api/budget-subjects", {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
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
    let cancelled = false
    ;(async () => {
      setProcessesLoading(true)
      try {
        const res = await fetch("/api/settings/approval-flow", {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        })
        const json = (await res.json()) as
          | ApiSuccess<{ items: ProcessItem[] }>
          | ApiFail
        if (cancelled) return
        if (!json.success) {
          setProcesses([])
          return
        }
        const filtered = json.data.items.filter(
          (p) => p.bizType === ApprovalBizType.BUDGET_ADJUSTMENT && p.isActive
        )
        setProcesses(filtered)
      } catch {
        if (!cancelled) setProcesses([])
      } finally {
        if (!cancelled) setProcessesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mockOrgId, mockUserId, mockUserRole])

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      let attachment: {
        name: string
        mime: string | null
        dataBase64: string
      } | null = null
      if (file) {
        const dataUrl = await readFileAsDataUrl(file)
        attachment = {
          name: file.name,
          mime: file.type || null,
          dataBase64: dataUrl,
        }
      }

      const approvalProcessId =
        !values.approvalProcessId ||
        values.approvalProcessId === NONE ||
        !values.approvalProcessId.trim()
          ? null
          : values.approvalProcessId.trim()

      const titleTrim = values.title?.trim()
      const body = {
        budgetHeaderId: values.budgetHeaderId.trim(),
        kind: values.kind,
        title: titleTrim ? titleTrim : null,
        reason: values.reason.trim(),
        approvalProcessId,
        attachment,
        details: values.details.map((d) => ({
          sourceSubjectId: normSubject(d.sourceSubjectId),
          targetSubjectId: normSubject(d.targetSubjectId),
          sourceProject: d.sourceProject?.trim() || null,
          targetProject: d.targetProject?.trim() || null,
          amount: d.amount.trim(),
          remark: d.remark?.trim() || null,
          budgetLineId: null,
        })),
      }

      const createRes = await fetch("/api/adjustment", {
        method: "POST",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify(body),
      })
      const createJson = (await createRes.json()) as
        | ApiSuccess<AdjustmentCreateResponse>
        | ApiFail
      if (!createJson.success) {
        toast.error(createJson.error?.message ?? "创建调整单失败")
        return
      }

      const submitRes = await fetch(
        `/api/adjustment/${createJson.data.id}/submit`,
        {
          method: "POST",
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        }
      )
      const submitJson = (await submitRes.json()) as
        | ApiSuccess<{ message: string }>
        | ApiFail
      if (!submitJson.success) {
        toast.error(
          submitJson.error?.message ??
            "调整单已保存为草稿，但提交审批失败，请稍后在列表中重试"
        )
        return
      }

      toast.success(submitJson.data.message)
      router.push("/budget")
    } catch {
      toast.error("提交失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  })

  const loadingMeta = budgetsLoading || subjectsLoading

  return (
    <div className="container max-w-5xl space-y-6 py-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/budget">← 返回预算列表</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">预算调整申请</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          选择原预算与调整类型，填写明细与原因；提交后将进入审批（若已绑定「预算调整」流程）。
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>原预算、类型与审批流程</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="budgetHeaderId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>原预算</FormLabel>
                    <Select
                      value={field.value ? field.value : NONE}
                      onValueChange={(v) =>
                        field.onChange(v === NONE ? "" : v)
                      }
                      disabled={budgetsLoading || budgets.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              budgetsLoading ? "加载中…" : "选择预算"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>请选择原预算</SelectItem>
                        {budgets.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}（{b.fiscalYear} · {b.status}）
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
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>调整类型</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        field.onChange(v as AdjustmentKind)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(KIND_LABEL) as AdjustmentKind[]).map(
                          (k) => (
                            <SelectItem key={k} value={k}>
                              {KIND_LABEL[k]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="approvalProcessId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>审批流程（可选）</FormLabel>
                    <Select
                      value={field.value || NONE}
                      onValueChange={field.onChange}
                      disabled={processesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="不绑定则仅标记已提交" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>不绑定流程</SelectItem>
                        {processes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
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
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>标题（可选）</FormLabel>
                    <FormControl>
                      <Input placeholder="简短说明本次调整" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>调整明细</CardTitle>
                <CardDescription>
                  原科目 / 项目 → 新科目 / 项目与金额（按类型校验必填项）
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append(emptyDetailRow())}
                disabled={loadingMeta}
              >
                <PlusIcon className="mr-1 size-4" />
                增行
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[10rem]">原科目</TableHead>
                    <TableHead className="min-w-[7rem]">原项目</TableHead>
                    <TableHead className="min-w-[10rem]">新科目</TableHead>
                    <TableHead className="min-w-[7rem]">新项目</TableHead>
                    <TableHead className="w-[7rem]">金额</TableHead>
                    <TableHead className="min-w-[6rem]">备注</TableHead>
                    <TableHead className="w-[4rem]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((f, index) => (
                    <TableRow key={f.id}>
                      <TableCell className="align-top">
                        <FormField
                          control={form.control}
                          name={`details.${index}.sourceSubjectId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <SubjectSelect
                                  value={field.value}
                                  onChange={field.onChange}
                                  subjects={subjects}
                                  disabled={subjectsLoading}
                                  placeholder="原科目"
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
                          name={`details.${index}.sourceProject`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="选填" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <FormField
                          control={form.control}
                          name={`details.${index}.targetSubjectId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <SubjectSelect
                                  value={field.value}
                                  onChange={field.onChange}
                                  subjects={subjects}
                                  disabled={subjectsLoading}
                                  placeholder="新科目"
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
                          name={`details.${index}.targetProject`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="选填" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <FormField
                          control={form.control}
                          name={`details.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="0.00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <FormField
                          control={form.control}
                          name={`details.${index}.remark`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="选填" {...field} />
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
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          disabled={fields.length <= 1}
                          onClick={() => remove(index)}
                          aria-label="删除行"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>原因与附件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>调整原因</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="请说明调整背景与依据"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label htmlFor="adj-attachment">附件（可选）</Label>
                <Input
                  id="adj-attachment"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setFile(f)
                  }}
                />
                {file ? (
                  <p className="text-muted-foreground text-xs">
                    已选：{file.name}（演示环境 Base64 直存，上限约 2MB）
                  </p>
                ) : null}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-6">
              <Button type="button" variant="outline" asChild>
                <Link href="/budget">取消</Link>
              </Button>
              <Button type="submit" disabled={submitting || loadingMeta}>
                {submitting ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    提交中…
                  </>
                ) : (
                  "提交审批"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  )
}
