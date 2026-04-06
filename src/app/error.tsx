"use client"

import * as React from "react"
import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/contexts/i18n-context"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  React.useEffect(() => {
    console.error("[budget-system:route-error]", error)
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <Alert variant="destructive">
        <AlertTitle>{t("error.title")}</AlertTitle>
        <AlertDescription>{t("error.description")}</AlertDescription>
      </Alert>
      {process.env.NODE_ENV === "development" ? (
        <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs break-words whitespace-pre-wrap">
          {error.message}
        </pre>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          {t("error.retry")}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/">{t("error.home")}</Link>
        </Button>
      </div>
    </div>
  )
}
