# 18mh 书目状态（连载/完结 + 更新时间）

日期：2026-09-22  
范围：`18mh/18mh.user.js` v4.2.0 → v4.3.0  
状态：已实现（v4.3.0）

## 目标

在书库面板与站点列表卡展示书籍「连载中/已完结」与更新时间，并提供书库刷新按钮。

## 数据源（站点内联，无需额外解析器）

- 列表卡：`.poster .dx-bg-linear` = 连载中/已完结；`span.mr-auto` = 「1小时前」
- 详情页：`main[data-novel-info]` 的 JSON `content_status`（serializing/…）；`.detail-page__meta-row span` 含「连载中」「2小时前 更新」

## 存储

- 新增 `dm_dl_status_v1`：`{ [id]: { status, statusText, updateText, checkedAt } }`
- `statusText` 归一为「连载中」/「已完结」；`updateText` 存站点原文
- 仅本机缓存，**不进 WebDAV**；同值不重复写

## 采集

- 被动（零额外请求）：
  - `markListCards` 对书库内（已下载/已收藏）的书读卡片状态并缓存
  - 详情页 `boot` 读 `document` 状态并缓存
- 主动（刷新按钮）：
  - 取 `loadHistory()` ∪ `loadFavs()`，按 id 去重，剔除 `loadBans()`
  - 并发 4 抓详情页，按钮显示 `刷新中 n/total` 并禁用
  - 完成 toast：成功/失败数；失败保留旧值

## 展示

- 书库条目 meta 行：状态胶囊 + `· 2小时前更新`（三个 tab 都显示；无缓存不显示状态）
- 站点列表卡：`.dm-dl-card-badge` 增加状态胶囊（连载中蓝 / 已完结灰）
- 书库标题栏新增 ⟳ 按钮（云同步按钮旁）

## 非目标

- 不改 WebDAV 载荷
- 不自动定时刷新
- 不隐藏/半透明卡片
