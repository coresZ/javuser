# 18mh 果核阅读器直连

日期：2026-09-22  
范围：`18mh/18mh.user.js` v4.3.0 → v4.4.0  
状态：已实现

## 目标

书库与站点书页提供跳转果核阅读器 `https://fixreader.vercel.app/` 的入口。

## 契约

- `?novel=<书籍id>` 打开指定书
- `?q=<关键字>` 按关键字搜索

## 入口

- **书库条目（已收藏 / 已下载）**：操作区新增「阅读」按钮，保留「打开」「删除」；已拉黑 tab 不加
  - 点「阅读」→ `?novel=<id>`
- **站点 Dock（详情页 / 阅读页）**：悬浮条新增书本图标按钮
  - 有 `novelId` → `?novel=<id>`；无 id → `?q=<书名>`

## 实现

- `READER_BASE` + `readerUrlById(id)` / `readerUrlByQuery(q)`
- `openReader(url)`：`window.open(url, '_blank', 'noopener')`，被拦截时回退同标签 `location.href`
- 图标 `ICONS.book`（Lucide book-open）；`.dm-dl-mini.read` 悬停蓝色
- 纯跳转，不需要 `@connect`

## 非目标

- 不改「打开」行为（仍跳 18mh 详情页）
- 不改 WebDAV 载荷
- 不给站点列表卡加阅读入口
- 不改书库条目主体点击
