# Enhanced_Media_Helper.js · 架构梳理

> 架构文档（2026-08 新建）。对应脚本 `Enhanced_Media_Helper.js` **v3.7.2（约 4640 行）**。
> 所有行号锚点以该版本为准；脚本升级会平移行号。

## 概述

油猴用户脚本，功能覆盖：

1. **番号库管理器**（Code Manager Panel）：Preact + htm 构建的右侧抽屉面板——收藏/已看/回收站管理、搜索过滤、批量操作、导入导出、键盘导航、主题；
2. **磁力截图预览**：whatslink API 抓取磁力预览（灯箱 + 宫格缩略图 + 懒加载），带并发去重与竞态处理；
3. **AVWikiDB 宫格截图**：按番号抓取作品页截图，独立缓存；
4. **javgg.net 站点增强**：列表页注入状态圆点与跳转链接；
5. **standalone 独立页**：同源真实网址 + `#emh-standalone` 全屏双栏；
6. **WebDAV 云端备份**（v3.7.0+，v3.7.1 组件化，v3.7.2 上 Greasy Fork 库）：番号库上传/下载到坚果云、Nextcloud、群晖等，AES-256-GCM 可选加密；内核为**Greasy Fork 库 `webdev-component.js` v1.0.0（ID 593538，真源 = 仓库 `webdev-library.user.js`）**，EMH `@require` 引用 + 内嵌副本幂等兜底；面板菜单「备份 → WebDAV 云端备份」设置卡 + `EMH_API.webdav*` 桥；
7. **跨脚本桥 `EMH_API`**（v3.6.1+）：挂 `unsafeWindow`，供 jav-code-scanner 等脚本入库/标记/截图。

主体是**单个严格模式 IIFE**（61-4613）。`@run-at document-start`（早起跑，standalone 封面/桥尽早就绪），`@noframes`（不进 iframe）。

### 元信息

- `@match` 7 条 javgg.net 路径 + `@include` 30+ 域名（与 scanner 高度重合）；`@require` preact@10.19.6 / hooks / htm（jsdelivr，DEPS 另有 cdnjs fallback）+ **Greasy Fork 库 `webdev-component.js`（ID 593538，v3.7.2+：`https://update.greasyfork.org/scripts/593538/1916639/webdev-component.js`；真源 = 仓库 `webdev-library.user.js`）**
- 授权：`GM_setValue/GM_getValue/GM_addValueChangeListener/GM_xmlhttpRequest/GM_openInTab/unsafeWindow`；`@connect 1cili.com / whatslink.info / avwikidb.com / *`（`*` 为 v3.7.0 起，WebDAV 任意主机需放行一次）
- 版本策略：3.6.1 起每个桥/灯箱能力变更递增（3.6.4 加 `previewAvwiki` 回调，3.6.5 灯箱 z-index 置顶，3.7.0 加 WebDAV 备份 + 导出/导入桥，3.7.1 WebDAV 内核抽为共享组件 + jav 凭据导入 + 设置卡 UX 改版，3.7.2 组件上 Greasy Fork 库 + @require + 幂等 UMD/解析回退）

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
| WebDAV 接线（组件化） | 1130–1590 | 番号库云端备份（v3.7.0+ / 3.7.1 组件化 / 3.7.2 Greasy Fork 库） | 注释 1130, `webdevRequest` 1137（GM Promise 化）, **组件内嵌** 1177–1549（`webdev-library.user.js` 库体同步副本，幂等 UMD）, `WebdevComp` 解析（库→沙箱→unsafeWindow）1553 + `createWebdev({storage, request, exportPayload})`, `javWebdavOpts` 1573（读 `JavCodeKit.getWebdavOpts` 的 url/user/加密开关） |
| `AVWIKI_PREVIEW` | 1591–1777 | avwikidb 宫格抓取 | `parseHtml`（jp-N 场景图优先）, `fetchAndShow`（`isLatest()` 门控缓存/提示）, `codeUrl` |
| 站点增强 | 1778–1890 | 状态指示器 + javgg 处理 | `waitForElement` 1778, `applyStatusIndicatorState` ~1796, `createCodeStatusIndicator` ~1811, `SITE_HANDLERS` 1843 |
| 依赖与样式 | 1891–2282 | Preact 加载 + 核心样式 + standalone 样式/封面 | `DEPS` 1891, `ensurePreact` 1929, `injectCoreStyles` 1948, `injectStandaloneCover` 2189, `injectStandaloneStyles` 2224, `createFallbackToggle` 2269 |
| 面板工厂 | 2283–4442 | Preact 组件树 + 全部面板 CSS | `buildPanel` 2283（`PanelStore` / `Memorize` / `CodeManagerApp` 2966 / `WebdavModal` 2547 / `CodeManagerPanel`） |
| 启动/同步 | 4445–4528 | 站点处理 + 跨页同步 | `main` 4445, `setupSyncListeners` 4465（`GM_addValueChangeListener` + 2s 轮询） |
| 公共 API | 4529–4633 | 对外桥 | `mountPublicApi` 4529（挂 `unsafeWindow.EMH_API` + `window.EMH_API`） |
| `initialize` | 4634–4637 | 入口：standalone 检测 → 主题 → 库 init → **挂桥** → main → 同步 → bootPanel | |

