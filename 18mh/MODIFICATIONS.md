# MODIFICATIONS · 18mh/

> 本目录协议：修改本目录任意文件前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。

## 项目约束

- 单文件油猴脚本 `18mh.user.js`；`@version` 与功能变更同步递增。
- 收藏存 `dm_dl_favorites_v1`，黑名单存 `dm_dl_blacklist_v1`（GM + localStorage）；下载记录/章节缓存不进 WebDAV。
- 拉黑时若已收藏则取消收藏；取消拉黑不恢复收藏。
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
