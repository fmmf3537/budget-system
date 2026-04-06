import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BudgetSubjectsAdminClient } from "@/components/settings/budget-subjects-admin-client"

export default function BudgetSubjectsAdminPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">预算科目</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          对本组织科目进行新增、编辑、删除；全局预置科目不可改删。编制预算时下拉数据与此处一致。
        </p>
      </div>
      <BudgetSubjectsAdminClient />
    </div>
  )
}
