# javuser · 油猴脚本合集

浏览器用户脚本（Tampermonkey / Greasemonkey）单仓库合集。已接入悬浮坞的脚本在 `dock/`，其余独立脚本留在根目录或各自子目录。

> 接手先读本文件和根目录 `AGENTS.md`。改某个目录前先读该目录的 `MODIFICATIONS.md`。

## 仓库构成

### 根目录脚本

| 文件 | 版本 | 定位 |
|---|---|---|
| `webdev-library.user.js` | v1.3.2 | `WebdevComponent`：WebDAV 云端备份共享组件库（AES-256-GCM，自 EMH 抽出，Greasy Fork 库 [593538](https://greasyfork.org/scripts/593538)）；iOS crypto 兼容 + 移动端响应式面板；真源即本文件，经 `tools/sync-webdev.js` 嵌入 EMH 兜底 |
| `whostv.user.js` | v3.4 | whos.tv 收藏/加专题扩展：列表页卡片注入 + JCS `pickButtons` 二级按钮组 |
| `U3C3 & 1cili Magnet Buttons.js` | v0.8 | u3c3 / 1cili 等站磁力复制按钮 + whatslink.info 截图预览 |

### 子目录

| 目录 | 内容 |
|---|---|
| `dock/` | 悬浮坞和已接入的脚本。见下表 |
| `18mh/` | `18mh.user.js`（v4.7.10）：18dm/18mh 小说一键下载为 TXT，章节缓存/增量更新，收藏更新提醒，书目状态（连载/完结+更新时间），果核阅读器直连（书库/悬浮条/列表卡），Dock 动作菜单，收藏与黑名单 WebDAV 云同步（接入 `WebdevComponent`），适配移动端 |
| `websiteTool/` | `网页对象工具库.user.js`（v0.4.3，Greasy Fork [590111](https://greasyfork.org/scripts/590111)）：取选任意网页元素、识别类型、绑定动作，支持远程规则订阅；`config/cores-ppk-rules-all.json` 为规则导出 |
| `tools/` | 开发辅助：`sync-webdev.js`（组件库同步嵌入 EMH）、`test-extension.js`（JCS 契约 v1 测试扩展）、`jable-live-preview.extension.js`（mounts 型实例扩展） |
| `html/` | 用户向静态页：`manual.html`（7 章交互式使用手册）、`changelog.html`（用户视角更新日志） |
| `docs/` | 尚未接入悬浮坞的项目文档，目前是 `docs/superpowers/` |

### dock/

| 文件 | 版本 | 定位 |
|---|---|---|
| `page-dock.user.js` | v1.3.8 | 悬浮坞库。Greasy Fork [600709](https://update.greasyfork.org/scripts/600709/PageDock.js)，引用不钉版本号 |
| `jav-code-scanner.user.js` | v1.5.96 | 番号扫描。扫描数量显示在悬浮坞「扫描」旁边 |
| `Enhanced_Media_Helper.js` | v3.7.18 | 番号库。脚本自己关闭面板时同步悬浮坞左边状态 |
| `jable & miss.user.js` | v6.0 | Missav / Jable 字幕与评论时间跳转 |

悬浮坞每一行有两个控件：左边打开或关闭对应面板，右边启用或停用整个脚本。脚本关闭时左边变灰，点了没有反应。打开右边开关不会顺便打开面板。

新脚本接入见 [`dock/docs/page-dock.md`](dock/docs/page-dock.md)。

## 架构速览

- **单文件 IIFE 双脚本 + 桥**：JCS ⇄ EMH 经 `unsafeWindow.EMH_API`（主 world）通信；GM 存储按脚本隔离，外部读写番号库必须走桥。
- **z-index 约定**：JCS 宿主 `2147483000` < EMH 灯箱 `2147483647`。
- **版本同步纪律**：脚本内 `@version` / `STYLE_VER` / `SCRIPT_VER` 三处同步；模板/样式变更必须升版本。
- **备份格式**：bundle `{global, sites, data}`，WebDAV + AES 加密复用同一链路。

## 文档地图

| 文档 | 说明 |
|---|---|
| `dock/docs/jav-code-scanner/README.md` | JCS 源码使用指南（安装/操作/扩展开发/文件地图） |
| `dock/docs/jav-code-scanner/jcs-extension-contract.md` | JCS 扩展宿主契约 v1.1（对外发布物） |
| `dock/docs/enhanced-media-helper/architecture-enhanced-media-helper.md` | EMH 架构梳理 |
| `dock/docs/enhanced-media-helper/standalone-mode.md` | EMH standalone 新标签页双栏模式 |
| `dock/docs/integration/integration-emh-scanner.md` | 跨脚本桥集成指南（EMH_API 参考/时序/降级） |
| `dock/docs/page-dock.md` | PageDock 接入说明 |
| `docs/superpowers/specs/` | 功能设计 spec（如 18mh 黑名单设计） |
| `dock/MODIFICATIONS.md`、`dock/docs/*/MODIFICATIONS.md`、`<脚本目录>/MODIFICATIONS.md` | 各域修改协议与回填记录（**改该域文件前必读，改完必回填**） |

## 开发工作流

- 语法校验：`node --check <脚本>`
- 提交/推送：`ego commit "<msg>" --yes` → `ego push`（多身份工作流）
- 版本号：代码改动须递增版本（纯文档/配置改动除外）
- **改代码必须同步更新文档**（见根目录 `AGENTS.md`）：行为说明与代码一致，并回填受影响目录的 `MODIFICATIONS.md`。只改代码、留下过时文档，视为未完成。

---

*仅供个人学习与技术研究使用。*
