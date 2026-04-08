import {
  ClipboardList,
  Gavel,
  Settings2,
  SlidersHorizontal,
  Wallet,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Permission } from "@/lib/auth/permissions"
import type { PermissionKey } from "@/lib/auth/permissions"

export type MainNavItem = {
  href: string
  label: string
  icon: LucideIcon
  permission: PermissionKey
}

export type SettingsNavItem = {
  href: string
  label: string
  permission: PermissionKey
}

/** 主导航：与各业务模块根路径一致 */
export const MAIN_NAV: MainNavItem[] = [
  {
    href: "/budget",
    label: "预算编制",
    icon: ClipboardList,
    permission: Permission.BUDGET_VIEW,
  },
  {
    href: "/approval/todo",
    label: "预算审批",
    icon: Gavel,
    permission: Permission.APPROVAL_VIEW,
  },
  {
    href: "/adjustment",
    label: "预算调整",
    icon: SlidersHorizontal,
    permission: Permission.ADJUSTMENT_VIEW,
  },
  {
    href: "/cash-plan",
    label: "资金计划",
    icon: Wallet,
    permission: Permission.CASH_PLAN_VIEW,
  },
]

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    href: "/settings/profile",
    label: "个人信息",
    permission: Permission.BUDGET_VIEW,
  },
  {
    href: "/settings/master-data",
    label: "主数据管理",
    permission: Permission.SETTINGS_MANAGE,
  },
  {
    href: "/settings/users",
    label: "用户管理",
    permission: Permission.USER_MANAGE,
  },
  {
    href: "/settings/approval-flow",
    label: "审批流程",
    permission: Permission.SETTINGS_MANAGE,
  },
  {
    href: "/settings/budget-template",
    label: "预算模板",
    permission: Permission.SETTINGS_MANAGE,
  },
]

export const SETTINGS_GROUP_LABEL = "系统设置"
export const SETTINGS_ICON = Settings2

/** 首页（侧栏品牌） */
export const HOME_HREF = "/"
/** 应用简称：展示文案请用 useI18n().t("app.shortTitle") */
