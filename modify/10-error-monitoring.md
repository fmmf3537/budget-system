# 任务 10：错误监控集成

## 🎯 任务目标

集成错误监控服务（如 Sentry），实时捕获和追踪生产环境错误。

## 🔍 当前问题

- 生产环境错误无法及时发现
- 没有错误堆栈和上下文信息
- 无法统计错误频率和趋势

## ✅ 改进要求

1. **错误捕获**：
   - API 路由错误
   - React 组件错误边界
   - 客户端 JavaScript 错误

2. **上下文信息**：
   - 用户信息（ID、组织）
   - 请求信息（URL、参数）
   - 环境信息（版本、部署环境）

3. **告警机制**：
   - 关键错误实时通知（邮件/钉钉/Slack）
   - 错误频率超过阈值时告警

4. **性能监控**（可选）：
   - 页面加载性能
   - API 响应时间

## 📝 具体步骤

1. **注册 Sentry 账号**：
   - 访问 https://sentry.io 或自托管
   - 创建项目，获取 DSN

2. **添加依赖**：
   ```bash
   npm install @sentry/nextjs
   ```

3. **配置 Sentry**（`sentry.client.config.ts`）：
   ```typescript
   import * as Sentry from '@sentry/nextjs'
   
   Sentry.init({
     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
     environment: process.env.NEXT_PUBLIC_ENV,
     release: process.env.NEXT_PUBLIC_RELEASE,
     tracesSampleRate: 0.1,  // 性能采样率
     replaysSessionSampleRate: 0.1,
     replaysOnErrorSampleRate: 1.0,
   })
   ```

4. **配置服务端**（`sentry.server.config.ts`）：
   ```typescript
   import * as Sentry from '@sentry/nextjs'
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.ENV,
     release: process.env.RELEASE,
     tracesSampleRate: 0.1,
   })
   ```

5. **配置 Edge**（`sentry.edge.config.ts`）：
   - 内容类似服务端配置

6. **更新 Next.js 配置**（`next.config.ts`）：
   ```typescript
   import { withSentryConfig } from '@sentry/nextjs'
   
   const nextConfig = {
     // ... 原有配置
   }
   
   export default withSentryConfig(nextConfig, {
     org: 'your-org',
     project: 'budget-system',
     silent: !process.env.CI,
   })
   ```

7. **增强错误上下文**（`src/lib/api/prisma-errors.ts`）：
   - 在错误处理中添加 Sentry 上报
   ```typescript
   import * as Sentry from '@sentry/nextjs'
   
   export function handleRouteError(error: unknown): NextResponse {
     // 上报到 Sentry
     Sentry.captureException(error)
     // ... 原有处理
   }
   ```

8. **添加用户信息**（`src/app/api/auth/me/route.ts`）：
   - 登录成功后设置 Sentry 用户上下文
   ```typescript
   Sentry.setUser({
     id: user.id,
     email: user.email,
     organization: user.organizationId,
   })
   ```

9. **React 错误边界**（`src/components/error/sentry-error-boundary.tsx`）：
   ```typescript
   'use client'
   
   import * as Sentry from '@sentry/nextjs'
   import { ErrorBoundary } from '@sentry/react'
   
   export function SentryErrorBoundary({ children }: { children: React.ReactNode }) {
     return (
       <ErrorBoundary
         fallback={({ error }) => (
           <div>发生错误，请刷新页面重试</div>
         )}
         beforeCapture={(scope, error, hint) => {
           scope.setTag('section', 'react')
         }}
       >
         {children}
       </ErrorBoundary>
     )
   }
   ```

10. **更新环境变量**（`.env.example`）：
    ```
    # Sentry 错误监控
    SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
    NEXT_PUBLIC_SENTRY_DSN=${SENTRY_DSN}
    SENTRY_ORG=your-org
    SENTRY_PROJECT=budget-system
    ```

## 🧪 验证方式

```bash
# 开发环境测试
npm run dev

# 访问测试错误页面
# 创建 src/app/sentry-test/page.tsx
<button onClick={() => { throw new Error('Test error') }}>
  触发错误
</button>

# 登录 Sentry 控制台查看是否收到错误
```

## 📂 相关文件

- `sentry.client.config.ts` - 新增
- `sentry.server.config.ts` - 新增
- `sentry.edge.config.ts` - 新增
- `next.config.ts` - 修改
- `src/lib/api/prisma-errors.ts` - 修改
- `src/components/error/sentry-error-boundary.tsx` - 新增
- `.env.example` - 添加配置

## ⚠️ 注意事项

- 确保敏感信息（密码、Token）不被上报到 Sentry
- 开发环境可以禁用或降低采样率
- 关注 Sentry 的配额限制，合理设置采样率
- 配置 Source Maps 以获取正确的错误堆栈
