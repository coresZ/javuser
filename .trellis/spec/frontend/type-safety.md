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
