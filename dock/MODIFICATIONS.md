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
