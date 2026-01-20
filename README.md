# Gemini Business batchexecute Trace Recorder

一个用于记录 Gemini Business Team/Mailbox RPC 追踪的工具，支持 XHR/fetch 请求的捕获和分析。

## 功能特性

- 🎯 **两种采集模式**
  - `minimal`: 仅采集 batchexecute + list-sessions（专为 Gemini Business 场景优化）
  - `all`: 采集全部 XHR/fetch 请求（通用抓包模式）

- 💾 **跨页面持久化**: 支持同一站点跨页面继续累积记录
- 🖱️ **点击事务追踪**: 自动关联用户点击操作与网络请求
- 📥 **JSON 导出**: 一键导出完整的追踪数据

## 使用方式

### 方式一：控制台版本（batchexecute_trace_recorder.js）

1. 打开 [Gemini Business Team 设置页面](https://business.gemini.google/settings/team)
2. 打开浏览器 DevTools Console
3. 复制粘贴 `batchexecute_trace_recorder.js` 的内容并回车
4. 点击右下角面板的 "Start" 按钮开始记录
5. 执行需要追踪的操作（list / add / remove / update）
6. 点击 "Download JSON" 导出数据

### 方式二：用户脚本版本（batchexecute_trace_recorder.user.js）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或其他用户脚本管理器
2. 安装 `batchexecute_trace_recorder.user.js` 脚本
3. 访问目标网站，脚本会自动加载
4. 使用右下角的控制面板进行操作

## 控制面板

- **Start/Stop**: 开始/停止记录
- **Mode**: 切换采集模式（mini/max）
- **Download JSON**: 导出追踪数据
- **Clear**: 清除当前记录

## 配置选项

可以在脚本中修改 `CFG` 对象来自定义行为：

```javascript
const CFG = {
  captureMode: "minimal",           // 采集模式: "minimal" 或 "all"
  enableClickTransaction: true,     // 启用点击事务追踪
  transactionWindowMs: 3000,        // 事务窗口时间（毫秒）
  readResponseBody: true,           // 读取响应体
  maxResponseTextLen: 200000,       // 最大响应文本长度
  persist: true,                    // 启用持久化
  maxEvents: 1200,                  // 最大事件数量
};
```

## 导出数据格式

导出的 JSON 文件包含：

- `meta`: 元数据（开始时间、用户代理、URL 等）
- `events`: 事件列表（网络请求、点击事件等）
- `transactions`: 事务映射（点击与网络请求的关联）
- `state`: 当前状态（运行状态、采集模式）

## 许可证

MIT

## 作者

gemini-business2api
