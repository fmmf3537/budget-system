import { UsersAdminClient } from "./users-admin-client"

export default function SettingsUsersPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          维护本组织用户账号、角色与启用状态，与财务系统常见的「系统管理 → 用户」能力一致。
        </p>
      </div>
      <UsersAdminClient />
    </div>
  )
}
