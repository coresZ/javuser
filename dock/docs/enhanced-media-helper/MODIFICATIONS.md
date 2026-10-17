# MODIFICATIONS · dock/docs/enhanced-media-helper/

> 本目录协议：修改本目录任意文档前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。

## 项目约束（enhanced-media-helper 文档域）

- 本目录只放 **Enhanced_Media_Helper（EMH）单项目文档**：架构说明、功能设计（如 standalone 模式）。
- 与 JCS 的协作协议放 `dock/docs/integration/`；JCS 侧文档放 `dock/docs/jav-code-scanner/`。
- 文档内引用其它目录文档一律用**相对路径**（如 `../integration/integration-emh-scanner.md`）。
- 文档头部必须标注对应脚本版本号（如 v3.7.2+），脚本版本推进时同步更新版本锚点与行号基准。
- 编码统一 UTF-8 **无 BOM**；中文正文，代码示例保留原格式。
- EMH 对外 API 以 `EMH_API`（mountPublicApi）为准；对外契约变更须同步核对 `docs/integration/integration-emh-scanner.md` 的 API 参考表。

## 2026-09-07 · 文档重组落位（迁移）

**功能**：按项目分域整理 docs/，EMH 文档归入本目录。

**修改内容**：
- `architecture-enhanced-media-helper.md` 由 `git mv` 自 `docs/` 迁入，文内 3 处交叉引用更新为相对路径（standalone 同目录、integration、jav-code-scanner 各 1 处）。
- `standalone-mode.md` 由 `git mv` 自 `docs/` 迁入（文内无外部引用，未改动内容）。

**涉及文件与位置**：
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`（迁移 + 引用修复 :187-189 区域）
- `docs/enhanced-media-helper/standalone-mode.md`（纯迁移）

## 2026-10-07 · 修复 javgg featured 列表链接不可点击（同步架构文档版本）

**功能**：修 bug 后同步文档版本锚点。

**修改内容**：
- `architecture-enhanced-media-helper.md` 头部版本锚点 `v3.7.2（约 4640 行）` → `v3.7.4（约 4746 行）`；版本策略补记 3.7.4 修复 `emh-javgg-controls` 溢出被相邻卡片覆盖不可点击。

**涉及文件与位置**：
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`（:3 版本锚点、:24 版本策略）

## 2026-10-17 · JCS 架构引用改到使用指南

**功能**：JCS 行号架构文档已删除，本目录仅改交叉引用，不改 EMH 架构正文。

**修改内容**：
- `architecture-enhanced-media-helper.md` 参考节的 scanner 链接改为 `../jav-code-scanner/README.md`。

