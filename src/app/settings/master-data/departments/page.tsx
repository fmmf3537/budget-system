import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { BudgetDepartmentsAdminClient } from "@/components/settings/budget-departments-admin-client"
import { Button } from "@/components/ui/button"

export default function MasterDataDepartmentsPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">
          部门 / 成本中心
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          维护预算明细中使用的部门或成本中心编码与名称；与预算模板中的列标题配合使用。
        </p>
      </div>
      <BudgetDepartmentsAdminClient />
    </div>
  )
}
