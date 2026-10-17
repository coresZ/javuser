# JCS 扩展宿主契约（Extension Contract v1.1）

> 宿主：jav-code-scanner（JCS）**v1.5.81+** · 契约版本：**v1.1**（2026-09）
> 本文档是**对外发布的标准约定**：任何油猴脚本/JS 库按本文规则注册，即可接入 JCS 的扩展点，并受 JCS 配置面板统一管控。
>
> **相对 v1 的增量**：新增 `pickButtons`（选源文字按钮 / **二级按钮组**）；`actions` 与 `pickButtons` 均进入【操作】tab 管控；返回值可请求关闭选源菜单。
>
> 设计原则：JCS 既有调用入口 `JavCodeKit`（openSearch / copyCode / …）**全部保留不动**；扩展机制纯增量，第三方出问题只影响自身。

---

## 1. 背景与动机

| 现状 | 问题 |
|---|---|
| 【操作】tab 部分按钮硬编码探测 `EMH_API` | 其它库无法接入 |
| 接入形态多样（独立油猴 / 纯 JS URL） | 需要统一注册与生命周期 |
| 选源菜单 / 预览操作栏仅内置键 | 第三方需可挂图标操作与文字入口 |
| 多个相关动作占满选源行 | 需要**按钮组 → 二级菜单**折叠展示 |

## 2. 术语

- **宿主**：jav-code-scanner.user.js，挂载 `window.JavCodeKit`。
- **扩展**：按契约 `register` 的第三方脚本。
- **扩展点（v1.1 四类）**：
  - `actions` — 操作栏**图标**按钮（选源面板 + 预览弹窗）
  - `pickButtons` — 选源**文字**叶子按钮，或 **二级按钮组**（`items`）
  - `styles` — 全站样式
  - `mounts` — 页面 DOM 挂载

## 3. 两种接入形态

### 形态 A：独立油猴脚本（推荐）

```js
function tryRegister() {
    const kit = window.JavCodeKit;
    if (kit && kit.__ready && kit.extensions) {
        try { kit.extensions.register(MANIFEST); } catch (e) { console.warn('[扩展名]', e); }
        return true;
    }
    return false;
}
if (tryRegister()) { /* done */ }
else {
    window.addEventListener('jcs:kit-ready', tryRegister, { once: true });
    let n = 0;
    const t = setInterval(() => { if (tryRegister() || ++n > 120) clearInterval(t); }, 500);
}
```

宿主在 `window` 与页面 world 双 dispatch `jcs:kit-ready`。

### 形态 B：纯库 URL

在【扩展】tab 添加 http(s) URL；boot 末尾注入页面 world，此时可直接 `register`。无 `GM_*`。

## 4. Manifest 规范

```js
const MANIFEST = {
    id: 'demo-kit',
    name: '示例工具包',
    version: '1.0.0',
    actions:     [ /* 操作栏图标 */ ],
    pickButtons: [ /* 叶子按钮 或 二级按钮组 */ ],
    styles:      [ /* 可选 */ ],
    mounts:      [ /* 可选 */ ]
};
```

### 4.1 校验规则

| 字段 | 规则 |
|---|---|
| `id` | ≤64，`/^[a-z0-9][a-z0-9-]*$/i`；同 id 覆盖 |
| `name` | ≤40 |
| `version` | ≤20 |
| `actions[].act` | ≤32，同扩展唯一；配置 key = `ext:{id}:{act}` |
| `actions[].title` | ≤20 |
| `actions[].onClick` | function |
| `actions[].icon` | 可选，含 `<svg`，≤2048 |
| `pickButtons` | 每扩展顶层最多 **4** 条（叶子或组） |
| `pickButtons[].id` | kebab-case ≤32；配置 key = `extpick:{id}:{btnId}` |
| `pickButtons[].label` | ≤16 |
| `pickButtons[].title` | 可选 ≤20 |
| `pickButtons[].order` | 可选 number，默认 0 |
| `pickButtons[].match` | 可选，见 §6 |
| **叶子** | 无 `items` 时必须有 `onClick` |
| **按钮组** | `items` 非空数组；组级无需 `onClick` |
| `pickButtons[].items` | 每组最多 **8** 项 |
| `items[].id` / `label` / `onClick` | 同叶子规则；`id` 组内唯一 |
| `styles[].css` | 非空 |
| `mounts[].match` | **必填** |
| `mounts[].mount` | function |

全局：选源 UI 同时展示的顶层扩展入口最多 **8** 个（按 `order` 截断）。

### 4.2 叶子 vs 按钮组

```js
// 叶子：直接执行
{ id: 'copy-dash', label: '复制-', onClick(code, ctx) { /* ... */ return 'done'; } }

// 按钮组：点击组名展开二级菜单
{
  id: 'multi-open',
  label: '多源',
  title: '批量打开搜索源',
  order: 10,
  items: [
    { id: 'all', label: '全部打开', onClick(code, ctx) { /* ... */ return { ok: true, close: true }; } },
    { id: 'first3', label: '前三个', onClick(code, ctx) { /* ... */ return 'done'; } }
  ]
}
```

| | 叶子 | 按钮组（`items`） |
|---|---|---|
| UI | 一个虚线胶囊按钮 | 组名 + ▾；点击展开浮动二级菜单 |
| 出现位置 | 旁出选源菜单；大窗「扩展」行 | 同左 |
| 【操作】tab | 显示开关 | 显示开关（整组）；标注「按钮组 · N 项」 |

### 4.3 `actions` vs `pickButtons`

