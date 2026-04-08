# 任务 12：Git Hooks 配置

## 🎯 任务目标

配置 Git Hooks，在提交前自动检查代码质量和格式。

## 🔍 当前问题

- 未经检查的代码可能直接提交
- 有时代码包含 ESLint 错误或格式问题
- 需要人工提醒检查测试

## ✅ 改进要求

1. **提交前检查**：
   - 检查 TypeScript 类型
   - 运行 ESLint
   - 运行 Prettier 检查

2. **提交信息规范**：
   - 强制使用约定式提交（Conventional Commits）
   - 示例：`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`

3. **性能优化**：
   - 只检查变更的文件（lint-staged）
   - 并行执行检查

## 📝 具体步骤

1. **添加依赖**：
   ```bash
   npm install -D husky lint-staged @commitlint/config-conventional @commitlint/cli
   ```

2. **初始化 Husky**：
   ```bash
   npx husky init
   ```

3. **配置 lint-staged**（`package.json`）：
   ```json
   {
     "lint-staged": {
       "*.{ts,tsx}": [
         "bash -c 'tsc --noEmit'",
         "eslint --fix",
         "prettier --write"
       ],
       "*.{js,jsx,mjs}": [
         "eslint --fix",
         "prettier --write"
       ],
       "*.{json,css,md}": [
         "prettier --write"
       ]
     }
   }
   ```

4. **创建 pre-commit Hook**（`.husky/pre-commit`）：
   ```bash
   npx lint-staged
   ```

5. **配置 Commitlint**（`commitlint.config.js`）：
   ```javascript
   module.exports = {
     extends: ['@commitlint/config-conventional'],
     rules: {
       'type-enum': [
         2,
         'always',
         [
           'feat',      // 新功能
           'fix',       // 修复
           'docs',      // 文档
           'style',     // 格式（不影响代码运行的变动）
           'refactor',  // 重构
           'perf',      // 性能优化
           'test',      // 测试
           'chore',     // 构建过程或辅助工具的变动
           'ci',        // CI 配置
           'revert',    // 回滚
         ],
       ],
       'subject-full-stop': [0, 'never'],
       'subject-case': [0, 'never'],
     },
   }
   ```

6. **创建 commit-msg Hook**（`.husky/commit-msg`）：
   ```bash
   npx --no-install commitlint --edit $1
   ```

7. **创建 prepare-commit-msg Hook**（可选，自动生成提交信息）：
   ```bash
   # .husky/prepare-commit-msg
   # 可以集成 Jira 等工具自动添加 issue 号
   ```

8. **添加提交信息模板**（`.gitmessage`）：
   ```
   # <类型>: <简短描述>
   #
   # <详细说明（可选）>
   #
   # <关联 issue（可选）>
   # Closes #123
   ```

9. **配置 Git 使用模板**：
   ```bash
   git config commit.template .gitmessage
   ```

10. **测试 Hooks**：
    ```bash
    # 测试提交前检查
    echo "const x: any = 1" > src/test-lint.ts
    git add .
    git commit -m "test commit"
    # 应该被 ESLint 拦截

    # 测试提交信息规范
    git commit -m "invalid message"
    # 应该被 commitlint 拦截

    # 正确提交
    git commit -m "feat: add user authentication"
    # 应该通过
    ```

11. **更新文档**（`README.md` 或 `CONTRIBUTING.md`）：
    ```markdown
    ## 提交规范

    本项目使用 [Conventional Commits](https://www.conventionalcommits.org/)。

    提交信息格式：`<type>: <description>`

    常用类型：
    - `feat`: 新功能
    - `fix`: 修复
    - `docs`: 文档更新
    - `style`: 代码格式
    - `refactor`: 重构
    - `test`: 测试
    - `chore`: 构建/工具
    ```

## 🧪 验证方式

```bash
# 测试 lint-staged
echo "const foo = ()=>{}" > src/test.ts
git add src/test.ts
git commit -m "test: lint-staged"
# 观察是否自动格式化

# 测试 commitlint
git commit -m "wrong message"
# 应该报错
```

## 📂 相关文件

- `.husky/pre-commit` - 新增
- `.husky/commit-msg` - 新增
- `commitlint.config.js` - 新增
- `package.json` - 添加 lint-staged 配置
- `.gitmessage` - 新增（可选）
- `README.md` - 添加提交规范说明

## ⚠️ 注意事项

- 第一次配置后，团队成员需要运行 `npm install` 来启用 hooks
- 如果紧急需要跳过 hooks：`git commit --no-verify`（不推荐常用）
- 确保 hooks 脚本有执行权限（Linux/Mac）
- Windows 用户可能需要配置 Git Bash 或使用 WSL
