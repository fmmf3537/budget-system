"use client"

import * as React from "react"

import "./globals.css"

/**
 * 根布局级错误时不会挂载 Theme/I18n Provider，故使用独立样式与双语静态文案。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[budget-system:global-error]", error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center antialiased">
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            应用加载失败
            <span className="text-muted-foreground font-normal"> / Application error</span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            根布局出现异常，请尝试刷新页面。
            <br />
            The root layout failed. Please try reloading.
          </p>
        </div>
        <button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md px-6 text-sm font-medium shadow transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={() => reset()}
        >
          刷新页面 / Reload
        </button>
      </body>
    </html>
  )
}
