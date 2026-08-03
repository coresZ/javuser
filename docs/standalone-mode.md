# Enhanced_Media_Helper · 番号库「新标签页模式」

> 功能说明与实现方案（2026-08）。对应脚本 `Enhanced_Media_Helper.js` v3.5.0+。

## 功能概述

在保留现有侧栏面板的同时，支持把番号库管理界面**在新标签页（独立窗口）打开**，呈现为全屏「大画布双栏」布局（左侧列表 + 右侧详情常驻）。数据与网络请求通过 **opener postMessage 桥**代理到原页面（父页）的油猴 GM 环境，实现跨页双向同步。

### 入口

- 侧栏 Header 的 `⋯` 菜单 → **「在新标签页打开」**
- 仅父页面（站点内）显示；standalone 页自身不显示该入口

### 效果

| 项目 | 侧栏模式（默认） | 新标签页模式 |
|---|---|---|
| 布局 | 520px 右侧抽屉 | 全屏双栏（左列表 / 右详情，约 46vw 详情） |
| 数据 | 直接读写 GM 存储 | postMessage 桥代理到父页 GM 存储 |
| 网络 | 直接 `GM_xmlhttpRequest` | 父页代理 `GM_xmlhttpRequest` |
| 联动 | 点击/Enter 打开详情抽屉 | 选中行即自动在右侧展示详情 |
| 依赖 | 父页面 | **父页面须保持打开**（桥依赖 `opener`），关闭时子页显示降级提示 |

## 架构

```
站点页面（父，含全部 GM 能力）                    新标签页（standalone，纯 UI）
┌─────────────────────────────┐              ┌─────────────────────────────┐
│ 侧栏 + 数据/网络真身          │   window.open │ 复用同一份脚本，standalone 模式 │
│ CODE_LIBRARY + GM_*          │ ──────────▶  │ GM_* 重定义为 postMessage 代理  │
│                             │              │                             │
│  ▲  message 处理器            │ ◀──────────  │ init / setKey / fetch        │
│  │  · init → 回传存储快照      │   postMessage│ libraryUpdated / parentClosed │
│  └──────────────────────────┘              └─────────────────────────────┘
```

### 源码复用（零重复）

主脚本 `IIFE` 改为可捕获源码：

```js
const __EMH_MAIN__ = function emhMain() { /* 全部逻辑 */ };
__EMH_MAIN__();
window.__EMH_SRC = __EMH_MAIN__.toString() + "\n;try { emhMain(); } catch (e) { console.error(e); }";
```

> 注：`toString()` 只捕获函数声明本身，末尾必须追加自调用（函数名 `emhMain` 与声明处一致），否则子页注入后只定义函数而不会执行。

`STANDALONE.buildHtml()` 用 `JSON.stringify(src).replace(/<\//g, '<\\/')` 把源码安全内联到子页（`<\/script` 转义避免 HTML 解析截断，JSON 解析后还原）。

### opener 桥协议（`{ __emh: 1, ... }`）

| 方向 | type | 载荷 | 处理 |
|---|---|---|---|
| 子→父 | `init` | id | 父页回传 `initResult { storage }`（`emh_code_library` / `emh_code_trash` / `emh_ui_theme` / `emh_sync_timestamp`） |
| 子→父 | `setKey` | key, value | 父页 `GM_setValue`；若为库 key → `CODE_LIBRARY.init(true)` 强制重载 + 派发 `emh_library_updated` |
| 子→父 | `fetch` | id, cfg | 父页 `GM_xmlhttpRequest` → 回传 `fetchResult { ok, status, responseText }` / `{ error }` |
| 父→子 | `libraryUpdated` | storage | 子页刷新存储 + `CODE_LIBRARY.init(true)` 强制重载 + 面板刷新 |
| 父→子 | `parentClosed` | — | 子页顶部黄色横幅提示 |

**信任边界**：父页仅处理 `event.source === STANDALONE.win`；子页仅处理 `event.source === window.opener`。

### 子页 bootstrap

