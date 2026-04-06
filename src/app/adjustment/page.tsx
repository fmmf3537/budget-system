import { Suspense } from "react"
import { Loader2Icon } from "lucide-react"

import { AdjustmentListClient } from "./adjustment-list-client"

export default function AdjustmentPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center gap-2 text-sm">
          <Loader2Icon className="size-5 animate-spin" />
          加载中…
        </div>
      }
    >
      <AdjustmentListClient />
    </Suspense>
  )
}
