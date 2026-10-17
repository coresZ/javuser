# jav-code-scanner（通用番号扫描 & 多源搜索）· 源码使用指南

> 本 README 给**使用源码的人**（改码 / 扩展开发 / 集成方），含完整操作说明。
> 只使用脚本的人：安装后按 §2「使用者操作说明」上手即可，无需读本文件其余部分。

## 1. 这是什么

单文件油猴脚本：`dock/jav-code-scanner.user.js`（严格模式 IIFE，当前 **v1.5.94**）。

功能全景：页面番号扫描高亮 → 点击即搜 → 多源切换与页内预览（iframe / GM 自渲染、
拒绝自动降级）→ 操作条（字幕 / 复制 / 番号库 / 剧照 / 扩展按钮）→ 配置面板六个 tab
（常规 / 高亮 / 操作 / 搜索源 / 扩展 / 备份）→ 全站配置 WebDAV 备份 →
`window.JavCodeKit` 对外 API → 扩展宿主（第三方油猴库接入）。
有 `PageDock` 时，原红色浮钮隐藏，入口收进悬浮坞的「扫描」。

## 2. 使用者操作说明（测试 / 日常使用照此执行）

### 2.1 安装

1. Tampermonkey → 仪表盘 → 实用工具 → 导入文件，或「+ 新建脚本」全量粘贴
   `dock/jav-code-scanner.user.js` → 保存。
2. 打开任意匹配站点（域名含 `jav`/`av`/`fc2` 的站、missav、jable、dmm 等 30+ 站，
   完整清单见脚本头 `@include`）。同时安装 `dock/page-dock.user.js` 后，只在悬浮坞菜单里看到「扫描」；没有悬浮坞时，右下角出现原来的红色浮钮。
3. 悬浮坞左边点「扫描」打开或关闭扫描面板。右边开关停用整个扫描脚本；停用后左边变灰，点了没有反应，扫描和高亮不再继续。打开右边开关只恢复脚本，不会顺便打开面板。

### 2.2 扫描与搜索

1. 脚本启用时，页面加载后自动扫描番号并高亮。手动重扫从扫描面板里的重扫按钮进入。
2. 点页面高亮番号：本页预览模式打开搜索大窗；新标签模式先弹出选源面板，再点源名新开标签。
   侧栏 `#jcs-panel` 在「内」模式不同：单击番号是复制，双击才在本页搜索。
3. 大窗顶栏可换源（点源名）；`Esc` 关闭、`/` 或 `J` 聚焦搜索框重搜。
4. 预览打不开时的行为链：**已有黑名单命中 → 只允许新窗口；iframe 被拒 → 当次降级 GM
   自渲染或提示新标签打开**。预览失败不再自动写入黑名单；内置域名与手动添加的条目仍生效。

### 2.3 操作条（当前番号操作）

番号旁 / 大窗内的按钮组（可在配置「操作」tab 逐键开关或折入 `⋯` 菜单）：

| 按钮 | 行为 | 依赖 |
|---|---|---|
| 字幕 | 打开字幕搜索弹窗（多字幕站聚合） | 无 |
| 复制 | 复制番号到剪贴板，闪 ✓ | 无 |
| 番号库 | 加入 / 移除 Enhanced_Media_Helper 番号库，chip 角标显示在库状态 | 需安装 EMH |
| 剧照 | 调 EMH 抓取 AVWikiDB 作品页宫格截图（Shift 强制刷新） | 需 EMH ≥3.6.4 |
| 扩展按钮 | 由「扩展」tab 注册的第三方扩展提供 | 需注册扩展 |

### 2.4 配置面板（浮钮 → 设置，六个 tab）

| Tab | 能做什么 | 关键操作 |
|---|---|---|
| 常规 | 主题（深/浅）、点番号时的行为（新标签/本页预览）、嵌入策略 | 勾选即生效 |
| 高亮 | 全局高亮样式 / 站点自定义选择器 / 番号正则范围 | 「框选」按钮可页面点选元素自动生成选择器 |
| 操作 | 上述操作条四键的「显示按钮」与「收进 ⋯ 菜单」开关 | 两列开关，即时生效 |
| 搜索源 | 源 CRUD（URL 模板支持 `{code}`/`{CODE}`/`{code_lower}`）+ 每源预览方式 | 预览方式：自动 / iframe 强制 / GM 自渲染强制 |
| 扩展 | 扩展库接入与管理（见 §2.5） | 添加 URL / 开关 / 复制 / 删除 / 卸载 |
| 备份 | 全部站点配置导出 / 导入 / WebDAV | 导出含扩展源；WebDAV 支持加密 |

### 2.5 扩展宿主操作（重点）