### 规模分布（近似）

- `buildPanel` 2283–4442：约 2160 行（47%），其中 `createStyles` CSS 模板约 545 行（含 WebDAV 卡样式）
- WebDAV 接线 1130–1590：约 460 行（其中组件内核 371 行为 `webdev-library.user.js` 库体同步副本）
- `MAGNET_PREVIEW` 711–1127：约 420 行（含灯箱样式）
- `CODE_LIBRARY` 94–594：约 500 行
- 依赖/样式 1891–2282：约 390 行（核心 CSS 约 240 行）

## 共享组件（Greasy Fork 库 webdev-library.user.js）

- **唯一真源**：仓库根 `webdev-library.user.js`（Greasy Fork 库 593538 的源码：元数据头 + 组件体一体；组件体 UMD：浏览器挂 `window.WebdevComponent`，Node 测试剥离元数据头后 `require`）；EMH 内嵌在 `/*__WEBDEV_COMPONENT_BEGIN__*/ … END` 标记块（1177–1549）
- **三重来源解析**（1553）：① `@require` 的 Greasy Fork 库（优先）→ ② 沙箱全局（内嵌副本）→ ③ `unsafeWindow.WebdevComponent`；UMD **幂等**（同名全局已存在即不覆盖），库与内嵌副本共存无冲突
- **同步**：改组件流程 = 编辑 `webdev-library.user.js` → 回填 Greasy Fork 库页面 → 运行 `node tools/sync-webdev.js`（嵌入 EMH 标记块 + `node --check` 校验）。勿手改标记块内容
- **适配器注入**：`createWebdev({ key, defaultFile, encMark, storage:{get,set}, request, exportPayload })`——EMH 注入 GM 存储、`webdevRequest`（GM_xmlhttpRequest Promise 化）、`exportData('all')` JSON 载荷；组件不引用任何脚本全局
- **能力**：`normalize/load/save`、Base64、AES-256-GCM（PBKDF2-SHA256 120k）、`joinUrl/authHeader`、`testConnection`（PROPFIND→GET）、`uploadLibrary`（PUT）、`downloadLibrary`（GET + 自动解密解析）
- **接入目标**：现供 EMH（`@require` + 内嵌兜底）；jav-code-scanner 后续可同组件接入（各自注入自己的存储/请求/载荷适配器、命名空间常量；GM 存储按脚本隔离，凭据不跨脚本共享）

### 发布到 Greasy Fork（已完成首版，流程留档）

