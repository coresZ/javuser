# 18mh 书籍黑名单标记

日期：2026-09-20  
范围：`18mh/18mh.user.js` v4.1.0 → v4.2.0  
状态：已实现（v4.2.0）

## 目标

按小说 id 标记黑名单：详情/阅读可开关，列表与标题打标，书库可管理，WebDAV 与收藏一并同步。不隐藏卡片。

## 数据

- 存储键：`dm_dl_blacklist_v1`（GM + localStorage，与收藏同一 `loadJSON`/`saveJSON`）
- 记录：`{ id, title, url, time, timeText }`，与收藏同形
- 拉黑与下载独立；拉黑时若已收藏则立刻 `removeFavorite`
- 取消拉黑不恢复收藏

## UI

- 详情/阅读 Dock：收藏按钮旁增加禁书按钮（交互同收藏：点按切换、toast、刷新徽章）
- 列表页 Dock 不加禁书按钮，只打标
- 详情标题：`#dm-dl-ban-badge` 文案「已拉黑」
- 列表卡：独立 `.dm-dl-card-badge.ban`，可与已下载/已收藏并存
- 书库第三 tab「已拉黑」：搜索、打开、删除=取消拉黑、底栏「清空记录」清当前 tab
- 导出列表对黑名单 tab 同样导出 txt

## WebDAV

- 仍一个文件 `18mh-favorites.json`
- 载荷 v2：

```json
{
  "app": "18mh",
  "kind": "favorites",
  "v": 2,
  "exportedAt": "...",
  "items": [ "收藏记录" ],
  "blacklist": [ "黑名单记录" ]
}
```

- `items` 仍是收藏（webdev-component 强制要求数组）
- 下载：先按 id 合并收藏，再按 id 合并黑名单，最后对黑名单内 id 从收藏中剔除（拉黑优先）
- 旧备份无 `blacklist`：只合并收藏
- 面板说明改为同步收藏和黑名单

## 非目标

- 不隐藏、不半透明列表卡
- 不注册油猴菜单
- 不改 webdev-component 源码
- 不同步下载记录/章节缓存
