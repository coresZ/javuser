# MODIFICATIONS · dock/

> 本目录协议：修改本目录任意文件前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。

## 项目约束

- 本目录只放已经接入 `PageDock` 的脚本：`page-dock.user.js`、`jav-code-scanner.user.js`、`Enhanced_Media_Helper.js`、`jable & miss.user.js`。
- 悬浮坞一行有两个控件：左边开关对应面板，右边开关整个脚本。脚本关闭时左边变灰，点了没有反应。
- JCS 行为变化仍要同步 `dock/docs/jav-code-scanner/`。EMH 行为变化仍要同步 `dock/docs/enhanced-media-helper/`。跨脚本桥文档在 `dock/docs/integration/`。
- 历史修改记录留在仓库根 `MODIFICATIONS.md`。2026-10-17 移入本目录之后的目录级变更写在这里。

## 2026-10-17 · 建立悬浮坞脚本目录

**功能**：已接入悬浮坞的四个脚本集中放置。

**修改内容**：
- 自仓库根目录移入四个脚本，文件名不变。
- Greasy Fork 的 `@require` 地址不因本地目录变化而改变。

**涉及文件与位置**：
- `dock/page-dock.user.js`
- `dock/jav-code-scanner.user.js`
- `dock/Enhanced_Media_Helper.js`
- `dock/jable & miss.user.js`

## 2026-10-17 · 悬浮坞相关文档移入 dock/docs

**功能**：已接入悬浮坞的脚本文档跟脚本放在同一目录树下。

**修改内容**：
- `docs/jav-code-scanner/`、`docs/enhanced-media-helper/`、`docs/integration/` 移到 `dock/docs/`。
- 仓库 README、AGENTS、PROJECT-STATUS、手册页脚、扩展 skill 和脚本内契约注释改为新路径。
- 三个文档域内部的相对链接保持 `../`，因为它们仍是同级目录。

**涉及文件与位置**：
- `dock/docs/jav-code-scanner/`
- `dock/docs/enhanced-media-helper/`
- `dock/docs/integration/`

## 2026-10-17 · 项目文档对齐当前目录

**功能**：接手文档不再指向已删除的 `PROJECT-STATUS.md`，版本和入口说明与当前脚本一致。

**修改内容**：
- 根 README 改为当前仓库地图。悬浮坞脚本版本和左右控件规则写在 `dock/` 小节。
- AGENTS 不再要求维护 `PROJECT-STATUS.md`。
- JCS 使用指南补充「扫描」左右控件。EMH 架构锚点改为 v3.7.17，并注明行号不再作为定位依据。
- 集成指南版本锚点改为 scanner v1.5.94 / EMH v3.7.17。

**涉及文件与位置**：
- `README.md`
- `AGENTS.md`
- `dock/docs/jav-code-scanner/README.md`
- `dock/docs/enhanced-media-helper/architecture-enhanced-media-helper.md`
- `dock/docs/integration/integration-emh-scanner.md`

## 2026-10-17 · 全屏时字幕跟着全屏元素

**功能**：视频全屏时字幕不再被挡在全屏层外面。

**修改内容**：
- `jable & miss.user.js` 5.23 → 5.24。
- 字幕层平时挂在 `body`，使用 fixed。进入全屏后挂进 `fullscreenElement`，改用 absolute。
- 监听 `fullscreenchange` 和 `webkitfullscreenchange`。退出全屏后回到 `body`。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`Renderer.subtitleHost`、`forceDomSubtitleLayer`

## 2026-10-17 · 全屏字幕按视频画面定位

**功能**：全屏后字幕不再相对整个播放器盒子定位。

**修改内容**：
- `jable & miss.user.js` 5.24 → 5.25。
- 用当前视频的可视矩形计算字幕的 `left`、`top` 和宽度。横向、垂直滑杆仍按画面百分比生效。
- 字幕底部对齐计算出的位置，避免多行字幕向上挤出画面。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`Renderer.placeSubtitle`

## 2026-10-17 · 从悬浮坞打开后面板不再漂移

**功能**：点 CC 打开面板后，再点面板内容不会把面板拽走。

**修改内容**：
- `jable & miss.user.js` 5.25 → 5.26。
- 打开时改走 `placeDock`，同步内部坐标和元素位置。后续点击或窗口缩放都按这个位置重排。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`openPanel`

## 2026-10-17 · 脚本自己关闭面板时同步悬浮坞

**功能**：面板由脚本自己的关闭按钮、点击空白或 Esc 关闭时，悬浮坞左边状态跟着关掉。

**修改内容**：
- 字幕脚本 5.26 → 5.27。所有关闭字幕面板的路径都走 `closePanel()`，并调用 `setActive`。
- EMH 3.7.17 → 3.7.18。`PanelStore.set` 发现 `visible` 变化时同步 `emh-library`。
- JCS 1.5.94 → 1.5.95。关闭按钮、Esc、原浮钮切换和主动打开都同步 `jcs-scanner`。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`closePanel`
- `dock/Enhanced_Media_Helper.js`：`PanelStore.set`
- `dock/jav-code-scanner.user.js`：面板打开与关闭路径

## 2026-10-17 · 扫描数量显示在悬浮坞

**功能**：原浮钮上的扫描数量改到悬浮坞「扫描」旁边。

**修改内容**：
- JCS 1.5.95 → 1.5.96。
- `renderPanelMeta` 调用已有的 `PageDock.setBadge('jcs-scanner', 数量)`。没有结果时清空。超过 99 显示 `99+`。
- 不改悬浮坞。

**涉及文件与位置**：
- `dock/jav-code-scanner.user.js`：`renderPanelMeta`

