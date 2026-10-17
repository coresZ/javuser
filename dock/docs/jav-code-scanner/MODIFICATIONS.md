# MODIFICATIONS · dock/docs/jav-code-scanner/

> 本目录协议：修改本目录任意文档前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。新建功能性子目录时同步创建 MODIFICATIONS.md。

## 项目约束（jav-code-scanner 文档域）

- 本目录只放 **jav-code-scanner（JCS）单项目文档**：架构说明、对外契约、设计规范。
- 跨两脚本协作的协议文档放 `dock/docs/integration/`；EMH 侧文档放 `dock/docs/enhanced-media-helper/`。
- 文档内引用其它目录文档一律用**相对路径**（如 `../integration/integration-emh-scanner.md`）。
- 文档头部必须标注对应的脚本版本号（如 v1.5.91），脚本改动推进时同步更新版本锚点。
- 改 `jav-code-scanner.user.js` 时，同一轮必须更新本目录里描述该行为的文档（通常是 `README.md`；契约语义变化时还包括 `jcs-extension-contract.md`），并回填本文件。不得只改代码。仓库级约束见根目录 `AGENTS.md`。

## 2026-10-17 · 扫描入口收进悬浮坞（JCS v1.5.92）

**功能**：有 PageDock 时，JCS 浮钮收进悬浮坞。开关控制整个扫描脚本。

**修改内容**：
- `@version` / `STYLE_VER` / `SCRIPT_VER` 1.5.91 → 1.5.92。
- `@require https://update.greasyfork.org/scripts/600709/PageDock.js`。
- 登记「扫描」。开关写入 `jcs_script_enabled_v1`。关闭后不建面板、不扫描；点菜单名字没有反应。没有悬浮坞时仍用原来的浮钮。
- CBox 轻量路径和 iframe 精简模式不进悬浮坞。

**涉及文件与位置**：
- `jav-code-scanner.user.js`：`joinPageDock`、`setScriptEnabled`、`boot`
- `docs/jav-code-scanner/README.md`：安装说明与版本锚点

## 2026-10-17 · 有悬浮坞时隐藏原扫描浮钮（JCS v1.5.93）

**功能**：有 PageDock 时，页面上不再显示原来的红色扫描按钮。

**修改内容**：
- `@version` / `STYLE_VER` / `SCRIPT_VER` 1.5.92 → 1.5.93。
- 检测到 `PageDock` 时给 `html` 加 `jcs-docked`，样式强制隐藏 `#jcs-fab`。
- 悬浮坞里的「扫描」直接打开面板，不再依赖点击原来的浮钮。

**涉及文件与位置**：
- `jav-code-scanner.user.js`：`html.jcs-docked #jcs-fab`、`openScanPanel`、`ensurePanel`
- 编码统一 UTF-8 **无 BOM**；中文正文，代码示例保留原格式。
- 契约类文档（如 jcs-extension-contract.md）是对外发布物：改动契约语义时必须同步核对宿主实现章节（§11）与 JCS 源码一致性。

## 2026-09-07 · 文档重组落位 + 契约文档迁入（新增）

**功能**：按项目分域整理 docs/，JCS 文档归入本目录。

**修改内容**：
- `architecture-jav-code-scanner.md` 由 `git mv` 自 `docs/` 迁入，文内 3 处交叉引用更新为相对路径（integration ×2、enhanced-media-helper ×1）。
- `jcs-extension-contract.md`（契约 v1）自 `docs/` 根迁入本目录，文内 1 处引用更新为 `../integration/integration-emh-scanner.md`。

**涉及文件与位置**：
- `docs/jav-code-scanner/architecture-jav-code-scanner.md`（迁移 + 引用修复 :106/:233/:270-272 区域）
- `docs/jav-code-scanner/jcs-extension-contract.md`（迁移 + 引用修复 §10 表格）

## 2026-09-07 · JCS 扩展宿主契约 v1（新增，自 docs/ 根迁入）

**功能**：JCS 对外扩展宿主标准约定（actions / styles / mounts 三类扩展点）。

**修改内容**：契约 v1 全文（273 行）：两种接入形态、manifest 规范、ctx 对象、match 语法、生命周期、安全须知、M3U8 提取器示例、v1 边界、宿主实现对照。

