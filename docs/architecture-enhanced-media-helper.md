# Enhanced_Media_Helper.js · 架构梳理

> 架构文档（2026-08 新建）。对应脚本 `Enhanced_Media_Helper.js` **v3.6.5（约 3900 行）**。
> 所有行号锚点以该版本为准；脚本升级会平移行号。

## 概述

油猴用户脚本，功能覆盖：

1. **番号库管理器**（Code Manager Panel）：Preact + htm 构建的右侧抽屉面板——收藏/已看/回收站管理、搜索过滤、批量操作、导入导出、键盘导航、主题；
2. **磁力截图预览**：whatslink API 抓取磁力预览（灯箱 + 宫格缩略图 + 懒加载），带并发去重与竞态处理；
3. **AVWikiDB 宫格截图**：按番号抓取作品页截图，独立缓存；
4. **javgg.net 站点增强**：列表页注入状态圆点与跳转链接；
5. **standalone 独立页**：同源真实网址 + `#emh-standalone` 全屏双栏；
6. **跨脚本桥 `EMH_API`**（v3.6.1+）：挂 `unsafeWindow`，供 jav-code-scanner 等脚本入库/标记/截图。

主体是**单个严格模式 IIFE**（61-3900）。`@run-at document-start`（早起跑，standalone 封面/桥尽早就绪），`@noframes`（不进 iframe）。

### 元信息

- `@match` 7 条 javgg.net 路径 + `@include` 30+ 域名（与 scanner 高度重合）；`@require` preact@10.19.6 / hooks / htm（jsdelivr，DEPS 另有 cdnjs fallback）
- 授权：`GM_setValue/GM_getValue/GM_addValueChangeListener/GM_xmlhttpRequest/GM_openInTab/unsafeWindow`；`@connect 1cili.com / whatslink.info / avwikidb.com`
- 版本策略：3.6.1 起每个桥/灯箱能力变更递增（3.6.4 加 `previewAvwiki` 回调，3.6.5 灯箱 z-index 置顶）

## 分区地图

| 模块 | 起止行 | 功能 | 关键成员 |
|---|---|---|---|
| 常量 | 61–93 | `CILI`（1cili 域名/搜索，66）/ `CONFIG`（存储键、缓存 TTL、状态色、备选站） | |
| `CODE_LIBRARY` | 94–594 | 番号库数据层 | `init`（自愈：remarks 清洗 + 磁力归一迁移）, `save`（双 key 写 + 事件广播）, `normMagnets`（三形态归一）, `sanitizeMagnetPreview`, `magnetIndex`（id/索引/`idx-N` 统一解析）, `markItem`（不可变更新）, `setTags`, `importData`（清洗归一）, `clearAllPreviewCaches`, `previewCacheStats`, `exportData` |
| `UTILS` | 595–627 | toast 事件、字节/时间格式化、URL 白名单 | |
| `LAZY` | 628–661 | IntersectionObserver 缩略图懒加载 | |
| `THEME` | 662–686 | 深色/浅色/system，`data-emh-theme` 驱动 | |
| `STANDALONE` | 687–710 | `GM_openInTab` 后台加载独立页 | |
| `MAGNET_PREVIEW` | 711–1127 | whatslink 灯箱 + 请求管线 | `ensureUi`（灯箱 DOM + 键盘/触摸）, `fetchAndCache`（`_requestSeq` 竞态 + `_inflight` 去重）, `parseApiResponse`, `_isCacheFresh` |
| `AVWIKI_PREVIEW` | 1128–1314 | avwikidb 宫格抓取 | `parseHtml`（jp-N 场景图优先）, `fetchAndShow`（`isLatest()` 门控缓存/提示）, `codeUrl` |
| 站点增强 | 1315–1426 | 状态指示器 + javgg 处理 | `waitForElement` 1315, `applyStatusIndicatorState` 1333, `createCodeStatusIndicator` 1348, `SITE_HANDLERS` 1380 |
| 依赖与样式 | 1427–1818 | Preact 加载 + 核心样式 + standalone 样式/封面 | `DEPS` 1428, `ensurePreact` 1466, `injectCoreStyles` 1485, `injectStandaloneCover` 1726, `injectStandaloneStyles` 1761, `createFallbackToggle` 1806 |
| 面板工厂 | 1819–3720 | Preact 组件树 + 全部面板 CSS | `buildPanel` 1820（`PanelStore` / `Memorize` / `CodeManagerApp` / `CodeManagerPanel`） |
| 启动/同步 | 3721–3799 | 站点处理 + 跨页同步 | `main` 3721, `setupSyncListeners` 3741（`GM_addValueChangeListener` + 2s 轮询） |
| 公共 API | 3800–3879 | 对外桥 | `mountPublicApi` 3805（挂 `unsafeWindow.EMH_API` + `window.EMH_API`） |
| `initialize` | 3880–3900 | 入口：standalone 检测 → 主题 → 库 init → **挂桥** → main → 同步 → bootPanel | |

