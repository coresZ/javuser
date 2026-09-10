# jav-code-scanner.user.js · 架构梳理

> 架构文档（2026-08 更新）。对应脚本 `jav-code-scanner.user.js` **v1.5.71（9983 行）**。
> 所有行号锚点以该版本为准；脚本升级会平移行号。

## 概述

油猴用户脚本，功能覆盖：页面番号扫描、多源搜索、字幕搜索、页面高亮、自定义选择器点选、iframe 白名单、CBox 轻量高亮、快捷键/主题、全站备份（WebDAV 可加密）、`window.JavCodeKit` 公共 API，以及（v1.5.63+）**与 Enhanced_Media_Helper 的跨脚本集成**：番号入库/移除、库状态徽标（chip ＋/✓）、当前番号操作条（字幕/复制/入库/截图，可配置折叠）、设置页「操作」tab。

主体是**单个严格模式 IIFE**（53-9983），按 12 个 `// ─── xxx ───` 分区注释组织。除分区横幅外，内部全部是函数声明 + 少量模块级 `let/const`，共享同一闭包；模块间通过闭包变量（`state`、`providersCache`、`_codeActions`、`_libCache` 等）和函数提升隐式耦合。

### 元信息

- `@run-at document-idle`；`@include` 覆盖 30+ 域名（jav*/av*/fc2*/missav*/javdb*/javlibrary*/dmm.co.jp/dmm.com/heyzo*/caribbeancom*/1pondo*/pacopaco*/xvideos*/pornhub*/xhamster*/reddit*/t66y/sis001/91porn/jable/avple/cbox.ws 等），`@exclude localhost/127.0.0.1`
- 授权：`GM_xmlhttpRequest` / `GM.xmlHttpRequest` / `GM_getValue` / `GM_setValue` / `GM_deleteValue` / `GM_listValues` / `unsafeWindow`；`@connect *`
- 防重入：`if (_pageWin.JavCodeKit && _pageWin.JavCodeKit.__ready) return;`（57）
- `_pageWin = unsafeWindow || window`（56）：跨脚本桥（EMH_API 读取）与 kit 挂载都走它

## 分区地图