**涉及文件与位置**：`docs/jav-code-scanner/jcs-extension-contract.md`

**关联决策**：JavCodeKit 既有方法签名全部保留；内置 lib/shot 按钮维持 `EMH_API` 直连；宿主版本实施时 v1.5.72 → v1.5.73。

## 2026-09-07 · 扩展宿主实现（JCS v1.5.73）

**功能**：按契约 v1 实现 JCS 扩展宿主——第三方油猴库/脚本可注册 actions/styles/mounts 三类扩展点，受「扩展」tab 管控。

**修改内容**（全部在 `jav-code-scanner.user.js`）：
- 存储层：新增 GM key `JCS_EXT_KEY = 'jcs_extensions_v1'`（:76 区域）并入 `STORE_KEYS`；`loadExtensionSources` / `saveExtensionSources`（URL 列表 ≤20 条，http/https 校验）。
- 宿主核心（`hostMatchesPattern` 后新增）：`EXT_LIMITS` 校验表、`validateExtensionManifest`（契约 §4 全字段校验，mounts 强制 match）、`extCtx`（code/getCode/showToast/onCleanup）、`activateExtensionInstance` / `deactivateExtensionInstance`（styles 注入 `jcs-ext-style-{id}-{i}`、mounts 挂载、cleanup 逆序）、`registerExtension`（同 id 覆盖先 cleanup、URL 注入回填列表）、`unregisterExtension`、`isExtensionEnabled`、`setExtensionEnabled`（会话级开关：开=重激活/关=cleanup）、`bindExtSpaHook`（pushState/replaceState/popstate 600ms 防抖重放 mounts）、`injectExtensionScripts`（boot 尾串行 `<script async=false>` 注入、onerror 记 lastStatus）、`dispatchKitReady`（window + unsafeWindow 双 dispatch `jcs:kit-ready`）。
- 对外 API：`JavCodeKit.extensions = { register, unregister, list, isEnabled, setEnabled }`；挂载 kit 后（非 CBox 路径）调 `dispatchKitReady()`。
- 操作条：`buildCodeActions` 渲染扩展按钮（`data-act="ext:{id}:{act}"`、`EXT_DEFAULT_ICON` 缺省图标、沿用内置外观）；点击路由支持同步/ Promise 返回值（半透明防重复点击），`flashActDone` 复用内置 ✓ 反馈。
- 配置 UI：新增「扩展」tab（搜索源与备份之间）——扩展源列表（启用开关/删除/状态显示）、已注册扩展卡（会话级开关/卸载/能力统计）；`setConfigTab` 白名单与切换钩子、`renderExtensionsTab` / `bindExtensionsTab`。
- 版本：`@version` / `STYLE_VER` / `SCRIPT_VER` 三处 1.5.72 → 1.5.73。
- 契约文档同步：§5 showToast type 参数改为"保留参数"说明、§7 生命周期改「扩展」tab 会话级开关描述（与实现一致）。

**涉及文件与位置**：
- `jav-code-scanner.user.js`（:76 GM key、:486+ 宿主模块、:1268+ 点击路由、:6346/:6695 扩展 tab、:8900 setConfigTab、:9447+ 渲染函数、boot 尾部、kit 对象、三处版本号）
- `docs/jav-code-scanner/jcs-extension-contract.md`（§5/§7 与实现对齐修订）

**状态**：实现完成；验证 `node --check` / `git diff --check` / 31 项静态断言通过。

**trellis-check 复核修复（2×P2 + 3×P3）**：
- P2 扩展 tab 重渲染后控件失活 → `renderExtensionsTab` 末尾统一调 `bindExtensionsTab()`（幂等）。
- P2 操作条扩展按钮属性注入风险 → `data-act`/`title` 拼接全部 `escapeHtml`（icon 按契约原样插入）。
- P3 Promise rejection 补 `console.error`；P3 源列表 20 条上限改为预检 + 保存结果校验；P3 `_extReg` 注释与实际形状对齐。

