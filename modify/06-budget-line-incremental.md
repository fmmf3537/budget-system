# 任务 06：预算行增量更新

## 🎯 任务目标

将预算明细的全量删除重建改为增量更新，提升性能并保留历史关联。

## 🔍 当前问题

文件：`src/lib/api/budget-queries.ts` 第 66-94 行

```typescript
export async function replaceBudgetLinesInTransaction(
  tx: Prisma.TransactionClient,
  headerId: string,
  lines: BudgetLineWriteInput[]
) {
  await tx.budgetLine.deleteMany({ where: { headerId } })  // 全删！
  if (lines.length > 0) {
    await tx.budgetLine.createMany({  // 重建
      data: lines.map((l) => ({...}))
    })
  }
  // ...
}
```

**问题**：
- 每次保存都删除所有行再重建，数据库开销大
- 破坏了原有行的 ID，影响关联数据
- 没有变更追踪（不知道改了什么）

## ✅ 改进要求

1. **增量更新逻辑**：
   - 对比新旧数据，识别新增、修改、删除
   - 只操作变更的行
   - 保留未变更行的 ID

2. **变更追踪**：
   - 记录每行的变更类型（新增/修改/删除）
   - 记录变更前后金额（用于审计）

3. **批量操作优化**：
   - 使用 `createMany` 批量插入
   - 使用 `updateMany` 批量更新（如条件允许）
   - 使用 `deleteMany` 批量删除

## 📝 具体步骤

1. **创建 `src/lib/budget/budget-line-diff.ts`**：
   ```typescript
   interface LineDiff {
     toCreate: BudgetLineWriteInput[]
     toUpdate: Array<BudgetLineWriteInput & { id: string }>
     toDelete: string[]  // ids
     unchanged: Array<BudgetLineWriteInput & { id: string }>
   }
   
   export function diffBudgetLines(
     existingLines: Array<{ id: string } & BudgetLineWriteInput>,
     newLines: BudgetLineWriteInput[]
   ): LineDiff
   ```

2. **创建增量更新函数**（`src/lib/api/budget-queries.ts`）：
   ```typescript
   export async function updateBudgetLinesIncremental(
     tx: Prisma.TransactionClient,
     headerId: string,
     newLines: BudgetLineWriteInput[],
     existingLines: Array<{ id: string } & BudgetLineWriteInput>
   ): Promise<{
     created: number
     updated: number
     deleted: number
     changes: Array<{ type: string; subjectId: string; oldAmount?: number; newAmount?: number }>
   }>
   ```

3. **更新调用方**（`src/app/api/budget/[id]/route.ts`）：
   - 先查询现有明细
   - 调用增量更新
   - 返回变更摘要

4. **添加变更日志**（与审计日志模块配合）：
   - 记录哪些科目金额发生了变化
   - 可用于后续的预算调整分析

5. **优化并发控制**：
   - 添加乐观锁（使用 `version` 字段）
   - 防止并发编辑覆盖

## 🧪 验证方式

```bash
# 单元测试
npm run test:unit -- budget-line-diff

# 集成测试
# 1. 创建预算，包含 3 行明细
# 2. 修改 1 行，删除 1 行，新增 1 行
# 3. 保存后验证：
#    - 原有未修改行的 ID 保持不变
#    - 只执行了 1 次插入、1 次更新、1 次删除
#    - 总计金额正确
```

## 📂 相关文件

- `src/lib/budget/budget-line-diff.ts` - 新增
- `src/lib/api/budget-queries.ts` - 添加新函数
- `src/app/api/budget/[id]/route.ts` - 修改调用方式
- `tests/unit/budget-line-diff.test.ts` - 新增测试

## ⚠️ 注意事项

- 保持向后兼容：原 `replaceBudgetLines` 函数保留，标记为 deprecated
- 确保金额计算的精度（使用 Decimal）
- 考虑大数据量情况（1000+ 行明细）的性能
