# 任务 09：API 限流中间件

## 🎯 任务目标

为 API 添加限流保护，防止暴力破解、DDoS 攻击和资源滥用。

## 🔍 当前问题

- 登录接口无限制，可能被暴力破解
- 所有 API 都没有请求频率限制
- 无法阻止恶意高频请求

## ✅ 改进要求

1. **分层限流策略**：
   - 全局限流：所有 API 共享（如 1000 req/min）
   - 接口级限流：特定接口单独限制（如登录 5 req/min）
   - 用户级限流：已登录用户按用户 ID 限制

2. **限流响应**：
   - HTTP 429 Too Many Requests
   - 响应头包含 `Retry-After`
   - 清晰的错误信息

3. **存储方式**：
   - 开发环境：内存存储
   - 生产环境：Redis 存储

4. **白名单**：
   - 内部服务 IP 可绕过限流（可选）

## 📝 具体步骤

1. **添加依赖**：
   ```bash
   npm install rate-limiter-flexible
   ```

2. **创建限流配置**（`src/lib/rate-limit/config.ts`）：
   ```typescript
   export const RATE_LIMITS = {
     // 全局：每 IP 每分钟 1000 次
     global: {
       points: 1000,
       duration: 60,
     },
     // 登录：每 IP 每分钟 5 次
     login: {
       points: 5,
       duration: 60,
       blockDuration: 300,  // 超限后锁定 5 分钟
     },
     // 注册（如有）：每 IP 每小时 10 次
     register: {
       points: 10,
       duration: 3600,
     },
     // 已认证用户：每分钟 600 次
     authenticated: {
       points: 600,
       duration: 60,
     },
   }
   ```

3. **创建限流服务**（`src/lib/rate-limit/rate-limiter.ts`）：
   ```typescript
   import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible'
   
   export class RateLimiterService {
     private limiters: Map<string, RateLimiterRedis | RateLimiterMemory>
     
     async checkLimit(
       key: string, 
       type: keyof typeof RATE_LIMITS
     ): Promise<{ allowed: boolean; retryAfter?: number }>
     
     getLimiter(type: keyof typeof RATE_LIMITS)
   }
   ```

4. **创建限流装饰器/中间件**（`src/lib/rate-limit/middleware.ts`）：
   ```typescript
   export function withRateLimit(
     handler: (req: Request) => Promise<Response>,
     type: keyof typeof RATE_LIMITS,
     keyExtractor?: (req: Request) => string
   ): (req: Request) => Promise<Response>
   ```

5. **应用到具体路由**：
   ```typescript
   // src/app/api/auth/login/route.ts
   import { withRateLimit } from '@/lib/rate-limit/middleware'
   
   export const POST = withRateLimit(
     async (request) => {
       // 原有登录逻辑
     },
     'login',
     (req) => req.headers.get('x-forwarded-for') || 'unknown'
   )
   ```

6. **全局限流**（`src/middleware.ts`）：
   - 创建 Next.js Middleware 进行全局限流
   - 对静态资源豁免

7. **添加响应头**：
   ```typescript
   // X-RateLimit-Limit: 1000
   // X-RateLimit-Remaining: 999
   // X-RateLimit-Reset: 1234567890
   ```

## 🧪 验证方式

```bash
# 测试登录限流
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# 第 6 次开始应该返回 429

# 检查响应头
# Retry-After: 60
```

## 📂 相关文件

- `src/lib/rate-limit/config.ts` - 新增
- `src/lib/rate-limit/rate-limiter.ts` - 新增
- `src/lib/rate-limit/middleware.ts` - 新增
- `src/middleware.ts` - 新增或修改
- `src/app/api/auth/login/route.ts` - 添加限流
- `src/app/api/auth/logout/route.ts` - 如有需要添加限流

## ⚠️ 注意事项

- 确保获取客户端 IP 正确（考虑反向代理）
- 限流错误不要暴露内部实现细节
- 监控限流触发频率，调整阈值
- CDN 或负载均衡环境下需要传递真实 IP
