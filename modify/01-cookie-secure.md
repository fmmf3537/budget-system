# 任务 01：Cookie Secure 标志配置

## 🎯 任务目标

为生产环境的会话 Cookie 添加 `secure` 标志，确保只有通过 HTTPS 传输。

## 🔍 当前问题

文件：`src/app/api/auth/login/route.ts` 第 69-74 行

```typescript
res.cookies.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
})
```

**问题**：
- 缺少 `secure` 标志，Cookie 可能在 HTTP 连接中传输
- 生产环境应该强制 HTTPS

## ✅ 改进要求

1. **添加环境变量判断**：只在生产环境启用 `secure: true`
2. **保持开发环境兼容**：开发环境（localhost）可以是非 HTTPS
3. **统一 Cookie 配置**：创建一个可复用的 Cookie 配置函数

## 📝 具体步骤

1. 在 `src/lib/auth/session.ts` 中添加 `getSessionCookieOptions()` 函数：
   - 判断 `process.env.NODE_ENV === 'production'`
   - 返回包含 `secure` 标志的 Cookie 选项
   - 开发环境添加注释说明

2. 更新 `src/app/api/auth/login/route.ts`：
   - 使用新的 Cookie 配置函数
   - 确保 `maxAge` 保持 7 天

3. **检查登出逻辑**：`src/app/api/auth/logout/route.ts`
   - 确保清除 Cookie 时也使用相同的选项

4. **添加类型安全**：为 Cookie 选项添加 TypeScript 类型

## 🧪 验证方式

```bash
# 开发环境测试
npm run dev
# 登录后检查浏览器 DevTools -> Application -> Cookies
# secure 标志应该为 false（开发环境）

# 构建生产版本测试
NODE_ENV=production npm run build
# 部署到 HTTPS 环境后验证 secure 标志为 true
```

## 📂 相关文件

- `src/lib/auth/session.ts` - 新增 Cookie 配置函数
- `src/app/api/auth/login/route.ts` - 修改设置 Cookie 的代码
- `src/app/api/auth/logout/route.ts` - 可能需要同步修改

## ⚠️ 注意事项

- 确保生产环境实际使用 HTTPS，否则启用 secure 后 Cookie 不会被发送
- 可以添加环境变量 `COOKIE_SECURE=true` 来显式控制（可选）
