# Web Request Tracer

一个通用的浏览器网络请求追踪工具，支持 XHR/fetch 请求的捕获、分析和导出。可用于 API 逆向工程、调试、性能分析等场景。

## 功能特性

- 🎯 **灵活的采集模式**
  - `minimal`: 自定义过滤规则，仅采集特定请求（减少数据量）
  - `all`: 采集全部 XHR/fetch 请求（通用抓包模式）

- 💾 **跨页面持久化**: 支持同一站点跨页面继续累积记录

- 🖱️ **点击事务追踪**: 自动关联用户点击操作与网络请求，便于分析用户行为触发的 API 调用

- 📥 **JSON 导出**: 一键导出完整的追踪数据，包含请求/响应详情

- 🔧 **易于定制**: 可根据目标网站自定义过滤规则和采集策略

## 使用场景

- API 逆向工程和分析
- 前端性能调试
- 用户行为与网络请求关联分析
- 自动化测试数据收集
- Web 应用安全审计

## 使用方式

### 方式一：控制台版本（batchexecute_trace_recorder.js）

适合临时使用或快速测试：

1. 打开目标网站
2. 打开浏览器 DevTools Console（F12）
3. 复制粘贴 `batchexecute_trace_recorder.js` 的内容并回车
4. 点击右下角面板的 "Start" 按钮开始记录
5. 执行需要追踪的操作
6. 点击 "Download JSON" 导出数据

### 方式二：用户脚本版本（batchexecute_trace_recorder.user.js）

适合长期使用或自动化场景：

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或其他用户脚本管理器
2. 安装 `batchexecute_trace_recorder.user.js` 脚本
3. 根据需要修改脚本中的 `@match` 规则以匹配目标网站
4. 访问目标网站，脚本会自动加载
5. 使用右下角的控制面板进行操作

## 示例：Gemini Business API 追踪

本工具默认配置为追踪 Gemini Business 的 batchexecute API，作为使用示例：

1. 打开 [Gemini Business Team 设置页面](https://business.gemini.google/settings/team)
2. 按照上述方式加载脚本
3. 执行团队管理操作（list / add / remove / update）
4. 导出数据分析 API 调用

## 控制面板

- **Start/Stop**: 开始/停止记录
- **Mode**: 切换采集模式（mini/max）
- **Download JSON**: 导出追踪数据
- **Clear**: 清除当前记录

## 自定义配置

### 基础配置

在脚本中修改 `CFG` 对象来自定义行为：

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

### 自定义过滤规则（minimal 模式）

修改 `shouldRecord` 函数来定义你自己的过滤规则：

```javascript
const shouldRecord = (u, method, parsedBody) => {
  if (!u || u.error) return false;
  if (CFG.captureMode === "all") return true;

  // 示例 1: 只记录特定域名的请求
  if (u.host === "api.example.com") return true;

  // 示例 2: 只记录特定路径的请求
  if (u.pathname.includes("/api/v1/")) return true;

  // 示例 3: 只记录 POST 请求
  if (method === "POST") return true;

  // 示例 4: 根据请求体内容过滤
  if (parsedBody?.value?.action === "getData") return true;

  return false;
};
```

### 用户脚本匹配规则

修改 `@match` 来指定脚本运行的网站：

```javascript
// @match        https://example.com/*           // 匹配特定域名
// @match        https://*.example.com/*         // 匹配所有子域名
// @match        *://*/*                         // 匹配所有网站（默认）
```

## 导出数据格式

导出的 JSON 文件包含：

- `meta`: 元数据（开始时间、用户代理、URL 等）
- `events`: 事件列表（网络请求、点击事件等）
- `transactions`: 事务映射（点击与网络请求的关联）
- `state`: 当前状态（运行状态、采集模式）

## 注意事项

- 本工具会读取和记录网络请求的内容，请注意数据安全和隐私保护
- 在生产环境使用时，建议使用 `minimal` 模式并配置严格的过滤规则
- 导出的 JSON 文件可能包含敏感信息，请妥善保管
- 某些网站可能有 CSP（内容安全策略）限制，可能影响脚本运行

## 技术原理

- 通过 Hook `XMLHttpRequest` 和 `fetch` API 拦截网络请求
- 使用 `localStorage` 实现跨页面数据持久化
- 通过事件监听器捕获用户点击行为
- 使用时间窗口算法关联点击事件与网络请求

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关项目

- [Fiddler](https://www.telerik.com/fiddler) - 功能强大的 HTTP 调试代理
- [Charles](https://www.charlesproxy.com/) - 跨平台 HTTP 代理工具
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - 浏览器内置开发者工具