| 分区 | 起止行 | 功能 | 关键函数 |
|---|---|---|---|
| ① 基础设施 | 53–1512 | 常量/存储层/站点总表/iframe 白名单/state/主题/Toast/剪贴板/**番号库桥**/操作条 | `storeGetJson` 142, `showToast` 759, `doAddToLibrary` 809, `addToLibrary` 825, `removeFromLibrary` 851, `loadLibCache` 862, `libStateOf` 879, `refreshLibBadges` 889, `bindChipLibBadge` 917, `PICK_ICON` 952, `CODE_ACT_DEF` 965, `buildCodeActions` 971, `ensureCodeActions` 1122, `updateCodeBar` 1140, `chipTitleText` 1155, `bindChipCopy` 1163, `ensureHost` 1341, `bindGlobalHotkeys` 1391 |
| ② 番号识别 | 1513–1836 | 番号解析/校验/DMM CID/三路扫描 | `extractJavCode` 1622, `extractAllJavCodes` 1658, `scanAttrCodes` 1705, `scanStructuredCodes` 1765, `scanPageCodes` 1813 |
| ③ 可配置搜索源 | 1837–1937 | provider CRUD + URL 模板 | `normalizeProvider` 1839, `loadProviders` 1852, `buildProviderUrl` 1904 |
| ④ 历史 | 1938–1962 | 最近搜索（上限 40） | `loadHist` 1940, `saveHist` 1949 |
| ⑤ 高亮选项 + 操作条配置 | 1963–2265 | hl 选项存取/自定义选择器解析/**codeActions 存取** | `loadCodeActions` 1984, `saveCodeActions` 1994, `loadHlOpts` 2005, `parseNativeSelectorInput` 2046, `clearPageHighlight` 2092, `isEmhInstalled` 2148, `syncCodeActionsUi` 2155, `bindCodeActionsUi` 2180 |
| ⑥ 点选器 | 2266–2911 | 鼠标点选拾取 + 候选选择器生成 | `_selPick` 2267, `buildSelectorCandidates` 2749, `ensureSelPickUi` 2343, `startSelectorPick` 2774 |
| ⑦ 字幕+网络+加密+WebDAV | 2912–3800 | 字幕 API/下载 + 网络层 + 加密 + WebDAV 客户端 | `gmRequest` 3022, `deriveAesKey` 3097, `encryptConfigPayload` 3123, `webdavUploadConfig` 3240, `fetchTextViaProxies` 3274, `ensureSubtitleModal` 3590, `openSubtitleSearch` 3696, `searchSubtitles` 3737 |
| ⑧ 高亮引擎 | 3801–4320 | 内置链/卡片/全文/自定义范围高亮 + **库状态 ✓ 徽标** | `codeLinkTitle` 3803, `bindCodeMarkClick` 3824, `enhanceNativeAnchorCodes` 3797*, `processTextNode` 4136, `applyCustomSelectorHighlight` 4233, `linkifyPage` 4278 |
| ⑨ UI | 4321–7502 | 全部样式 + 面板/大窗/选源/设置/备份 UI | `injectStyles` 4323（CSS 模板）, `ensurePanel` 5863, `renderPanelList` 6178, `ensurePopup` 6251, `ensurePicker` 7107, `openProviderPicker` 7168, `rememberCode` 6921, `loadFrame` 7812, `stepCode` 7889, `collectConfigBundle` 7897, `exportConfigJson` 7943, `importConfigBundle` 7985, `setConfigTab` 8777, `toggleConfig` 8992 |
| ⑩ fetch 型搜索源 | 7503–9557 | GM 请求 + 自渲染源（X-Frame-Options 拒绝 iframe 的站） | `renderFetchResults` 8275 |
| ⑪ 启动 + CBox | 9558–9836 | 启动分支 + CBox 轻量高亮 + 父页桥 | `probeHostFramePolicy` 9560, `linkifyCbox` 9706, `bootCboxLite` 9734, `bindCboxParentBridge` 9777 |
| ⑫ 公共 API | 9837–9983 | boot + kit 对象 | `boot` 9837, `kit` 9897（挂 `window.JavCodeKit` 9972-9975） |

> *`enhanceNativeAnchorCodes` 位于 3797（高亮引擎区开头附近），行号以 grep 实测为准。

### 规模分布（近似，9983 行）

- CSS 模板字符串 4323 起：约 1500 行（15%）
- UI 逻辑 5863–7502 + 7503–9557：约 3700 行
- 基础设施 53–1512：约 1460 行（含番号库桥 ~400 行）
- 字幕/网络/加密/WebDAV 2912–3800：约 890 行
- 高亮引擎 3801–4320：约 520 行
- 番号识别 1513–1836：约 325 行
- CBox 9612–9836：约 225 行

## 核心数据流

### 启动（boot 9837）

```
IIFE 53 → 常量（CODE_ACT_KEY 72 / STORE_KEYS 86）→ 存储层 → 站点总表 → 迁移
        → iframe 门禁 → boot()（readyState==='loading' 时等 DOMContentLoaded）
```

`boot()` 分支：

1. **IS_CBOX** → `bootCboxLite()`（9734），不进全站 UI
2. **embedLite**（iframe 内且顶层已有 `JavCodeKit.__ready`）→ 只 `injectStyles + refreshScan(true)` + MutationObserver，不挂浮钮/面板
3. **完整模式**：`state.theme = loadTheme(); loadSubOpts(); loadHlOpts(); loadCodeActions(); applyTheme` → `ensurePanel → applyExtModeUi → refreshScan(true) → bindGlobalHotkeys → probeHostFramePolicy`，注册 MutationObserver（600ms 防抖）
4. iframe 非精简 → 完整 UI 跑在本 frame

### 番号扫描管线

`refreshScan(forceLinkify)`（9523）→ `scanPageCodes()`（1813）：

```
① scanStructuredCodes()（1765）：结构化节点，≤4000 节点
② 构造 text：title + pathname + search + href + og 标签 + TreeWalker 全文（≤5000 节点）
③ extractAllJavCodes(text)（1658）→ extractJavCode 归一 + 小写 DMM CID 二次扫
④ scanAttrCodes()（1705）：location.href + ≤4000 个 a/area/[data-*]/img/source 属性
⑤ uniqCodes() → state.codes
```

番号规范化链：`extractJavCode`（1622）→ `makeCode` → `isPlausibleCode` / `formatCodeNum`。DMM CID 走 `fromDmmCid`。

### 高亮管线

`linkifyPage()`（4278，`state.linkifyBusy` 互斥锁）：

```
① 用户自定义选择器 → applyCustomSelectorHighlight()（4233）；only 模式直接 return
② enhanceExistingCodeLinks() → enhanceNativeAnchorCodes()（短叶子包 span 色标 / markInnerCodeNodes / markTextCodesInRoot）
③ 全文纯文本 walker → processTextNode(node, false)
```

`bindCodeMarkClick`（3824）capture 阶段 click+keydown：点击=搜索、Alt+点击=复制、**Alt+Shift+点击=加入番号库**（v1.5.63+）；并在绑定处按 `libStateOf(code)` 写入 `data-jcs-lib`，在库的高亮块右上角显示 `✓` 徽标（CSS `::after`，4144 行区域）。

### 番号库桥（v1.5.63+，跨脚本集成核心）

```
┌─ scanner（isolated world） ─┐        ┌─ EMH（isolated world） ─┐
│ _pageWin.EMH_API ───────────┼─ 主 world 共享 ──▶ unsafeWindow.EMH_API 挂载
│ libStateOf / 操作条 / 徽标   │                        │
│ ────────────────────────────│                        ├─ addCode / removeCode
│ 30s 缓存 _libCache（getAll） │                        ├─ markItem / getItem
│ 操作后 invalidateLibCache    │                        ├─ previewAvwiki / openPanel
└─────────────────────────────┘                        └─ getStatus / getAll / refresh
```

- **为何走主 world**：GM 存储按脚本隔离（scanner 无法直接写 EMH 的库），两个沙箱互不可见 → 唯一可靠通道是 `unsafeWindow`（页面主 world）上挂全局 API；
- **检测**：`isEmhInstalled()`（2148）直接查 `EMH_API.addCode` 是否为函数；`libStateOf`（879）走 30s 缓存（`loadLibCache` 862 一次性 `getAll` 建 map），EMH 未装时返回 null；
- **消费点**：选源面板操作条、预览弹窗操作栏（`buildCodeActions` 971）、面板/弹窗 chip 徽标（`bindChipLibBadge` 917）、页面高亮 ✓ 徽标、Alt+Shift 点击；
- **状态同步**：添加/移除成功后 `invalidateLibCache() + refreshLibBadges()`（889，遍历页面 mark + 面板/弹窗 chip 更新 data-jcs-lib 与 badge）；
- 详见 `../integration/integration-emh-scanner.md`。

### 搜索 / 动作流

`openSearch(code, opts)`（9487）三分支：

1. 大窗已开或 forceFull → `runPopupSearch`（9438）：`rememberCode`（6921，**所有切番号路径的唯一入口**，内部调 `updateCodeBar()` 同步操作栏）→ 渲染列表 → `loadFrame(c)`（7812）
2. `preferExternalSearch()` → `openProviderPicker(code, anchor)`（7168）：toggle 语义、四向定位、document pointerdown 关闭；操作条（`buildCodeActions`）挂载在源按钮列表末尾
3. 否则（内嵌）→ runPopupSearch

`stepCode(±1)`（7889）→ openSearch(下一个码)。

字幕流：`openSubtitleSearch`（3696）→ `searchSubtitles`（3737，`subReqSeq` 竞态保护）→ `fetchSubtitleJson`（GM → 迅雷字幕 API，失败回落 `fetchTextViaProxies` 3274）→ `renderSubtitleList` → `downloadSubtitleFile`。

## 当前番号操作条（v1.5.65+）

**抽象**：`buildCodeActions(container, opts)`（971）——字幕/复制/入库/截图四个图标按钮，**外链 picker 与预览弹窗操作栏共用同一份逻辑与图标**（`PICK_ICON` 952 / `CODE_ACT_DEF` 965，含 `emh` 依赖标记）。

| 按钮 | 行为 | 依赖 EMH |
|---|---|---|
| 字幕（sub） | `onSub` 回调（picker 先关 picker）或 `openSubtitleSearch` | 否 |
| 复制（copy） | `copyCode` + ✓ 反馈 900ms | 否 |
| 入库（lib） | `doAddToLibrary`；状态化 ＋/✓ | **是**（未装时 `setCode` 隐藏） |
| 截图（shot） | `EMH_API.previewAvwiki`（Shift=强制刷新），失败原因经 `onDone` 回传 scanner toast | **是** |

- **折叠**：`ca[k].fold=true` 的按钮收进 `⋯` 更多菜单（`.jcs-act-pop`，操作条上方弹出；document capture 监听点外部关闭，`buildCodeActions._docBound` 只绑一次）；
- **配置**：`jcs_code_actions_v1`（`CODE_ACT_KEY` 72），结构 `{sub|copy|lib|shot: {on, fold}}`，`normalizeCodeActions`（429 区域）兼容 v1.5.67 之前的布尔格式；设置页「操作」tab 每行双开关（显示/折叠），EMH 未装时 `lib`/`shot` 行置灰（`isEmhInstalled` 2148）；
- **操作栏**：预览弹窗 `.jcs-code-bar`（`updateCodeBar` 1140：番号标签 + 操作条；无当前番号时整栏隐藏；`ensureCodeActions(rebuild)` 1122 支持配置变更后强制重建）；
- **导出/导入**：`collectConfigBundle`（7897）global 含 `codeActions`；`importConfigBundle`（7985）恢复 + `syncCodeActionsUi` 刷新。

## UI 体系

### 组件清单（NS = 'jcs'，全部 id 前缀 `jcs-`）

| 组件 | 根 id | 构建函数 | 说明 |
|---|---|---|---|
| 视口宿主 | `#jcs-host` | `ensureHost` 1341 | fixed inset:0, z-index 2147483000, pointer-events:none |
| 样式 | `#jcs-styles` | `injectStyles` 4323 | data-ver=STYLE_VER 防重复 |
| Toast | `#jcs-toast` | `showToast` 759 | role=status, 1.6s 自动隐藏 |
| 浮钮 | `#jcs-fab` | `ensurePanel` 5863 | `#jcs-badge`/`.jcs-fab-ico`/`.jcs-fab-txt` |
| 扫描面板 | `#jcs-panel` | `ensurePanel` | `#jcs-q`/`#jcs-list`（chip 带 `＋/✓` 库徽标）/`#jcs-ext-mode-btn` 等 |
| 搜索大窗 | `#jcs-popup` > `#jcs-win` | `ensurePopup` 6251 | 头部 `#jcs-pprev/pnext/pext/pext-mode/ptheme/pcfg/pclose`（v1.5.66 起字幕按钮移出头部）；**`.jcs-code-bar` 操作栏**（`#jcs-code-bar-code` 标签 + `#jcs-code-actions` 操作条）；`#jcs-providers`/`#jcs-pinput`/`#jcs-frame` |
| 设置层 | `#jcs-cfg` | `ensurePopup` / `toggleConfig` 8992 | 5 tab：general/highlight/**actions（操作）**/sources/backup |
| 选源浮卡 | `#jcs-pick` | `ensurePicker` 7107 | `#jcs-pick-code/close/list`、`.jcs-pick-arrow`、操作条 |
| 字幕弹窗 | `#jcs-sub` > `#jcs-sub-win` | `ensureSubtitleModal` 3590 | `#jcs-sub-q/orig/hist/list` |
| 点选器 | `#jcs-selpick` | `ensureSelPickUi` 2343 | `#jcs-selpick-mask/box/bar/confirm/input/cands` |
| 页内高亮 | — | 高亮引擎 | `a.jcs-link`、`.jcs-code-mark`（在库时 `data-jcs-lib="1"` + ✓ 徽标）、`span[data-jcs-wrap]` |