### 规模分布（近似）

- `buildPanel` 1819–3720：约 1900 行（50%），其中 `createStyles` CSS 模板约 480 行
- `MAGNET_PREVIEW` 711–1127：约 420 行（含灯箱样式）
- `CODE_LIBRARY` 94–594：约 500 行
- 依赖/样式 1427–1818：约 390 行（核心 CSS 约 240 行）

## 数据模型

### 番号条目（item）

```js
{
  code: 'ABC-123',              // 统一大写
  title: '…',                  // 缺省 = code
  status: 'unmarked'|'favorite'|'watched',
  remarks: '',                  // 仅字符串（init 自愈清洗）
  tags: [],                     // 字符串数组（setTags 去重）
  magnet: [{ id, value, preview? }],  // 对象数组；preview = whatslink 缓存
  createdDate, modifiedDate, deleteDate?  // ISO 字符串；deleteDate 仅回收站条目
}
```

### 磁力形态兼容（normMagnets 239 区域）

- 单值字符串 / 旧字符串数组 / 新对象数组 → 统一 `{id, value, preview?}`；
- `init` 自愈（v3.6.2+）：旧格式或缺 id 对象**落盘迁移**（保证 id 稳定，详情逐条操作按 id 定位可靠）；
- `magnetIndex` 解析顺序：存储 id → 数字索引 → `idx-N` 兼容形式。

### 预览缓存（preview）

```js
{ name, type, fileType, size, count, screenshots: [{screenshot, time?}], fetchedAt, error? }
```

- whatslink 缓存存 item.magnet[i].preview（随库持久化）；AVWikiDB 缓存独立 GM key `emh_avwiki_cache`
- TTL：成功 7 天 / 错误 5 分钟（`CONFIG.magnetPreview`）

## 核心数据流

### 启动（initialize 3880）

```
standalone 检测（hash/search 含 emh-standalone → __EMH_STANDALONE + 加载封面）
→ THEME.apply → CODE_LIBRARY.init（含自愈迁移）
→ mountPublicApi()（document-start 即挂桥，不依赖 Preact）   ← v3.6.1+
→ main()（DOMContentLoaded 后跑 SITE_HANDLERS）
→ setupSyncListeners()（跨页同步）
→ bootPanel()（async：injectCoreStyles → 等 body → ensurePreact → buildPanel → init）
```

### 库读写

所有操作经 `CODE_LIBRARY`，`save()` 每次写 `emh_code_library` + `emh_code_trash` 双 key，并广播 `emh_library_updated` 事件 + 写 `emh_sync_timestamp`（触发跨页同步）。

### 磁力预览管线（MAGNET_PREVIEW.fetchAndCache 961 区域）

```
① 校验 magnet 前缀 / GM 能力
② 缓存命中：旧截图立即开灯箱（后台刷新，force 时直接跳过）
③ 并发去重：_inflight[key] 复用；force 时旧请求 superseded
④ 发起：_requestSeq 递增 → GM_xmlhttpRequest（20s 超时）
⑤ 完成：仅「最新且未被作废」的请求能开灯箱/弹提示/持久化错误（isLatest 判定）
```

AVWikiDB 同模式（`fetchAndShow`），失败/成功都按 `isLatest()` 门控缓存与提示（v3.6.0 起）。

