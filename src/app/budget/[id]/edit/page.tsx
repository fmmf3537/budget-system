import { redirect } from "next/navigation"

type Props = { params: Promise<{ id: string }> }

/** 兼容旧链接：编辑已合并至 `/budget/[id]` */
export default async function BudgetEditRedirectPage({ params }: Props) {
  const { id } = await params
  redirect(`/budget/${id}`)
}
