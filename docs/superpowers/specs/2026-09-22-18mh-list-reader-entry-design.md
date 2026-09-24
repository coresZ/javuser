# 18mh 列表卡阅读器入口

日期：2026-09-22  
范围：`18mh/18mh.user.js` v4.5.2 → v4.6.0  
状态：已实现（v4.6.1 起改为悬停显示）

## 目标

站点列表页的**每张卡片**都能一键进果核阅读器。

## 交互

- 封面底部通栏「📖 阅读」（半透明黑条）
- **默认常显**；仅 `@media (hover:hover) and (pointer:fine)` 的桌面设备改为悬停封面（`.poster:hover`）才滑出
- 点击 → `?novel=<id>`，新标签打开；被拦截则回退同标签
- 点击不触发卡片自身的跳转（`preventDefault` + `stopPropagation`）

## 实现

- `markListCards()`：遍历卡片时对**所有**卡片调用 `addReaderBar(card, id)`（不再限于书库内的书）
- `addReaderBar`：定位 `.poster`（回退：卡片内首个 `img` 的父节点），必要时补 `position:relative`，追加 `.dm-dl-reader-bar`
- 幂等：重绘时先清 `.dm-dl-card-badge, .dm-dl-reader-bar`
- 面包屑等无封面图的节点因找不到 `.poster`/`img` 自动跳过

## 非目标

- 不改书库条目、Dock 的阅读入口
- 不加 hover 隐藏（移动端无 hover）
- 不改现有徽章与状态逻辑