### 事件绑定模式

1. 单点全局热键：`bindGlobalHotkeys` 唯一 document keydown capture，Esc 层级关闭集中于此
2. 遮罩点击关闭：root click 且 `e.target === root` → close
3. 选源浮卡外部关闭：document pointerdown capture（picker）；`⋯` 菜单外部关闭：document click capture（`buildCodeActions._docBound`）
4. 显式 onclick 直绑：ensure* 构建时逐按钮绑定
5. 防重绑标志：`dataset.jcsBound` / `dataset.jcsMarkBound` / `dataset.jcsBadgeBound` / 函数属性 `_bound`
6. Capture 阶段拦截：色标 click/keydown capture（Alt+Shift 入库分支在 shiftKey 放行之前）
7. 拖拽：`bindDrag` / `setupFabDrag` 8px 阈值区分点击与拖动
8. DOM 版本自愈：`data-ver !== SCRIPT_VER` 整体重建（模板变更必须升版本）
9. MutationObserver + 防抖：boot / embedLite / CBox 三处
10. 滚动/视口同步：`syncHostToViewport`

### 快捷键

- `Esc` 层级式关闭；`/`、`j`、`J` 聚焦搜索；输入框 Enter 提交
- 修饰键：chip/色标 Alt/Ctrl/Meta = 复制或强开大窗；**Alt+Shift+点击 = 加入番号库**

