# 任务 03：组织数据隔离校验加固

## 🎯 任务目标

确保用户只能访问自己所属组织的数据，防止横向越权访问。

## 🔍 当前问题

文件：`src/lib/api/budget-queries.ts` 第 21-30 行

```typescript
export async function findBudgetDetail(
  id: string,
  organizationId: string
): Promise<BudgetHeaderWithLines | null> {
  const row = await prisma.budgetHeader.findFirst({
    where: { id, organizationId },
    include: { lines: budgetLinesInclude },
  })
  return row as BudgetHeaderWithLines | null
}
```

**问题**：
- 虽然查询时带上了 `organizationId`，但需要全面检查所有 API
- 某些更新操作可能未正确校验组织归属
- 没有统一的组织隔离校验中间件

## ✅ 改进要求

1. **全面审查 API 路由**：检查所有 `[id]/route.ts` 文件
2. **统一校验模式**：确保所有详情查询都包含 `organizationId` 过滤
3. **添加防御性校验**：在更新/删除前再次确认归属
4. **创建辅助函数**：提取通用的"属于本组织"校验逻辑

## 📝 具体步骤

1. **创建 `src/lib/api/org-check.ts`**：
   ```typescript
   // 通用组织归属校验函数
   export async function assertBudgetBelongsToOrg(
     budgetId: string, 
     orgId: string
   ): Promise<boolean>
   // 类似函数：assertUserBelongsToOrg, assertCashPlanBelongsToOrg 等
   ```

2. **审查并修复以下 API 路由**：
   - `src/app/api/budget/[id]/route.ts` - GET/PUT/DELETE
   - `src/app/api/adjustment/[id]/route.ts`
   - `src/app/api/cash-plan/[id]/route.ts`
   - `src/app/api/approval/[processId]/route.ts`
   - `src/app/api/budget-subjects/[id]/route.ts`
   - `src/app/api/master-data/*/route.ts` 系列

3. **检查更新操作**：
   - 确保 `prisma.xxx.update()` 的 where 条件包含 `organizationId`
   - 如果返回 `count === 0`，返回 404 或 403

4. **添加测试用例**：
   - 测试用其他组织的 ID 访问，期望返回 404/403

## 🧪 验证方式

```bash
# 运行单元测试
npm run test:unit

# 手动测试（使用 Mock 头）
# 1. 以 org A 的用户登录
# 2. 尝试访问 org B 的预算详情
# 3. 应该返回 404（不要暴露存在性，返回 404 而非 403）
```

## 📂 需要检查的文件

- `src/app/api/budget/[id]/route.ts`
- `src/app/api/adjustment/[id]/route.ts`
- `src/app/api/cash-plan/[id]/route.ts`
- `src/app/api/approval/[processId]/route.ts`
- `src/app/api/budget-subjects/[id]/route.ts`
- `src/app/api/master-data/departments/[id]/route.ts`
- `src/app/api/master-data/dimension-values/[id]/route.ts`
- `src/app/api/master-data/cash-plan-categories/[id]/route.ts`

## ⚠️ 注意事项

- 对于查询不存在的资源，返回 404（不要暴露存在性）
- 对于存在但不属于当前组织的资源，也返回 404（而非 403）
- 保持错误信息一致，不要暴露内部信息
