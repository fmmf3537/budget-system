import { Suspense } from "react"
import { Loader2Icon } from "lucide-react"

import { ApprovalDetailClient } from "./approval-detail-client"

type PageProps = { params: Promise<{ processId: string }> }

function DetailFallback() {
  return (
    <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center gap-2 text-sm">
      <Loader2Icon className="size-5 animate-spin" />
      加载…
    </div>
  )
}

export default async function ApprovalDetailPage({ params }: PageProps) {
  const { processId } = await params
  return (
    <Suspense fallback={<DetailFallback />}>
      <ApprovalDetailClient processId={processId} />
    </Suspense>
  )
}
