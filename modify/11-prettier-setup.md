# 任务 11：Prettier 代码格式化

## 🎯 任务目标

添加 Prettier 配置，统一代码风格，提升代码可读性。

## 🔍 当前问题

- 没有统一的代码格式化配置
- 不同开发者代码风格不一致
- 缩进、引号、分号等风格混杂

## ✅ 改进要求

1. **基础配置**：
   - 与项目现有风格保持一致
   - 与 ESLint 配置兼容

2. **格式化规则**：
   - 缩进：2 空格
   - 引号：单引号或双引号（与现有代码一致）
   - 分号：不使用
   - 行长：80 或 100 字符

3. **集成方式**：
   - 命令行格式化脚本
   - 与 ESLint 协同工作
   - 编辑器自动格式化支持

## 📝 具体步骤

1. **添加依赖**：
   ```bash
   npm install -D prettier eslint-config-prettier
   ```

2. **创建配置**（`.prettierrc`）：
   ```json
   {
     "semi": false,
     "singleQuote": false,
     "tabWidth": 2,
     "trailingComma": "es5",
     "printWidth": 100,
     "arrowParens": "always",
     "endOfLine": "lf"
   }
   ```

3. **创建忽略文件**（`.prettierignore`）：
   ```
   node_modules
   dist
   .next
   src/generated
   package-lock.json
   *.log
   ```

4. **添加脚本**（`package.json`）：
   ```json
   {
     "scripts": {
       "format": "prettier --write .",
       "format:check": "prettier --check ."
     }
   }
   ```

5. **更新 ESLint 配置**（`eslint.config.mjs`）：
   ```javascript
   import { dirname } from "path"
   import { fileURLToPath } from "url"
   import { FlatCompat } from "@eslint/eslintrc"
   import eslintConfigPrettier from "eslint-config-prettier"
   
   const __filename = fileURLToPath(import.meta.url)
   const __dirname = dirname(__filename)
   
   const compat = new FlatCompat({
     baseDirectory: __dirname,
   })
   
   const eslintConfig = [
     ...compat.extends("next/core-web-vitals", "next/typescript"),
     eslintConfigPrettier,  // 放在最后，覆盖冲突规则
   ]
   
   export default eslintConfig
   ```

6. **配置编辑器**（`.vscode/settings.json`，如使用 VS Code）：
   ```json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": "explicit"
     }
   }
   ```

7. **创建 VS Code 扩展推荐**（`.vscode/extensions.json`）：
   ```json
   {
     "recommendations": [
       "esbenp.prettier-vscode",
       "dbaeumer.vscode-eslint"
     ]
   }
   ```

8. **执行格式化**：
   ```bash
   npm run format
   ```
   - 这将格式化整个项目
   - 会产生大量文件变更，建议单独提交

## 🧪 验证方式

```bash
# 检查格式
npm run format:check

# 应无错误输出

# 故意格式化一个文件
npm run format
# 所有文件应保持不变（如果之前已格式化）
```

## 📂 相关文件

- `.prettierrc` - 新增
- `.prettierignore` - 新增
- `package.json` - 添加脚本
- `eslint.config.mjs` - 修改
- `.vscode/settings.json` - 新增（可选）
- `.vscode/extensions.json` - 新增（可选）

## ⚠️ 注意事项

- 执行 `npm run format` 会产生大量文件变更，建议：
  1. 确保当前没有未提交的修改
  2. 执行格式化
  3. 单独提交：`git commit -m "style: format all files with prettier"`
- 与团队成员沟通，统一在保存时自动格式化
- CI 中可以添加 `npm run format:check` 检查