### 跨页同步（setupSyncListeners 3741）

- `GM_addValueChangeListener('emh_sync_timestamp', remote)` → 重新 `init(true)` + 刷新指示器/面板
- 2s 轮询兜底（非 GM 环境 / 同上下文写入）

### 跨脚本桥（mountPublicApi 3805）

- 挂载：`unsafeWindow.EMH_API`（主 world，防覆盖）+ `window.EMH_API`（沙箱）+ `window.__EMH_API__`
- 方法：`addCode / removeCode / markItem / getItem / getStatus / getAll / openPanel / refresh / previewAvwiki`（详见 `docs/integration-emh-scanner.md`）
- 注意：GM 存储按脚本隔离，外部脚本**必须**经此 API 才能操作库

## UI 体系

### 组件（NS 前缀 `emh-`）

| 组件 | id / class | 说明 |
|---|---|---|
| 浮动按钮 | `#emh-code-manager-toggle` | 右下角，Preact 就绪后创建 |
| 面板 | `#emh-code-manager-panel` | 右侧抽屉，宽度 320–900px 可拖（`emh_panel_size` 记忆） |
| 行组件 | `.emh-item` | `Memorize` 浅比较 memo + `actionsRef` 稳定回调 |
| 详情抽屉 | `.emh-detail-drawer` | 双栏协调（Hero → meta → 信息/磁力卡片）；宫格缩略图 LAZY 懒加载 |
| 灯箱 | `#emh-magnet-lightbox` | **z-index 2147483647**（v3.6.5 置顶，盖过 scanner 宿主 2147483000）；键盘 ←→/Esc、触摸滑动、缩略图索引条 |
| Toast | `#custom-toast-container` | 经 `emh_toast` 事件桥接（仅面板构建后显示——**跨脚本场景的静默反馈问题由此而来，v3.6.4 起用 onDone 回调解决**） |
| 模态 | `.emh-panel-modal` | Prompt/Confirm/磁力列表/批量进度 |

### 主题

`data-emh-theme` = dark（默认）/ light / system；CSS 变量 `--emh-*`（Linear 风格，暖黑基底）。

## 存储键

| 键 | 用途 |
|---|---|
| `emh_code_library` | 主库 `{items, lastUpdated}` |
| `emh_code_trash` | 回收站 `{items, lastUpdated}`（7 天保留，init 清理） |
| `emh_avwiki_cache` | AVWikiDB 截图缓存 `{code: preview}` |
| `emh_sync_timestamp` | 跨页同步信号 |
| `emh_ui_theme` | 主题 |
| `emh_panel_size` | 面板宽度 |

## 技术债务与耦合点

1. **单文件 IIFE**：`buildPanel` 内部 1900 行组件 + CSS 混放；`Memorize` 手写浅比较（preact.umd 无 memo）
2. **Toast 通道依赖面板**：`emh_toast` 监听器在 `buildPanel` 注册，Preact 未构建（CDN 失败/未开面板）时 toast 丢失——跨脚本调用方需自带反馈（scanner 已用 onDone 回调）
3. **全量双 key 保存**：`save()` 每次写 data + trash 两份 JSON，库大时开销可观
4. **灯箱 z-index 全局置顶**：2147483647 是双刃剑——盖 scanner/站点所有层是预期，但与站点自己的全屏层冲突时无法再叠加
5. **`@include` 极宽**：脚本在 30+ 域名全部注入面板与 Preact（设计取舍，非 javgg 站点无站点增强但面板可用）
6. **状态指示器样式双写**：JS 内联色值 + CSS `[data-status]` 规则（v3.6.0 已删死 CSS，保留 JS 单源）
7. **iframe 语义**：`@noframes` 保证单实例，但也意味着 iframe 页面里的集成（如 scanner 的 embedLite 模式）拿不到桥

## 参考

- standalone 模式详解见 `docs/standalone-mode.md`
- 与 jav-code-scanner 的桥协议见 `docs/integration-emh-scanner.md`
- scanner 架构见 `docs/architecture-jav-code-scanner.md`
