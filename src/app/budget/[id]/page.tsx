"use client"

import { useParams } from "next/navigation"

import { BudgetForm } from "@/components/budget/budget-form"

export default function BudgetEditPage() {
  const params = useParams()
  const raw = params?.id
  const id = typeof raw === "string" ? raw : raw?.[0]

  if (!id) {
    return (
      <div className="text-muted-foreground container py-10 text-sm">
        无效的预算 ID
      </div>
    )
  }

  return <BudgetForm mode="edit" budgetId={id} />
}
