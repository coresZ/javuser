# jav-code-scanner.user.js · 架构梳理

> 架构文档（2026-08）。对应脚本 `jav-code-scanner.user.js` v1.5.47（8575 行，383,919 字节）。
> 所有行号锚点以该版本为准；脚本升级会平移行号。

## 概述

油猴用户脚本，功能覆盖：页面番号扫描、多源搜索、字幕搜索、页面高亮、自定义选择器点选、iframe 白名单、CBox 轻量高亮、快捷键/主题、全站备份（WebDAV 可加密）、`window.JavCodeKit` 公共 API。

主体是**单个严格模式 IIFE**（50-8575），按 12 个 `// ─── xxx ───` 分区注释组织。除 11 个分区横幅外，内部全部是函数声明 + 少量模块级 `let/const`，共享同一闭包；模块间通过闭包变量（`state`、`providersCache`、`_selPick` 等）和函数提升隐式耦合。

### 元信息

- `@run-at document-idle`；`@include` 覆盖 30+ 域名（jav*/av*/fc2*/missav*/javdb*/javlibrary*/dmm.co.jp/dmm.com/heyzo*/caribbeancom*/1pondo*/pacopaco*/xvideos*/pornhub*/xhamster*/reddit*/t66y/sis001/91porn/jable/avple/cbox.ws 等），`@exclude localhost/127.0.0.1`
- 授权：`GM_xmlhttpRequest` / `GM.xmlHttpRequest` / `GM_getValue` / `GM_setValue` / `GM_deleteValue` / `GM_listValues` / `unsafeWindow`；`@connect *`
- 防重入：`if (_pageWin.JavCodeKit && _pageWin.JavCodeKit.__ready) return;`（54）

## 分区地图

| 分区 | 起止行 | 功能 | 关键函数 |
|---|---|---|---|
| ① 基础设施 | 50–1039 | 常量/存储层/站点总表/iframe 白名单/state/主题/Toast/剪贴板/热键/视口宿主/拖拽 | `storeGetRaw` 96, `mergeLegacyLocalIntoGlobalStore` 209, `loadSitesMap` 244, `isFrameAllowHost` 467, `loadTheme` 594, `applyTheme` 605, `showToast` 643, `bindGlobalHotkeys` 790, `ensureHost` 868, `lockBodyScroll` 953, `bindDrag` 978 |
| ② 番号识别 | 1040–1363 | 番号解析/校验/DMM CID/三路扫描 | `makeCode` 1077, `fromDmmCid` 1089, `extractJavCode` 1149, `extractAllJavCodes` 1183, `uniqCodes` 1217, `scanAttrCodes` 1230, `scanStructuredCodes` 1290, `scanPageCodes` 1338 |
| ③ 搜索源 | 1364–1441 | provider CRUD + URL 模板 | `normalizeProvider` 1366, `loadProviders` 1379, `buildProviderUrl` 1431 |
| ④ 历史 | 1442–1466 | 最近搜索（上限 40） | `loadHist` 1444, `saveHist` 1453 |
| ⑤ 高亮选项 | 1467–1692 | hl 选项存取/自定义选择器解析/高亮清除 | `loadHlOpts` 1488, `parseNativeSelectorInput` 1541, `clearPageHighlight` 1589 |
| ⑥ 点选器 | 1693–2338 | 鼠标点选拾取 + 候选选择器生成 | `_selPick` 1694, `buildSelectorCandidates` 1746, `ensureSelPickUi` 1840, `startSelectorPick` 2271 |
| ⑦ 字幕+网络+加密+WebDAV | 2339–3191 | 字幕 API/下载 + 网络层 + 加密 + WebDAV 客户端 | `gmRequest` 2419, `deriveAesKey` 2496, `encryptConfigPayload` 2514, `webdavUploadConfig` 2631, `fetchTextViaProxies` 2769, `searchSubtitles` 3128, `openSubtitleSearch` 3087 |
| ⑧ 高亮引擎 | 3192–3699 | 内置链/卡片/全文/自定义范围高亮 | `bindCodeMarkClick` 3215, `enhanceNativeAnchorCodes` 3294, `codeFromAnchor` 3433, `enhanceExistingCodeLinks` 3488, `processTextNode` 3544, `applyCustomSelectorHighlight` 3588, `linkifyPage` 3657 |
| ⑨ UI | 3700–8163 | 全部样式 + 面板/大窗/选源/设置/备份 UI | `injectStyles` 3702（CSS 模板 3709–5107）, `ensurePanel` 5111, `renderPanelList` 5426, `ensurePopup` 5486, `ensurePicker` 6253, `openProviderPicker` 6314, `loadFrame` 6560, `exportConfigJson` 6655, `importConfigBundle` 6697, `runPopupSearch` 8049, `openSearch` 8098, `refreshScan` 8131 |
| ⑩ 启动 | 8164–8206 | 启动 + frame 策略静默探测 | `probeHostFramePolicy` 8167 |
| ⑪ CBox 轻量 | 8207–8431 | CBox 框内高亮 + 父页桥 | `cboxPost` 8209, `installCboxNavGuard` 8235, `linkifyCbox` 8323, `bootCboxLite` 8351, `bindCboxParentBridge` 8394 |
| ⑫ 公共 API | 8432–8575 | boot + kit 对象 | `boot` 8432, `kit` 8491（挂 `window.JavCodeKit` 8565-8568） |

