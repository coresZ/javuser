# PROJECT STATUS · javuser

> 项目状态总览（AI 会话接手指南）。更新日期 2026-09-07 · 分支 `main`。
> 脚本版本推进时同步更新本文件；改动依据见各域 `docs/*/MODIFICATIONS.md`。

## 1. 仓库构成

| 文件 | 当前版本 | 规模 | 一句话定位 |
|---|---|---|---|
| `jav-code-scanner.user.js` | **v1.5.76** | ~10.6k 行 | 通用番号扫描/搜索/JCS 扩展宿主（主项目） |
| `Enhanced_Media_Helper.js` | **v3.7.3** | ~4750 行 | 番号库管理 + 磁力/AVWikiDB 截图预览 + `EMH_API` 桥 |
| `webdev-library.user.js` | v1.0.0 | 16 KB | WebDAV 组件库（自 EMH 3.7.2 抽出，Greasy Fork 库 593538） |
| `docs/` | — | 三域 | jav-code-scanner / enhanced-media-helper / integration 各自 MODIFICATIONS 协议 |
| `tools/` | — | — | 扩展样例（`test-extension.js`、`jable-live-preview.extension.js`）、html 手册（7 章交互式指南） |

## 2. 脚本版本与近期演化

| 版本 | 里程碑 |
|---|---|
| JCS v1.5.71 | 操作条抽象 + 配置化折叠 + 设置「操作」tab + EMH 依赖置灰 |
| JCS v1.5.72 | fetch 型搜索源 403/CF challenge **多级自动重试**（GM → 页面 fetch → 代理链） |
| JCS v1.5.73-76 | **扩展宿主 v1**：actions/styles/mounts 三类扩展点 + 「扩展」tab + 备份集成扩展源 + 状态标记生命周期修复 + 黑名单行重排 |
| EMH v3.7.2 | WebDAV 备份组件化（抽 `webdev-library`）+ jav 凭据导入/设置卡 UX |
| EMH v3.7.3 | AVWikiDB 截图请求**三级自动重试**（GM 补头+cookie → 页面 fetch → CORS 代理链），解决 Cloudflare 403 |

### 当前 Git 状态

- 分支 `main`，与 `origin/main` 同步（HEAD `ad563a1`，2026-09-07）
- **工作区未提交删除**：`docs/MODIFICATIONS.md`（已被三域 MODIFICATIONS 取代）、`hgdj.user.js`（曾被误提交入 `41981bd`，后清理删除）
- 分支：`main`（发布）/ `debug` / `v1.0.1`（发布合并点 `831777c`）

## 3. 架构与协作要点（速览）

- **单文件 IIFE 双脚本 + 跨脚本桥**：JCS ⇄ EMH 通过 `unsafeWindow.EMH_API`（主 world）通信；GM 存储按脚本隔离，外部必须走桥。
- **JCS 扩展宿主**（v1.5.73+，对外契约）：第三方油猴库经 `JavCodeKit.extensions.register()` 注册 actions/styles/mounts；契约 v1 + 宿主实现章节见 `docs/jav-code-scanner/jcs-extension-contract.md`。
- **z-index 约定**：JCS 宿主 `2147483000` < EMH 灯箱 `2147483647`；JCS 截图前先收起 picker。
- **版本同步纪律**：`@version` / `STYLE_VER` / `SCRIPT_VER` 三处同步；模板/样式变更必须升版本（`data-ver` 重建机制）。
- **备份格式**：bundle `{global, sites, data}`；`global` 含 providers/hl/codeActions/extensions/sub/theme 等；WebDAV + AES 加密复用同一链路。

## 4. 文档地图

| 文档 | 路径 | 说明 |
|---|---|---|
| JCS 使用指南（源码向） | `docs/jav-code-scanner/README.md` | 安装/操作/扩展宿主开发/文件地图/已知事项 |
| JCS 架构梳理 | `docs/jav-code-scanner/architecture-jav-code-scanner.md` | ⚠️ 见 §5 待办 |
| JCS 扩展宿主契约 v1 | `docs/jav-code-scanner/jcs-extension-contract.md` | 对外发布物 |
| EMH 架构梳理 | `docs/enhanced-media-helper/architecture-enhanced-media-helper.md` | ⚠️ 见 §5 待办 |
| EMH standalone 模式 | `docs/enhanced-media-helper/standalone-mode.md` | 新标签页双栏 |
| 跨脚本桥集成指南 | `docs/integration/integration-emh-scanner.md` | EMH_API 参考/时序/降级/扩展 5 步 |
| 各域修改记录 | `docs/*/MODIFICATIONS.md` | 修改协议与回填（改文档前必读） |

## 5. 待办与已知事项

- [ ] **架构文档版本锚点滞后**（README 已登记）：
  - JCS 架构文档 v1.5.71/9983 行 → 实际 v1.5.76/~10.6k 行，**模块地图未收录扩展宿主**（`extensions` 宿主模块、JavCodeKit.extensions、扩展 tab）；
  - EMH 架构文档 v3.7.2 → 实际 v3.7.3（AVWikiDB 三级重试未入图）；
  - 集成指南锚点 v1.5.71/3.7.2 → 实际 v1.5.76/3.7.3（`previewAvwiki` 三级重试说明未同步）。
- [ ] 清理未提交删除（`docs/MODIFICATIONS.md`、`hgdj.user.js`）——确认后 `git rm`/commit。
- [ ] JCS v1.5.76 之后的功能验证与回归（403 重试链路、扩展宿主样例）。

## 6. 开发工作流速查

- **提交/推送**：`ego commit "<msg>" --yes`（hooks+暂存+提交）→ `ego push`（Node spawn git，沙箱下需完整权限）
- **语法校验**：`node --check <脚本>`
- **写 docs 前**：读目标域 `MODIFICATIONS.md`，完成后回填
