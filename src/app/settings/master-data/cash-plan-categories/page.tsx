import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { CashPlanCategoriesAdminClient } from "@/components/settings/cash-plan-categories-admin-client"
import { Button } from "@/components/ui/button"

export default function MasterDataCashPlanCategoriesPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">资金计划类别</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          维护流入、流出明细的类别编码与名称，编制资金计划时可从字典选取。
        </p>
      </div>
      <CashPlanCategoriesAdminClient />
    </div>
  )
}