**接入方式 A（独立油猴脚本）**：把扩展装进 Tampermonkey 即自动注册。
**接入方式 B（URL 注入）**：配置 → 「扩展」tab → 上半区粘贴脚本 URL（http/https）
→ 「添加」。添加时宿主会**请求一次脚本头自动取 `@name`** 作为显示名（失败则显示主机名）。

源列表每行：`[启用开关] 名称 / 状态副行 [复制] [删除]`：

- 状态副行三种：`已注册 · 扩展名`（绿，说明脚本成功调用了 register）/
  `加载失败 · 检查 URL 或本地服务`（红）/ 主机名（脚本已注入但未按契约注册，
  如自执行库——能跑但不受管控）。
- 开关关闭 = 下次页面加载不注入该源（刷新生效）。

下半区「已注册扩展」每行：`[会话开关] 名称 vX [能力统计 · 来源] [卸载]`：

- **会话级开关**：关闭立即隐藏其按钮 / 移除样式 / 清理挂载 DOM；刷新页面后恢复启用。
- 能力统计如 `2 按钮 · 1 样式 · 1 挂载`；来源显示「独立脚本」或注入源主机名。

**验收一个新扩展**：注册出现 → 按钮可点 → 关开关后按钮/样式/挂载全部消失 → 再开恢复 →
刷新默认启用。扩展作者侧的完整契约见 `jcs-extension-contract.md`。

### 2.6 备份与恢复

- 备份内容：搜索源 / 黑名单 / 高亮与站点选择器 / 操作开关 / 主题布局 /
  **扩展源列表（URL+开关+名称）**；历史记录不备份。
- 导出：备份 tab → 下载 JSON（文件名含站点数与时间戳）；或复制到剪贴板。
- 导入：选文件或粘贴 JSON，可选合并（现有条目状态保留，按 URL/域名去重并入）或替换。
- WebDAV：填地址/账号/密码（可加密），上传 = 全量 bundle 上云，下载后按导入流程恢复。

### 2.7 快捷键

| 键 | 行为 |
|---|---|
| `Esc` | 逐层关闭：点选 → 字幕窗 → 选源面板 → 设置（先取消编辑/删除确认）→ 搜索大窗 → 侧栏 |
| `/` 或 `J` | 聚焦番号输入（大窗开着聚焦窗内输入框，否则唤起侧栏） |

### 2.8 故障排查

| 现象 | 原因与处理 |
|---|---|
| 扩展显示「加载失败」 | URL 不可达（本地服务没起 / 404）。修好后**刷新页面**即自动清标 |
| 扩展功能生效但列表只显示主机名 | 脚本未按契约调 `register`（自执行库）；或形态 B 运行在页面 world 拿不到 GM_* |
| 番号库按钮不出现 | 未安装 Enhanced_Media_Helper，或其版本 <3.6.1 |
| 剧照提示版本低 | EMH 需 ≥3.6.4（`previewAvwiki`） |
| 预览一直弹新窗口 | 源已在黑名单（内置或以前自动加入的）；到「搜索源 → 域名黑名单」删除该域名可重试。v1.5.89 起失败不再自动加入 |
| 本站全部预览都新窗口 | 该站被记为「本页禁止嵌入」；常规 tab 或 iframe 白名单里放行 |

## 3. 开发者操作说明（改码 / 扩展开发）

### 3.1 改码流程（每轮必走）

```text
读 MODIFICATIONS.md（协议+既有记录）
  → 改 dock/jav-code-scanner.user.js
  → 版本号三处同步：@version(:4) / STYLE_VER(:60) / SCRIPT_VER(:61)
  → 验证三件套：
      node --check dock/jav-code-scanner.user.js
      git diff --check
      here-string 静态断言：@'...js 代码...'@ | node -（参照 MODIFICATIONS.md 各条目写法）
  → 更新本 README 中受影响的行为说明（扩展契约有变再改 jcs-extension-contract.md）
  → 回填 dock/docs/jav-code-scanner/MODIFICATIONS.md（功能 → 修改内容 → 文件与位置）
```

注意 CBox 隔离：`cbox.ws` 域走 `bootCboxLite()` 轻量路径（只有扫描/linkify/精简 API），
改宿主功能时确认未破坏 `IS_CBOX` 分支。

### 3.2 扩展开发 30 分钟上手

1. 复制 `tools/test-extension.js`（全类型样例：2 按钮 + 1 样式 + 1 挂载）为你的文件。
2. 改 manifest 三要素：`id`（kebab-case 唯一）/ `name` / `version`；按需保留/删除三类扩展点。
3. UI 元素 id 一律加 `jcs-ext-{id}` 前缀；定时器与监听器全部登记 `ctx.onCleanup`。
4. 验收：装进 Tampermonkey（形态 A）或经「扩展」tab 添加 URL（形态 B）→ 按 §2.5 走一遍。
5. 规范细节（校验规则 / 生命周期 / match 语法 / 完整 M3U8 示例）：
   `jcs-extension-contract.md`；会话内说「写一个 JCS 扩展」会自动加载 `jcs-build` skill。