## 2026-10-17 · Jable 评论时间并入字幕脚本

**功能**：评论时间列表只在 Jable 启用，默认打开，和 CC 共用同一个脚本开关。

**修改内容**：
- `jable-time-jump.js` 1.9.0 → 1.10.0。去掉自动启动，改为 `window.JableTimeJump.setEnabled`。关闭时移除时间列表。
- 字幕脚本 5.27 → 5.28。`@require ./jable-time-jump.js`。脚本开关变化时同步时间列表。
- Missav 页面不调用这个模块。

**涉及文件与位置**：
- `dock/jable-time-jump.js`：`setEnabled`
- `dock/jable & miss.user.js`：`@require`、`setScriptEnabled`

## 2026-10-17 · 评论时间代码直接迁入字幕脚本

**功能**：不再通过独立文件或 `@require` 挂评论时间功能。

**修改内容**：
- 字幕脚本 5.28 → 5.29。
- `jable-time-jump.js` 的时间解析、评论链接、自动加载和时间列表代码直接放进字幕脚本的 `JableTimeJump`。
- 删除 `dock/jable-time-jump.js`。Jable 上仍和 CC 共用 `STATE.enabled`，Missav 不启动。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`JableTimeJump`
- `dock/jable-time-jump.js`：删除

## 2026-10-17 · 时间列表显隐只跟右侧开关

**功能**：评论更新不能在脚本关闭后把时间列表重新画出来。

**修改内容**：
- 字幕脚本 5.29 → 5.30。
- `JableTimeJump.setEnabled` 写入 `timeEnabled`。`renderSidebar` 在关闭时直接移除列表，不再因为评论变化重建。
- 列表上的关闭也走同一个关闭状态。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`timeEnabled`、`renderSidebar`、`setEnabled`

## 2026-10-17 · 右侧开关当场控制时间列表

**功能**：不刷新页面，右侧开关关闭就隐藏时间列表，打开就重新显示。

**修改内容**：
- 字幕脚本 5.30 → 5.31。
- 开关不再直接调用内层的 `JableTimeJump`。它在另一个函数作用域里，调用不到。
- 改为派发 `msv-script-enabled`。时间模块监听后立刻移除或重建列表。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`setScriptEnabled`、`JableTimeJump.setEnabled`

## 2026-10-17 · 评论时间显示在进度条上

**功能**：时间点和时间段画在播放器进度条上，全屏时跟着进度条显示。

**修改内容**：
- 字幕脚本 5.31 → 5.32。
- 单个时间画成刻度，时间段画成区间。点击跳到起点。
- 右侧开关关闭时，进度条标记和时间列表一起移除。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`renderProgressMarks`

## 2026-10-17 · 全屏右侧时间刻度

**功能**：全屏时不再把时间点压在进度条上，改为播放器右侧的横向刻度。

**修改内容**：
- 字幕脚本 5.32 → 5.33。
- 刻度挂在 `.plyr` 内，只在全屏显示。单个时间是短横线，时间段是更长的横线，点击热区比进度条上的点大。
- 点击仍跳到起点。右侧开关关闭时移除。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

## 2026-10-17 · 右侧刻度按数量均匀排列

**功能**：全屏右侧刻度不再按片长时间隔拉开。

**修改内容**：
- 字幕脚本 5.35 → 5.36。
- 每个时间点和时间段各占一行，行高 16px。数量少时尺子短，数量多时变长，最高 70%，超出后在刻度区内滚动。
- 点击仍跳到真实时间。时间段只是横线更长，不再按时间跨度拉高。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

## 2026-10-17 · 选中刻度保持变长

**功能**：选中的右侧刻度保持长线，直到选择另一个，或播放进入下一个时间段。

**修改内容**：
- 字幕脚本 5.36 → 5.37。
- 刻度记录起止秒数。播放进入某个时间段时自动选中该段；离开后如果没有进入下一段，仍保持上次选中。
- 点击刻度或侧栏时间也会更新选中状态。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`currentRailPoint`、`updateSelectedSidebarItem`

## 2026-10-17 · 右侧刻度区不再误暂停

**功能**：全屏时点右侧刻度附近，不会再点到画面导致暂停。

**修改内容**：
- 字幕脚本 5.34 → 5.35。
- 右侧刻度条改为可点击区域，挡住背后的播放器点击。
- 刻度热区加高到 12px。点空白只拦截，不暂停；点刻度仍跳转。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

## 2026-10-17 · 右侧时间刻度收短

**功能**：全屏右侧刻度不再拉满播放器高度，相邻刻度更近。

**修改内容**：
- 字幕脚本 5.33 → 5.34。
- 刻度尺改为垂直居中，高度 `min(240px, 42%)`。时间百分比仍按这条较短的尺计算。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`

## 2026-10-17 · 调整 PageDock 接入说明

**功能**：写明脚本自己关闭面板时也要同步左边状态。

**修改内容**：
- `dock/docs/page-dock.md` 增加强制同步规则、三个已接入脚本的同步点和内部关闭示例。
- 接入步骤增加「每次打开或关闭都调用 `setActive`」。

**涉及文件与位置**：
- `dock/docs/page-dock.md`

## 2026-10-17 · 增加 PageDock 接入说明

**功能**：给后续脚本一份可执行的悬浮坞接入说明。

**修改内容**：
- 新建 `dock/docs/page-dock.md`：安装、左右控件、`@require`、登记示例和 API。
- 根 README 与 AGENTS 指向这份说明。

**涉及文件与位置**：
- `dock/docs/page-dock.md`
- `README.md`
- `AGENTS.md`
