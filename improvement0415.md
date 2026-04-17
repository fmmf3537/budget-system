# 预算管理系统改进方案

## 一、项目概述

**技术栈**: Next.js 16.2.2 (App Router) + Prisma 7.6.0 + PostgreSQL + Radix UI + Tailwind CSS 4

**主要功能模块**:
- 预算管理（编制、提交、审批、版本控制）
- 资金计划（流入/流出管理、预测、预警）
- 预算调整（申请、审批、附件管理）
- 审批工作流（多节点、金额路由）
- 系统设置（组织、用户、科目、部门、维度等主数据管理）

---

## 二、性能优化方案

### 2.1 数据库优化

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| 缺少复合索引 | 在 `BudgetAdjustment` 表添加 `(organizationId, status, createdAt)` 复合索引（**实施前**用列表真实查询与 `EXPLAIN` / 慢查询日志验证，避免盲目加索引） | 高 |
| N+1 查询风险 | 使用 Prisma `include` 批量加载关联数据，避免循环内查询 | 高 |
| 大数据量分页 | 列表 API 从 `skip/take` 分页改为游标分页 (keyset pagination) | 中 |
| Base64 附件存储 | 生产环境改用对象存储 (S3/MinIO)，数据库只存 URL | 中 |

**索引添加参考**:
```prisma
model BudgetAdjustment {
  // ... existing fields
  @@index([organizationId, status, createdAt])
}
```

**说明**：复合索引是否「缺」应以**真实列表查询**与 PostgreSQL `EXPLAIN` / 慢查询日志为准；确认后再写迁移，避免无效索引增加写入与维护成本。

### 2.2 API 性能优化

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| 无 API 限流 | 添加 rate limiting 中间件 (如 upstash/ratelimit) | 高 |
| count 查询慢 | 对大表使用覆盖索引优化，或缓存总数 | 中 |
| 重复的 API 调用 | 引入 React Query/SWR 做客户端缓存 | 中 |

### 2.3 前端性能优化

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| Zustand 存储调试字段 | 生产环境使用 Feature Flag 或构建开关移除 mock 状态（明确「构建时剔除」或「运行时开关」，避免误伤本地演示） | 低 |
| 缺少客户端缓存 | 列表页引入 React Query 缓存策略 | 中 |

---

## 三、安全加固方案

### 3.1 认证与授权

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| 开发环境弱密钥 | 确保生产环境强制校验密钥长度，添加启动检查 | 高 |
| 权限检查分散 | 在保留各路由显式 `requireAuth` / `requireApiPermission` 的前提下，抽取**薄封装**（如共享 wrapper）减少重复；**避免**与现有细粒度权限、mock 头等冲突的「一刀切全局中间件」重复鉴权 | 中 |

### 3.2 数据安全

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| Base64 附件存储 | 改用对象存储服务，数据库只存储文件 URL | 高 |
| 无 API 限流 | 添加 rate limiting 防止恶意请求 | 高 |
| 附件大小限制 | 当前限制 2MB 较合理，但存储方案需改进 | 中 |

### 3.3 错误处理

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| 错误码不统一 | 创建统一的错误码枚举 (ErrorCode enum) | 中 |

---

## 四、代码质量改进方案

### 4.1 代码结构优化

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| 重复工具函数 | 提取 `handleRouteError`, `fromZodError` 到统一工具库 | 中 |
| 类型断言滥用 | 使用类型守卫或合理的类型收缩替代 `as` | 中 |
| 魔法字符串 | 使用 const object 或 enum 替代字符串常量 | 低 |

**示例**:
```typescript
// 当前
export const ENTITY_BUDGET_HEADER = "BudgetHeader"

// 改进
export const EntityType = {
  BUDGET_HEADER: 'BudgetHeader',
  BUDGET_ADJUSTMENT: 'BudgetAdjustment',
  CASH_PLAN: 'CashPlanHeader',
} as const;

export type EntityType = typeof EntityType[keyof typeof EntityType];
```

### 4.2 审批流程优化

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| if-else 硬编码 | 使用策略模式重构 `finalizeApproved` 处理 | 中 |

**当前代码问题**:
```typescript
// 改进前
if (entityType === 'BudgetHeader') {
  await finalizeBudgetApprovedTx(tx, entityId);
} else if (entityType === 'BudgetAdjustment') {
  await finalizeAdjustmentApprovedTx(tx, entityId);
}

// 改进后 - 策略模式
const finalizer = approvalFinalizers[entityType];
if (finalizer) {
  await finalizer(tx, entityId);
}
```

---

## 五、可扩展性改进

| 问题 | 改进方案 | 优先级 |
|------|---------|--------|
| 单体架构 | 当前规模无需调整，保持模块化即可 | 低 |
| 主数据缓存 | 科目、部门等变动频率低的数据添加 Redis 缓存（**前提**：读多写少、多实例部署或确有延迟/负载问题再上，并设计失效策略） | 中 |
| 审批流程可配置 | 将硬编码的审批完成逻辑改为插件式架构 | 中 |

---

## 六、测试覆盖

| 模块 | 当前状态 | 改进方案 | 优先级 |
|------|---------|---------|--------|
| 端到端 | 已有 **Playwright** 用例（仓库 `e2e/` 目录），覆盖部分关键用户路径 | 持续补齐关键业务路径；与下方 API 层测试互补 | 中 |
| API 路由 | **缺少**针对路由层的 **Vitest + Supertest**（或同类）集成测试；不等同于「无测试」 | 对核心写路径与鉴权路径补充 API 集成测试 | 高 |
| 审批工作流 | E2E 可能未覆盖全部分支；核心业务逻辑缺少独立单测 | 为 `approval-workflow` 等核心模块补充单元测试 | 高 |
| Prisma 查询 | 同上，查询层无独立测试 | 对热点查询或复杂事务添加查询层 / 集成测试 | 中 |

---

## 七、改进优先级汇总

### 高优先级 (立即处理)
1. 添加 API 限流中间件
2. Base64 附件存储改为对象存储
3. 添加数据库复合索引（**经慢查询 / `EXPLAIN` 验证后再迁移**）
4. 生产环境密钥校验
5. **测试**：补充 API 核心路径集成测试（Vitest + Supertest 等）与审批工作流核心业务单测（与第六节「高」一致）

### 中优先级 (近期处理)
1. 修复 N+1 查询问题
2. 统一错误码定义
3. 提取重复工具函数
4. 引入 React Query 做客户端缓存
5. 审批流程策略模式重构
6. **测试**：扩展 Playwright 覆盖范围；为 Prisma 热点查询补充测试（与第六节「中」一致）

### 低优先级 (可延后)
1. 游标分页改造
2. 主数据 Redis 缓存

---

## 八、总结

该项目架构清晰、技术栈现代化，主要改进方向集中在：

1. **安全加固**: API 限流、附件存储改造、密钥管理
2. **性能优化**: 数据库索引、N+1 查询修复、客户端缓存
3. **代码质量**: 统一错误处理、类型安全、策略模式应用

建议按优先级分批次实施，高优先级问题涉及系统稳定性需立即处理。
