# Enhanced_Media_Helper · 番号库「新标签页模式」

> 功能说明与实现方案（2026-08）。对应脚本 `Enhanced_Media_Helper.js` v3.6.5+（机制自 v3.5.0 起稳定）。

## 功能概述

在保留现有侧栏面板的同时，支持把番号库管理界面**在新标签页打开**，呈现为全屏「大画布双栏」布局（左侧列表 + 右侧详情常驻）。实现为 **GM_openInTab 后台加载同源真实网址**：独立页脚本原生运行于油猴环境（GM 存储/网络齐全），**不依赖父页**，父页可随时关闭。

### 入口

- 侧栏 Header 的 `⋯` 菜单 → **「在新标签页打开」**
- 仅父页面（站点内）显示；standalone 页自身不显示该入口

### 效果

| 项目 | 侧栏模式（默认） | 新标签页模式 |
|---|---|---|
| 布局 | 520px 右侧抽屉 | 全屏双栏（左列表 / 右详情，约 46vw 详情） |
| 数据 | 直接读写 GM 存储 | 直接读写 GM 存储（独立原生运行） |
| 网络 | 直接 `GM_xmlhttpRequest` | 直接 `GM_xmlhttpRequest` |
| 联动 | 点击/Enter 打开详情抽屉 | 选中行即自动在右侧展示详情 |
| 依赖 | 父页面 | **无**（真实网址，父页可关闭） |

## 架构

```
父页面（站点）                                   独立页（standalone，真实网址 + #emh-standalone）
┌─────────────────────────────┐   GM_openInTab   ┌─────────────────────────────┐
│ 侧栏 + 完整 GM 能力          │ ──active:false──▶ │ 同一份脚本原生运行           │
│ CODE_LIBRARY + GM_*          │  后台加载        │ CODE_LIBRARY + GM_*（齐全）  │
│                             │                  │ 双栏大画布布局               │
└─────────────────────────────┘                  └─────────────────────────────┘
```

- 打开目标：`location.href.split('#')[0] + '#emh-standalone'`（同源真实网址，用户脚本 `@match/@include` 天然命中）。
- 无 postMessage 桥、无 Blob URL、无源码捕获/子页注入；跨页同步走油猴自身的 `GM_addValueChangeListener`（cross-tab）与 2s 轮询。

### standalone 检测

脚本 `@run-at document-start`。`initialize()` 最前判断 `location.hash` / `location.search` 含 `emh-standalone` → 置 `window.__EMH_STANDALONE = true` 并设标题「番号库 · 独立页」，同时 `injectStandaloneCover()`：隐藏 `body`（`visibility: hidden`）并显示全屏「加载中」spinner，避免闪现站点内容。之后所有 standalone 分支由该标志驱动：

- `bootPanel`：先等 `document.body` 出现，注入 `injectStandaloneStyles()`（双栏大画布布局），完成后自动 `CodeManagerPanel.showPanel()`，随后 `removeStandaloneCover()`（成功 / 降级 / 异常三路都移除，防卡加载）
- 主从联动：standalone 下 `selectedIndex` 变化 → 自动 `openDetail`（右侧展示详情）
- Header `⋯` 菜单：standalone 页不显示「在新标签页打开」入口（`onOpenStandalone` 传 null）

> `document-start` 下 DOM 未就绪：样式注入一律 `(document.head || document.documentElement)`；面板挂载前须等 `document.body`。

### 打开与回退

`STANDALONE.open()`：

1. 首选 `GM_openInTab(url, { active: false, insert: true })` —— 后台加载，不抢焦点；`@grant GM_openInTab` 提供
2. `GM_openInTab` 不可用或抛错 → 回退 `window.open(url, '_blank')`；被拦截时 toast 提示「请允许弹窗后重试」

### standalone 布局

`injectStandaloneStyles()`（`bootPanel` 中按标志注入）：

- 隐藏 toggle 按钮与面板 backdrop；面板 `position: fixed; inset: 0; padding-right: min(580px, 47vw)`（左列）
- `.emh-detail-drawer` → `position: fixed; right: 0; width: min(580px, 47vw)`（右列常驻）
- 隐藏主面板关闭按钮（保留详情关闭）；隐藏详情 backdrop
- **层次优化**（standalone 双栏）：
  - 左右顶栏统一 52px 高、同背景（去毛玻璃）、hairline 下边框 —— 顶栏协调
  - 背景统一：左右栏同为 `--emh-bg`，右栏用 hairline 边框 + 阴影作分隔
  - 详情主次：**Hero 标题**（大字）→ **meta 行**（创建/更新时间上移置顶）→ **信息卡片**（备注+标签）→ **磁力卡片**（列表+宫格+操作）；standalone 下隐藏底部 meta
- 冲突属性与 `createStyles()`（晚注入）加 `!important` 保证覆盖

### 生命周期

- 独立页为真实网址，与父页无引用关系：父页关闭不影响独立页浏览与增删改（数据直写 GM 存储）
- 跨页同步：`GM_addValueChangeListener`（cross-tab）监听库变更 → 两页各自 `CODE_LIBRARY.init(true)` + 面板刷新；另有 2s 轮询兜底

## 能力覆盖

新标签页模式完整支持现有功能（原生 GM 能力）：

- 列表浏览 / 搜索（防抖）/ 时间与磁力过滤 / 状态标记
- 详情抽屉、备注与**标签编辑**、磁力列表与**缩略图宫格**、**灯箱 + 缩略图索引条**
- 磁力搜索（1cili）、磁力详情抓取、批量获取（进度）
- 预览缓存统计与「清除全部预览缓存」（Header `⋯` 菜单）
- 键盘导航全套（↑↓/Enter/Esc//n/Del/⌘C/r/?）与主题切换

## 约束与注意

- 独立页必须能命中用户脚本：目标为同源真实网址，`@match/@include` 天然覆盖；不依赖父页常驻
- 无需新增 `@connect`：独立页原生 `GM_xmlhttpRequest`，跨域请求（1cili / whatslink）直接由独立页完成
- GM 存储 schema 不变；无数据迁移
- `@grant` 新增 `GM_openInTab`（连同 `GM_setValue/GM_getValue/GM_addValueChangeListener/GM_xmlhttpRequest`）
- 跨脚本桥 `EMH_API` 在 standalone 页同样挂载（`mountPublicApi` 在 `initialize` 中，不依赖面板）；对 scanner 无影响（standalone 页通常没有 scanner 操作条，但桥可用）

## 相关实现位置（Enhanced_Media_Helper.js）

| 模块 | 说明 |
|---|---|
| `STANDALONE` | `standaloneUrl`（同源真实网址 + `#emh-standalone`）/ `open`（`GM_openInTab` 后台加载，回退 `window.open`） |
| `initialize()` | 最前 standalone 检测 → `window.__EMH_STANDALONE` + 标题 |
| `injectStandaloneStyles` | standalone 双栏布局 |
| `bootPanel` / CodeManagerApp | 自动展示 + 主从联动 effect |
| Header `⋯` 菜单 | 「在新标签页打开」入口（`actions.openStandalone`） |

## 验证

- `node --check Enhanced_Media_Helper.js`
- 浏览器验收 harness（`C:\Users\Administrator\AppData\Local\Temp\opencode\emh-verify\verify.mjs`）四视图 34 项断言：list / detail / menu / **standalone**（自动展示、双栏样式、主从联动、`__EMH_STANDALONE` 标志）
- 真实网址后台加载（GM_openInTab active:false + 父页可关闭）建议在真实站点人工验证
