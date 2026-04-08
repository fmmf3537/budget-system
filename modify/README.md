# Cursor 改进提示词清单

本文件夹包含 budget-system 项目的逐步改进提示词。建议按照编号顺序执行。

## 📋 使用方式

1. 打开 Cursor，将对应 `.md` 文件的内容复制到对话中
2. Cursor 会分析当前代码并给出改进方案
3. 审查修改后提交代码
4. 进入下一个任务

## 🎯 任务清单

### 🔴 第一阶段：安全加固（必做）

| 序号 | 任务 | 文件 | 预估时间 |
|------|------|------|----------|
| 01 | Cookie Secure 标志配置 | `01-cookie-secure.md` | 30 min |
| 02 | Mock 认证生产环境禁用 | `02-mock-auth-restriction.md` | 20 min |
| 03 | 组织数据隔离校验加固 | `03-org-data-isolation.md` | 1 hour |

### 🟠 第二阶段：认证与会话（重要）

| 序号 | 任务 | 文件 | 预估时间 |
|------|------|------|----------|
| 04 | JWT 刷新令牌机制 | `04-jwt-refresh-token.md` | 2 hours |
| 05 | 会话 Redis 存储 | `05-session-redis.md` | 2 hours |

### 🟡 第三阶段：性能优化

| 序号 | 任务 | 文件 | 预估时间 |
|------|------|------|----------|
| 06 | 预算行增量更新 | `06-budget-line-incremental.md` | 1.5 hours |
| 07 | 预算科目树缓存 | `07-subject-tree-cache.md` | 1 hour |

### 🟢 第四阶段：代码质量

| 序号 | 任务 | 文件 | 预估时间 |
|------|------|------|----------|
| 08 | 统一审计日志模块 | `08-audit-log-module.md` | 2 hours |
| 09 | API 限流中间件 | `09-rate-limiting.md` | 1 hour |
| 10 | 错误监控集成 | `10-error-monitoring.md` | 1.5 hours |

### 🔵 第五阶段：工程化

| 序号 | 任务 | 文件 | 预估时间 |
|------|------|------|----------|
| 11 | Prettier 代码格式化 | `11-prettier-setup.md` | 30 min |
| 12 | Git Hooks 配置 | `12-git-hooks.md` | 30 min |

## ⚠️ 注意事项

1. **每完成一个任务后运行测试**：`npm run test:all`
2. **数据库变更需要创建新迁移**：`npx prisma migrate dev`
3. **添加新依赖后更新 lock 文件**：`npm install`
4. **生产环境配置需要环境变量配合**

## 📚 相关文档

- 项目根目录 `AGENTS.md` - Next.js 版本注意事项
- 项目根目录 `README.md` - 基础启动说明
- `.env.example` - 环境变量参考