### 主题系统

- CSS 变量 `--jcs-*`（深色默认，浅色覆盖块）；`applyTheme` → host `data-theme` + `colorScheme` + `documentElement[data-jcs-theme]`

## 存储与状态

### GM 存储键（STORE_KEYS 86）

| 常量 | 键名 | 用途 |
|---|---|---|
| PROVIDERS_KEY | `jcs_providers_v1` | 自定义搜索源数组 |
| PROVIDER_KEY | `jcs_provider_active_v1` | 当前源 id |
| HIST_KEY | `jcs_hist_v1` | 最近番号（≤40） |
| PANEL_KEY | `jcs_panel_layout_v1` | 面板拖拽位置 |
| FAB_POS_KEY | `jcs_fab_pos_v1` | 浮钮位置 |
| THEME_KEY | `jcs_theme_v1` | 主题 |
| FRAME_BLOCK_KEY | `jcs_frame_block_hosts_v1` | 禁嵌 hostname 列表 |
| FRAME_ALLOW_KEY | `jcs_frame_allow_hosts_v1` | iframe 白名单 |
| EXT_MODE_KEY | `jcs_prefer_ext_hosts_v1` | 手动旁出 hostname 列表 |
| HL_OPT_KEY | `jcs_hl_opts_v1` | 全局高亮开关 |
| **CODE_ACT_KEY** | **`jcs_code_actions_v1`** | **操作条按钮配置 `{sub|copy|lib|shot:{on,fold}}`（v1.5.67+）** |
| SUB_OPT_KEY | `jcs_sub_filename_v1` | 字幕命名选项 |
| SUB_HIST_KEY | `jcs_sub_hist_v1` | 字幕历史（≤12） |
| SITES_KEY | `jcs_sites_map_v1` | hostname → 站点规则总表 |
| WEBDAV_KEY | `jcs_webdav_v1` | WebDAV 连接 + 加密配置 |