**涉及文件与位置**：
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`（参考节）
- 对应脚本改动见根目录 `Enhanced_Media_Helper.js`（该目录无 MODIFICATIONS.md）

## 2026-10-07 · 面板新增「未标记」筛选 tab（EMH v3.7.5）

**功能**：番号库面板的筛选 tab 由「全部 / 关注 / 已看 / 回收站」扩展为含「未标记」，补齐此前只能逐个看状态标签、无法集中处理未标记番号的缺口。

**修改内容**：
- 脚本 `Enhanced_Media_Helper.js`（根目录，无独立 MODIFICATIONS.md）：
  - 数据层新增 `CODE_LIBRARY.getUnmarked()`，口径为 `status !== 'favorite' && status !== 'watched'`——与 `STATUS_TEXT`/`StatusTag` 对缺失或未知 `status` 兜底显示「未标记」一致，避免旧数据/外部导入条目在关注、已看、未标记三栏都查不到；
  - 面板接线：`unmarkedList` 数据源 + `currentFilter === 'unmarked'` 列表路由、空态文案「暂无未标记番号」、`EMPTY_ICONS.unmarked` 标签形图标、`tabDefs` 新增 `{f:'unmarked', label:'未标记'}`（置于「已看」与「回收站」之间）；
  - 样式：`.emh-panel-tabs` 增 `overflow-x: auto` + 隐藏滚动条，tab 按钮增 `flex-shrink: 0; white-space: nowrap`，防止第五个 tab 在窄面板/移动端挤压换行；
  - 版本：`@version` 3.7.4 → 3.7.5，`EMH_API.version` '3.7.3' → '3.7.5'（对外 API 表面未变：`exportData(filter)` 白名单本就含 `unmarked`）。
- 本目录文档：`architecture-enhanced-media-helper.md` 头部版本锚点 → v3.7.5（约 4759 行）、概述第 1 条补「未标记」、版本策略补记 3.7.5。

**验证**：
- `node --check Enhanced_Media_Helper.js` 通过；
- 临时接线/谓词校验脚本（提取脚本内真实 `getUnmarked` 实现后执行）：未标记集合 = `unmarked` + 缺失 status + 未知 status 条目，且与关注/已看构成全部条目的无重叠划分；tab 顺序、空态、图标、导出白名单、版本两处同步均通过（脚本用后即删）。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`（`:3` 版本、`:200-205` `getUnmarked`、`:2464` `EMPTY_ICONS.unmarked`、`:3746` 列表路由、`:3800` 空态、`:3823` tabDefs、`:4085-4091` tab 栏样式、`:4638` `EMH_API.version`）
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`（`:3`、`:10`、`:24`）

**已知遗留**：架构文档里的行号锚点从 v3.7.4 起已整体滞后。2026-10-17 起以函数名为准，不再用行号定位。

## 2026-10-17 · 番号库入口收进悬浮坞（EMH v3.7.6）

**功能**：页面上已有 `PageDock` 时，番号库不再单独放右下角按钮。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.5 → 3.7.6。
- `createToggleButton` 检测到 `PageDock.register` 时登记「番号库」，点击调用 `showPanel`。独立页和没有悬浮坞时仍创建原来的按钮。
- 架构文档版本锚点改为 v3.7.6，版本策略补记本次行为。行号地图未重标。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`、`@version`、`EMH_API.version`
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`：版本锚点与版本策略

## 2026-10-17 · 悬浮坞改为本地库引用（EMH v3.7.7）

**功能**：番号库通过 `@require` 引入悬浮坞库，不再依赖另一个独立启用的用户脚本。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.6 → 3.7.7。
- 元信息增加 `@require file:///D:/source/javuser/page-dock.user.js`。
- `createToggleButton` 先 `PageDock.mount()`，再 `register`。登记走解析到的 `dockApi`，不假设它一定挂在 `unsafeWindow`。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：元信息、`createToggleButton`

## 2026-10-17 · 悬浮坞开关控制整个番号库脚本（EMH v3.7.15）

**功能**：开关不再只关面板，而是停掉番号库脚本的页面功能。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.14 → 3.7.15。
- 状态写入 `emh_script_enabled`。关闭后不再跑站点注入；已注入的状态点和 javgg 控件通过 `html.emh-script-off` 隐藏，面板关闭。
- 再打开时重新执行站点注入。独立页不受这个开关影响。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`setScriptEnabled`、`main`、`createToggleButton`、核心样式

## 2026-10-17 · 关闭后点番号库无反应（EMH v3.7.16）

**功能**：脚本关闭后，点悬浮坞里的番号库名字不会重新打开。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.15 → 3.7.16。
- 菜单 `onClick` 在 `scriptEnabled` 为假时直接返回。重新启用只走开关。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`

## 2026-10-17 · 番号库开关收进悬浮坞（EMH v3.7.14）

**功能**：悬浮坞菜单里的番号库可以打开和关闭面板。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.13 → 3.7.14。
- 登记时提供 `onToggle`：开调用 `showPanel`，关调用 `hidePanel`。
- 订阅 `PanelStore`，面板从其它入口打开或关闭时同步开关状态。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`

## 2026-10-17 · 改用 Greasy Fork 悬浮坞库（EMH v3.7.9）

**功能**：番号库引用已发布的 PageDock 库，不再依赖本地文件或独立启用。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.8 → 3.7.9。
- `@require https://update.greasyfork.org/scripts/600709/1965283/PageDock.js`。
- 登记前调用 `PageDock.mount()`。线上库是 v1.3.1，不调用 `mount()` 不会画出图标。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：元信息、`createToggleButton`
