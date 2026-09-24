# MODIFICATIONS · 18mh/

> 本目录协议：修改本目录任意文件前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。

## 项目约束

- 单文件油猴脚本 `18mh.user.js`；`@version` 与功能变更同步递增。
- 收藏存 `dm_dl_favorites_v1`，黑名单存 `dm_dl_blacklist_v1`，书目状态存 `dm_dl_status_v1`（GM + localStorage）；下载记录/章节缓存/状态不进 WebDAV。
- 拉黑时若已收藏则取消收藏；取消拉黑不恢复收藏。
- 状态刷新范围 = 已下载 ∪ 已收藏，按 id 去重并排除已拉黑。
- WebDAV 走 Greasy Fork 库 `webdev-component`（`@require`），接入方只接线，不改库源码、不自写表单。
- iOS / 全端均不注册 `GM_registerMenuCommand`；入口只有书库标题栏一个设置按钮。
- WebDAV 下载合并：远端同 id 覆盖，本地独有保留；黑名单 id 从收藏中剔除。

## 2026-09-20 · 收藏 WebDAV 同步

**功能**：书库接入 webdev-component，仅同步收藏。

**修改内容**：
- 元数据：`@version` 4.0.0 → 4.1.0；`@require` webdev-component v1.3.2；`@connect *`。
- `createWebdev({ menu:false })`：收藏 `{items}` 载荷、GM 存储、`GM_xmlhttpRequest`。
- 书库标题栏云朵按钮打开库自带面板；下载后按 id 合并收藏并刷新书库/徽章。

**涉及文件与位置**：
- `18mh/18mh.user.js` 头、`ICONS.cloud`、书库 `.dm-dl-hd-acts`、`initWebdav` / `openWebdavPanel` / `mergeFavsFromPack`

## 2026-09-20 · 书籍黑名单标记

**功能**：按小说 id 打标拉黑；Dock 开关；书库 tab；WebDAV 与收藏一并同步。

**修改内容**：
- `@version` 4.1.0 → 4.2.0。
- `BAN_KEY` + Dock 禁书按钮 + 标题/列表卡「已拉黑」徽章（不隐藏卡片）。
- 书库第三 tab「已拉黑」；拉黑时取消收藏。
- WebDAV 载荷 v2 增加 `blacklist[]`；下载先合并收藏再合并黑名单，拉黑优先。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`toggleBan` / `injectTitleBadges` / `markListCards` / 书库 tab / `exportLibraryPayload`
- `docs/superpowers/specs/2026-09-20-18mh-book-blacklist-design.md`

## 2026-09-22 · 书目状态（连载/完结 + 更新时间）

**功能**：书库与站点列表卡展示书目状态与更新时间，书库提供刷新按钮。

**修改内容**：
- `@version` 4.2.0 → 4.3.0。
- 新增 `dm_dl_status_v1` 缓存；列表卡与详情页被动采集，同值不重写。
- 书库标题栏 ⟳ 按钮：并集(已下载∪已收藏) 去重、排除已拉黑，并发 4 抓详情页，带进度。
- 书库条目与列表卡显示「连载中/已完结」胶囊与更新时间。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`STATUS_KEY` / `recordStatus` / `readCardStatus` / `readDetailStatus` / `refreshLibraryStatus` / `markListCards` / `renderSheetBody` / `boot`
- `docs/superpowers/specs/2026-09-22-18mh-book-status-design.md`

## 2026-09-22 · 果核阅读器直连

**功能**：书库与站点书页跳转果核阅读器 `fixreader.vercel.app`。

**修改内容**：
- `@version` 4.3.0 → 4.4.0。
- 书库「已收藏/已下载」条目新增「阅读」按钮 → `?novel=<id>`（已拉黑不加）。
- 站点 Dock 新增书本按钮 → 有 id 用 `?novel=<id>`，否则 `?q=<书名>`。
- 新增 `READER_BASE` / `readerUrlById` / `readerUrlByQuery` / `openReader`、`ICONS.book`。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`READER_BASE` 段 / `ICONS.book` / `buildDockUI` / `renderSheetBody`
- `docs/superpowers/specs/2026-09-22-18mh-reader-link-design.md`

## 2026-09-22 · Dock 动作菜单（⋯）

**功能**：Dock 图标按钮过多/无标签 → 收藏/拉黑/阅读收进「⋯」气泡。

