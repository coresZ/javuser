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

## 2026-10-17 · 增加 PageDock 接入说明

**功能**：给后续脚本一份可执行的悬浮坞接入说明。

**修改内容**：
- 新建 `dock/docs/page-dock.md`：安装、左右控件、`@require`、登记示例和 API。
- 根 README 与 AGENTS 指向这份说明。

**涉及文件与位置**：
- `dock/docs/page-dock.md`
- `README.md`
- `AGENTS.md`
