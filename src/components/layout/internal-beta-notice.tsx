import { InfoIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type InternalBetaNoticeProps = {
  /** 与登录/注册顶栏一致的居中宽度 */
  variant?: "centered" | "full"
  className?: string
}

/**
 * 全站可见的内测说明：提示系统处于内测、可能存在缺陷，遇到问题请反馈管理员。
 */
export function InternalBetaNotice({
  variant = "full",
  className,
}: InternalBetaNoticeProps) {
  return (
    <div
      role="note"
      aria-label="内测说明"
      className={cn(
        "border-b border-amber-500/25 bg-amber-500/[0.08] text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-50",
        className
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2 py-2 text-xs leading-snug sm:text-sm md:items-center",
          variant === "centered" && "mx-auto max-w-6xl px-4",
          variant === "full" && "w-full px-4 md:px-6"
        )}
      >
        <InfoIcon
          className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-200"
          aria-hidden
        />
        <p className="text-pretty text-amber-900/90 dark:text-amber-100/90">
          <span className="font-medium">内测说明：</span>
          本系统目前处于内测阶段，可能存在功能异常或数据问题。若您在使用过程中遇到
          bug 或其它异常，请将现象与操作步骤向管理员反馈，以便我们尽快处理。
        </p>
      </div>
    </div>
  )
}