存储抽象：`storeGetRaw/SetRaw/Remove/GetJson/SetJson/GetStr` 全部 **GM 优先、localStorage 回退且自动迁入 GM**。

### state 对象（668）

`codes` / `active` / `provider` / `theme` / `viewed` / `linkifyBusy` / `scrollLocked` / `scrollY` / `frameUrl` / `frameWatch` / `pickAnchor` / `pickRect` / `pickCloseTimer` / `pickPosRaf` / `subUseOriginalName` / `inFrame` / `embedLite` / `hl` / **`codeActions`** / `cfgTab` / `cfgSourceTab` / `cfgEditId` / `cfgDeleteId` / `cfgFlashId` / `cfgFrameDirty` / `cfgFramePrev`。

模块级变量：`_libCache`（库状态缓存）、`_codeActions`（弹窗操作条实例）、`providersCache`、`_selPick` 等。

### 备份包格式

`collectConfigBundle`（7897）：`{app, scope, storage, bundleVersion:3, scriptVersion, exportedAt, siteCount, global, sites, data}`；`global` 含 `providers/providerActive/providerBlacklist/theme/hl/codeActions/sub/panelLayout/fabPos`。WebDAV 上传与加密备份复用同一 bundle（`webdavUploadConfig` 3240 → `exportConfigJson`）。账号密码与历史不导出。

## 公共 API（window.JavCodeKit，kit 9897）

| 分组 | 方法 |
|---|---|
| 元信息 | `__ready` / `version` |
| 环境 | `isMobile` / `isInIframe` / `isEmbedLite` / `hasGlobalStore` / `getStoreKeys` |
| iframe | `isFrameAllowHost` / `setFrameAllowHost` / `getFrameAllowHosts` |
| 备份 | `exportConfig` / `importConfig` / `downloadConfig` / `getWebdavOpts` / `saveWebdavOpts` / `webdavUpload` / `webdavDownload` / `encryptConfig` / `decryptConfig` |
| 番号 | `extract` / `extractAll` / `fromDmmCid` / `scanPage` |
| 扫描/高亮 | `refresh` / `getHlOpts` / `setHlOpts` / `linkify` / `clearHighlight` |
| 搜索 | `openSearch` / `openProviderPicker` / `openSubtitleSearch` / `searchSubtitles` / `closeSubtitleSearch` / `preferExternalSearch` / `isUserPreferExternal` / `setPreferExternalSearch` / `togglePreferExternal` / `buildUrl` |
| 搜索源 | `getProviders` / `saveProviders` / `resetProviders` / `getActiveProvider` / `setActiveProvider` / `DEFAULT_PROVIDERS` |
| **番号库** | **`addToLibrary` / `removeFromLibrary`（v1.5.63+，桥接 EMH_API）** |
| 杂项 | `getCodes` / `copyCode` / `getTheme` / `setTheme` / `toggleTheme` / `getSubUseOriginalName` / `setSubUseOriginalName` |

