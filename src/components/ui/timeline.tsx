import * as React from "react"

import { cn } from "@/lib/utils"

function Timeline({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline"
      className={cn("space-y-8 border-l-2 border-border pl-8", className)}
      {...props}
    />
  )
}

function TimelineItem({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-item"
      className={cn("relative", className)}
      {...props}
    >
      <span
        className="bg-background absolute top-1 -left-[calc(2rem+5px)] size-3 rounded-full border-2 border-primary"
        aria-hidden
      />
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export { Timeline, TimelineItem }
