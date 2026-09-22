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
