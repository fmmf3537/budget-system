import Link from "next/link"
import {
  Building2,
  ClipboardList,
  FileSpreadsheet,
  Layers,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const modules = [
  {
    href: "/settings/master-data/budget-subjects",
    title: "预算科目",
    description:
      "维护本组织预算科目树：编码、名称、层级、排序与启用状态；预置科目只读。",
    icon: ClipboardList,
    primary: true,
  },
  {
    href: "/settings/master-data/departments",
    title: "部门 / 成本中心",
    description:
      "预算明细部门编码主数据；与模板中的「部门列」标题对应，编制页可下拉选择。",
    icon: Building2,
    primary: true,
  },
  {
    href: "/settings/master-data/dimensions",
    title: "预算维度值",
    description: "维度 1、维度 2 的可选值字典；写入明细对应列，列名在预算模板中配置。",
    icon: Layers,
    primary: true,
  },
  {
    href: "/settings/master-data/cash-plan-categories",
    title: "资金计划类别",
    description: "流入 / 流出明细的类别主数据；计划编制页可下拉选择类别编码。",
    icon: Wallet,
    primary: true,
  },
  {
    href: "/settings/users",
    title: "用户管理",
    description: "本组织用户账号、角色与启用状态。",
    icon: Users,
    primary: false,
  },
  {
    href: "/settings/approval-flow",
    title: "审批流程",
    description: "预算/调整/资金计划等审批流配置。",
    icon: SlidersHorizontal,
    primary: false,
  },
  {
    href: "/settings/budget-template",
    title: "预算模板",
    description: "编制页维度列名、可选编制方法等模板设置。",
    icon: FileSpreadsheet,
    primary: false,
  },
] as const

export default function MasterDataHubPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">主数据与后台配置</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          集中入口：对系统中可维护的基础数据与设置进行增删改查。需具备系统设置权限（通常为管理员）。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <Card
              key={m.href}
              className={m.primary ? "border-primary/40 bg-muted/20" : ""}
            >
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
                  <Icon className="text-muted-foreground size-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <CardTitle className="text-lg">{m.title}</CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </div>
              </CardHeader>
              <CardFooter>
                <Button asChild variant={m.primary ? "default" : "outline"}>
                  <Link href={m.href}>进入管理</Link>
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
