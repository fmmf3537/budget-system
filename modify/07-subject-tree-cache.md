# 任务 07：预算科目树缓存

## 🎯 任务目标

为预算科目树添加 Redis 缓存，减少数据库查询，提升页面加载速度。

## 🔍 当前问题

预算科目树的特点：
- 读取频繁（几乎每个预算页面都要用）
- 变更稀少（通常月度/季度才调整）
- 树形结构查询需要多次 JOIN 或递归查询

当前每次请求都查询数据库，造成不必要的开销。

## ✅ 改进要求

1. **缓存策略**：
   - 使用 Redis 缓存科目树（JSON 格式）
   - 按组织分 key：`subject:tree:{orgId}`
   - TTL 设置 24 小时或更长

2. **缓存失效**：
   - 科目增删改时自动失效缓存
   - 提供手动刷新接口（管理员）

3. **降级处理**：
   - Redis 故障时自动回退到数据库查询
   - 记录警告日志

4. **缓存预热**：
   - 应用启动时预加载热门组织数据（可选）

## 📝 具体步骤

1. **创建缓存模块**（`src/lib/cache/subject-cache.ts`）：
   ```typescript
   const CACHE_KEY_PREFIX = "subject:tree"
   const CACHE_TTL = 86400  // 24小时
   
   export async function getCachedSubjectTree(
     orgId: string
   ): Promise<BudgetSubject[] | null>
   
   export async function setCachedSubjectTree(
     orgId: string, 
     subjects: BudgetSubject[]
   ): Promise<void>
   
   export async function invalidateSubjectTree(orgId: string): Promise<void>
   
   export async function getSubjectTreeWithFallback(
     orgId: string,
     fetchFromDb: () => Promise<BudgetSubject[]>
   ): Promise<BudgetSubject[]>
   ```

2. **更新查询接口**（`src/app/api/budget-subjects/route.ts`）：
   - 先查缓存，未命中再查数据库
   - 数据库查询后写入缓存

3. **添加缓存失效**：
   - 在创建科目接口后失效缓存
   - 在更新科目接口后失效缓存
   - 在删除科目接口后失效缓存

4. **创建管理接口**（`src/app/api/admin/cache/route.ts`）：
   ```typescript
   // POST /api/admin/cache/invalidate
   // Body: { type: "subject:tree", orgId: "xxx" }
   
   // GET /api/admin/cache/stats
   // 返回缓存命中率等统计信息
   ```

5. **添加监控**：
   - 记录缓存命中/未命中日志
   - 可选：集成 Prometheus 指标

## 🧪 验证方式

```bash
# 第一次请求 - 应命中数据库
# 检查 Redis：redis-cli get "subject:tree:demo-org"

# 第二次请求 - 应命中缓存
# 查看响应时间应该更快

# 修改科目 - 缓存应被清除
# 再次请求 - 应重新加载数据库
```

## 📂 相关文件

- `src/lib/cache/subject-cache.ts` - 新增
- `src/lib/redis/client.ts` - 确保已存在
- `src/app/api/budget-subjects/route.ts` - 修改
- `src/app/api/budget-subjects/[id]/route.ts` - 添加失效逻辑
- `src/app/api/admin/cache/route.ts` - 新增

## ⚠️ 注意事项

- 科目树可能较大，确保 Redis 配置支持大 value
- 考虑使用 Redis 的压缩存储（如 Snappy）
- 多环境隔离（dev/staging/prod 使用不同 Redis DB）
