"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { BUDGET_COMPILATION_METHODS } from "@/lib/api/budget-schemas"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  type SubjectTreeNode,
  SubjectTree,
  buildSubjectForest,
} from "@/components/budget-template/subject-tree"
import { buildMockHeaders } from "@/lib/api/mock-headers"
import { useBudgetStore } from "@/stores/budget-store"

const COMPILATION_LABEL: Record<(typeof BUDGET_COMPILATION_METHODS)[number], string> =
  {
    ZERO_BASE: "零基预算",
    INCREMENTAL: "增量预算",
    ROLLING: "滚动预算",
    HYBRID: "混合编制",
  }

type ApiSuccess<T> = { success: true; data: T; error: null }
type ApiFail = {
  success: false
  data: null
  error: { message: string }
}

type SubjectRow = Omit<SubjectTreeNode, "children">

function collectDescendantIds(
  flat: SubjectRow[],
  rootId: string
): Set<string> {
  const byParent = new Map<string | null, SubjectRow[]>()
  for (const s of flat) {
    const k = s.parentId
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(s)
  }
  const out = new Set<string>()
  const walk = (id: string) => {
    const kids = byParent.get(id) ?? []
    for (const c of kids) {
      out.add(c.id)
      walk(c.id)
    }
  }
  walk(rootId)
  return out
}

function parentSelectOptions(
  forest: SubjectTreeNode[],
  excludeIds: Set<string>
): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  const walk = (nodes: SubjectTreeNode[], depth: number) => {
    for (const n of nodes) {
      if (excludeIds.has(n.id)) continue
      const pad = depth > 0 ? `${"\u3000".repeat(depth)}` : ""
      out.push({ value: n.id, label: `${pad}${n.code} · ${n.name}` })
      walk(n.children, depth + 1)
    }
  }
  walk(forest, 0)
  return out
}

type TemplateState = {
  departmentFieldLabel: string | null
  dimension1Label: string | null
  dimension2Label: string | null
  enabledCompilationMethods: (typeof BUDGET_COMPILATION_METHODS)[number][]
}