### 3.3 调试命令（浏览器 Console）

```js
window.JavCodeKit.__ready                    // 宿主就绪？
JavCodeKit.extensions.list()                 // 已注册扩展（含能力计数）
JavCodeKit.extensions.isEnabled('my-id')     // 会话级开关状态
JavCodeKit.extensions.setEnabled('my-id', false)  // 等价于扩展 tab 关开关
JavCodeKit.openSearch('ABC-123')             // 直接唤起搜索
JavCodeKit.extensions.register(MANIFEST)     // 手动注册（调试 manifest 用，抛错可见）
```

### 3.4 备份 bundle 结构（写集成 / 工具时参考）

```jsonc
{
  "app": "jav-code-scanner", "scope": "all-sites",
  "bundleVersion": 3, "scriptVersion": "1.5.91",
  "global": {
    "providers": [...], "providerActive": "...", "providerBlacklist": [...],
    "theme": "...", "hl": {...}, "codeActions": {...},
    "sub": {...}, "panelLayout": {...}, "fabPos": {...},
    "extensions": [{ "url": "...", "enabled": true, "name": "...", "id": "..." }]
  },
  "sites": { "<hostname>": {...站点级高亮/打开方式...} },
  "data": { "...旧扁平格式兼容层，内容同 global + 域名列表..." }
}
```

导出（`exportConfigJson`）/ 导入（`importConfigBundle`）/ WebDAV 上传下载共用该结构；
导入支持新旧格式自动识别，扩展源按 URL 去重合并。

### 3.5 宿主实现锚点（排障用，行号以 grep 实时为准）

| 关注点 | 函数 |
|---|---|
| GM key | `JCS_EXT_KEY = 'jcs_extensions_v1'` |
| 校验 / 注册 | `validateExtensionManifest` / `registerExtension`（同 id 覆盖先 cleanup） |
| 激活 / 卸载 | `activateExtensionInstance` / `deactivateExtensionInstance`（逆序 cleanup） |
| SPA 重放 | `bindExtSpaHook`（pushState/replaceState/popstate 600ms 防抖） |
| 形态 B 注入 | `injectExtensionScripts`（串行 async=false、onerror 标记、onload 清标） |
| 名称预取 | `parseExtensionScriptMeta` / `fetchExtensionMeta` |
| 按钮插槽 | `buildCodeActions`（`data-act="ext:{id}:{act}"` 路由 + `flashActDone`） |
| 配置 UI | `renderExtensionsTab` / `bindExtensionsTab` / `setConfigTab` |
| 握手 | `dispatchKitReady`（`jcs:kit-ready` 双 dispatch） |
| 打开方式 | `openSearch`（新标签先 `openProviderPicker`）/ `openExternalProvider` / `openUrlInNewTab` |
| 黑名单 | `markProviderHostBlacklisted`（v1.5.89 起空操作；内置与手动名单仍由 `isProviderHostBlacklisted` 生效） |
| 侧栏番号 | `bindChipCopy`（「内」单击复制、双击 `openSearch`；「外」单击出选源） |

## 4. 文件与文档地图

| 路径 | 说明 |
|---|---|
| `dock/jav-code-scanner.user.js` | 唯一产品文件（当前 v1.5.94） |
| `dock/docs/jav-code-scanner/jcs-extension-contract.md` | 扩展契约 v1.1（对外发布物，宿主 ≥ v1.5.81） |
| `dock/docs/jav-code-scanner/MODIFICATIONS.md` | 修改协议与记录（改前读、改后回填） |
| `dock/docs/integration/integration-emh-scanner.md` | 与 EMH 的双脚本协作协议 |
| `tools/test-extension.js` | 全类型扩展样例（脚手架） |
| `tools/jable-live-preview.extension.js` | 真实脚本改造参考（mounts 型，含完整 cleanup） |
| `.opencode/skills/jcs-build/` | 「写 JCS 扩展」skill |

## 5. 已知事项

- 行号级架构文档已删除（停在 v1.5.71，与 v1.5.91 对不上）。排障用本文件 §3.5 的函数名，不要依赖旧行号。
- 扩展会话级开关：关闭后刷新恢复启用；形态 B 注入无运行中撤销（浏览器限制）。
- `l.userjs.min.js` 类自执行库可注入运行，但不调 `register` 就不受管控。
- 内置 lib/shot 按钮走 `EMH_API` 直连桥，不经过扩展注册表（迁移见契约 §10 边界）。
- 仓库根 `AGENTS.md`：禁止自动提交；代码更新先递增版本号；每一次改代码必须同步更新文档。
