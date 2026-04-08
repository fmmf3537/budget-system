# 任务 05：会话 Redis 存储

## 🎯 任务目标

将用户会话存储从纯 JWT 改为 JWT + Redis 白名单模式，支持服务端主动踢出用户。

## 🔍 当前问题

当前使用纯 JWT，服务端无法：
- 主动登出（踢出）用户
- 查看当前在线用户
- 强制所有用户重新登录（如安全事件）

## ✅ 改进要求

1. **Redis 集成**：
   - 添加 ioredis 依赖
   - 配置 Redis 连接
   - 支持本地开发和生产环境配置

2. **会话白名单**：
   - 登录时：JWT + Redis 存储会话信息
   - 验证时：先验 JWT，再查 Redis 是否存在
   - 登出时：从 Redis 删除会话

3. **会话管理功能**：
   - 查看用户所有会话
   - 单设备登出
   - 全平台登出

4. **会话信息**：
   - 用户 ID
   - 登录时间
   - 最后活跃时间
   - IP 地址
   - User-Agent（设备信息）

## 📝 具体步骤

1. **添加依赖**：
   ```bash
   npm install ioredis
   npm install -D @types/ioredis
   ```

2. **创建 Redis 客户端**（`src/lib/redis/client.ts`）：
   - 配置连接参数（从环境变量读取）
   - 连接池管理
   - 错误处理和重连逻辑

3. **创建会话存储**（`src/lib/auth/session-store.ts`）：
   ```typescript
   interface SessionData {
     userId: string
     organizationId: string
     role: string
     createdAt: string
     lastActiveAt: string
     ip: string
     userAgent: string
   }
   
   export async function createSession(
     sessionId: string, 
     data: SessionData, 
     ttl: number
   ): Promise<void>
   
   export async function getSession(sessionId: string): Promise<SessionData | null>
   
   export async function deleteSession(sessionId: string): Promise<void>
   
   export async function getUserSessions(userId: string): Promise<SessionData[]>
   
   export async function deleteAllUserSessions(userId: string): Promise<void>
   ```

4. **更新会话管理**（`src/lib/auth/session.ts`）：
   - 修改 `createSessionToken` 为 `createSession`
   - JWT 中包含 `sid`（session ID）
   - 验证时先验 JWT，再用 `sid` 查 Redis

5. **更新登录接口**：
   - 生成 session ID
   - 存储会话到 Redis
   - 设置 Cookie

6. **创建会话管理 API**（管理员功能）：
   - `GET /api/admin/sessions` - 查看当前用户会话
   - `DELETE /api/admin/sessions/:id` - 删除指定会话
   - `DELETE /api/admin/sessions/all` - 删除所有会话

7. **更新环境变量**（`.env.example`）：
   ```
   REDIS_URL=redis://localhost:6379/0
   SESSION_TTL=604800  # 7天，单位秒
   ```

## 🧪 验证方式

```bash
# 启动 Redis（如未安装）
# Windows: 使用 Docker 或 WSL

docker run -d -p 6379:6379 redis:alpine

# 登录后检查 Redis
redis-cli keys "session:*"
redis-cli hgetall "session:xxx"

# 测试踢出
# 1. 用户 A 登录
# 2. 管理员调用删除会话接口
# 3. 用户 A 的下次请求应返回 401
```

## 📂 相关文件

- `src/lib/redis/client.ts` - 新增
- `src/lib/auth/session-store.ts` - 新增
- `src/lib/auth/session.ts` - 大幅修改
- `src/app/api/auth/login/route.ts` - 修改
- `src/app/api/auth/logout/route.ts` - 修改
- `src/app/api/auth/me/route.ts` - 可能需要修改
- `src/app/api/admin/sessions/route.ts` - 新增

## ⚠️ 注意事项

- Redis 需要持久化配置，避免重启丢失会话
- 考虑 Redis 集群/哨兵模式用于高可用
- 设置合理的过期时间，避免内存无限增长
- 生产环境建议使用云 Redis 服务（如 AWS ElastiCache、阿里云 Redis）
