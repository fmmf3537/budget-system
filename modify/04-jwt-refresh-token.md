# 任务 04：JWT 刷新令牌机制

## 🎯 任务目标

实现双令牌机制（Access Token + Refresh Token），提升安全性的同时保持用户体验。

## 🔍 当前问题

文件：`src/lib/auth/session.ts`

```typescript
.setExpirationTime("7d")  // 7 天固定过期
```

**问题**：
- Token 7 天固定过期，期间无法 revoke（踢出用户）
- 长期有效的 Token 风险较高
- 没有"记住我"功能的区分

## ✅ 改进要求

1. **双令牌机制**：
   - Access Token：短期有效（15-60 分钟）
   - Refresh Token：长期有效（7-30 天），存储在 HttpOnly Cookie

2. **后端存储 Refresh Token**：
   - 使用 Redis 或数据库存储，支持主动失效
   - 绑定设备/浏览器指纹（可选）

3. **自动刷新**：
   - 前端检测 Token 即将过期，自动调用刷新接口
   - 刷新失败时跳转登录页

4. **安全特性**：
   - Refresh Token 轮换（每次使用后生成新的）
   - 检测 Refresh Token 重用（可能表示被盗）

## 📝 具体步骤

1. **更新 Token 生成逻辑**（`src/lib/auth/session.ts`）：
   - 创建 `createAccessToken()` - 15 分钟有效
   - 创建 `createRefreshToken()` - 7 天有效，包含 `jti`（唯一 ID）
   - 修改 `verifySessionToken()` 为 `verifyAccessToken()`
   - 添加 `verifyRefreshToken()`

2. **创建 Token 存储**（简化版可用内存，生产用 Redis）：
   - `src/lib/auth/token-store.ts`
   - `setRefreshToken(jti, userId, expiresAt)`
   - `getRefreshToken(jti)`
   - `revokeRefreshToken(jti)`
   - `revokeAllUserTokens(userId)`

3. **更新登录接口**（`src/app/api/auth/login/route.ts`）：
   - 返回两个 Cookie：`access_token` 和 `refresh_token`
   - 存储 Refresh Token 到后端

4. **创建刷新接口**（`src/app/api/auth/refresh/route.ts`）：
   - POST 接口
   - 验证 Refresh Token
   - 检查后端存储是否存在
   - 生成新的双令牌
   - 失效旧的 Refresh Token（轮换）

5. **更新登出接口**（`src/app/api/auth/logout/route.ts`）：
   - 同时清除两个 Cookie
   - 失效 Refresh Token

6. **前端自动刷新**（`src/components/auth/session-provider.tsx`）：
   - 定时检查 Token 过期时间
   - 过期前 5 分钟自动调用刷新接口
   - 失败后触发登出

## 🧪 验证方式

```bash
# 登录测试
# 应该看到两个 Cookie：access_token (15min) + refresh_token (7d)

# 刷新测试
# 等待 15 分钟或手动修改系统时间
# 前端应自动刷新，用户无感知

# 踢出用户测试
# 调用 revokeAllUserTokens
# 用户的 Refresh Token 应失效，下次访问需要重新登录
```

## 📂 相关文件

- `src/lib/auth/session.ts` - 修改
- `src/lib/auth/token-store.ts` - 新增
- `src/app/api/auth/login/route.ts` - 修改
- `src/app/api/auth/logout/route.ts` - 修改
- `src/app/api/auth/refresh/route.ts` - 新增
- `src/components/auth/session-provider.tsx` - 修改
- `.env.example` - 添加相关配置

## ⚠️ 注意事项

- 这是一个较大改动，建议在非业务高峰期部署
- Access Token 过期前端处理要优雅（避免并发刷新请求）
- 考虑网络抖动，添加重试机制
- 生产环境务必使用 Redis 存储 Refresh Token