export default function BudgetTemplateSettingsPage() {
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [subjects, setSubjects] = React.useState<SubjectRow[]>([])
  const [tpl, setTpl] = React.useState<TemplateState>({
    departmentFieldLabel: null,
    dimension1Label: null,
    dimension2Label: null,
    enabledCompilationMethods: [...BUDGET_COMPILATION_METHODS],
  })
  const [savingTpl, setSavingTpl] = React.useState(false)

  const forest = React.useMemo(() => buildSubjectForest(subjects), [subjects])

  const reload = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [subRes, setRes] = await Promise.all([
        fetch("/api/budget-subjects?manage=1", {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        }),
        fetch("/api/settings/budget-template", {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        }),
      ])
      const subJson = (await subRes.json()) as ApiSuccess<{ items: SubjectRow[] }> | ApiFail
      const setJson = (await setRes.json()) as ApiSuccess<TemplateState> | ApiFail
      if (!subJson.success) {
        setError(subJson.error?.message ?? "加载科目失败")
        return
      }
      if (!setJson.success) {
        setError(setJson.error?.message ?? "加载模板设置失败")
        return
      }
      setSubjects(subJson.data.items)
      setTpl({
        departmentFieldLabel: setJson.data.departmentFieldLabel,
        dimension1Label: setJson.data.dimension1Label,
        dimension2Label: setJson.data.dimension2Label,
        enabledCompilationMethods: [...setJson.data.enabledCompilationMethods],
      })
    } catch {
      setError("网络异常，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [mockOrgId, mockUserId, mockUserRole])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const [subjectDialog, setSubjectDialog] = React.useState<
    | { mode: "create"; parentId: string | null }
    | {
        mode: "edit"
        row: SubjectRow
      }
    | null
  >(null)

  const [deleteTarget, setDeleteTarget] = React.useState<SubjectRow | null>(
    null
  )

  const [dCode, setDCode] = React.useState("")
  const [dName, setDName] = React.useState("")
  const [dParent, setDParent] = React.useState<string | "ROOT">("ROOT")
  const [dSort, setDSort] = React.useState("0")
  const [dActive, setDActive] = React.useState(true)
  const [dSaving, setDSaving] = React.useState(false)

  const excludeParentIds = React.useMemo(() => {
    if (!subjectDialog || subjectDialog.mode !== "edit") return new Set<string>()
    const ex = collectDescendantIds(subjects, subjectDialog.row.id)
    ex.add(subjectDialog.row.id)
    return ex
  }, [subjectDialog, subjects])

  const parentOptions = React.useMemo(() => {
    return parentSelectOptions(forest, excludeParentIds)
  }, [forest, excludeParentIds])

  React.useEffect(() => {
    if (!subjectDialog) return
    if (subjectDialog.mode === "create") {
      setDCode("")
      setDName("")
      setDParent(subjectDialog.parentId ?? "ROOT")
      setDSort("0")
      setDActive(true)
      return
    }
    const r = subjectDialog.row
    setDCode(r.code)
    setDName(r.name)
    setDParent(r.parentId ?? "ROOT")
    setDSort(String(r.sortOrder))
    setDActive(r.isActive)
  }, [subjectDialog])

  async function saveSubjectDialog() {
    const code = dCode.trim()
    const name = dName.trim()
    if (!code || !name) {
      toast.error("请填写编码与名称")
      return
    }
    const sortOrder = Number.parseInt(dSort, 10)
    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      toast.error("排序号无效")
      return
    }
    const parentId = dParent === "ROOT" ? null : dParent

    setDSaving(true)
    try {
      if (subjectDialog?.mode === "create") {
        const res = await fetch("/api/budget-subjects", {
          method: "POST",
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
          body: JSON.stringify({
            code,
            name,
            parentId,
            sortOrder,
          }),
        })
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error?.message ?? "创建失败")
          return
        }
        toast.success("已新增科目")
      } else if (subjectDialog?.mode === "edit") {
        const res = await fetch(
          `/api/budget-subjects/${subjectDialog.row.id}`,
          {
            method: "PUT",
            headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
            body: JSON.stringify({
              code,
              name,
              parentId,
              sortOrder,
              isActive: dActive,
            }),
          }
        )
        const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
        if (!json.success) {
          toast.error(json.error?.message ?? "保存失败")
          return
        }
        toast.success("已保存")
      }
      setSubjectDialog(null)
      await reload()
    } finally {
      setDSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const res = await fetch(`/api/budget-subjects/${deleteTarget.id}`, {
      method: "DELETE",
      headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
    })
    const json = (await res.json()) as ApiSuccess<unknown> | ApiFail
    if (!json.success) {
      toast.error(json.error?.message ?? "删除失败")
      return
    }
    toast.success("已删除")
    setDeleteTarget(null)
    await reload()
  }

  async function saveTemplate() {
    if (tpl.enabledCompilationMethods.length === 0) {
      toast.error("至少启用一种编制方法")
      return
    }
    setSavingTpl(true)
    try {
      const res = await fetch("/api/settings/budget-template", {
        method: "PUT",
        headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        body: JSON.stringify({
          departmentFieldLabel: tpl.departmentFieldLabel?.trim() || null,
          dimension1Label: tpl.dimension1Label?.trim() || null,
          dimension2Label: tpl.dimension2Label?.trim() || null,
          enabledCompilationMethods: tpl.enabledCompilationMethods,
        }),
      })
      const json = (await res.json()) as ApiSuccess<TemplateState> | ApiFail
      if (!json.success) {
        toast.error(json.error?.message ?? "保存失败")
        return
      }
      setTpl({
        departmentFieldLabel: json.data.departmentFieldLabel,
        dimension1Label: json.data.dimension1Label,
        dimension2Label: json.data.dimension2Label,
        enabledCompilationMethods: [...json.data.enabledCompilationMethods],
      })
      toast.success("模板设置已保存")
    } finally {
      setSavingTpl(false)
    }
  }

  function toggleMethod(m: (typeof BUDGET_COMPILATION_METHODS)[number]) {
    setTpl((s) => {
      const has = s.enabledCompilationMethods.includes(m)
      if (has && s.enabledCompilationMethods.length <= 1) {
        toast.error("至少保留一种编制方法")
        return s
      }
      return {
        ...s,
        enabledCompilationMethods: has
          ? s.enabledCompilationMethods.filter((x) => x !== m)
          : [...s.enabledCompilationMethods, m],
      }
    })
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center gap-2 text-sm">
        <Loader2Icon className="size-5 animate-spin" />
        加载配置…
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-lg py-12">
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            {error}
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/budget">← 返回预算列表</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            预算模板配置
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            维护预算科目树、组织维度列名，以及编制页可选的编制方法。
          </p>
        </div>
      </div>

      <Tabs defaultValue="subjects" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="subjects">预算科目</TabsTrigger>
          <TabsTrigger value="dimensions">组织维度</TabsTrigger>
          <TabsTrigger value="methods">编制方法</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>预算科目树</CardTitle>
              <CardDescription>
                支持多级科目；系统预置科目仅可查看或在其下新增本组织子科目。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubjectTree
                forest={forest}
                onAddRoot={() =>
                  setSubjectDialog({ mode: "create", parentId: null })
                }
                onAddChild={(parent) =>
                  setSubjectDialog({ mode: "create", parentId: parent.id })
                }
                onEdit={(node) => {
                  const { children: _ch, ...row } = node
                  setSubjectDialog({ mode: "edit", row })
                }}
                onDelete={(node) => {
                  const { children: _ch, ...row } = node
                  setDeleteTarget(row)
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dimensions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>组织维度</CardTitle>
              <CardDescription>
                将用于预算明细表头展示（与「部门编码」「维度1」「维度2」列对应）。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:max-w-md">
              <div className="grid gap-2">
                <Label htmlFor="lbl-dept">部门 / 组织编码列名</Label>
                <Input
                  id="lbl-dept"
                  placeholder="默认：部门编码"
                  value={tpl.departmentFieldLabel ?? ""}
                  onChange={(e) =>
                    setTpl((s) => ({
                      ...s,
                      departmentFieldLabel: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lbl-d1">维度 1 列名</Label>
                <Input
                  id="lbl-d1"
                  placeholder="例如：成本中心"
                  value={tpl.dimension1Label ?? ""}
                  onChange={(e) =>
                    setTpl((s) => ({
                      ...s,
                      dimension1Label: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lbl-d2">维度 2 列名</Label>
                <Input
                  id="lbl-d2"
                  placeholder="例如：产品线"
                  value={tpl.dimension2Label ?? ""}
                  onChange={(e) =>
                    setTpl((s) => ({
                      ...s,
                      dimension2Label: e.target.value || null,
                    }))
                  }
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                disabled={savingTpl}
                onClick={() => void saveTemplate()}
              >
                {savingTpl ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                保存维度与编制设置
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>编制方法</CardTitle>
              <CardDescription>
                勾选后，预算编制页「编制方法」下拉仅显示已启用的选项。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {BUDGET_COMPILATION_METHODS.map((m) => (
                <label
                  key={m}
                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="border-input size-4 rounded border"
                    checked={tpl.enabledCompilationMethods.includes(m)}
                    onChange={() => toggleMethod(m)}
                  />
                  <div>
                    <div className="font-medium">{COMPILATION_LABEL[m]}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {m}
                    </div>
                  </div>
                </label>
              ))}
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                disabled={savingTpl}
                onClick={() => void saveTemplate()}
              >
                {savingTpl ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                保存维度与编制设置
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={subjectDialog !== null}
        onOpenChange={(o) => !o && setSubjectDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {subjectDialog?.mode === "edit" ? "编辑科目" : "新增科目"}
            </DialogTitle>
            <DialogDescription>
              编码在同一组织内需唯一；上级可选择系统预置或本组织科目。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>上级科目</Label>
              <Select
                value={dParent}
                onValueChange={(v) => setDParent(v as string | "ROOT")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择上级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROOT">（顶级）</SelectItem>
                  {parentOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-code">科目编码</Label>
              <Input
                id="sub-code"
                value={dCode}
                onChange={(e) => setDCode(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-name">科目名称</Label>
              <Input
                id="sub-name"
                value={dName}
                onChange={(e) => setDName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-sort">排序号</Label>
              <Input
                id="sub-sort"
                type="number"
                min={0}
                value={dSort}
                onChange={(e) => setDSort(e.target.value)}
              />
            </div>
            {subjectDialog?.mode === "edit" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="border-input size-4 rounded border"
                  checked={dActive}
                  onChange={(e) => setDActive(e.target.checked)}
                />
                启用
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubjectDialog(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={dSaving}
              onClick={() => void saveSubjectDialog()}
            >
              {dSaving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除科目？</DialogTitle>
            <DialogDescription>
              将删除「{deleteTarget?.code} · {deleteTarget?.name}
              」。若存在子科目或已被预算引用，操作将失败。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