### 规模分布（近似）

- CSS 模板字符串 3709–5107：约 1400 行（16%）
- UI 逻辑 5111–8163：约 3050 行
- 基础设施 50–1039：约 990 行
- 字幕/网络/加密/WebDAV 2339–3191：约 850 行
- 点选器 1693–2338：约 645 行
- 高亮引擎 3192–3699：约 510 行
- 番号识别 1040–1363：约 325 行
- CBox 8207–8431：约 225 行

## 核心数据流

### 启动（boot 8432）

```
IIFE 50 → 常量 → 存储层 96-176 → 站点总表 → 立即迁移遗留配置 mergeLegacyLocalIntoGlobalStore() 448
        → iframe 门禁（_inFrame 且非 CBox 且不在白名单 → return 499-500）
        → boot()（readyState==='loading' 时等 DOMContentLoaded 8570-8574）
```

`boot()` 四个分支：

1. **IS_CBOX**（59 行判定 cbox.ws）→ `bootCboxLite()`（8351），不进全站 UI
2. **embedLite**（582-587：iframe 内且顶层已有 `JavCodeKit.__ready`）→ 只 `injectStyles + refreshScan(true)` + MutationObserver（8450-8465），不挂浮钮/面板
3. **完整模式**：`ensurePanel → applyExtModeUi → refreshScan(true) → bindGlobalHotkeys → probeHostFramePolicy`，并注册 `MutationObserver`（body 子树，600ms 防抖 → `refreshScan(true)`，8475-8486）
4. iframe 非精简（顶层无 API）→ 完整 UI 跑在本 frame

### 番号扫描管线

`refreshScan(forceLinkify)`（8131）→ `scanPageCodes()`（1338）：

```
scanPageCodes:
  ① scanStructuredCodes()（1290）：结构化节点（.data h3 a / article.item / t66y / DMM 链），≤4000 节点
  ② 构造 text：title + pathname + search + href + og 标签 + TreeWalker 全文（≤5000 节点，跳过 SKIP_SEL）
  ③ extractAllJavCodes(text)（1183）：去 script/style/tag → CODE_FIND_RE(538) → extractJavCode 归一 + 小写 DMM CID 二次扫
  ④ scanAttrCodes()（1230）：location.href + ≤4000 个 a/area/[data-*]/img/source 的 href/data-id/src/srcset
  ⑤ uniqCodes(...)（1217）：extractJavCode||fromDmmCid 规范化去重 → state.codes
```

番号规范化链：`extractJavCode`（1149）→ `makeCode`（1077）→ `isPlausibleCode`（1053，黑名单 502/分辨率 527/画质前缀 533/年份拦截）/ `formatCodeNum`（1043）。DMM CID 走 `fromDmmCid`（1089）。