1. 真源 `webdev-library.user.js` 即库源码（`@name WebdevComponent` / `@version` 随组件 `VERSION`），编辑后直接回填库页面
2. greasyfork.org → **新建脚本** → 粘贴 `webdev-library.user.js` 全部内容 → 保存（被 `@require` 引用后自动归类为库）——**已完成，库 ID 593538**
3. 库页给出的 `@require` 地址（`https://update.greasyfork.org/scripts/593538/1916639/webdev-component.js`）——**已填入 EMH 元信息**
4. 之后每次改组件：编辑 `webdev-library.user.js` → 更新库页面源码（递增 `VERSION`）→ 运行 `node tools/sync-webdev.js` 同步 EMH 内嵌，并在 EMH 元信息核对库的版本化 URL 是否变化（greasyfork 版本化路径含版本号时需同步更新）

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
- 方法：`addCode / removeCode / markItem / getItem / getStatus / getAll / openPanel / refresh / previewAvwiki`（详见 `../integration/integration-emh-scanner.md`）；v3.7.0+ 另加 `exportData / importData`（外部 WebDAV 备份配套）与 `getWebdavOpts / saveWebdavOpts / webdavTest / webdavUpload / webdavDownload`（`webdav*` 均返回 Promise；`getWebdavOpts` 只回传密码存在位，明文不出脚本存储）
- **反向读取（v3.7.1+）**：EMH WebDAV 卡经 `unsafeWindow.JavCodeKit.getWebdavOpts()` 一键导入 jav 已保存的服务器/账号/加密开关（`javWebdavOpts` 1562）；jav 的桥同样不回传密码，`hasPass` 仅提示「需手动输入一次」
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
| 备份设置卡 | `.emh-webdav-modal-content`（v3.7.0+，v3.7.1 改版） | 菜单「备份 → WebDAV 云端备份」：分区排版（jav 导入 / 服务器 / 备份文件 / 恢复策略）、文件名固定 `emh-library.json` 只读、一键导入 jav 的服务器+账号、前置校验（地址必填 / 加密密码 ≥4 位）、busy 态禁用按钮、状态行 `ok/err/info` |

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
| `emh_webdav_v1` | WebDAV 连接 + 加密设置 `{url,user,pass,file,encrypt,secret}`（v3.7.0+；密码仅本机） |

## 技术债务与耦合点

1. **单文件 IIFE**：`buildPanel` 内部 1900 行组件 + CSS 混放；`Memorize` 手写浅比较（preact.umd 无 memo）
2. **Toast 通道依赖面板**：`emh_toast` 监听器在 `buildPanel` 注册，Preact 未构建（CDN 失败/未开面板）时 toast 丢失——跨脚本调用方需自带反馈（scanner 已用 onDone 回调）
3. **全量双 key 保存**：`save()` 每次写 data + trash 两份 JSON，库大时开销可观
4. **灯箱 z-index 全局置顶**：2147483647 是双刃剑——盖 scanner/站点所有层是预期，但与站点自己的全屏层冲突时无法再叠加
5. **`@include` 极宽**：脚本在 30+ 域名全部注入面板与 Preact（设计取舍，非 javgg 站点无站点增强但面板可用）
8. **`@connect *`（v3.7.0+）**：WebDAV 任意主机需要；油猴首次访问新主机弹放行确认（scanner 同款），用户可随时在脚本权限里撤销单个域
9. **组件双副本 + 库版本同步**：`webdev-library.user.js` 同时以内嵌副本（标记块）与 Greasy Fork 库（ID 593538，@require 引用）存在——`tools/sync-webdev.js` 负责同步与校验；升级组件 VERSION 后需回填库页面，并核对 EMH 元信息里的版本化库 URL
6. **状态指示器样式双写**：JS 内联色值 + CSS `[data-status]` 规则（v3.6.0 已删死 CSS，保留 JS 单源）
7. **iframe 语义**：`@noframes` 保证单实例，但也意味着 iframe 页面里的集成（如 scanner 的 embedLite 模式）拿不到桥

## 参考

- standalone 模式详解见 `standalone-mode.md`
- 与 jav-code-scanner 的桥协议见 `../integration/integration-emh-scanner.md`
- scanner 架构见 `../jav-code-scanner/architecture-jav-code-scanner.md`
