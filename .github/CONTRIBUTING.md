# 贡献指南

感谢你考虑为 Web Request Tracer 做出贡献！

## 如何贡献

### 报告 Bug

如果你发现了 bug，请创建一个 Issue 并包含以下信息：

1. Bug 的详细描述
2. 复现步骤
3. 预期行为
4. 实际行为
5. 浏览器和版本信息
6. 相关的错误信息或截图

### 提出新功能

如果你有新功能的想法：

1. 先检查是否已有相关的 Issue
2. 创建一个新的 Issue 描述你的想法
3. 说明为什么这个功能有用
4. 如果可能，提供使用场景示例

### 提交代码

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 代码规范

- 使用 2 空格缩进
- 使用有意义的变量和函数名
- 添加必要的注释
- 保持代码简洁清晰

### 提交信息规范

使用清晰的提交信息：

- `feat: 添加新功能`
- `fix: 修复 bug`
- `docs: 更新文档`
- `style: 代码格式调整`
- `refactor: 代码重构`
- `test: 添加测试`
- `chore: 构建/工具链更新`

## 开发流程

1. 克隆仓库
   ```bash
   git clone https://github.com/yourusername/web-request-tracer.git
   cd web-request-tracer
   ```

2. 创建分支
   ```bash
   git checkout -b feature/my-feature
   ```

3. 进行开发
   - 修改 `src/` 目录下的文件
   - 在浏览器中测试你的改动

4. 提交改动
   ```bash
   git add .
   git commit -m "feat: add my feature"
   git push origin feature/my-feature
   ```

5. 创建 Pull Request

## 测试

在提交 PR 之前，请确保：

1. 在多个浏览器中测试（Chrome、Firefox、Edge）
2. 测试控制台版本和用户脚本版本
3. 测试 minimal 和 all 两种模式
4. 确保没有控制台错误

## 文档

如果你的改动影响了用户使用方式：

1. 更新 README.md
2. 更新 docs/USAGE.md
3. 更新 docs/API.md（如果涉及 API 变更）
4. 更新 CHANGELOG.md

## 问题和讨论

如有任何问题，欢迎：

- 创建 Issue
- 在 Pull Request 中讨论
- 发送邮件至维护者

## 行为准则

- 尊重所有贡献者
- 保持友好和专业
- 接受建设性的批评
- 关注项目的最佳利益

感谢你的贡献！🎉