**扩展源显示名预取（追加）**：
- 新增 `parseExtensionScriptMeta`（只扫前 8KB 元数据头取 `@name`/`@version`）与 `fetchExtensionMeta`（复用 `gmRequest`，15s 超时，失败返回 null）。
- 「扩展」tab 添加流程改为先拉取脚本头：取到名 → 入库 `{url, enabled, name, version}` 并 toast 显示名称；取不到 → 仍允许添加、列表显示主机名（toast 注明）。并发双检防重复入库。
- 源列表行显示改为「名称优先、主机名降级副标签」，加载失败标红；扩展注册成功后回填 `id`/`name`/`lastStatus='ok'`。
- 契约 §11 同步该行为说明。

**扩展源行复制链接 + 按钮右置（追加）**：
- 源列表行新增「复制」按钮（`copyText` 写剪贴板，成功/失败 toast）；按钮组（复制/删除/卸载）包进 `jcs-row-ops` 容器（`margin-left:auto` 右对齐，flex-shrink:0），「已注册扩展」行的卸载按钮同款右置。
- 新增 CSS `#jcs-cfg .jcs-row-ops`（:5003 区域）。

**状态标记生命周期修复（v1.5.74）**：
- Bug：`injectExtensionScripts` 的 `onerror` 持久化 `lastStatus='load-failed'`，但 `onload` 从不清除——历史失败过一次后即使后续加载成功，列表仍永远显示「加载失败」。修复：onload 成功时统一写 `{lastStatus:'ok', lastLoadAt}` 覆盖旧标记。
- 增强：新增 `_extInjectingUrl` 跟踪串行注入中的 URL，`registerExtension` 无显式 source 时自动归属（库脚本注册时不传 source，此前无法关联回 URL 列表，「已注册」状态显示不出来）。
- 版本 1.5.73 → 1.5.74（三处同步）。

**jcs-blacklist-row 布局重排（v1.5.74 追加）**：
- 行结构统一为「[开关] [主列双行：名称加粗 / 状态副行] [按钮组右置]」，新增 `.jcs-blacklist-main` 主列（flex:1，`code` 名称行 + `small` 状态行）。
- 四类行套用同结构：内置黑名单（副行「内置 · 不可移除」）、用户黑名单（副行「用户黑名单 · 失败自动加入」+ 删除）、扩展源（状态副行：已注册绿 `is-ok` / 加载失败红 `is-bad` / 未注册显示主机名；复制+删除）、已注册扩展（能力+来源副行 + 卸载）。
- CSS：行高 36→46px、padding 8px 12px、hover 边框反馈；`jcs-row-ops` 去掉 `margin-left:auto`（由主列 flex:1 顶开）；删除/卸载按钮加 `is-danger` 危险态 hover；`--jcs-ok`/`--jcs-danger` 语义色用于状态副行。

**备份包含扩展源（v1.5.75）**：
- `collectConfigBundle` 的 `global` 新增 `extensions: loadExtensionSources()`（URL/开关/名称/注册状态随备份走）。
- `importConfigBundle` 新增扩展源导入块：条目净化（URL http/https 校验、字段类型收敛）→ 按 URL 去重；merge 模式与现有列表拼接（现有条目开关状态保留）、replace 模式整体覆盖；导入后刷新「扩展」tab。
- 旧扁平格式接受条件补 `bundle.extensions`（仅含扩展源的备份也可导入）。
- WebDAV 上传/下载复用 export/import 链路，自动获得该能力；版本 1.5.74 → 1.5.75。

## 2026-09-07 · 源码使用指南 README + 脚本描述更新（v1.5.76）

**功能**：为源码使用者提供入口文档；脚本元数据描述补齐扩展宿主卖点。

**修改内容**：
- 新增 `README.md`（源码向）：文件地图 / 文档地图 / 开发基线（版本三处同步、验证三件套、CBox 隔离、修改协议）/ 扩展宿主开发（契约+skill+样例+宿主锚点）/ JavCodeKit 与存储键速览 / 已知事项（架构文档锚点滞后等）。
- `jav-code-scanner.user.js` `@description` 重写为使用者向功能枚举（扫描→搜索预览→字幕→高亮→番号库→扩展宿主→备份→JavCodeKit）；版本 1.5.75 → 1.5.76 三处同步。

**涉及文件与位置**：
- `docs/jav-code-scanner/README.md`（新建）
- `jav-code-scanner.user.js`（:4-5 元数据、:60-61 版本常量）

**状态**：`node --check` / 版本断言 / README 引用路径核对通过；架构文档（architecture-jav-code-scanner.md）锚点更新为独立待办。

