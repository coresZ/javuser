# MODIFICATIONS · docs/jav-code-scanner/

> 本目录协议：修改本目录任意文档前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。新建功能性子目录时同步创建 MODIFICATIONS.md。

## 项目约束（jav-code-scanner 文档域）

- 本目录只放 **jav-code-scanner（JCS）单项目文档**：架构说明、对外契约、设计规范。
- 跨两脚本协作的协议文档放 `docs/integration/`；EMH 侧文档放 `docs/enhanced-media-helper/`。
- 文档内引用其它目录文档一律用**相对路径**（如 `../integration/integration-emh-scanner.md`）。
- 文档头部必须标注对应的脚本版本号（如 v1.5.72+），脚本改动推进时同步更新版本锚点。
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