**修改内容**：
- `@version` 4.4.0 → 4.5.0。
- Dock 改为 `[主按钮][书库][⋯][收起]`；移除独立收藏/拉黑/阅读按钮。
- `⋯` 气泡：紧贴按钮下方 6px、右对齐、宽 78px（移动端 96px）；四项 收藏/拉黑/阅读/分享。
- 已收藏/已拉黑时行文字切换，`⋯` 高亮 + 红点；点击外部/Esc/滚动关闭。
- 新增 `ICONS.more` / `ICONS.share`、`copyText` / `shareNovel`。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`openDockMenu` / `closeDockMenu` / `buildDockMenuRows` / `syncMenuBtnState` / `shareNovel` / `buildDockUI`
- `docs/superpowers/specs/2026-09-22-18mh-dock-action-menu-design.md`

## 2026-09-22 · 修复：收藏状态配色 + 面板靠边溢出

**功能**：修两个 UI bug。

**修改内容**：
- `@version` 4.5.0 → 4.5.1。
- 收藏/拉黑恢复红色语义：菜单行图标按状态着色（已收藏粉红 / 已拉黑灰白），`⋯` 按钮已收藏时粉红高亮。
- `anchorPopoverToDock` 水平夹取 + 按 Dock 所在半屏切换锚定边，修复 Dock 贴左时面板溢出屏幕。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`anchorPopoverToDock` / `syncMenuBtnState` / `buildDockMenuRows` / Dock 菜单 CSS

## 2026-09-22 · 修复：章节页取到章节名当书名

**功能**：修 bug。

**修改内容**：
- `@version` 4.5.1 → 4.5.2。
- `getNovelTitle()` 优先读 `main[data-novel-info]` 的 `novel_title`（详情页/章节页都有），章节页不再把 `h1`（章节名）当书名。
- 影响：章节页收藏/拉黑的入库标题、分享文案、下载 TXT 文件名。
- 已存错的旧收藏条目不会自动修正，需重新收藏一次。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`readNovelTitleFromPage` / `getNovelTitle`

## 2026-09-22 · 列表卡阅读器入口

**功能**：站点列表页每张卡片封面底部加「📖 阅读」，一键进果核阅读器。

**修改内容**：
- `@version` 4.5.2 → 4.6.0。
- `markListCards` 对所有卡片（不限书库内）调用 `addReaderBar`。
- 新增 `.dm-dl-reader-bar` 样式与 `addReaderBar`；点击 `preventDefault` 不触发卡片跳转；重绘时清理。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`addReaderBar` / `markListCards` / 列表卡 CSS
- `docs/superpowers/specs/2026-09-22-18mh-list-reader-entry-design.md`

## 2026-09-22 · 列表卡阅读条改为悬停显示

**功能**：阅读条默认隐藏，悬停封面才滑出。

**修改内容**：
- `@version` 4.6.0 → 4.6.1。
- `.dm-dl-reader-bar` 默认 `opacity:0` + `translateY(100%)` + `pointer-events:none`；`.poster:hover` 显示。
- `@media (hover:none)` 触屏设备保持常显。

**涉及文件与位置**：
- `18mh/18mh.user.js`：列表卡 CSS

## 2026-09-22 · 收藏更新提醒

**功能**：收藏的连载书有新章时 toast + 书库红点提醒。

**修改内容**：
- `@version` 4.6.1 → 4.7.0。
- 新增 `dm_dl_updates_v1`（`lastCheckAt` + 每书 `maxId` 基线、`add` 未读新增数）。
- 检查范围仅收藏；并发 4 抓详情页对比最新章 id。
- 触发：进站延迟 3s 静默（6 小时阈值、每会话一次）+ 书库标题栏铃铛按钮。
- 提醒：toast 汇总 + 书库按钮红点 + 条目「有更新 +N」；打开书库先渲染再清标记。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`UPD_KEY` / `checkFavUpdates` / `fetchChapterLists` / `notifyUpdates` / `clearUpdateMarks` / `hasPendingUpdates` / `maybeAutoCheckUpdates` / `openSheet` / `renderSheetBody` / `buildDockUI`
- `docs/superpowers/specs/2026-09-22-18mh-fav-update-alert-design.md`

## 2026-09-22 · 修复：移动端列表阅读条不显示

**功能**：修 bug。

**修改内容**：
- `@version` 4.7.0 → 4.7.1。
- `.dm-dl-reader-bar` 改为**默认常显**，仅 `@media (hover:hover) and (pointer:fine)` 的桌面设备才悬停显示（原先靠 `@media (hover:none)` 兜底，移动端不可靠）。
- 新增 `readNovelIdFromPage()`：URL 解析不到书籍 id 时，回退读 `main[data-novel-info].novel_id` / 面包屑链接（预防性，`buildDockUI`、`boot` 已接入）。

**涉及文件与位置**：
- `18mh/18mh.user.js`：列表卡 CSS / `readNovelIdFromPage` / `buildDockUI` / `boot`
