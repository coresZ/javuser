# javuser · 油猴脚本合集

浏览器用户脚本（Tampermonkey / Greasemonkey）单仓库合集，主线为 **JCS（番号扫描 & 扩展宿主）** 与 **EMH（番号库管理）** 双脚本协作体系，另含若干独立工具脚本与配套文档。

> AI 会话接手请先读 [`PROJECT-STATUS.md`](PROJECT-STATUS.md)；改动任一目录前先读该域 `MODIFICATIONS.md`（协议见下）。

## 仓库构成

### 根目录脚本

| 文件 | 版本 | 定位 |
|---|---|---|
| `jav-code-scanner.user.js` | v1.5.88 | **主项目 JCS**：通用番号扫描、多源搜索与页内预览、操作条、六 tab 配置面板、全站配置 WebDAV 备份（可加密）、`window.JavCodeKit` 开放 API、**扩展宿主**（第三方油猴库经 `JavCodeKit.extensions.register()` 接入 actions/styles/mounts） |
| `Enhanced_Media_Helper.js` | v3.7.3 | **EMH**：番号库管理面板（Preact + htm）+ 磁力/AVWikiDB 截图预览（三级自动重试）+ `EMH_API` 跨脚本桥 + WebDAV 备份 |
| `webdev-library.user.js` | v1.3.2 | `WebdevComponent`：WebDAV 云端备份共享组件库（AES-256-GCM，自 EMH 抽出，Greasy Fork 库 [593538](https://greasyfork.org/scripts/593538)）；iOS crypto 兼容 + 移动端响应式面板；真源即本文件，经 `tools/sync-webdev.js` 嵌入 EMH 兜底 |
| `whostv.user.js` | v3.4 | whos.tv 收藏/加专题扩展：列表页卡片注入 + JCS `pickButtons` 二级按钮组 |
| `U3C3 & 1cili Magnet Buttons.js` | v0.8 | u3c3 / 1cili 等站磁力复制按钮 + whatslink.info 截图预览 |

### 子目录

| 目录 | 内容 |
|---|---|
| `18mh/` | `18mh.user.js`（v4.7.3）：18dm/18mh 小说一键下载为 TXT，章节缓存/增量更新，收藏更新提醒，书目状态（连载/完结+更新时间），果核阅读器直连（书库/悬浮条/列表卡），Dock 动作菜单，收藏与黑名单 WebDAV 云同步（接入 `WebdevComponent`），适配移动端 |
| `websiteTool/` | `网页对象工具库.user.js`（v0.4.3，Greasy Fork [590111](https://greasyfork.org/scripts/590111)）：取选任意网页元素、识别类型、绑定动作，支持远程规则订阅；`config/cores-ppk-rules-all.json` 为规则导出 |
| `tools/` | 开发辅助：`sync-webdev.js`（组件库同步嵌入 EMH）、`test-extension.js`（JCS 契约 v1 测试扩展）、`jable-live-preview.extension.js`（mounts 型实例扩展） |
| `html/` | 用户向静态页：`manual.html`（7 章交互式使用手册）、`changelog.html`（用户视角更新日志） |
| `docs/` | 按项目分域的文档（见文档地图） |

## 架构速览

- **单文件 IIFE 双脚本 + 桥**：JCS ⇄ EMH 经 `unsafeWindow.EMH_API`（主 world）通信；GM 存储按脚本隔离，外部读写番号库必须走桥。
- **z-index 约定**：JCS 宿主 `2147483000` < EMH 灯箱 `2147483647`。
- **版本同步纪律**：脚本内 `@version` / `STYLE_VER` / `SCRIPT_VER` 三处同步；模板/样式变更必须升版本。
- **备份格式**：bundle `{global, sites, data}`，WebDAV + AES 加密复用同一链路。

## 文档地图

| 文档 | 说明 |
|---|---|
| `docs/jav-code-scanner/README.md` | JCS 源码使用指南（安装/操作/扩展开发/文件地图） |
| `docs/jav-code-scanner/jcs-extension-contract.md` | JCS 扩展宿主契约 v1（对外发布物） |
| `docs/jav-code-scanner/architecture-jav-code-scanner.md` | JCS 架构梳理 |
| `docs/enhanced-media-helper/architecture-enhanced-media-helper.md` | EMH 架构梳理 |
| `docs/enhanced-media-helper/standalone-mode.md` | EMH standalone 新标签页双栏模式 |
| `docs/integration/integration-emh-scanner.md` | 跨脚本桥集成指南（EMH_API 参考/时序/降级） |
| `docs/superpowers/specs/` | 功能设计 spec（如 18mh 黑名单设计） |
| `docs/*/MODIFICATIONS.md`、`<脚本目录>/MODIFICATIONS.md` | 各域修改协议与回填记录（**改该域文件前必读，改完必回填**） |

## 开发工作流

- 语法校验：`node --check <脚本>`
- 提交/推送：`ego commit "<msg>" --yes` → `ego push`（多身份工作流）
- 版本号：代码改动须递增版本（纯文档/配置改动除外）

---

*仅供个人学习与技术研究使用。*
