# 任务 08：统一审计日志模块

## 🎯 任务目标

创建统一的审计日志模块，记录所有关键业务操作，支持合规审计和问题追溯。

## 🔍 当前问题

- 只有 `AdjustmentHistory` 记录了调整历史
- 预算创建、修改、删除等操作无日志
- 没有统一的用户操作追踪机制

## ✅ 改进要求

1. **统一日志模型**：
   - 用户操作日志（登录、登出、修改密码等）
   - 业务操作日志（预算 CRUD、审批操作等）
   - 数据变更日志（字段级变更追踪）

2. **日志内容**：
   - 操作人、操作时间、IP 地址
   - 操作类型、资源类型、资源 ID
   - 变更前数据、变更后数据（JSON 格式）

3. **存储策略**：
   - 近期日志：数据库存储
   - 历史日志：归档到对象存储（可选）

4. **查询接口**：
   - 按用户、时间、资源类型筛选
   - 支持导出（Excel/CSV）

## 📝 具体步骤

1. **数据库模型**（Prisma 添加）：
   ```prisma
   model AuditLog {
     id            String   @id @default(cuid())
     organizationId String
     userId        String?
     userName      String?  // 冗余存储，防止用户被删除后无法显示
     action        String   // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
     resourceType  String   // Budget, Adjustment, User, etc.
     resourceId    String?
     description   String   // 人类可读的操作描述
     oldValues     Json?    // 变更前数据
     newValues     Json?    // 变更后数据
     ipAddress     String?
     userAgent     String?
     createdAt     DateTime @default(now())
     
     organization Organization @relation(fields: [organizationId], references: [id])
     
     @@index([organizationId, createdAt])
     @@index([userId, createdAt])
     @@index([resourceType, resourceId])
     @@map("audit_log")
   }
   ```

2. **创建审计服务**（`src/lib/audit/audit-service.ts`）：
   ```typescript
   interface AuditLogEntry {
     action: string
     resourceType: string
     resourceId?: string
     description: string
     oldValues?: Record<string, unknown>
     newValues?: Record<string, unknown>
   }
   
   export class AuditService {
     async log(
       auth: MockAuthContext,
       entry: AuditLogEntry,
       request?: Request
     ): Promise<void>
     
     // 便捷方法
     async logBudgetCreated(auth: MockAuthContext, budget: BudgetHeader): Promise<void>
     async logBudgetUpdated(auth: MockAuthContext, oldData: unknown, newData: unknown): Promise<void>
     async logBudgetDeleted(auth: MockAuthContext, budgetId: string): Promise<void>
     async logLogin(auth: MockAuthContext, request: Request): Promise<void>
     async logLogout(auth: MockAuthContext): Promise<void>
   }
   ```

3. **创建差异比较工具**（`src/lib/audit/diff-util.ts`）：
   - 比较两个对象，生成变更字段列表
   - 处理敏感字段脱敏（如密码）

4. **集成到 API**：
   - `src/app/api/budget/route.ts` - 创建预算后记录日志
   - `src/app/api/budget/[id]/route.ts` - 更新/删除后记录日志
   - `src/app/api/auth/login/route.ts` - 登录成功记录日志
   - `src/app/api/auth/logout/route.ts` - 登出记录日志
   - 审批相关接口 - 审批操作记录日志

5. **创建查询 API**（`src/app/api/admin/audit-logs/route.ts`）：
   - 支持分页查询
   - 支持按用户、时间范围、操作类型筛选
   - 支持导出 CSV

6. **创建管理页面**（`src/app/admin/audit-logs/page.tsx`）：
   - 日志列表展示
   - 筛选条件面板
   - 详情弹窗（显示变更前后对比）

7. **数据迁移**：
   ```bash
   npx prisma migrate dev --name add_audit_log
   ```

## 🧪 验证方式

```bash
# 创建预算后检查 audit_log 表
npx prisma studio
# 应能看到一条 action=CREATE, resourceType=Budget 的记录

# 更新预算金额后
# 应能看到 oldValues 和 newValues 包含金额变化
```

## 📂 相关文件

- `prisma/schema.prisma` - 添加 AuditLog 模型
- `src/lib/audit/audit-service.ts` - 新增
- `src/lib/audit/diff-util.ts` - 新增
- `src/app/api/admin/audit-logs/route.ts` - 新增
- `src/app/admin/audit-logs/page.tsx` - 新增（可选）
- 各业务 API 路由 - 添加日志调用

## ⚠️ 注意事项

- 敏感数据（如密码）不要记录到日志
- 日志表增长可能很快，考虑定期归档策略
- 大量日志写入可能影响性能，考虑异步处理（消息队列）
- 保留用户名称的冗余字段，防止用户删除后显示为 null
