# 任务 02：Mock 认证生产环境禁用

## 🎯 任务目标

禁止在生产环境使用 Mock 认证头，防止安全隐患。

## 🔍 当前问题

文件：`src/lib/api/mock-auth.ts`

```typescript
export function getMockAuth(request: Request): MockAuthContext {
  const userId =
    request.headers.get("x-mock-user-id")?.trim() ||
    process.env.MOCK_USER_ID ||
    "demo-user"
  // ...
}
```

**问题**：
- 生产环境仍可通过 Header 或环境变量使用 Mock 认证
- 可能导致未授权访问
- 任何人都可以通过 `x-mock-user-id` 头伪装成任意用户

## ✅ 改进要求

1. **生产环境完全禁用 Mock**：当 `NODE_ENV === 'production'` 时返回 `null`
2. **保留开发环境功能**：本地开发仍能使用 Mock 头方便测试
3. **添加警告日志**：开发环境使用 Mock 时在服务端打印警告
4. **文档化**：在 `.env.example` 中明确标注 Mock 配置仅用于开发

## 📝 具体步骤

1. **修改 `src/lib/api/mock-auth.ts`**：
   - 在 `getMockAuth` 开头检查 `process.env.NODE_ENV`
   - 生产环境直接返回 `null`
   - 开发环境使用时打印警告：`console.warn('[MockAuth] 使用 Mock 认证:', userId)`

2. **修改 `src/lib/api/request-auth.ts`**：
   - 确保正确处理 Mock 返回 `null` 的情况
   - 检查是否有其他地方调用 `getMockAuth` 需要适配

3. **更新 `.env.example`**：
   - 为 MOCK 相关变量添加注释：`# ⚠️ 仅开发环境使用，生产环境禁用`

4. **添加测试**：
   - 在 `tests/unit/mock-auth.test.ts` 中添加生产环境禁用测试

## 🧪 验证方式

```bash
# 开发环境 - Mock 应该可用
npm run dev
# 使用 x-mock-user-id 头发送请求，应该能正常工作

# 生产环境构建 - Mock 应该被禁用
NODE_ENV=production npm run build
# Mock 头应该被忽略，未登录请求返回 401
```

## 📂 相关文件

- `src/lib/api/mock-auth.ts` - 主要修改
- `src/lib/api/request-auth.ts` - 可能需要调整
- `.env.example` - 更新注释
- `tests/unit/mock-auth.test.ts` - 新增测试（如不存在则创建）

## ⚠️ 注意事项

- 确保部署到生产环境前设置了正确的 `NODE_ENV=production`
- 检查 Vercel 等平台的默认环境变量配置