1. 定义 `window.__EMH_STANDALONE = true`、`__EMH_STORAGE = {}`
2. 定义 GM 代理：
   - `GM_getValue` → 读 `__EMH_STORAGE` 缓存（同步）
   - `GM_setValue` → 写缓存 + `post setKey`
   - `GM_xmlhttpRequest` → 入 pending 表 + `post fetch`，`fetchResult` 回填 `onload/onerror/ontimeout`
   - `GM_addValueChangeListener` → no-op（同步走 `libraryUpdated` 推送）
3. `post init` 握手 → 收到 `initResult` 后**注入主脚本**（此时存储缓存已就绪，`CODE_LIBRARY.init()` 可同步读到数据）

### standalone 布局

`injectStandaloneStyles()`（`bootPanel` 中按标志注入）：

- 隐藏 toggle 按钮与面板 backdrop；面板 `position: fixed; inset: 0; padding-right: min(560px, 46vw)`（左列）
- `.emh-detail-drawer` → `position: fixed; right: 0; width: min(560px, 46vw)`（右列常驻；冲突属性加 `!important`，因为组件样式在 `bootPanel` 中晚于 standalone 样式注入，避免被同优先级后置规则覆盖）
- 隐藏主面板关闭按钮（保留详情关闭）；隐藏详情 backdrop
- `bootPanel` 完成后自动 `CodeManagerPanel.showPanel()`
- 主从联动：standalone 下 `selectedIndex` 变化 → 自动 `openDetail`（右侧展示详情）

### 生命周期

- 父页 `beforeunload` → `post parentClosed` → 子页显示「父页面已关闭」横幅（仍可浏览，但更改可能无法同步）
- 子页关闭 → 父页 `forwardLibrary` 检测 `win.closed` 清理引用；`open()` 再次调用会 `focus()` 已有窗口

## 能力覆盖

新标签页模式完整支持现有功能（经桥代理）：

- 列表浏览 / 搜索（防抖）/ 时间与磁力过滤 / 状态标记
- 详情抽屉、备注与**标签编辑**、磁力列表与**缩略图宫格**、**灯箱 + 缩略图索引条**
- 磁力搜索（1cili）、磁力详情抓取、批量获取（进度）
- 预览缓存统计与「清除全部预览缓存」（Header `⋯` 菜单）
- 键盘导航全套（↑↓/Enter/Esc//n/Del/⌘C/r/?）与主题切换

## 约束与注意

- **父页面须保持打开**：桥依赖 `opener`；父页关闭后新页面降级为只读浏览（横幅提示）
- 无需新增 `@connect`：子页跨域请求（1cili / whatslink）全部由父页 `GM_xmlhttpRequest` 完成
- GM 存储 schema 不变；无数据迁移
- `@grant` 已含 `GM_setValue/GM_getValue/GM_addValueChangeListener/GM_xmlhttpRequest`；`window.open` + Blob URL 无需额外授权

## 相关实现位置（Enhanced_Media_Helper.js）

| 模块 | 说明 |
|---|---|
| `__EMH_MAIN__` / `window.__EMH_SRC` | 脚本源码捕获 |
| `STANDALONE` | 父页侧：`buildHtml/open/installListener/forwardLibrary/notifyParentClosed` |
| 子页 bootstrap | `buildHtml` 内联（GM 代理 + 握手 + 注入） |
| `injectStandaloneStyles` | standalone 双栏布局 |
| `bootPanel` / CodeManagerApp | 自动展示 + 主从联动 effect |
| Header `⋯` 菜单 | 「在新标签页打开」入口（`actions.openStandalone`） |

## 验证

- `node --check Enhanced_Media_Helper.js`
- 浏览器验收 harness（`C:\Users\Administrator\AppData\Local\Temp\opencode\emh-verify\verify.mjs`）四视图 34 项断言：list / detail / menu / **standalone**（自动展示、双栏样式、主从联动、`__EMH_SRC` 捕获）
- 跨页桥（真实双窗口 postMessage 往返）建议在真实站点人工验证