### 高亮管线

`linkifyPage()`（3657，`state.linkifyBusy` 互斥锁）：

```
① 用户自定义选择器 → applyCustomSelectorHighlight()（3588）：query 选择器 → 扫文本 → processTextNode
   only 模式直接 return（3672）
② enhanceExistingCodeLinks()（3488）：DEFAULT_NATIVE_LINK_SELS(406) 锚点 → codeFromAnchor(3433) 解析
   → enhanceNativeAnchorCodes(3294)（短叶子包 span 色标 / markInnerCodeNodes / markTextCodesInRoot）
③ 全文纯文本 walker（跳过 SKIP_SEL + a + .jcs-link + .jcs-code-mark）→ processTextNode(node, false)
```

`processTextNode`（3544）：a 外生成 `a.jcs-link`（createCodeLink 3364），a 内生成 `span[data-jcs-wrap="1"]` 色标。`bindCodeMarkClick`（3215）capture 阶段 click+keydown，`dataset.jcsMarkBound` 防重绑。清除走 `clearPageHighlight`（1589）/ `stripCodeMark`（1569）。

### 搜索 / 动作流

`openSearch(code, opts)`（8098）三分支：

1. 大窗已开或 forceFull → `runPopupSearch`（8049）：`rememberCode`（6069）→ 渲染 4 处列表 → `loadFrame(c)`（6560，先 about:blank 再赋 src，900ms frameWatch 兜底）
2. `preferExternalSearch()`（5998）→ `openProviderPicker(code, anchor)`（6314）：toggle 语义、`positionPickerNear`（6154）四向定位、document pointerdown 关闭
3. 否则（内嵌）→ runPopupSearch

`stepCode(±1)`（6605）→ openSearch(下一个码)。

字幕流：`openSubtitleSearch`（3087）→ `searchSubtitles`（3128，`subReqSeq` 竞态保护）→ `fetchSubtitleJson`（2822：GM → 迅雷字幕 API，失败回落 `fetchTextViaProxies` 2769：allorigins/corsproxy）→ `renderSubtitleList`（2929）→ `downloadSubtitleFile`（2844：GM blob → fetchBlobViaProxies 2782 → triggerBlobDownload 2829）。

## UI 体系

### 组件清单（NS = 'jcs'，全部 id 前缀 `jcs-`）

| 组件 | 根 id | 构建函数 | 说明 |
|---|---|---|---|
| 视口宿主 | `#jcs-host` | `ensureHost` 868 / `syncHostToViewport` 894 | fixed inset:0, z-index 2147483000, pointer-events:none |
| 样式 | `#jcs-styles` | `injectStyles` 3702 | data-ver=STYLE_VER 防重复 |
| Toast | `#jcs-toast` | `showToast` 643 | role=status, 1.6s 自动隐藏 |
| 浮钮 | `#jcs-fab` | `ensurePanel` 5119 | `#jcs-badge`/`.jcs-fab-ico`/`.jcs-fab-txt` |
| 扫描面板 | `#jcs-panel` | `ensurePanel` 5130 | `#jcs-q`/`#jcs-list`/`#jcs-ext-mode-btn`/`#jcs-theme-btn`/`#jcs-cfg-btn`/`#jcs-rescan` 等 |
| 搜索大窗 | `#jcs-popup` > `#jcs-win` | `ensurePopup` 5486 | `#jcs-ptitle/pprev/pnext/psub/pext/ptheme/pcfg/pclose`、`#jcs-providers`、`#jcs-pinput`、`#jcs-frame` |
| 设置层 | `#jcs-cfg` | `ensurePopup` 5565 / `toggleConfig` 7655 | 4 tab：general/highlight/sources/backup |
| 选源浮卡 | `#jcs-pick` | `ensurePicker` 6253 | `#jcs-pick-code/close/list`、`.jcs-pick-arrow` |
| 字幕弹窗 | `#jcs-sub` > `#jcs-sub-win` | `ensureSubtitleModal` 2981 | `#jcs-sub-q/orig/hist/list` |
| 点选器 | `#jcs-selpick` | `ensureSelPickUi` 1840 | `#jcs-selpick-mask/box/bar/confirm/input/cands` |
| 页内高亮 | — | 高亮引擎 | `a.jcs-link`、`.jcs-code-mark`、`span[data-jcs-wrap]`、`[data-jcs-bound]` |