**README 扩充为完整操作说明（追加）**：
- 新增 §2 使用者操作说明（安装 / 扫描搜索 / 操作条按钮依赖表 / 配置六 tab 逐 tab 操作 /
  扩展宿主完整操作流含三种状态副行与会话级开关语义 / 备份恢复 / 快捷键 / 故障排查表 7 条）。
- 新增 §3 开发者操作说明（改码流程五步 / 扩展开发 30 分钟上手 / Console 调试命令 /
  备份 bundle JSONC 结构示例 / 宿主实现锚点表）。
- 原 §4-5 保留为文件地图与已知事项；快捷键与 UI 文案均从源码核对（:1577 hotkeys、:1229 CODE_ACT_DEF、:6970-6972 预览模式）。

## 2026-09-10 · Trellis 卸载后死链清理（新增）

**功能**：Trellis 工作流框架已从项目卸载（`.trellis/` 整目录删除），修正本文档域内指向 `.trellis/spec/` 的失效引用。

**修改内容**：
- `architecture-jav-code-scanner.md` 删除 2 处死链：「主题系统」节末「详见 `.trellis/spec/frontend/design-system.md`」及「参考」节首条「视觉/交互约束的通用化约定见 `.trellis/spec/frontend/design-system.md`」。原 spec 内容随 Trellis 卸载移除，如需恢复可从 git 历史取回。
- 本目录 `MODIFICATIONS.md:55` 的「trellis-check 复核修复」为历史记录，保留不动。

**涉及文件与位置**：
- `docs/jav-code-scanner/architecture-jav-code-scanner.md`（:175、:269 两行删除）

**状态**：grep 全域无 `trellis` 存活引用（仅剩本文件与 `.opencode/skills/MODIFICATIONS.md` 的历史/卸载记录字样）

## 2026-10-17 · 停自动拉黑 + 新标签直接开窗（v1.5.89）

**功能**：missav / 123av 在「新标签」下点高亮不再只弹出番号提示；预览失败不再自动写入搜索源黑名单。

**修改内容**：
- `markProviderHostBlacklisted` 改为空操作，只返回域名。iframe 失败、CSP、HEAD 探测、GM 抓取失败、Cloudflare / 登录页仍走当次外链提示，但不再 `saveProviderBlacklist`。内置黑名单、已有用户名单、设置页手动添加/删除不变。
- `openSearch`：新标签模式且当前源不是强制 iframe 时，普通点击调用 `openExternalProvider`（同一次点击 `window.open` 当前源）。`opts.pick`（Shift+点击）才 `openProviderPicker`。大窗已开、`forceFull`、本页预览路径不变。
- 页内高亮 `bindCodeMarkClick`、自建链 `bindCodeLinkEl`、侧栏 chip 的 Shift 传 `pick: true`。选源按钮改为捕获阶段监听，避免站点在冒泡前截走 click。
- 文案：设置黑名单说明、用户黑名单副行、chip / 高亮 title、侧栏脚注、常规 tab 打开方式提示。

**涉及文件与位置**：
- `jav-code-scanner.user.js`（版本 1.5.88 → 1.5.89；`markProviderHostBlacklisted`；`openSearch`；`bindCodeMarkClick` / `bindCodeLinkEl` / `bindChipCopy`；`openProviderPicker` 源按钮绑定；黑名单与打开方式文案）
- `README.md`（版本表 v1.5.89）
- `docs/jav-code-scanner/README.md`（§2.2 点击行为、§2.8 黑名单排查）

## 2026-10-17 · 新标签改走 GM_openInTab（v1.5.90）

**功能**：v1.5.89 在 missav / 123av 仍只出番号提示。页面侧 `window.open` 会被站点更早的 click 处理或 COOP 吃掉。

**修改内容**：
- 增加 `@grant GM_openInTab`。`openUrlInNewTab` 优先走油猴开标签，失败再回退 `unsafeWindow.open`。
- `installEarlyCodeOpen` 在 boot 时挂 document 捕获监听，命中高亮后同步开标签，并 `stopImmediatePropagation`，避免站点先截走这次点击。
- 高亮自身的 shift 提前 return 去掉，Shift+点击仍传 `pick` 给选源面板。

