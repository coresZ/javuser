# 18mh 收藏更新提醒

日期：2026-09-22  
范围：`18mh/18mh.user.js` v4.6.1 → v4.7.0  
状态：已实现

## 目标

收藏的连载书有新章时提醒用户。

## 存储

`dm_dl_updates_v1`：

```json
{ "lastCheckAt": 0, "items": { "<id>": { "maxId": 74, "title": "书名", "add": 3 } } }
```

- `maxId`：上次见到的最新章 id（基线）
- `add`：未读的新增章数（累加，打开书库时清零）
- 首次检查只写基线、不提醒

## 检查

- 范围：**仅 `loadFavs()`**（去重；不含拉黑/已下载）
- 并发 4 抓详情页 → `parseChaptersIn` 取最新章 id
- `latestId > baseline.maxId` → `delta = 大于基线的章数`，`add = (旧 add) + delta`
- 结果 `[{id,title,add,delta}]`

## 触发

- **进站静默**：`setTimeout(…, 3000)`，距 `lastCheckAt` 超 6 小时才跑，每会话仅一次
- **手动**：书库标题栏「检查更新」铃铛按钮，立即检查

## 提醒

- 有更新：toast「收藏有更新（N 本）」+ 书库按钮（☰，列表页为主按钮）加红点
- 打开书库：**先渲染**（保住本轮「有更新 +N」标签）再清 `add` 与红点
- 书库条目显示「有更新 +N」琥珀色小标

## 非目标

- 不用 `GM_notification` 系统通知
- 不做定时轮询
- 不检查拉黑/已下载的书