### 事件绑定模式

1. 单点全局热键：`bindGlobalHotkeys`（790）唯一 document keydown capture，Esc 层级关闭集中于此
2. 遮罩点击关闭：root click 且 `e.target === root` → close（5812 popup、3027 sub）
3. 选源浮卡外部关闭：`document.addEventListener('pointerdown', onOutside, true)` capture（6302）
4. 显式 onclick 直绑：ensure* 构建时逐按钮绑定
5. 防重绑标志：`dataset.jcsBound`（3354）/`dataset.jcsMarkBound`（3222）/函数属性 `_bound`
6. Capture 阶段拦截：色标 click/keydown capture（3233-3234）、点选器 document capture（2323-2334）
7. 拖拽：`bindDrag`（978）；`setupFabDrag`（5273）8px 阈值区分点击与拖动
8. DOM 版本自愈：`data-ver !== SCRIPT_VER` 整体重建（1843、5490）
9. MutationObserver + 防抖：boot（8481）/embedLite（8459）/CBox（8367）三处，120-800ms
10. 滚动/视口同步：`syncHostToViewport`（882-889）

### 快捷键

- `Esc` 层级式关闭（从上到下）：点选器→字幕→选源→设置（先撤编辑/删除确认）→大窗→面板（796-844）；输入框内也可用
- `/`、`j`、`J`：聚焦搜索（大窗 `#jcs-pinput` / 面板 `#jcs-q`）
- 输入框 Enter：面板/大窗/字幕/搜索源表单
- 修饰键：chip/色标 Alt/Ctrl/Meta = 复制或强开大窗

### 主题系统

- CSS 变量：`:root` 定义全部 `--jcs-*` token（3711-3729），`html[data-jcs-theme="light"]` / `#jcs-host[data-theme="light"]` 覆盖浅色（3730-3744），dark 块重复（3745-3759）——**深色为默认，浅色为覆盖块**
- 应用：`applyTheme`（605）→ host `data-theme` + `colorScheme` + `documentElement[data-jcs-theme]` + 三个主题按钮文案
- 读取：`loadTheme`（594）存储 → `prefers-color-scheme` → 默认 dark
- 设计 token 清单详见 `docs/` 系列与 `.trellis/spec/frontend/design-system.md`

## 存储与状态

### GM 存储键（STORE_KEYS 81-85）

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
| SUB_OPT_KEY | `jcs_sub_filename_v1` | 字幕命名选项 |
| SUB_HIST_KEY | `jcs_sub_hist_v1` | 字幕历史（≤12） |
| SITES_KEY | `jcs_sites_map_v1` | hostname → 站点规则总表 |
| WEBDAV_KEY | `jcs_webdav_v1` | WebDAV 连接 + 加密配置 |

存储抽象（96-176）：`storeGetRaw/SetRaw/Remove/GetJson/SetJson/GetStr` 全部 **GM 优先、localStorage 回退且自动迁入 GM**；`lsPeekRaw/Json` 只读不迁（159-176）。

### state 对象（554-580）

`codes`（本页番号）、`active`（当前激活）、`provider`、`theme`、`viewed`（会话已浏览）、`linkifyBusy`（互斥锁）、`scrollLocked/scrollY`（滚锁）、`frameUrl/frameWatch`（iframe 状态）、`pickAnchor/pickRect/pickCloseTimer/pickPosRaf`（选源浮卡）、`subUseOriginalName`、`inFrame/embedLite`、`hl`、`cfgTab/cfgEditId/cfgDeleteId/cfgFlashId`、`cfgFrameDirty/cfgFramePrev`。

