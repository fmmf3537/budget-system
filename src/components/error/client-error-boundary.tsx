"use client"

import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type Props = React.PropsWithChildren<{
  /** 无 I18n 上下文时使用的简短说明（如类组件边界内） */
  title?: string
}>

type State = { error: Error | null; resetKey: number }

/**
 * 客户端局部错误边界：隔离图表等易抛错子树，避免整页崩溃。
 */
export class ClientErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ClientErrorBoundary]", error, info.componentStack)
  }

  private reset = () => {
    this.setState((s) => ({
      error: null,
      resetKey: s.resetKey + 1,
    }))
  }

  render() {
    if (this.state.error) {
      return (
        <Alert variant="destructive">
          <AlertTitle>{this.props.title ?? "模块渲染失败"}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span className="text-sm">可尝试重试；若持续出现请检查数据或联系管理员。</span>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={this.reset}>
                重试
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )
    }
    return (
      <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
    )
  }
}