**涉及文件与位置**：
- `jav-code-scanner.user.js`（版本 1.5.89 → 1.5.90；`@grant GM_openInTab`；`openUrlInNewTab`；`installEarlyCodeOpen`；`bindCodeMarkClick`）
- `README.md`（版本表 v1.5.90）

## 2026-10-17 · 新标签恢复先选源再打开（v1.5.91）

**功能**：撤回 v1.5.89/v1.5.90 的「一点高亮直接新开当前源」。新标签模式恢复原来的两步：点高亮出选源面板，点源名再打开网页。

**修改内容**：
- `openSearch` 在新标签模式重新只调用 `openProviderPicker`，不再直接 `openExternalProvider`。
- 删除 `installEarlyCodeOpen` 及其 boot 调用。高亮 / 自建链 / 侧栏 chip 的 Shift 直开分支和对应文案恢复。
- 保留 v1.5.89 的「失败不自动写黑名单」，以及 v1.5.90 的 `GM_openInTab`：选源按钮仍用它开标签，避免 missav / 123av 吃掉 `window.open`。

**涉及文件与位置**：
- `jav-code-scanner.user.js`（版本 1.5.90 → 1.5.91；`openSearch`；删除 `installEarlyCodeOpen`；点击文案）
- `README.md`（版本表 v1.5.91）
- `docs/jav-code-scanner/README.md`（§2.2）

## 2026-10-17 · v1.5.92 已撤回，停留在 v1.5.91

**功能**：用户手动把脚本退回 1.5.91。v1.5.92 的面板单击打开、`GM_openInTab(url, false)` 不保留。

**修改内容**：
- 脚本保持 1.5.91：面板「内」仍是单击复制、双击本页搜索；新标签仍是先选源再打开，`GM_openInTab` 继续传 `{ active: true, insert: true, setParent: true }`。
- 版本表改回 v1.5.91，避免文档超前于脚本。

**涉及文件与位置**：
- `jav-code-scanner.user.js`（维持 `@version` / `STYLE_VER` / `SCRIPT_VER` = 1.5.91）
- `README.md`（版本表 v1.5.91）

## 2026-10-17 · 文档对齐 v1.5.91，删除过时架构文档

**功能**：`docs/jav-code-scanner` 与当前脚本 v1.5.91 对齐，去掉无法再维护的行号架构文档。

**修改内容**：
- 删除 `architecture-jav-code-scanner.md`（锚点停在 v1.5.71 / 9983 行，未收录扩展宿主、选源面板、打开方式与黑名单变更）。
- `README.md` 版本锚点改为 v1.5.91；补侧栏「内」模式单击复制、双击搜索；备份示例版本、打开方式与黑名单锚点、文档地图同步。契约仍以 `jcs-extension-contract.md`（v1.1）为准，不改契约正文。
- 外部引用改指向 `docs/jav-code-scanner/README.md`：仓库 README、PROJECT-STATUS、EMH 架构、集成指南。

**涉及文件与位置**：
- `docs/jav-code-scanner/architecture-jav-code-scanner.md`（删除）
- `docs/jav-code-scanner/README.md`（§1 / §2.2 / §3.4 / §3.5 / §4 / §5）
- `README.md`、`PROJECT-STATUS.md`（文档地图）
- `docs/integration/integration-emh-scanner.md`、`docs/integration/MODIFICATIONS.md`
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`

## 2026-10-17 · 仓库增加「改代码必须更新文档」约束

**功能**：把「每一次修改代码都要更新文档」写成仓库级约束，避免再出现代码已改、文档仍描述旧行为。

**修改内容**：
- 新建根目录 `AGENTS.md`：禁止自动提交、递增版本号、改代码必须同步更新对应用户向 / 开发向文档并回填 `MODIFICATIONS.md`。
- 根 `README.md`、`PROJECT-STATUS.md`、本目录 README 改码流程与本文件约束同步指向该规则。

**涉及文件与位置**：
- `AGENTS.md`（新建）
- `README.md`（开发工作流）
- `PROJECT-STATUS.md`（开发工作流速查）
- `dock/docs/jav-code-scanner/README.md`（§2.1 悬浮坞左右控件，2026-10-17）
- `docs/jav-code-scanner/MODIFICATIONS.md`（项目约束）