### 跨站存储迁移（mergeLegacyLocalIntoGlobalStore 209-242）

- IIFE 内**立即执行**（448），`collectConfigBundle`（6613）与 `importConfigBundle`（6697）内再调用
- 三类迁移：① 三个 hostname 列表本站 LS → 与 GM 合并；② 搜索源 GM 空则迁入；③ 其它全局键 GM 空用 LS 填充
- 站点总表 SITES_KEY 是**归一入口**：`buildAllSitesSnapshot`（263）合并成 hostname → 规则对象；`applySitesSnapshot`（361）反向还原
- 备份包格式（`collectConfigBundle` 6613）：`{app, scope, storage, bundleVersion:3, scriptVersion, exportedAt, siteCount, global, sites, data}`；账号密码与历史不导出

## 公共 API（window.JavCodeKit，kit 8491-8563）

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
| 杂项 | `getCodes` / `copyCode` / `getTheme` / `setTheme` / `toggleTheme` / `getSubUseOriginalName` / `setSubUseOriginalName` |

CBox 精简 API（8380-8390）：`{__ready, __cboxLite, extract, extractAll, linkify}`。

## 技术债务与耦合点

### 结构性问题

1. **单文件巨型 IIFE（8575 行）**：无模块边界、无类型；函数提升掩盖前向引用
2. **分区注释与内容不符**：「字幕搜索」区（2339-3191）混入网络层/加密/WebDAV（实际服务备份）；「UI」区（3700-8163）样式/面板/大窗/设置/备份全塞一起
3. **隐式全局状态**：`state` + 6 个模块级变量 + `_selPick` 被所有分区读写
4. **DOM 重绘耦合**：`renderPanelList`（5426）锚定不重建逻辑与 `pickerAnchoredInPanelList`（5382）、`openProviderPicker`（6314）toggle 语义互相缠绕——**最容易出 bug 的区域**（多处注释在打补丁）
5. **代码重复**：`processTextNode`（3544）与 `processCboxTextNode`（8279）近乎一致；多个 render* 函数渲染相似数据
6. **存储双写 + 迁移副作用**：启动/导出/导入都触发 mergeLegacyLocalIntoGlobalStore
7. **字符串拼装 HTML**：大量 `innerHTML` 模板，XSS 面靠 `escapeHtml`（2388）局部使用
8. **版本自愈 hack**：STYLE_VER/SCRIPT_VER 驱动 DOM 重建
9. **iframe/CSP 探测链复杂**：`probeHostFramePolicy`（8167）+ `bindFrameGuard`（6518）+ `markHostFrameBlocked`（6418）三套机制叠加，状态分散三处

### 可抽取的独立模块（按依赖纯净度排序）

| 模块 | 来源行 | 理由 |
|---|---|---|
| 番号识别引擎 | 1040-1363 | 纯函数，零 DOM 依赖（scan* 除外），可独立成库/worker |
| 存储层 + 站点总表 | 96-402 | 完整自洽，仅依赖 GM/localStorage |
| provider 注册表 | 1364-1441 | 无 UI 依赖，被高亮/搜索/备份共用 |
| 网络传输层 | gmRequest 2419 / proxies 2769 | 纯 Promise 封装 |
| 加密模块 | 2488-2582 | WebCrypto 独立 |
| WebDAV 客户端 | 2584-2718 | 依赖导出/加密，可参数化 |
| 高亮引擎 | 3192-3699 | 依赖识别 + provider + state.hl |
| UI 基础件 | 643-1038 | toast/copy/host/mount/scroll-lock/drag/hotkeys，与业务无关 |
| 设计 token + 组件样式 | 3709-5107 | 可抽成独立 css/设计系统源 |
| CBox 轻量路径 | 8207-8431 | 完全独立分支 |
| API 适配层 | 8491-8568 | 组装层 |

## 参考

- 视觉/交互约束的通用化约定见 `.trellis/spec/frontend/design-system.md`
- 两脚本视觉体系对比见任务 research：`.trellis/tasks/08-07-javcode-architecture-design-system/research/ui-comparison.md`
