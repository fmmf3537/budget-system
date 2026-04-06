"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderTreeIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SubjectTreeNode = {
  id: string
  code: string
  name: string
  parentId: string | null
  level: number | null
  sortOrder: number
  isActive: boolean
  organizationId: string | null
  children: SubjectTreeNode[]
}

export function buildSubjectForest(
  flat: Omit<SubjectTreeNode, "children">[]
): SubjectTreeNode[] {
  const map = new Map<string, SubjectTreeNode>()
  for (const s of flat) {
    map.set(s.id, { ...s, children: [] })
  }
  const roots: SubjectTreeNode[] = []
  for (const s of flat) {
    const n = map.get(s.id)!
    if (s.parentId && map.has(s.parentId)) {
      map.get(s.parentId)!.children.push(n)
    } else {
      roots.push(n)
    }
  }
  const sortRecursive = (nodes: SubjectTreeNode[]) => {
    nodes.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, "zh-CN")
    )
    for (const n of nodes) sortRecursive(n.children)
  }
  sortRecursive(roots)
  return roots
}

type Props = {
  forest: SubjectTreeNode[]
  onAddRoot: () => void
  onAddChild: (parent: SubjectTreeNode) => void
  onEdit: (node: SubjectTreeNode) => void
  onDelete: (node: SubjectTreeNode) => void
}

export function SubjectTree({
  forest,
  onAddRoot,
  onAddChild,
  onEdit,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const s = new Set<string>()
    const walk = (nodes: SubjectTreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) s.add(n.id)
        walk(n.children)
      }
    }
    walk(forest)
    return s
  })

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onAddRoot}>
          <PlusIcon className="size-4" />
          新增顶级科目
        </Button>
      </div>
      {forest.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-sm">
          <FolderTreeIcon className="size-8 opacity-50" />
          暂无科目，请点击「新增顶级科目」
        </div>
      ) : (
        <div className="rounded-lg border">
          {forest.map((n) => (
            <SubjectTreeRows
              key={n.id}
              node={n}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SubjectTreeRows({
  node,
  depth,
  expanded,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: SubjectTreeNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onAddChild: (n: SubjectTreeNode) => void
  onEdit: (n: SubjectTreeNode) => void
  onDelete: (n: SubjectTreeNode) => void
}) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)
  const isPreset = node.organizationId == null

  return (
    <div className="border-b last:border-b-0">
      <div
        className={cn(
          "hover:bg-muted/40 flex flex-wrap items-center gap-2 py-2 pr-2",
          "min-h-11"
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-expanded={isOpen}
            onClick={() => onToggle(node.id)}
          >
            {isOpen ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
          </Button>
        ) : (
          <span className="inline-flex w-7 shrink-0 justify-center" />
        )}
        <span className="font-mono text-muted-foreground text-xs tabular-nums">
          {node.code}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
        {!node.isActive ? (
          <Badge variant="secondary" className="shrink-0">
            停用
          </Badge>
        ) : null}
        {isPreset ? (
          <Badge variant="outline" className="shrink-0">
            系统预置
          </Badge>
        ) : null}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddChild(node)}
          >
            <PlusIcon className="size-3.5" />
            子科目
          </Button>
          {!isPreset ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(node)}
              >
                <PencilIcon className="size-3.5" />
                编辑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onDelete(node)}
              >
                <Trash2Icon className="size-3.5" />
                删除
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {hasChildren && isOpen ? (
        <div>
          {node.children.map((c) => (
            <SubjectTreeRows
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
