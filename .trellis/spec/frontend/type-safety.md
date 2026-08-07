# Type Safety

> Type safety patterns in this project.

---

## Overview

两个脚本均为**纯 JavaScript 无 TypeScript**、无构建类型检查。类型安全靠：JSDoc 注释 + 归一化/防御式访问 + 数据校验。

---

## Type Organization

- 无独立类型定义文件。关键数据结构以 JSDoc 注释 + 常量注释声明（如 provider `{id,name,hint,url}`、备份包格式 `collectConfigBundle` 6613）。
- 跨函数传递的对象（action ctx、provider、站点规则对象）在注释中标明字段。

---

## Validation

- **外部输入**（用户自定义搜索源、导入配置、字幕 API 响应）必须校验：
  - `normalizeProvider`（jcs 1366）：id/name/url 归一化，缺 url 拒绝。
  - `parseSubtitlePayload`（3119）：JSON.parse try/catch，非预期结构回退 `{data:[]}`。
  - `importConfigBundle`：逐段校验，失败回退不破坏现有配置。
- **GM API 返回**：`gmResponseToText`（2795）多形态兜底（responseText/response）。

---

## Common Patterns

- **防御式访问**：链式 `el && el.getAttribute`、`Array.isArray(x) ? x : []`、`Object.assign({}, fallback, raw)`。
- **归一化入口**：所有外部数据结构先进 normalize 函数，后续代码只消费归一形态（`uniqCodes`/`normalizeProvider`/`normalizeHlOpts`）。
- **只读回退**：`storeGetJson(key, fallback)` 解析失败返回 fallback，不抛错。

---

## Forbidden Patterns

1. **裸引用 GM / 全局**：`GM.x` 无守卫会 ReferenceError（用 `typeof` 守卫）。
2. **无校验 JSON.parse 结果直接消费**：必须 try/catch + 结构校验。
3. **就地 mutate 共享数组**：不可变更新，避免 memo 行/多处引用不同步。
4. **把 `innerHTML` 拼接的用户输入当安全数据**：先 `escapeHtml`。

---

## Fetch 型搜索源（自渲染替代 iframe）

> 实证：javdb fetch 搜索源（jav-code-scanner 2026-08）。站点带 `X-Frame-Options`/CSP 时 iframe 无法嵌入，改用 `GM_xmlhttpRequest` 抓搜索页 HTML → DOMParser → 自渲染结果卡片。

- **iframe 无法自定义请求头**：被 X-Frame-Options 拒绝的站点不能靠"加请求头"修复嵌入；`GM_xmlhttpRequest` 可带目标域 cookie（浏览器已持会话如 `cf_clearance`）+ 自定义头（Referer/Accept/UA）过 Cloudflare 类校验。
- **解析第三方 HTML 的安全要求**：
  - 提取的 `href` 必须 **scheme 白名单**（仅 `http:`/`https:`），`javascript:` 伪协议直接跳过（escapeHtml 只防属性逃逸，不防伪协议执行）。
  - 卡片文本/属性（title/uid/href/img）全部 `escapeHtml`；相对路径补全为绝对 URL。
  - 解析空 / 结构漂移时降级回退层，不白屏。
- **异步竞态保护**：GM 请求在途时切源/切番号，旧 promise 回调不能渲染到新容器上。用**代次计数器**（如 `let fetchGen`，`loadFrame` 入口递增，回调比较代次丢弃过期结果），避免旧结果盖新预览 / 误标宿主禁嵌。
- 无 GM 环境：`gmRequest` reject → catch → 降级新标签，与 iframe 源现状一致。