| | `actions` | `pickButtons` |
|---|---|---|
| UI | 操作栏图标 | 文字胶囊 / 二级组 |
| 位置 | 选源面板操作条 + 预览弹窗顶栏 | 选源列表区 + 大窗扩展行 |
| 设置 | 显示 + 收进「⋯」 | 仅显示（整组或叶子） |

## 5. ctx 与返回值

```js
ctx = {
    code: 'ABC-123',
    showToast(msg, type),
    getCode(),
    onCleanup(fn)
}
```

| 返回值 | `actions` | `pickButtons` / `items` |
|---|---|---|
| `'done'` / `{ ok: true }` | 闪 ✓ | 按钮 `is-done` |
| `{ ok: true, close: true }` | — | 关闭旁出选源菜单 |
| Promise | 等待期半透明 | 同左 |
| 抛错 | toast 失败，宿主不崩 | 同左 |

组内项执行后默认关闭二级菜单。

## 6. match 语法

- `fs1.app` 精确；`*.jable.tv` 含子域
- 缺省 = 全站；**mounts 必须写 match**

## 7. 生命周期

```text
register
  ├─ actions → 操作栏 +【操作】tab（on/fold）
  ├─ pickButtons → 选源/大窗 +【操作】tab（on）
  │                 组：二级菜单渲染
  ├─ styles / mounts → match 过滤注入
【操作】改开关 → 立即 rebuild 操作栏 / 选源扩展入口
【扩展】会话开关 → 隐藏全部能力；刷新后恢复启用
SPA → mounts 防抖重挂
```

## 8. 配置面板

| 位置 | 内容 |
|---|---|
| **设置 → 操作** | 内置 4 键；扩展 `actions`（显示/折叠）；扩展 `pickButtons`（整组 + **组内项** 分别显示开关） |
| **设置 → 扩展** | URL 列表；已注册卡（操作 N / 选源 N / 样式 N / 挂载 N） |

存储：`jcs_extensions_v1`；`jcs_code_actions_v1`（含 `ext:*`、`extpick:*`）。

## 9. 安全

扩展 = 任意代码；形态 B 仅 http(s)；无 GM 代理；DOM 前缀 `jcs-ext-{id}`。

## 10. 完整示例（按钮组）

```js
// ==UserScript==
// @name         JCS 示例 · 二级按钮组
// @version      1.0.0
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const MANIFEST = {
        id: 'demo-kit',
        name: '示例工具包',
        version: '1.0.0',
        actions: [{
            act: 'toast-code',
            title: '提示番号',
            onClick(code, ctx) {
                ctx.showToast('当前：' + code);
                return 'done';
            }
        }],
        pickButtons: [
            {
                id: 'quick',
                label: '快开',
                onClick(code, ctx) {
                    const kit = window.JavCodeKit;
                    if (kit && kit.getProviders) {
                        const p = (kit.getProviders() || [])[0];
                        if (p) window.open(kit.buildUrl(code, p.id), '_blank', 'noopener');
                    }
                    return { ok: true, close: true };
                }
            },
            {
                id: 'batch',
                label: '批量',
                title: '批量打开搜索源',
                order: 20,
                items: [
                    {
                        id: 'all',
                        label: '全部打开',
                        onClick(code, ctx) {
                            const kit = window.JavCodeKit;
                            (kit.getProviders() || []).forEach((p) => {
                                window.open(kit.buildUrl(code, p.id), '_blank', 'noopener');
                            });
                            ctx.showToast('已打开全部源');
                            return { ok: true, close: true };
                        }
                    },
                    {
                        id: 'top3',
                        label: '前三个',
                        onClick(code, ctx) {
                            const kit = window.JavCodeKit;
                            (kit.getProviders() || []).slice(0, 3).forEach((p) => {
                                window.open(kit.buildUrl(code, p.id), '_blank', 'noopener');
                            });
                            return { ok: true, close: true };
                        }
                    }
                ]
            }
        ]
    };

    function tryRegister() {
        const kit = window.JavCodeKit;
        if (kit && kit.__ready && kit.extensions) {
            try { kit.extensions.register(MANIFEST); } catch (e) { console.warn('[demo-kit]', e); }
            return true;
        }
        return false;
    }
    if (tryRegister()) return;
    window.addEventListener('jcs:kit-ready', tryRegister, { once: true });
    let n = 0;
    const t = setInterval(() => { if (tryRegister() || ++n > 120) clearInterval(t); }, 500);
})();
```

## 11. 契约边界

| 不做 | 说明 |
|---|---|
| 扩展 GM 存储代理 | v2 |
| 注册搜索源进 providers 列表 | 用 pickButtons |
| pickButtons 收进操作栏「⋯」 | 仅 on；折叠语义留给 actions |
| 组内项独立配置 key | `extpick:{extId}:{groupId}:{itemId}`；组关闭时子项 UI 禁用 |

## 12. 宿主实现对照

- `JavCodeKit.extensions = { register, unregister, list, isEnabled, setEnabled }`
- `collectPickButtons` / `renderPickEntryHtml` / `bindPickSubMenus` / `listExtPickSlots`
- 配置 key：`ext:{id}:{act}`、`extpick:{id}:{btnId}`
- 宿主版本 **≥ 1.5.80**

## 13. 版本记录

| 契约 | 宿主 | 变更 |
|---|---|---|
| v1 | ≥1.5.73 | actions / styles / mounts |
| v1.1 | ≥1.5.79 | +pickButtons 叶子；actions 操作 tab |
| **v1.1（修订）** | **≥1.5.81** | pickButtons **二级按钮组**（`items`）；组/叶子进【操作】tab |
