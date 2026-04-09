import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { OrganizationsAdminClient } from "@/components/settings/organizations-admin-client"
import { Button } from "@/components/ui/button"

export default function SettingsOrganizationsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings/master-data">
            <ArrowLeftIcon className="mr-1 size-4" />
            主数据与后台配置
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">组织管理</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          维护本租户组织树（名称、编码、状态与上下级）。仅系统管理员可见与操作。
        </p>
      </div>
      <OrganizationsAdminClient />
    </div>
  )
}