CBox 精简 API：`{__ready, __cboxLite, extract, extractAll, linkify}`。

## 跨脚本协作（Enhanced_Media_Helper）

- **桥协议**：`unsafeWindow.EMH_API`（EMH 3.6.1+ 挂载，3.6.4 起含 `previewAvwiki`，3.6.5 灯箱 z-index 2147483647）
- **z-index 约定**：scanner 宿主 `2147483000` < EMH 灯箱 `2147483647`——预览灯箱永远置顶；scanner 侧截图操作先收起 picker
- **iframe 注意**：EMH `@noframes` 不进 iframe；iframe 内 scanner 为精简模式（无操作条），桥只在顶层可用
- 完整协议说明见 `../integration/integration-emh-scanner.md`

## 技术债务与耦合点

### 结构性问题

1. **单文件巨型 IIFE（9983 行）**：无模块边界、无类型；函数提升掩盖前向引用
2. **分区注释与内容不符**：「字幕搜索」区混入网络层/加密/WebDAV；「UI」区含 fetch 型搜索源；「高亮选项」区混入 codeActions 存取
3. **隐式全局状态**：`state` + 模块级变量被所有分区读写
4. **DOM 重绘耦合**：`renderPanelList`（6178）锚定不重建逻辑与 picker toggle 语义互相缠绕——最容易出 bug 的区域
5. **代码重复**：`processTextNode` 与 `processCboxTextNode` 近乎一致；多个 render* 函数渲染相似数据
6. **存储双写 + 迁移副作用**：启动/导出/导入都触发 `mergeLegacyLocalIntoGlobalStore`
7. **字符串拼装 HTML**：大量 `innerHTML` 模板，XSS 面靠 `escapeHtml` 局部使用
8. **版本自愈 hack**：STYLE_VER/SCRIPT_VER 驱动 DOM 重建——**模板/样式变更必须同步升版本**，否则旧 DOM 不重建（v1.5.66 起弹窗操作栏依赖此机制）
9. **iframe/CSP 探测链复杂**：`probeHostFramePolicy` + `bindFrameGuard` + `markHostFrameBlocked` 三套机制叠加
10. **跨脚本桥依赖版本**：EMH_API 方法随 EMH 版本增加，scanner 需按方法存在性降级（`isEmhInstalled` / 方法级检查）

### 可抽取的独立模块（按依赖纯净度排序）

| 模块 | 来源行 | 理由 |
|---|---|---|
| 番号识别引擎 | 1513-1836 | 纯函数，零 DOM 依赖，可独立成库/worker |
| 存储层 + 站点总表 | 86-402 | 完整自洽，仅依赖 GM/localStorage |
| provider 注册表 | 1837-1937 | 无 UI 依赖 |
| 番号库桥 | 809-1150 | 依赖 `_pageWin` + 存储，逻辑独立，可抽成集成层 |
| 网络传输层 | gmRequest 3022 / proxies 3274 | 纯 Promise 封装 |
| 加密模块 | 3097-3190 | WebCrypto 独立 |
| WebDAV 客户端 | 3240-3330 | 依赖导出/加密，可参数化 |
| 高亮引擎 | 3801-4320 | 依赖识别 + provider + state.hl |
| UI 基础件 | 759-1512 | toast/copy/host/mount/scroll-lock/drag/hotkeys |
| 设计 token + 组件样式 | 4323 起 | 可抽成独立 css/设计系统源 |
| CBox 轻量路径 | 9612-9836 | 完全独立分支 |
| API 适配层 | 9897-9983 | 组装层 |

## 参考

- Enhanced_Media_Helper 架构见 `../enhanced-media-helper/architecture-enhanced-media-helper.md`
- 两脚本桥协议见 `../integration/integration-emh-scanner.md`
- standalone 模式见 `../enhanced-media-helper/standalone-mode.md`
