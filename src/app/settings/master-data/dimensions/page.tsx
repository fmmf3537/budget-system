import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { BudgetDimensionsAdminClient } from "@/components/settings/budget-dimensions-admin-client"
import { Button } from "@/components/ui/button"

export default function MasterDataDimensionsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings/master-data">
            <ArrowLeftIcon className="mr-1 size-4" />
            主数据管理
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">预算维度值</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          维护维度 1、维度 2 的可选编码，用于编制页下拉；列显示名称在「预算模板」中配置。
        </p>
      </div>
      <BudgetDimensionsAdminClient />
    </div>
  )
}
