# MODIFICATIONS

> 本仓库唯一的修改记录文件（**单文件制**）。修改任何文件前先完整读取本文件，找到对应目录小节并遵守其中的规则、验证基线与已知取舍；修改完成后**必须回填同一小节**（功能 → 修改内容 → 涉及文件与位置）。**禁止**新建子目录级 `MODIFICATIONS.md`。

## 目录索引

| 小节 | 覆盖范围 |
|---|---|
| 一 | 仓库根目录（历史记录：2026-10-17 之前的根目录脚本改动） |
| 二 | dock/（悬浮坞脚本与文档） |
| 三 | 18mh/（18dm 小说下载器） |
| 四 | dock/docs/jav-code-scanner/（JCS 文档域） |
| 五 | dock/docs/enhanced-media-helper/（EMH 文档域） |
| 六 | dock/docs/integration/（跨脚本协议文档域） |
| 七 | docs/superpowers/（设计 spec） |
| 八 | .opencode/skills/（项目级 skills） |

---

## 全仓库项目约束

- 本仓库是**纯用户脚本仓库**：无 `package.json`、无构建产物、无 `dist/`。版本号只体现在脚本元数据的 `@version` 与文件内等价常量（`STYLE_VER` / `SCRIPT_VER` / `EMH_API.version`）。
- 每个脚本的版本号可能有多处，**必须同步**：JCS 是 `@version` + `STYLE_VER` + `SCRIPT_VER`；EMH 是 `@version` + `EMH_API.version`。
- 用户脚本文件名含空格与 `&`（如 `jable & miss.user.js`），shell 操作一律加引号。
- 编码统一 UTF-8 **无 BOM**，LF 换行。
- 禁止自动提交：除非用户明确要求「提交」「commit」「push」，不得执行 `git commit` / `git push` / `git merge` / `git branch -d`。
- 改代码必须同一轮更新受影响文档（用户向与开发向），不得留下已知过时的描述。

---

## 一、仓库根目录（历史记录：2026-10-17 之前的根目录脚本改动）

### 2026-10-23 · MODIFICATIONS.md 合并为单文件制

**功能**：把分散在 7 个子目录的修改记录合并到仓库根 `MODIFICATIONS.md`，改为按目录分节的单文件制，与全局 `AGENTS.md` 的约束一致。

**问题**：合并前仓库有 8 份 `MODIFICATIONS.md`（根 + 7 个子目录，合计 1602 行）。全局 `~/.config/opencode/AGENTS.md` 要求「每个项目只在仓库根目录维护一份，禁止新建子目录级」，两者直接冲突；且子文件各自带一份重复的「本目录协议」说明，新增目录时容易漏建。

**修改内容**：
- 根 `MODIFICATIONS.md` 重组为「目录索引 + 全仓库项目约束 + 八个小节」，按目录归集：
  - 一、仓库根目录
  - 二、`dock/`
  - 三、`18mh/`
  - 四、`dock/docs/jav-code-scanner/`
  - 五、`dock/docs/enhanced-media-helper/`
  - 六、`dock/docs/integration/`
  - 七、`docs/superpowers/`
  - 八、`.opencode/skills/`
- 删除 7 份子目录 `MODIFICATIONS.md`。原 `## ` 条目统一降为 `### `，避免与目录小节平级。
- **内容零丢失**：合并后 123 条记录与原 8 份合计条目数一致；字符数 57574 → 57712（差值 138 来自新增的标题、索引表、约束与分隔线）。
- 新增「全仓库项目约束」一节，收敛共性规则：纯用户脚本仓库（无 `package.json` / `dist/`）、多版本号必须同步、文件名含空格与 `&` 需加引号、UTF-8 无 BOM / LF。
- 根 `AGENTS.md` 重写：`MODIFICATIONS.md` 协议改为单文件制并附小节划分表；纳入全局的三节（滚动条规范、排查纪律、交付纪律）；版本号约束补「多处必须同步」与「本仓库无构建产物」。
- 修正 4 处指向已删除子文件的活引用：
  - `dock/docs/jav-code-scanner/README.md`：改码流程与文件地图两处指向根文件「四、」小节。
  - `README.md`：文档地图改为指向根 `MODIFICATIONS.md`；开发工作流同步措辞。

**验证**：`Get-ChildItem -Recurse -Filter MODIFICATIONS.md` 返回 1 个；全仓库 grep 已无指向子文件的活引用（仅剩本文件内部 3 处历史条目按新协议保留）。合并前后条目数 123 = 123，字符数差 138（纯新增结构）。

**涉及文件与位置**：
- `MODIFICATIONS.md`：整体重组（原 8 份合并）
- `AGENTS.md`：全文件重写
- `README.md`：文档地图表、开发工作流
- `dock/docs/jav-code-scanner/README.md`：改码流程、文件地图表
- 已删除：`18mh/MODIFICATIONS.md`、`dock/MODIFICATIONS.md`、`dock/docs/jav-code-scanner/MODIFICATIONS.md`、`dock/docs/enhanced-media-helper/MODIFICATIONS.md`、`dock/docs/integration/MODIFICATIONS.md`、`docs/superpowers/MODIFICATIONS.md`、`.opencode/skills/MODIFICATIONS.md`

### 项目约束

- 根目录独立油猴脚本各自维护 `@version`。行为变化必须递增版本，并同步本文件。
- `jable & miss.user.js` 不接入 JCS / EMH。字幕层用 DOM overlay，不依赖站点播放器字幕轨。
- 字幕位置写入 `localStorage`：`msv-subtitle-pos-v1`（字幕 `bottom` / `x`），`msv-dock-pos-v1`（控制台坐标）。

### 2026-10-17 · 字幕控制台重写与横向位置

**功能**：重写 Missav / Jable 字幕控制台样式，并支持横向调节字幕位置。

**修改内容**：
- `@version` 5.3 → 5.4。
- 控制台改为可拖动 dock：标题栏与 CC 都可拖，位置写入 `msv-dock-pos-v1`，窗口缩放时夹在视口内。
- 主界面增加「横向」滑杆（0%–100%，默认 50%）。字幕层 `left` 跟随 `STATE.x`，与垂直位置一并写入 `msv-subtitle-pos-v1`。
- 去掉失效的垂直加减按钮绑定。搜索、开关、时间偏移、本地下载逻辑不变。

**涉及文件与位置**：
- `jable & miss.user.js`：`@version`、`STATE` / `savePos`、`GM_addStyle`、`Renderer.forceDomSubtitleLayer`、`UIBuilder.build`
- `README.md`：根目录脚本表补上 `jable & miss.user.js` v5.4

### 2026-10-17 · 隐藏控制台改为收成小图标

**功能**：点「收成小图标」不再把入口藏没，只把面板收成可再打开的 CC 小圆点。

**修改内容**：
- `@version` 5.4 → 5.5。
- `#msv-dock.is-mini` 强制隐藏面板，CC 缩成 28px 半透明圆点。再点 CC 去掉 `is-mini` 并打开面板。

**涉及文件与位置**：
- `jable & miss.user.js`：`GM_addStyle`、`#msv-hide-fab` 文案与点击、`#msv-fab` 点击

### 2026-10-17 · 打开面板时小图标保持不动

**功能**：点 CC 只弹出面板，小图标位置不跳。

**修改内容**：
- `@version` 5.5 → 5.6。
- dock 尺寸固定为图标大小。面板 `position: absolute; right: 0; bottom: 44px`，从图标上方弹出，不再把图标顶走。
- 拖动夹取改用 dock 的图标尺寸，不再用面板撑开后的外框。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-dock` / `#msv-fab` / `#msv-panel` 样式，`clampDock`，打开与收起时不再重排 dock

### 2026-10-17 · CC 图标尺寸固定

**功能**：收起面板时图标大小不再变化。

**修改内容**：
- `@version` 5.6 → 5.7。
- 去掉 `.is-mini` 把 dock / CC 缩到 28px 的样式。收起只隐藏面板，图标保持 36px。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-dock.is-mini` 样式

### 2026-10-17 · CC 图标去掉描边

**功能**：CC 图标不再显示边框。

**修改内容**：
- `@version` 5.7 → 5.8。
- `#msv-fab` 边框设为 0；`.ok` 只改文字颜色，不再加边框。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-fab` / `#msv-fab.ok`

### 2026-10-17 · 页面悬浮坞

**功能**：各脚本的悬浮图标可以登记进同一个可拖动入口。

**修改内容**：
- 新建 `page-dock.user.js` v1.0.0。`document-start` 挂 `PageDock.register / unregister / setBadge / close`。无登记项时入口隐藏。位置写入 `page-dock-pos-v1`。
- 字幕脚本 v5.8 → v5.9。检测到 `PageDock` 时隐藏自己的 CC，登记「字幕」；没有悬浮坞时仍用原来的 CC。

**涉及文件与位置**：
- `page-dock.user.js`：新建
- `jable & miss.user.js`：`openPanel`、`PageDock.register`
- `README.md`：根目录脚本表

### 2026-10-17 · 番号库收进悬浮坞

**功能**：EMH 番号库入口在有悬浮坞时不再单独漂按钮。

**修改内容**：
- `Enhanced_Media_Helper.js` 3.7.5 → 3.7.6。详见 `docs/enhanced-media-helper/MODIFICATIONS.md`。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`
- `README.md`：版本表

### 2026-10-17 · 字幕 CC 真正收进悬浮坞

**功能**：有 `PageDock` 时 CC 不再和悬浮坞同时出现。

**修改内容**：
- 字幕脚本 5.9 → 5.10。
- `#msv-fab { display: flex }` 会盖掉 `hidden`。改为加 `is-docked`，用 `display: none !important` 隐藏。
- 登记失败时每 250ms 重试，最多约 5 秒，避免悬浮坞晚挂载时 CC 漏出来。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-fab.is-docked`、`joinPageDock`

### 2026-10-17 · 字幕就绪不再把 CC 放回页面

**功能**：字幕加载成功后，已收进悬浮坞的 CC 不再重新出现。

**修改内容**：
- 字幕脚本 5.10 → 5.11。
- 两处 `fab.className = 'ok'` 改为 `classList.add('ok')`，避免清掉 `is-docked`。

**涉及文件与位置**：
- `jable & miss.user.js`：`Engine.dl`、本地字幕加载

### 2026-10-17 · 悬浮坞改成直接可见的文字条

**功能**：不再用抽象九宫格打开菜单。登记项直接显示成可点击的文字按钮。

**修改内容**：
- `page-dock.user.js` 1.0.0 → 1.1.0。
- 去掉九宫格和弹出菜单。条上直接是「字幕」「番号库」这类名字，点名字打开对应面板。空白处仍可拖动整条。
- `PageDock.register / setBadge / close` 接口保留。`close` 现在没有菜单可关。

**涉及文件与位置**：
- `page-dock.user.js`：`renderMenu`、样式、拖动绑定

### 2026-10-17 · 悬浮坞恢复图标菜单并提高完成度

**功能**：撤回直接摊开的文字条，恢复「小图标点开菜单」。

**修改内容**：
- `page-dock.user.js` 1.1.0 → 1.2.0。
- 图标改为三道长短线，不再用九宫格圆点。36px、无描边，打开时只加深底色。
- 菜单从图标旁边弹出，项里有首字标记和名字。点空白或点一项后关闭。`close()` 重新可用。

**涉及文件与位置**：
- `page-dock.user.js`：样式、`setOpen`、`renderMenu`
- `README.md`：版本表

### 2026-10-17 · 悬浮坞里的字幕入口改回 CC

**功能**：收进悬浮坞后，菜单项叫 CC，点开后面板出现在悬浮坞旁边。

**修改内容**：
- 字幕脚本 5.11 → 5.12。
- 登记名从「字幕」改为「CC」。
- 从悬浮坞打开时，把字幕面板锚点移到 `#page-dock` 的位置，避免面板还停在已经隐藏的旧 CC 坐标上。

**涉及文件与位置**：
- `jable & miss.user.js`：`openPanel`、`PageDock.register`

### 2026-10-17 · 悬浮坞图标改回九宫格

**功能**：入口图标恢复为原来的九个圆点。

**修改内容**：
- `page-dock.user.js` 1.2.0 → 1.2.1。
- 图标 SVG 从三道线改回 3×3 圆点。菜单、拖动和登记接口不变。

**涉及文件与位置**：
- `page-dock.user.js`：`#page-dock-fab` 的 SVG

### 2026-10-17 · 悬浮坞改为可 @require 的库

**功能**：悬浮坞不再作为全站独立脚本自动出现，改由引用它的脚本导入。

**修改内容**：
- `page-dock.user.js` 1.2.1 → 1.3.0。去掉 `@match` 和自动挂载。库挂到沙箱 `window` 与 `unsafeWindow`，调用方执行 `PageDock.mount()` 后 `register`。
- 样式改为自建 `<style id="page-dock-style">`，不再依赖 `GM_addStyle`，因此库头 `@grant none`。
- 字幕脚本 5.12 → 5.13，EMH 3.7.6 → 3.7.7。两者都 `@require file:///D:/source/javuser/page-dock.user.js`。
- 本地 file URL 只适合这台机器。发布到 Greasy Fork 后要换成库的 update URL。

**涉及文件与位置**：
- `page-dock.user.js`：库包装、`mount`
- `jable & miss.user.js`：`@require`、`PageDock.mount`
- `Enhanced_Media_Helper.js`：`@require`、`createToggleButton`

### 2026-10-17 · 多个脚本引用悬浮坞时只建一个

**功能**：字幕脚本和 EMH 都 `@require` 悬浮坞时，页面上不会出现两个图标。

**修改内容**：
- `page-dock.user.js` 1.3.0 → 1.3.1。
- 库加载时如果页面已有 `__PAGE_DOCK__`，后来的副本直接退出，不再创建第二套状态。
- 各沙箱的 `PageDock` 是转发桩，`register` 一律转到页面上的那一个实例。
- 字幕脚本和 EMH 优先读 `unsafeWindow.PageDock`。

**涉及文件与位置**：
- `page-dock.user.js`：库包装
- `jable & miss.user.js`、`Enhanced_Media_Helper.js`：`dockApi` 取值顺序

### 2026-10-17 · 悬浮坞恢复为可独立启用

**功能**：装上 `page-dock.user.js` 就能看到图标，不再依赖会让其它脚本起不来的本地 `@require`。

**修改内容**：
- `page-dock.user.js` 1.3.1 → 1.3.2。加回 `@match *://*/*` 和 `document-start` 自动 `mount()`。单例转发保留，所以独立脚本和 `@require` 副本不会画出两个图标。
- 字幕脚本 5.13 → 5.14，EMH 3.7.7 → 3.7.8。去掉本地 `file:///` 引用。检测到 `unsafeWindow.PageDock` 再登记；没有悬浮坞时保留各自原来的按钮。

**涉及文件与位置**：
- `page-dock.user.js`：元信息、`boot`
- `jable & miss.user.js`：去掉 `@require`，`joinPageDock` 每次读取页面 API
- `Enhanced_Media_Helper.js`：去掉 `@require`，`createToggleButton`

### 2026-10-17 · 接入 Greasy Fork PageDock

**功能**：字幕脚本和 EMH 引用已发布的悬浮坞库。

**修改内容**：
- 线上库为 v1.3.1：`https://update.greasyfork.org/scripts/600709/1965283/PageDock.js`。它不会自动挂载，引用方必须调用 `PageDock.mount()`。
- 字幕脚本 5.14 → 5.15，EMH 3.7.8 → 3.7.9。两者都加上该 `@require`，登记前先 `mount()`。
- 多个脚本引用时，库内 `__PAGE_DOCK__` 保证页面只有一个实例。

**涉及文件与位置**：
- `jable & miss.user.js`：元信息、`joinPageDock`
- `Enhanced_Media_Helper.js`：元信息、`createToggleButton`

### 2026-10-17 · 悬浮坞写入真实页面

**功能**：修复 UI 被建在油猴隔离文档、页面上看不到的问题。

**修改内容**：
- `page-dock.user.js` 1.3.2 → 1.3.3。元素和事件都走 `unsafeWindow.document`。
- 字幕脚本 5.16 → 5.17，EMH 3.7.10 → 3.7.11。优先使用页面上的 `PageDock`。
- 线上 Greasy Fork 仍是旧版时，必须用本文件覆盖库 600709，并让 Tampermonkey 重新拉取 `@require`。

**涉及文件与位置**：
- `page-dock.user.js`：`pageDocument`、元素创建、事件绑定

### 2026-10-17 · 改用 PageDock 新版本地址

**功能**：停止引用钉死的旧库版本。

**修改内容**：
- Greasy Fork 600709 的 v1.3.3 地址是 `1965297`。旧地址 `1965283` 永远返回 v1.3.1。
- 字幕脚本 5.17 → 5.18，EMH 3.7.11 → 3.7.12。`@require` 改为新地址。

**涉及文件与位置**：
- `jable & miss.user.js`、`Enhanced_Media_Helper.js`：`@require`

### 2026-10-17 · 悬浮坞拖动不再一卡一卡

**功能**：拖动时图标跟手，不再每帧触发布局。

**修改内容**：
- `page-dock.user.js` 1.3.3 → 1.3.4。
- 拖动中只改 `transform`，不再连续写 `left`/`top`，也不在移动中重算菜单位置。松手后一次落位。
- 去掉拖动元素上的 `backdrop-filter`，避免移动时整层重绘。

**涉及文件与位置**：
- `page-dock.user.js`：拖动处理、`#page-dock` 样式

需要重新发布到 Greasy Fork 600709。不钉版本的 `@require` 会拿到新代码，但 Tampermonkey 可能要手动更新外部库缓存。

### 2026-10-17 · 悬浮坞菜单项增加开关

**功能**：登记项可以在菜单右侧带一个开关，点开关不打开面板。

**修改内容**：
- `page-dock.user.js` 1.3.4 → 1.3.5。`register` 增加可选 `checked` 与 `onToggle`。新增 `setChecked(id, checked)`。
- 字幕脚本 5.19 → 5.20。CC 的开关控制字幕显示，并和面板里的原开关同步。

**涉及文件与位置**：
- `page-dock.user.js`：`register`、`renderMenu`、`.page-dock-switch`
- `jable & miss.user.js`：`setSubtitleVisible`、`PageDock.register`

### 2026-10-17 · 番号库开关收进悬浮坞

**功能**：悬浮坞里的番号库项可以打开和关闭面板。

**修改内容**：
- `Enhanced_Media_Helper.js` 3.7.13 → 3.7.14。详见 `docs/enhanced-media-helper/MODIFICATIONS.md`。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`

### 2026-10-17 · 悬浮坞开关改为整个脚本开关

**功能**：开关控制脚本功能，不再只控制面板或字幕显示层。

**修改内容**：
- 字幕脚本 5.20 → 5.21。开关写入 `localStorage` 的 `msv-script-enabled`。关闭后停止渲染和自动搜索，再打开才恢复。
- EMH 3.7.14 → 3.7.15。详见 `docs/enhanced-media-helper/MODIFICATIONS.md`。

**涉及文件与位置**：
- `jable & miss.user.js`：`STATE.enabled`、`setScriptEnabled`
- `Enhanced_Media_Helper.js`：`setScriptEnabled`

### 2026-10-17 · 脚本关闭后点菜单项无反应

**功能**：关闭后只能用开关重新打开，点名字不再把功能打开。

**修改内容**：
- 字幕脚本 5.21 → 5.22。`openPanel` 在 `STATE.enabled` 为假时直接返回。
- EMH 3.7.15 → 3.7.16。番号库菜单点击在 `scriptEnabled` 为假时直接返回。

**涉及文件与位置**：
- `jable & miss.user.js`：`openPanel`
- `Enhanced_Media_Helper.js`：`createToggleButton` 的 `onClick`

### 2026-10-17 · JCS 收进悬浮坞

**功能**：番号扫描入口收进悬浮坞，开关控制整个扫描脚本。

**修改内容**：
- `jav-code-scanner.user.js` 1.5.91 → 1.5.92。详见 `docs/jav-code-scanner/MODIFICATIONS.md`。

**涉及文件与位置**：
- `jav-code-scanner.user.js`：`joinPageDock`、`boot`

### 2026-10-17 · 有悬浮坞时隐藏 JCS 原浮钮

**功能**：有 PageDock 时，原来的红色扫描按钮不再出现。

**修改内容**：
- `jav-code-scanner.user.js` 1.5.92 → 1.5.93。详见 `docs/jav-code-scanner/MODIFICATIONS.md`。

**涉及文件与位置**：
- `jav-code-scanner.user.js`：`html.jcs-docked #jcs-fab`、`openScanPanel`

### 2026-10-17 · 悬浮坞左边管面板，右边管脚本

**功能**：同一行的两个控件分开。左边开关对应面板，右边开关整个脚本。

**修改内容**：
- `page-dock.user.js` 1.3.6 → 1.3.7。新增 `enabled`、`active`、`onActive`、`setActive`。脚本关闭时左边变灰且不可点。打开右边开关不会打开面板。
- 字幕 5.22 → 5.23，EMH 3.7.16 → 3.7.17，JCS 1.5.93 → 1.5.94。三个入口都按这个规则接线。

**涉及文件与位置**：
- `page-dock.user.js`：`register`、`renderMenu`
- `jable & miss.user.js`：`setPanelActive`
- `Enhanced_Media_Helper.js`：`onActive`
- `jav-code-scanner.user.js`：`setScanPanelActive`

### 2026-10-17 · 修复悬浮坞右边开关

**功能**：点右边开关不再把菜单重建掉，开关状态和点击区域稳定。

**修改内容**：
- `page-dock.user.js` 1.3.7 → 1.3.8。
- `setChecked` / `setActive` 改为更新已有行，不再 `renderMenu()`。
- 开关热区加高到 28px，轨道仍是 18px。回调里的状态回写不会拆掉正在点的按钮。

**涉及文件与位置**：
- `page-dock.user.js`：`paintItem`、`setChecked`、`.page-dock-switch`

### 2026-10-17 · 已接入悬浮坞的脚本移入 dock/

**功能**：把共用悬浮坞的脚本从仓库根目录收进同一目录。

**修改内容**：
- 新建 `dock/`，移入 `page-dock.user.js`、`jav-code-scanner.user.js`、`Enhanced_Media_Helper.js`、`jable & miss.user.js`。
- 根目录 `MODIFICATIONS.md` 保留历史记录。新的目录记录写在 `dock/MODIFICATIONS.md`。
- `tools/sync-webdev.js` 的 EMH 路径改为 `dock/Enhanced_Media_Helper.js`。
- 根 README、AGENTS、PROJECT-STATUS、JCS 使用指南中的安装路径同步改为 `dock/`。

**涉及文件与位置**：
- `dock/`：四个脚本
- `tools/sync-webdev.js`：`EMH_PATH`
- `README.md`、`AGENTS.md`、`PROJECT-STATUS.md`

### 2026-10-17 · 悬浮坞开关打开态改为灰色

**功能**：打开状态不再用绿色。

**修改内容**：
- `page-dock.user.js` 1.3.5 → 1.3.6。
- `.page-dock-switch.is-on` 背景从 `#34c759` 改为 `rgba(255,255,255,0.42)`。

**涉及文件与位置**：
- `page-dock.user.js`：`.page-dock-switch.is-on`

### 2026-10-17 · PageDock 改用不钉版本的地址

**功能**：库更新后不用再改引用脚本里的 URL。

**修改内容**：
- Greasy Fork 页面给出的 `.../600709/<版本号>/PageDock.js` 每次更新都会变，旧版本号地址永久返回旧代码。
- 不带版本号的 `https://update.greasyfork.org/scripts/600709/PageDock.js` 返回当前最新版。
- 字幕脚本 5.18 → 5.19，EMH 3.7.12 → 3.7.13。`@require` 改为这个地址。

**涉及文件与位置**：
- `jable & miss.user.js`、`Enhanced_Media_Helper.js`：`@require`

### 2026-10-17 · 悬浮坞改用本脚本加载到的实例

**功能**：避免登记写进页面上尚未挂载的空壳，导致图标不出现。

**修改内容**：
- 字幕脚本 5.15 → 5.16，EMH 3.7.9 → 3.7.10。
- `dockApi` 只取当前沙箱的 `PageDock`，不再优先读 `unsafeWindow.PageDock`。
- 登记前仍调用 `mount()`。每个引用脚本都会挂载自己的 UI；这是当前线上库 v1.3.1 的限制。

**涉及文件与位置**：
- `jable & miss.user.js`：`joinPageDock`
- `Enhanced_Media_Helper.js`：`createToggleButton`

---

## 二、dock/（悬浮坞脚本与文档）

### 项目约束

- 本目录只放已经接入 `PageDock` 的脚本：`page-dock.user.js`、`jav-code-scanner.user.js`、`Enhanced_Media_Helper.js`、`jable & miss.user.js`。
- 悬浮坞一行有两个控件：左边开关对应面板，右边开关整个脚本。脚本关闭时左边变灰，点了没有反应。
- JCS 行为变化仍要同步 `dock/docs/jav-code-scanner/`。EMH 行为变化仍要同步 `dock/docs/enhanced-media-helper/`。跨脚本桥文档在 `dock/docs/integration/`。
- 历史修改记录留在仓库根 `MODIFICATIONS.md`。2026-10-17 移入本目录之后的目录级变更写在这里。

### 2026-10-17 · 建立悬浮坞脚本目录

**功能**：已接入悬浮坞的四个脚本集中放置。

**修改内容**：
- 自仓库根目录移入四个脚本，文件名不变。
- Greasy Fork 的 `@require` 地址不因本地目录变化而改变。

**涉及文件与位置**：
- `dock/page-dock.user.js`
- `dock/jav-code-scanner.user.js`
- `dock/Enhanced_Media_Helper.js`
- `dock/jable & miss.user.js`

### 2026-10-17 · 悬浮坞相关文档移入 dock/docs

**功能**：已接入悬浮坞的脚本文档跟脚本放在同一目录树下。

**修改内容**：
- `docs/jav-code-scanner/`、`docs/enhanced-media-helper/`、`docs/integration/` 移到 `dock/docs/`。
- 仓库 README、AGENTS、PROJECT-STATUS、手册页脚、扩展 skill 和脚本内契约注释改为新路径。
- 三个文档域内部的相对链接保持 `../`，因为它们仍是同级目录。

**涉及文件与位置**：
- `dock/docs/jav-code-scanner/`
- `dock/docs/enhanced-media-helper/`
- `dock/docs/integration/`

### 2026-10-17 · 项目文档对齐当前目录

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

### 2026-10-17 · 全屏时字幕跟着全屏元素

**功能**：视频全屏时字幕不再被挡在全屏层外面。

**修改内容**：
- `jable & miss.user.js` 5.23 → 5.24。
- 字幕层平时挂在 `body`，使用 fixed。进入全屏后挂进 `fullscreenElement`，改用 absolute。
- 监听 `fullscreenchange` 和 `webkitfullscreenchange`。退出全屏后回到 `body`。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`Renderer.subtitleHost`、`forceDomSubtitleLayer`

### 2026-10-17 · 全屏字幕按视频画面定位

**功能**：全屏后字幕不再相对整个播放器盒子定位。

**修改内容**：
- `jable & miss.user.js` 5.24 → 5.25。
- 用当前视频的可视矩形计算字幕的 `left`、`top` 和宽度。横向、垂直滑杆仍按画面百分比生效。
- 字幕底部对齐计算出的位置，避免多行字幕向上挤出画面。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`Renderer.placeSubtitle`

### 2026-10-17 · 从悬浮坞打开后面板不再漂移

**功能**：点 CC 打开面板后，再点面板内容不会把面板拽走。

**修改内容**：
- `jable & miss.user.js` 5.25 → 5.26。
- 打开时改走 `placeDock`，同步内部坐标和元素位置。后续点击或窗口缩放都按这个位置重排。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`openPanel`

### 2026-10-17 · 脚本自己关闭面板时同步悬浮坞

**功能**：面板由脚本自己的关闭按钮、点击空白或 Esc 关闭时，悬浮坞左边状态跟着关掉。

**修改内容**：
- 字幕脚本 5.26 → 5.27。所有关闭字幕面板的路径都走 `closePanel()`，并调用 `setActive`。
- EMH 3.7.17 → 3.7.18。`PanelStore.set` 发现 `visible` 变化时同步 `emh-library`。
- JCS 1.5.94 → 1.5.95。关闭按钮、Esc、原浮钮切换和主动打开都同步 `jcs-scanner`。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`closePanel`
- `dock/Enhanced_Media_Helper.js`：`PanelStore.set`
- `dock/jav-code-scanner.user.js`：面板打开与关闭路径

### 2026-10-17 · 扫描数量显示在悬浮坞

**功能**：原浮钮上的扫描数量改到悬浮坞「扫描」旁边。

**修改内容**：
- JCS 1.5.95 → 1.5.96。
- `renderPanelMeta` 调用已有的 `PageDock.setBadge('jcs-scanner', 数量)`。没有结果时清空。超过 99 显示 `99+`。
- 不改悬浮坞。

**涉及文件与位置**：
- `dock/jav-code-scanner.user.js`：`renderPanelMeta`

### 2026-10-17 · Jable 评论时间并入字幕脚本

**功能**：评论时间列表只在 Jable 启用，默认打开，和 CC 共用同一个脚本开关。

**修改内容**：
- `jable-time-jump.js` 1.9.0 → 1.10.0。去掉自动启动，改为 `window.JableTimeJump.setEnabled`。关闭时移除时间列表。
- 字幕脚本 5.27 → 5.28。`@require ./jable-time-jump.js`。脚本开关变化时同步时间列表。
- Missav 页面不调用这个模块。

**涉及文件与位置**：
- `dock/jable-time-jump.js`：`setEnabled`
- `dock/jable & miss.user.js`：`@require`、`setScriptEnabled`

### 2026-10-17 · 评论时间代码直接迁入字幕脚本

**功能**：不再通过独立文件或 `@require` 挂评论时间功能。

**修改内容**：
- 字幕脚本 5.28 → 5.29。
- `jable-time-jump.js` 的时间解析、评论链接、自动加载和时间列表代码直接放进字幕脚本的 `JableTimeJump`。
- 删除 `dock/jable-time-jump.js`。Jable 上仍和 CC 共用 `STATE.enabled`，Missav 不启动。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`JableTimeJump`
- `dock/jable-time-jump.js`：删除

### 2026-10-17 · 时间列表显隐只跟右侧开关

**功能**：评论更新不能在脚本关闭后把时间列表重新画出来。

**修改内容**：
- 字幕脚本 5.29 → 5.30。
- `JableTimeJump.setEnabled` 写入 `timeEnabled`。`renderSidebar` 在关闭时直接移除列表，不再因为评论变化重建。
- 列表上的关闭也走同一个关闭状态。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`timeEnabled`、`renderSidebar`、`setEnabled`

### 2026-10-17 · 右侧开关当场控制时间列表

**功能**：不刷新页面，右侧开关关闭就隐藏时间列表，打开就重新显示。

**修改内容**：
- 字幕脚本 5.30 → 5.31。
- 开关不再直接调用内层的 `JableTimeJump`。它在另一个函数作用域里，调用不到。
- 改为派发 `msv-script-enabled`。时间模块监听后立刻移除或重建列表。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`setScriptEnabled`、`JableTimeJump.setEnabled`

### 2026-10-17 · 评论时间显示在进度条上

**功能**：时间点和时间段画在播放器进度条上，全屏时跟着进度条显示。

**修改内容**：
- 字幕脚本 5.31 → 5.32。
- 单个时间画成刻度，时间段画成区间。点击跳到起点。
- 右侧开关关闭时，进度条标记和时间列表一起移除。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`renderProgressMarks`

### 2026-10-17 · 全屏右侧时间刻度

**功能**：全屏时不再把时间点压在进度条上，改为播放器右侧的横向刻度。

**修改内容**：
- 字幕脚本 5.32 → 5.33。
- 刻度挂在 `.plyr` 内，只在全屏显示。单个时间是短横线，时间段是更长的横线，点击热区比进度条上的点大。
- 点击仍跳到起点。右侧开关关闭时移除。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

### 2026-10-17 · 右侧刻度按数量均匀排列

**功能**：全屏右侧刻度不再按片长时间隔拉开。

**修改内容**：
- 字幕脚本 5.35 → 5.36。
- 每个时间点和时间段各占一行，行高 16px。数量少时尺子短，数量多时变长，最高 70%，超出后在刻度区内滚动。
- 点击仍跳到真实时间。时间段只是横线更长，不再按时间跨度拉高。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

### 2026-10-17 · 选中刻度保持变长

**功能**：选中的右侧刻度保持长线，直到选择另一个，或播放进入下一个时间段。

**修改内容**：
- 字幕脚本 5.36 → 5.37。
- 刻度记录起止秒数。播放进入某个时间段时自动选中该段；离开后如果没有进入下一段，仍保持上次选中。
- 点击刻度或侧栏时间也会更新选中状态。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`currentRailPoint`、`updateSelectedSidebarItem`

### 2026-10-17 · 修正字幕脚本版本号

**功能**：避免把脚本版本从 5.37 误写成 71。

**修改内容**：
- `@version` 改为 5.38。脚本名已包含评论时间跳转。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`@version`

### 2026-10-17 · 字幕脚本升到 6.0

**功能**：版本号从 5.38 升到 6.0。

**修改内容**：
- `@version` 5.38 → 6.0。行为没有另外改动。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`@version`
- `README.md`：版本表

### 2026-10-17 · 右侧刻度区不再误暂停

**功能**：全屏时点右侧刻度附近，不会再点到画面导致暂停。

**修改内容**：
- 字幕脚本 5.34 → 5.35。
- 右侧刻度条改为可点击区域，挡住背后的播放器点击。
- 刻度热区加高到 12px。点空白只拦截，不暂停；点刻度仍跳转。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

### 2026-10-17 · 右侧时间刻度收短

**功能**：全屏右侧刻度不再拉满播放器高度，相邻刻度更近。

**修改内容**：
- 字幕脚本 5.33 → 5.34。
- 刻度尺改为垂直居中，高度 `min(240px, 42%)`。时间百分比仍按这条较短的尺计算。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`

### 2026-10-21 · 字号 / 垂直 / 横向三项记忆

**功能**：字号、垂直位置、横向位置现在都会跨刷新记住。

**根因**：
1. **字号完全没存**。`STATE.fontSize` 直接用 `CONFIG.defaultFontSize` 初始化，全脚本没有任何读取或写入字号存储的代码，刷新必然回到默认值。
2. **垂直/横向的存储逻辑本身是好的**（`msv-subtitle-pos-v1` 存 `bottom` + `x`），但被第 3 点连累。
3. **`localStorage` 不可用会让整个脚本崩掉**。原代码在顶层直接读 `localStorage.getItem('msv-script-enabled')`，iOS 无痕模式或 Safari「阻止所有 Cookie」下这一句抛 `SecurityError`，IIFE 中断，悬浮坞根本不渲染 —— 用户看到的现象就是「三项全都没记住」。

**修改内容**：
- 字幕脚本 6.3 → 6.4。
- 新增统一存储键 `msv-subtitle-view-v2`，三项（`bottom` / `x` / `fontSize`）一起读写，不再出现「只记住一部分」。
- 新增 `storageGet` / `storageSet`：全部包 `try/catch`，并维护一份 `memoryStore` 内存副本 —— 存储不可用时本次会话内仍能记住设置；`localStorage` 抛错不再中断脚本。
- 所有直接 `localStorage` 调用（脚本开关、悬浮坞位置、设置读写）统一改走这两个函数。全文现在只剩 `storageGet` / `storageSet` 内部两处真正触碰 `localStorage`。
- 兼容旧键 `msv-subtitle-pos-v1`：先读旧键再读新键，老用户已保存的位置不丢；新键优先。
- 脏数据防护：`bottom` / `x` 夹到 0~100；`fontSize` 超出滑杆范围（12~60）或非数字时丢弃回默认，避免脏数据把字号顶到不可读；非法 JSON 不崩溃。
- 三个滑杆都补 `onchange = oninput` 兜底 —— 触屏上拖动可能只派发 `change`，`input` 被手势吞掉时就不会保存。
- `STATE.fontSize` 从字符串改为 `Number`，与存储里的数值类型一致。

**验证**：`node --check` 通过。新增 29 项断言全部通过：三项写入同一份存储、刷新后字号 30 / 垂直 25% / 横向 70% 全部恢复且滑杆 value 同步、旧键被继承且新键优先、脏数据被夹取或丢弃、`localStorage` 被禁用时脚本不崩溃且悬浮坞/面板正常渲染、仅派发 `change` 也能保存。前三轮的 29 + 41 + 35 项回归全通过（共 134 项）。**未在真机 iPhone 17 验证**，无痕模式下的实际行为需真机确认。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`@version`、`VIEW_KEY` / `LEGACY_POS_KEY` / `memoryStore`、`storageGet` / `storageSet` / `clampPercent`、`readSavedView` / `savedView`、`STATE.fontSize`、`saveView`、三个滑杆的 `oninput` / `onchange`、`placeDock`、`setScriptEnabled`
- `README.md`：`dock/` 版本表

### 2026-10-21 · 移动端面板与字幕字号收敛

**功能**：移动端字幕面板不再拉满屏宽，时间条与右侧刻度整体收小；字幕默认字号按屏幕宽度分档，手机上不再用桌面 24px。

**问题**：上一版移动端面板是 `left:8px; right:8px` 全宽，在 iPhone 17（402×874 CSS px）上 386px 宽显得过大；时间条条目 40px 高、13px 字、容器 8px 内边距也偏厚重；字幕默认字号固定 24px，在 402px 宽的屏上一行放不下多少字。

**修改内容**：
- 字幕脚本 6.2 → 6.3。
- 新增 `defaultSubtitleFontSize()`，按视口宽度分三档：`≤480px` → 17px（iPhone 竖屏）、`≤820px` → 19px（手机横屏 / 小平板）、其余 24px。`CONFIG.defaultFontSize` 改用它。
- 面板改为固定宽度：CSS 兜底 `width: min(320px, calc(100vw - 24px))`；`placePanel()` 在移动端写入实际宽度并按悬浮坞所在侧贴靠（`left` 或 `right` 只写一个），不再全宽拉伸。
- 移动端内部尺寸整体收一档：头部 padding `10/12/8` → `8/10/7`、标题 12 → 11.5px、`.msv-body` padding `10/12/12` → `8/10/10`、gap 8 → 7、标签 10 → 9.5px、按钮 12 → 11.5px、列表项 12 → 11.5px、列表高度上限 `38dvh` → `34dvh`、圆角 16 → 14px。输入框仍保留 16px（低于此值 iOS 聚焦会放大整页），只收 padding。
- 时间条收小：容器 padding `8/10` → `6/8`、圆角 14 → 12px、标题 11 → 10.5px、条目 `min-height` 40 → 36px、`min-width` 58 → 50px、`font-size` 13 → 12.5px（区间 12 → 11.5px）、关闭按钮 26 → 22px。
- 右侧刻度收小：宽度 76 → 66px、`max-height` 56% → 52%、热区 24 → 22px、线宽 26 → 24px、区间线 38 → 34px、选中线 48 → 42px。
- `placePanel()` 的移动端判定改用 `matchMedia` + UA，与 CSS 的 `@media` 保持同一条件；不再用 `getComputedStyle(panel).position` 反推（依赖样式解析结果，环境差异下不可靠）。

**验证**：`node --check` 通过。按 iPhone 17 视口（402×874）新增 35 项断言全部通过：默认字号 17px 且滑杆初值/填充比例同步、字幕层实际 font-size 为 17px、面板宽度落在 240~320px 且只贴一侧、时间条各尺寸与 safe-area/横向滚动/关闭按钮常显均符合；桌面端字号仍 24px、时间侧栏仍贴视频左侧；800px 走 19px 档、844px 走 24px 档。前两轮的 29 + 41 项回归断言重跑全通过。**未在真机 iPhone 17 验证**，实际观感与 `env()` 取值需真机确认。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`@version`、`defaultSubtitleFontSize`、`CONFIG.defaultFontSize`、注入样式块移动端段、`isMobilePanel`、`placePanel`、`#jable-comment-time-sidebar.jcts-touch` 系列、`#jable-comment-time-rail.jcts-touch` 系列
- `README.md`：`dock/` 版本表

### 2026-10-21 · 修复滑杆轨道不可见，时间点适配移动端

**功能**：字号 / 垂直 / 横向三条滑杆的轨道恢复可见，并显示已填充比例；Jable 评论时间点在移动端改为底部横向时间条，不再是贴视频左侧的 PC 竖栏。

**问题 1 根因**：上一版给 `.msv-slider` 加了 `-webkit-appearance: none`，该属性会移除浏览器原生轨道绘制，但当时只写了 `::-webkit-slider-thumb`，没有写 `::-webkit-slider-runnable-track`，结果只剩一个滑块圆点、整条轨道不可见。

**问题 2 根因**：时间点侧栏是纯 PC 交互。侧栏固定贴视频左侧 `128px` 宽竖排，手机上视频满宽，`rect.left - width - gap` 算出负数后被夹到 `8px`，直接压在画面上；只能按住 11px 小标题拖动；关闭按钮平时 `opacity:0` + `pointer-events:none`，要先点侧栏才显形，触屏上等于没有关闭入口；右侧刻度只有 16px 高、18~28px 宽，选中态依赖 `:hover`（触屏会黏住）。

**修改内容**：
- 字幕脚本 6.1 → 6.2。
- 滑杆：补 `::-webkit-slider-runnable-track`（6px 高、圆角）与 `::-moz-range-track` / `::-moz-range-progress`；thumb 改为白色圆点并用 `margin-top: -6px` 在轨道上居中；已填充段用 CSS 变量 `--msv-fill` 画渐变。
- 新增 `syncSliderFill()`，在 `oninput` 与初始化时写入 `--msv-fill`，三条滑杆（垂直 / 横向 / 字号）都会随值实时更新。
- 新增 `isTouchLayout()`（`max-width:820px`、`pointer:coarse` 或移动 UA），`renderSidebar` / `renderProgressMarks` 据此给侧栏和刻度加 `jcts-touch`。
- 移动端侧栏改为底部固定横条：`left/right: 8px`、避开 `env(safe-area-inset-bottom)`、半透明背景加模糊；列表 `flex-direction: row` 横向滚动、隐藏滚动条；条目最小 `40px` 高、`13px` 字，点按即跳转。
- 移动端关闭按钮常显（`opacity:1`、`pointer-events:auto`、26px 见方），不再依赖 `pointerdown` 才浮现。
- 移动端刻度热区加高到 24px、线宽加大，`jcts-selected` 不依赖 hover。
- `positionSidebar` 在触屏模式下不再写死 `left/top`，交给 CSS 固定；`bindSidebarDragging` 在触屏模式下直接跳过，避免标题拖动抢走横向滚动。
- `clampSidebarPosition` 改用 `visualViewport` 尺寸；`bindLayoutUpdates` 补 `orientationchange` 与 `visualViewport.resize`。
- 桌面端行为完全保留：仍贴视频左侧、仍可拖动、标题仍提示「按住并拖动」。

**验证**：`node --check` 通过。jsdom 41 项断言全部通过：三条滑杆的 `--msv-fill` 初值分别为 `8%` / `50%` / `25%`，拖到端点后变为 `100%` / `0%`；移动端侧栏带 `jcts-touch` 且不写死 `left/top`、关闭按钮常显可点、条目点击能选中并跳转、关闭能移除侧栏；桌面端侧栏不带 `jcts-touch`、仍写死定位、标题仍提示拖动。上一轮 iOS 兼容的 29 项断言重跑仍全通过。**未在真机 iOS Safari 验证**，滑杆自绘轨道与 `env()` 实际取值需真机确认。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`@version`、注入样式块（`.msv-slider` 系列、`#jable-comment-time-sidebar.jcts-touch` 系列、`#jable-comment-time-rail.jcts-touch`）、`isTouchLayout`、`syncSliderFill`、`renderSidebar`、`renderProgressMarks`、`positionSidebar`、`bindSidebarDragging`、`clampSidebarPosition`、`bindLayoutUpdates`
- `README.md`：`dock/` 版本表

### 2026-10-21 · 修复字幕脚本在 iOS 上完全不工作

**功能**：`jable & miss.user.js` 在 iOS Safari（Userscripts 扩展）上现在能正常注入样式、显示 CC 悬浮坞并打开面板；面板不再在窄屏上溢出，输入框聚焦不再放大整页，滑杆和拖动按触屏方式工作。

**根因**：脚本直接调用 `GM_addStyle(...)`。iOS 的 Userscripts 扩展只注册 `GM.addStyle`（见 quoid/userscripts `src/ext/content-scripts/api.js` 的导出表与 `entry-userscripts.js` 的 `@grant` 映射），没有 `GM_addStyle`。该调用抛 `ReferenceError`，整个 IIFE 在这一步中断，界面完全不出现，而 Userscripts 的外层 `try/catch` 只往控制台打一行错误。

**修改内容**：
- 字幕脚本 6.0 → 6.1。
- 新增 `MsvGM` 兼容层：`addStyle` 依次尝试 `GM_addStyle` → `GM.addStyle` → 自插 `<style>`；`request` 依次尝试 `GM_xmlhttpRequest` → `GM.xmlHttpRequest` → 页面 `XMLHttpRequest`。刻意不声明名为 `GM` / `GM_xmlhttpRequest` 的局部变量，避免遮蔽管理器注入的同名 API。
- `@grant` 补 `GM.xmlHttpRequest`、`GM.addStyle`；样式与 5 处请求调用改走兼容层。
- 触屏：`#msv-dock` 的 `touch-action` 由 `none` 改为 `manipulation`（原来连面板列表都无法滚动），拖动保留在 `#msv-fab` / `.msv-head` 上；`point()` 兼容 `changedTouches`；补 `touchcancel` 收尾，避免页面滚动中断触摸序列后卡在拖动态；拖动结束后 400ms 复位 `dragMoved`，防止下一次点按被吞。
- 视口：新增 `viewportSize()`，位置夹取改用 `visualViewport`；监听 `visualViewport` 的 `resize`/`scroll` 与 `orientationchange`。
- 布局：窄屏（`max-width:820px` 或 `pointer:coarse`）面板改为 fixed 贴底抽屉并避开 `env(safe-area-inset-bottom)`；桌面端 `placePanel()` 用视口把面板夹回可见区域。面板补 `100vh` + `100dvh` 双写 `max-height`。
- iOS 细节：输入框字号 12px → 16px（低于 16px 会触发 Safari 聚焦自动缩放）；range 滑杆加 `-webkit-appearance` 与自定义 thumb，`touch-action: pan-y`；按需加 `-webkit-user-select` / `-webkit-tap-highlight-color`。
- 挂载点由 `document.body` 改为 `document.documentElement`，避免站点给 `body` 加 `transform`/`filter` 时内部 `position:fixed` 退化为相对 `body` 定位。
- 列表滚动条显式声明 track 透明，符合仓库滚动条规范。
- 回归兼容：Tampermonkey / Violentmonkey 仍优先走 `GM_addStyle` 老路径。

**验证**：`node --check` 通过。jsdom 模拟三种环境（仅 `GM.addStyle` 的 iOS 环境、有 `GM_addStyle` 的 Tampermonkey 环境、无任何 GM API）共 29 项断言全部通过：三种环境均无异常且能建出 `#msv-dock` / `#msv-fab` / `#msv-panel`；触屏单击开合面板、拖动改位、`touchcancel` 收尾、拖动后不误触均符合预期；自动搜索确实经 `GM.xmlHttpRequest` 发出。**未在真机 iOS Safari 上验证**，媒体查询与 `env()` 的实际取值需真机确认。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`@version`、`@grant`、`MsvGM`、`MsvGM.addStyle`、`MsvGM.request`、注入样式块、`viewportSize`、`clampDock`、`placePanel`、`dragStart`/`dragMove`/`dragEnd`、`UIBuilder.build` 挂载点、`openPanel`
- `README.md`：`dock/` 版本表

### 2026-10-17 · 调整 PageDock 接入说明

**功能**：写明脚本自己关闭面板时也要同步左边状态。

**修改内容**：
- `dock/docs/page-dock.md` 增加强制同步规则、三个已接入脚本的同步点和内部关闭示例。
- 接入步骤增加「每次打开或关闭都调用 `setActive`」。

**涉及文件与位置**：
- `dock/docs/page-dock.md`

### 2026-10-17 · 增加 PageDock 接入说明

**功能**：给后续脚本一份可执行的悬浮坞接入说明。

**修改内容**：
- 新建 `dock/docs/page-dock.md`：安装、左右控件、`@require`、登记示例和 API。
- 根 README 与 AGENTS 指向这份说明。

**涉及文件与位置**：
- `dock/docs/page-dock.md`
- `README.md`
- `AGENTS.md`

---

## 三、18mh/（18dm 小说下载器）

### 项目约束

- 单文件油猴脚本 `18mh.user.js`；`@version` 与功能变更同步递增。
- 收藏存 `dm_dl_favorites_v1`，黑名单存 `dm_dl_blacklist_v1`，书目状态存 `dm_dl_status_v1`（GM + localStorage）；下载记录/章节缓存/状态不进 WebDAV。
- 拉黑时若已收藏则取消收藏；取消拉黑不恢复收藏。
- 状态刷新范围 = 已下载 ∪ 已收藏，按 id 去重并排除已拉黑。
- 刷新入口统一为 `refreshLibrary({ manual, scope })`：一次抓取同时产出书目状态与章节更新，不要再新增第二条详情页抓取路径。
- WebDAV 走 Greasy Fork 库 `webdev-component`（`@require`），接入方只接线，不改库源码、不自写表单。
- iOS / 全端均不注册 `GM_registerMenuCommand`；入口只有书库标题栏一个设置按钮。
- WebDAV 下载合并：远端同 id 覆盖，本地独有保留；黑名单 id 从收藏中剔除。

### 2026-10-23 · 合并「刷新状态」与「检查更新」

**功能**：书库标题栏原来的「刷新状态」和「检查更新」两个按钮合并为一个「刷新状态与更新」按钮。一次详情页抓取同时产出书目状态和章节更新，不再重复请求。

**问题**：
1. 两个按钮请求的是同一个 `GET /novel/detail/{id}`，解析同一份 HTML，只是各取不同字段（状态取徽章与 meta 行，更新取章节列表）。分开后同一本书被请求两次。
2. `checkFavUpdates` 的 `add` 累加器依赖 `prev.maxId` 判断增量；两条路径并发时都读到同一个旧 `maxId`，后写的一方会把同一个 `delta` 再加一遍，`有更新 +N` 虚高。
3. `maybeAutoCheckUpdates` 用 `autoCheckRan` 布尔值防重入，按钮用 `busy` class 防重入，两个锁互不相干，挡不住彼此。
4. 两条路径各自维护一份 `CONC=4` 并发池（复制粘贴），加上已有的 `mapPool`，共三处重复实现。
5. 拉黑一本书后，`dm_dl_updates_v1` 里该书的旧 `add` 不会被清，留下永远不会被刷新的「有更新」标记（刷新范围本就排除黑名单）。

**修改内容**：
- `@version` 4.7.10 → 4.8.0。
- 新增 `fetchNovelSnapshot(id)`：一次抓取返回 `{ id, status, chapters }`，复用已有的 `readDetailStatus` 与 `parseChaptersIn`（两者本就接收 `doc`，签名无需改动）。
- 新增 `refreshLibrary({ manual, scope })` 作为唯一刷新入口：
  - `scope: 'all'` = 已下载 ∪ 已收藏（保持旧「刷新状态」语义，项目约束不变）；
  - `scope: 'fav'` = 仅已收藏（旧「检查更新」语义）；
  - 两者都排除已拉黑，按 id 去重。
- 新增 `refreshInFlight` 单飞变量：同一时刻只允许一个刷新任务，重复调用直接复用进行中的 Promise。
- 新增手动连点保护：`dm_dl_updates_v1.lastManualAt` + 30 秒最小间隔，命中时提示「刚刚已刷新」而不重跑。自动检查不受此限制。
- 并发池改用已有的 `mapPool`，删除两份复制的 `CONC=4` 实现。
- 新增 `setRefreshBusy`（统一忙碌态与 `刷新中 N/M` 进度）、`showRefreshSummary`（一条汇总提示替代原两条 toast）。
- 汇总文案：`已刷新 N 本 · N 本有更新 · N 本已完结 · N 本失败`；标题在无更新时为「已是最新」，有更新时为「发现更新」。
- 删除 `fetchOneStatus` / `fetchStatusForIds` / `refreshLibraryStatus` / `fetchChapterLists` / `checkFavUpdates` / `notifyUpdates`，共约 150 行重复代码。
- UI：`#dm-dl-updates-btn` 与 `#dm-dl-status-refresh` 合并为 `#dm-dl-refresh-btn`，图标用 `ICONS.refresh`，标题「刷新状态与更新」。CSS 两条选择器合并为一条。
- `maybeAutoCheckUpdates` 改调 `refreshLibrary({ manual: false, scope: 'fav' })`，静默不弹汇总，仍然写 `lastCheckAt` 做 6 小时节流。
- `toggleBan` 在成功拉黑后删除该书在 `dm_dl_updates_v1.items` 中的记录，避免「有更新」残留。
- `ICONS.bell` 保留定义但暂无使用者（图标库的一部分，后续做「有更新」提示态可复用）。

**验证**：`node --check` 通过。jsdom 29 项断言全部通过：每本书只请求一次、覆盖历史∪收藏、状态与更新均正确写入、`add` 累加正确（基线 1005 → 最新 1010 得 delta 5）、并发三次调用仍只跑一轮、拉黑书被排除、`scope:'fav'` 只请求收藏、失败不影响其他书、30 秒内连点被节流、拉黑清理逻辑存在、汇总文案四段齐全。**未在真实站点验证**，`readDetailStatus` / `parseChaptersIn` 对真实页面的解析依赖既有实现（本次未改动）。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`@version`、`REFRESH_CONCURRENCY` / `REFRESH_MIN_GAP_MS` / `refreshInFlight`、`fetchNovelSnapshot`、`setRefreshBusy`、`showRefreshSummary`、`refreshLibrary`、书库标题栏 HTML、`buildSheet` 按钮绑定、`.busy` CSS、`maybeAutoCheckUpdates`、`toggleBan`
- `18mh/MODIFICATIONS.md`：项目约束补充「统一刷新入口」一条

### 2026-09-20 · 收藏 WebDAV 同步

**功能**：书库接入 webdev-component，仅同步收藏。

**修改内容**：
- 元数据：`@version` 4.0.0 → 4.1.0；`@require` webdev-component v1.3.2；`@connect *`。
- `createWebdev({ menu:false })`：收藏 `{items}` 载荷、GM 存储、`GM_xmlhttpRequest`。
- 书库标题栏云朵按钮打开库自带面板；下载后按 id 合并收藏并刷新书库/徽章。

**涉及文件与位置**：
- `18mh/18mh.user.js` 头、`ICONS.cloud`、书库 `.dm-dl-hd-acts`、`initWebdav` / `openWebdavPanel` / `mergeFavsFromPack`

### 2026-09-20 · 书籍黑名单标记

**功能**：按小说 id 打标拉黑；Dock 开关；书库 tab；WebDAV 与收藏一并同步。

**修改内容**：
- `@version` 4.1.0 → 4.2.0。
- `BAN_KEY` + Dock 禁书按钮 + 标题/列表卡「已拉黑」徽章（不隐藏卡片）。
- 书库第三 tab「已拉黑」；拉黑时取消收藏。
- WebDAV 载荷 v2 增加 `blacklist[]`；下载先合并收藏再合并黑名单，拉黑优先。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`toggleBan` / `injectTitleBadges` / `markListCards` / 书库 tab / `exportLibraryPayload`
- `docs/superpowers/specs/2026-09-20-18mh-book-blacklist-design.md`

### 2026-09-22 · 书目状态（连载/完结 + 更新时间）

**功能**：书库与站点列表卡展示书目状态与更新时间，书库提供刷新按钮。

**修改内容**：
- `@version` 4.2.0 → 4.3.0。
- 新增 `dm_dl_status_v1` 缓存；列表卡与详情页被动采集，同值不重写。
- 书库标题栏 ⟳ 按钮：并集(已下载∪已收藏) 去重、排除已拉黑，并发 4 抓详情页，带进度。
- 书库条目与列表卡显示「连载中/已完结」胶囊与更新时间。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`STATUS_KEY` / `recordStatus` / `readCardStatus` / `readDetailStatus` / `refreshLibraryStatus` / `markListCards` / `renderSheetBody` / `boot`
- `docs/superpowers/specs/2026-09-22-18mh-book-status-design.md`

### 2026-09-22 · 果核阅读器直连

**功能**：书库与站点书页跳转果核阅读器 `fixreader.vercel.app`。

**修改内容**：
- `@version` 4.3.0 → 4.4.0。
- 书库「已收藏/已下载」条目新增「阅读」按钮 → `?novel=<id>`（已拉黑不加）。
- 站点 Dock 新增书本按钮 → 有 id 用 `?novel=<id>`，否则 `?q=<书名>`。
- 新增 `READER_BASE` / `readerUrlById` / `readerUrlByQuery` / `openReader`、`ICONS.book`。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`READER_BASE` 段 / `ICONS.book` / `buildDockUI` / `renderSheetBody`
- `docs/superpowers/specs/2026-09-22-18mh-reader-link-design.md`

### 2026-09-22 · Dock 动作菜单（⋯）

**功能**：Dock 图标按钮过多/无标签 → 收藏/拉黑/阅读收进「⋯」气泡。

**修改内容**：
- `@version` 4.4.0 → 4.5.0。
- Dock 改为 `[主按钮][书库][⋯][收起]`；移除独立收藏/拉黑/阅读按钮。
- `⋯` 气泡：紧贴按钮下方 6px、右对齐、宽 78px（移动端 96px）；四项 收藏/拉黑/阅读/分享。
- 已收藏/已拉黑时行文字切换，`⋯` 高亮 + 红点；点击外部/Esc/滚动关闭。
- 新增 `ICONS.more` / `ICONS.share`、`copyText` / `shareNovel`。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`openDockMenu` / `closeDockMenu` / `buildDockMenuRows` / `syncMenuBtnState` / `shareNovel` / `buildDockUI`
- `docs/superpowers/specs/2026-09-22-18mh-dock-action-menu-design.md`

### 2026-09-22 · 修复：收藏状态配色 + 面板靠边溢出

**功能**：修两个 UI bug。

**修改内容**：
- `@version` 4.5.0 → 4.5.1。
- 收藏/拉黑恢复红色语义：菜单行图标按状态着色（已收藏粉红 / 已拉黑灰白），`⋯` 按钮已收藏时粉红高亮。
- `anchorPopoverToDock` 水平夹取 + 按 Dock 所在半屏切换锚定边，修复 Dock 贴左时面板溢出屏幕。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`anchorPopoverToDock` / `syncMenuBtnState` / `buildDockMenuRows` / Dock 菜单 CSS

### 2026-09-22 · 修复：章节页取到章节名当书名

**功能**：修 bug。

**修改内容**：
- `@version` 4.5.1 → 4.5.2。
- `getNovelTitle()` 优先读 `main[data-novel-info]` 的 `novel_title`（详情页/章节页都有），章节页不再把 `h1`（章节名）当书名。
- 影响：章节页收藏/拉黑的入库标题、分享文案、下载 TXT 文件名。
- 已存错的旧收藏条目不会自动修正，需重新收藏一次。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`readNovelTitleFromPage` / `getNovelTitle`

### 2026-09-22 · 列表卡阅读器入口

**功能**：站点列表页每张卡片封面底部加「📖 阅读」，一键进果核阅读器。

**修改内容**：
- `@version` 4.5.2 → 4.6.0。
- `markListCards` 对所有卡片（不限书库内）调用 `addReaderBar`。
- 新增 `.dm-dl-reader-bar` 样式与 `addReaderBar`；点击 `preventDefault` 不触发卡片跳转；重绘时清理。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`addReaderBar` / `markListCards` / 列表卡 CSS
- `docs/superpowers/specs/2026-09-22-18mh-list-reader-entry-design.md`

### 2026-09-22 · 列表卡阅读条改为悬停显示

**功能**：阅读条默认隐藏，悬停封面才滑出。

**修改内容**：
- `@version` 4.6.0 → 4.6.1。
- `.dm-dl-reader-bar` 默认 `opacity:0` + `translateY(100%)` + `pointer-events:none`；`.poster:hover` 显示。
- `@media (hover:none)` 触屏设备保持常显。

**涉及文件与位置**：
- `18mh/18mh.user.js`：列表卡 CSS

### 2026-09-22 · 收藏更新提醒

**功能**：收藏的连载书有新章时 toast + 书库红点提醒。

**修改内容**：
- `@version` 4.6.1 → 4.7.0。
- 新增 `dm_dl_updates_v1`（`lastCheckAt` + 每书 `maxId` 基线、`add` 未读新增数）。
- 检查范围仅收藏；并发 4 抓详情页对比最新章 id。
- 触发：进站延迟 3s 静默（6 小时阈值、每会话一次）+ 书库标题栏铃铛按钮。
- 提醒：toast 汇总 + 书库按钮红点 + 条目「有更新 +N」；打开书库先渲染再清标记。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`UPD_KEY` / `checkFavUpdates` / `fetchChapterLists` / `notifyUpdates` / `clearUpdateMarks` / `hasPendingUpdates` / `maybeAutoCheckUpdates` / `openSheet` / `renderSheetBody` / `buildDockUI`
- `docs/superpowers/specs/2026-09-22-18mh-fav-update-alert-design.md`

### 2026-09-22 · 修复：移动端列表阅读条不显示

**功能**：修 bug。

**修改内容**：
- `@version` 4.7.0 → 4.7.1。
- `.dm-dl-reader-bar` 改为**默认常显**，仅 `@media (hover:hover) and (pointer:fine)` 的桌面设备才悬停显示（原先靠 `@media (hover:none)` 兜底，移动端不可靠）。
- 新增 `readNovelIdFromPage()`：URL 解析不到书籍 id 时，回退读 `main[data-novel-info].novel_id` / 面包屑链接（预防性，`buildDockUI`、`boot` 已接入）。

**涉及文件与位置**：
- `18mh/18mh.user.js`：列表卡 CSS / `readNovelIdFromPage` / `buildDockUI` / `boot`

### 2026-09-22 · 修复：iOS 刷新后 WebDAV 账号丢失

**功能**：修 bug。

**修改内容**：
- `@version` 4.7.1 → 4.7.2。
- WebDAV `storage` 适配器由「仅 GM」改为 **GM + localStorage 双写**，读取优先 GM、回退 localStorage（JSON 串），与脚本其余存储（`saveJSON`/`loadJSON`）一致。
- 兼容旧数据：GM 里存的旧对象原样返回；同时 fire-and-forget 调用现代 `GM.setValue`。
- 原因：iOS Userscripts 上同步 `GM_setValue` 不可靠，只走 GM 导致设置刷新即丢。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`initWebdav` 的 `storage` 适配器

### 2026-09-22 · 加固：WebDAV 设置读取与双保险落盘

**功能**：修 iOS 上仍丢账号的问题。

**修改内容**：
- `@version` 4.7.2 → 4.7.3。
- `storage.get` 改为遍历 GM/localStorage 全部候选，**优先返回确实含 url/user/pass 的那份**，避免旧空值盖掉好值。
- `openWebdavPanel` 增加 `onSave`：面板保存时同步 `saveJSON('dm_dl_webdav_v1', s)`（与收藏同一条存储路径，iOS 已验证可用）。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`initWebdav` 的 `storage.get` / `openWebdavPanel`

### 2026-09-24 · 修复：点「阅读」当前页也被跳走

**功能**：修 bug。

**修改内容**：
- `@version` 4.7.3 → 4.7.4。
- `openReader`：`window.open(url, '_blank', 'noopener')` 按规范恒返回 `null`，原逻辑把「返回 null」误判为被拦截 → 又执行了 `location.href = url`，导致新窗口与当前页同时打开。
- 改为不带 `noopener` 打开、成功后手动 `w.opener = null`；仅当确实返回 null（真被拦截）才回退当前页。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`openReader`

### 2026-09-24 · 修复：下载进度整条闪烁 + Dock 转圈卡顿

**功能**：修两个下载期 UI bug。

**修改内容**：
- `@version` 4.7.4 → 4.7.5。
- `showToast`：glitch 撕裂动画改为仅在「由隐藏→显示」时播一次（`wasShown` 判断），进度类高频更新不重放。
- 下载进度不再每 tick `innerHTML` 重建：
  - 新增 `ensureMainProgress` / `setMainProgress`，`.dm-dl-prog`、`.dm-dl-spinner`、`.dm-dl-pct` 只建一次，之后只改 `style.width` 与文本 → spinner 动画不再重启、进度条过渡生效。
  - 新增 `setDotProgress`，折叠球百分比原地更新（原逻辑第二个 tick 起因查不到 svg 而冻结，顺带修掉）。
  - loading 开始时先 `setMainProgress(btn, 0)`，立即出现 spinner。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`showToast` / `ensureMainProgress` / `setMainProgress` / `setDotProgress` / `startDownload`

### 2026-09-24 · 修复：提示标题残留 glitch 重影

**功能**：修 bug。

**修改内容**：
- `@version` 4.7.5 → 4.7.6。
- glitch 的 `::before/::after` 是青/红错位副本；动画（.42s）结束后未摘类会留下重影。现在 `showToast` 播完后用 `glitchTimer` 在 460ms 移除 `.dm-dl-glitch`。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`showToast`

### 2026-10-18 · 修复：书库条目少时面板变矮

**功能**：修 bug。

**修改内容**：
- `@version` 4.7.6 → 4.7.7。
- PC 书库气泡原先 `height: auto`，已下载/已收藏/已拉黑任一 tab 为空或条目少时，面板会跟着内容缩到只剩标题和底栏。
- 改为固定 `height: min(62vh, 540px)`，并加 `min-height: min(360px, 62vh)`，避免视口较矮时被 min-height 撑出屏幕。
- `.dm-dl-body` 增加 `flex: 1 1 auto; min-height: 0`，空态和少条目时列表区撑满，多条目仍在体内滚动。三个 tab 共用同一面板，一起修好。
- 标签抽屉本身已是固定高度，不改。确认气泡内容短，保持自适应。

**涉及文件与位置**：
- `18mh/18mh.user.js`：PC `#dm-dl-sheet` 高度、`.dm-dl-body`

### 2026-10-18 · 列表卡拉黑封面与书名毛玻璃

**功能**：站点列表上，已拉黑的书单独遮封面和书名。

**修改内容**：
- `@version` 4.7.7 → 4.7.8。
- `markListCards` 命中黑名单时调用 `veilBannedCard`，不再插灰色「已拉黑」徽章。
- 封面（`.poster`，没有则退到图片父节点）铺一层 `.dm-dl-veil`，文案「已拉黑」。
- 书名（`h2`/`h3`）另铺一层 `.dm-dl-veil-title`，只糊字，不带动旁边徽章和行高。
- 更新时间、章节数留在玻璃外。层 `pointer-events: none`，点击仍进详情。
- 桌面悬停整张卡时两层淡出，方便确认是否拉错；触屏保持遮住。
- 重绘时清掉旧层，避免二次 boot 叠加。详情页标题徽章和书库「已拉黑」tab 仍显示原文。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`.dm-dl-veil` CSS / `veilBannedCard` / `markListCards`

### 2026-10-18 · 书库条目不再显示收藏时间

**功能**：书库三个 tab 的操作时间不再占一行。

**修改内容**：
- `@version` 4.7.8 → 4.7.9。
- `renderSheetBody` 去掉 meta 行的 `timeText`。PC 书库按钮占掉右侧后，这段完整本地时间会把标签行挤到按钮下方。
- 时间改挂到书名 `title`：已下载是「下载于」，已收藏是「收藏于」，已拉黑是「拉黑于」。悬停书名可见。
- 排序仍按 `time` 倒序。连载/完结、书目更新时间、「有更新 +N」留在 meta 行。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`renderSheetBody`

### 2026-10-18 · 书库操作按钮收窄

**功能**：给书名和标签多留宽度，减少 meta 换行。

**修改内容**：
- `@version` 4.7.9 → 4.7.10。
- `.dm-dl-item-acts` 间距 6px → 4px，按钮不收缩。
- `.dm-dl-mini` 水平内边距 12px → 7px。
- 条目左右间距 10px → 8px，左右内边距 12px → 10px。
- 三个按钮大约少占 40px，让给左侧书名和标签。

**涉及文件与位置**：
- `18mh/18mh.user.js`：`.dm-dl-item` / `.dm-dl-item-acts` / `.dm-dl-mini`

---

## 四、dock/docs/jav-code-scanner/（JCS 文档域）

### 项目约束（jav-code-scanner 文档域）

- 本目录只放 **jav-code-scanner（JCS）单项目文档**：架构说明、对外契约、设计规范。
- 跨两脚本协作的协议文档放 `dock/docs/integration/`；EMH 侧文档放 `dock/docs/enhanced-media-helper/`。
- 文档内引用其它目录文档一律用**相对路径**（如 `../integration/integration-emh-scanner.md`）。
- 文档头部必须标注对应的脚本版本号（如 v1.5.91），脚本改动推进时同步更新版本锚点。
- 改 `jav-code-scanner.user.js` 时，同一轮必须更新本目录里描述该行为的文档（通常是 `README.md`；契约语义变化时还包括 `jcs-extension-contract.md`），并回填本文件。不得只改代码。仓库级约束见根目录 `AGENTS.md`。

### 2026-10-17 · 扫描入口收进悬浮坞（JCS v1.5.92）

**功能**：有 PageDock 时，JCS 浮钮收进悬浮坞。开关控制整个扫描脚本。

**修改内容**：
- `@version` / `STYLE_VER` / `SCRIPT_VER` 1.5.91 → 1.5.92。
- `@require https://update.greasyfork.org/scripts/600709/PageDock.js`。
- 登记「扫描」。开关写入 `jcs_script_enabled_v1`。关闭后不建面板、不扫描；点菜单名字没有反应。没有悬浮坞时仍用原来的浮钮。
- CBox 轻量路径和 iframe 精简模式不进悬浮坞。

**涉及文件与位置**：
- `jav-code-scanner.user.js`：`joinPageDock`、`setScriptEnabled`、`boot`
- `docs/jav-code-scanner/README.md`：安装说明与版本锚点

### 2026-10-17 · 有悬浮坞时隐藏原扫描浮钮（JCS v1.5.93）

**功能**：有 PageDock 时，页面上不再显示原来的红色扫描按钮。

**修改内容**：
- `@version` / `STYLE_VER` / `SCRIPT_VER` 1.5.92 → 1.5.93。
- 检测到 `PageDock` 时给 `html` 加 `jcs-docked`，样式强制隐藏 `#jcs-fab`。
- 悬浮坞里的「扫描」直接打开面板，不再依赖点击原来的浮钮。

**涉及文件与位置**：
- `jav-code-scanner.user.js`：`html.jcs-docked #jcs-fab`、`openScanPanel`、`ensurePanel`
- 编码统一 UTF-8 **无 BOM**；中文正文，代码示例保留原格式。
- 契约类文档（如 jcs-extension-contract.md）是对外发布物：改动契约语义时必须同步核对宿主实现章节（§11）与 JCS 源码一致性。

### 2026-09-07 · 文档重组落位 + 契约文档迁入（新增）

**功能**：按项目分域整理 docs/，JCS 文档归入本目录。

**修改内容**：
- `architecture-jav-code-scanner.md` 由 `git mv` 自 `docs/` 迁入，文内 3 处交叉引用更新为相对路径（integration ×2、enhanced-media-helper ×1）。
- `jcs-extension-contract.md`（契约 v1）自 `docs/` 根迁入本目录，文内 1 处引用更新为 `../integration/integration-emh-scanner.md`。

**涉及文件与位置**：
- `docs/jav-code-scanner/architecture-jav-code-scanner.md`（迁移 + 引用修复 :106/:233/:270-272 区域）
- `docs/jav-code-scanner/jcs-extension-contract.md`（迁移 + 引用修复 §10 表格）

### 2026-09-07 · JCS 扩展宿主契约 v1（新增，自 docs/ 根迁入）

**功能**：JCS 对外扩展宿主标准约定（actions / styles / mounts 三类扩展点）。

**修改内容**：契约 v1 全文（273 行）：两种接入形态、manifest 规范、ctx 对象、match 语法、生命周期、安全须知、M3U8 提取器示例、v1 边界、宿主实现对照。

**涉及文件与位置**：`docs/jav-code-scanner/jcs-extension-contract.md`

**关联决策**：JavCodeKit 既有方法签名全部保留；内置 lib/shot 按钮维持 `EMH_API` 直连；宿主版本实施时 v1.5.72 → v1.5.73。

### 2026-09-07 · 扩展宿主实现（JCS v1.5.73）

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

### 2026-09-07 · 源码使用指南 README + 脚本描述更新（v1.5.76）

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

### 2026-09-10 · Trellis 卸载后死链清理（新增）

**功能**：Trellis 工作流框架已从项目卸载（`.trellis/` 整目录删除），修正本文档域内指向 `.trellis/spec/` 的失效引用。

**修改内容**：
- `architecture-jav-code-scanner.md` 删除 2 处死链：「主题系统」节末「详见 `.trellis/spec/frontend/design-system.md`」及「参考」节首条「视觉/交互约束的通用化约定见 `.trellis/spec/frontend/design-system.md`」。原 spec 内容随 Trellis 卸载移除，如需恢复可从 git 历史取回。
- 本目录 `MODIFICATIONS.md:55` 的「trellis-check 复核修复」为历史记录，保留不动。

**涉及文件与位置**：
- `docs/jav-code-scanner/architecture-jav-code-scanner.md`（:175、:269 两行删除）

**状态**：grep 全域无 `trellis` 存活引用（仅剩本文件与 `.opencode/skills/MODIFICATIONS.md` 的历史/卸载记录字样）

### 2026-10-17 · 停自动拉黑 + 新标签直接开窗（v1.5.89）

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

### 2026-10-17 · 新标签改走 GM_openInTab（v1.5.90）

**功能**：v1.5.89 在 missav / 123av 仍只出番号提示。页面侧 `window.open` 会被站点更早的 click 处理或 COOP 吃掉。

**修改内容**：
- 增加 `@grant GM_openInTab`。`openUrlInNewTab` 优先走油猴开标签，失败再回退 `unsafeWindow.open`。
- `installEarlyCodeOpen` 在 boot 时挂 document 捕获监听，命中高亮后同步开标签，并 `stopImmediatePropagation`，避免站点先截走这次点击。
- 高亮自身的 shift 提前 return 去掉，Shift+点击仍传 `pick` 给选源面板。

**涉及文件与位置**：
- `jav-code-scanner.user.js`（版本 1.5.89 → 1.5.90；`@grant GM_openInTab`；`openUrlInNewTab`；`installEarlyCodeOpen`；`bindCodeMarkClick`）
- `README.md`（版本表 v1.5.90）

### 2026-10-17 · 新标签恢复先选源再打开（v1.5.91）

**功能**：撤回 v1.5.89/v1.5.90 的「一点高亮直接新开当前源」。新标签模式恢复原来的两步：点高亮出选源面板，点源名再打开网页。

**修改内容**：
- `openSearch` 在新标签模式重新只调用 `openProviderPicker`，不再直接 `openExternalProvider`。
- 删除 `installEarlyCodeOpen` 及其 boot 调用。高亮 / 自建链 / 侧栏 chip 的 Shift 直开分支和对应文案恢复。
- 保留 v1.5.89 的「失败不自动写黑名单」，以及 v1.5.90 的 `GM_openInTab`：选源按钮仍用它开标签，避免 missav / 123av 吃掉 `window.open`。

**涉及文件与位置**：
- `jav-code-scanner.user.js`（版本 1.5.90 → 1.5.91；`openSearch`；删除 `installEarlyCodeOpen`；点击文案）
- `README.md`（版本表 v1.5.91）
- `docs/jav-code-scanner/README.md`（§2.2）

### 2026-10-17 · v1.5.92 已撤回，停留在 v1.5.91

**功能**：用户手动把脚本退回 1.5.91。v1.5.92 的面板单击打开、`GM_openInTab(url, false)` 不保留。

**修改内容**：
- 脚本保持 1.5.91：面板「内」仍是单击复制、双击本页搜索；新标签仍是先选源再打开，`GM_openInTab` 继续传 `{ active: true, insert: true, setParent: true }`。
- 版本表改回 v1.5.91，避免文档超前于脚本。

**涉及文件与位置**：
- `jav-code-scanner.user.js`（维持 `@version` / `STYLE_VER` / `SCRIPT_VER` = 1.5.91）
- `README.md`（版本表 v1.5.91）

### 2026-10-17 · 文档对齐 v1.5.91，删除过时架构文档

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

### 2026-10-17 · 仓库增加「改代码必须更新文档」约束

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

---

## 五、dock/docs/enhanced-media-helper/（EMH 文档域）

### 项目约束（enhanced-media-helper 文档域）

- 本目录只放 **Enhanced_Media_Helper（EMH）单项目文档**：架构说明、功能设计（如 standalone 模式）。
- 与 JCS 的协作协议放 `dock/docs/integration/`；JCS 侧文档放 `dock/docs/jav-code-scanner/`。
- 文档内引用其它目录文档一律用**相对路径**（如 `../integration/integration-emh-scanner.md`）。
- 文档头部必须标注对应脚本版本号（如 v3.7.2+），脚本版本推进时同步更新版本锚点与行号基准。
- 编码统一 UTF-8 **无 BOM**；中文正文，代码示例保留原格式。
- EMH 对外 API 以 `EMH_API`（mountPublicApi）为准；对外契约变更须同步核对 `docs/integration/integration-emh-scanner.md` 的 API 参考表。

### 2026-09-07 · 文档重组落位（迁移）

**功能**：按项目分域整理 docs/，EMH 文档归入本目录。

**修改内容**：
- `architecture-enhanced-media-helper.md` 由 `git mv` 自 `docs/` 迁入，文内 3 处交叉引用更新为相对路径（standalone 同目录、integration、jav-code-scanner 各 1 处）。
- `standalone-mode.md` 由 `git mv` 自 `docs/` 迁入（文内无外部引用，未改动内容）。

**涉及文件与位置**：
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`（迁移 + 引用修复 :187-189 区域）
- `docs/enhanced-media-helper/standalone-mode.md`（纯迁移）

### 2026-10-07 · 修复 javgg featured 列表链接不可点击（同步架构文档版本）

**功能**：修 bug 后同步文档版本锚点。

**修改内容**：
- `architecture-enhanced-media-helper.md` 头部版本锚点 `v3.7.2（约 4640 行）` → `v3.7.4（约 4746 行）`；版本策略补记 3.7.4 修复 `emh-javgg-controls` 溢出被相邻卡片覆盖不可点击。

**涉及文件与位置**：
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`（:3 版本锚点、:24 版本策略）

### 2026-10-17 · JCS 架构引用改到使用指南

**功能**：JCS 行号架构文档已删除，本目录仅改交叉引用，不改 EMH 架构正文。

**修改内容**：
- `architecture-enhanced-media-helper.md` 参考节的 scanner 链接改为 `../jav-code-scanner/README.md`。

**涉及文件与位置**：
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`（参考节）
- 对应脚本改动见根目录 `Enhanced_Media_Helper.js`（该目录无 MODIFICATIONS.md）

### 2026-10-07 · 面板新增「未标记」筛选 tab（EMH v3.7.5）

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

### 2026-10-17 · 番号库入口收进悬浮坞（EMH v3.7.6）

**功能**：页面上已有 `PageDock` 时，番号库不再单独放右下角按钮。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.5 → 3.7.6。
- `createToggleButton` 检测到 `PageDock.register` 时登记「番号库」，点击调用 `showPanel`。独立页和没有悬浮坞时仍创建原来的按钮。
- 架构文档版本锚点改为 v3.7.6，版本策略补记本次行为。行号地图未重标。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`、`@version`、`EMH_API.version`
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`：版本锚点与版本策略

### 2026-10-17 · 悬浮坞改为本地库引用（EMH v3.7.7）

**功能**：番号库通过 `@require` 引入悬浮坞库，不再依赖另一个独立启用的用户脚本。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.6 → 3.7.7。
- 元信息增加 `@require file:///D:/source/javuser/page-dock.user.js`。
- `createToggleButton` 先 `PageDock.mount()`，再 `register`。登记走解析到的 `dockApi`，不假设它一定挂在 `unsafeWindow`。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：元信息、`createToggleButton`

### 2026-10-17 · 悬浮坞开关控制整个番号库脚本（EMH v3.7.15）

**功能**：开关不再只关面板，而是停掉番号库脚本的页面功能。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.14 → 3.7.15。
- 状态写入 `emh_script_enabled`。关闭后不再跑站点注入；已注入的状态点和 javgg 控件通过 `html.emh-script-off` 隐藏，面板关闭。
- 再打开时重新执行站点注入。独立页不受这个开关影响。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`setScriptEnabled`、`main`、`createToggleButton`、核心样式

### 2026-10-17 · 关闭后点番号库无反应（EMH v3.7.16）

**功能**：脚本关闭后，点悬浮坞里的番号库名字不会重新打开。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.15 → 3.7.16。
- 菜单 `onClick` 在 `scriptEnabled` 为假时直接返回。重新启用只走开关。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`

### 2026-10-17 · 番号库开关收进悬浮坞（EMH v3.7.14）

**功能**：悬浮坞菜单里的番号库可以打开和关闭面板。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.13 → 3.7.14。
- 登记时提供 `onToggle`：开调用 `showPanel`，关调用 `hidePanel`。
- 订阅 `PanelStore`，面板从其它入口打开或关闭时同步开关状态。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`

### 2026-10-17 · 改用 Greasy Fork 悬浮坞库（EMH v3.7.9）

**功能**：番号库引用已发布的 PageDock 库，不再依赖本地文件或独立启用。

**修改内容**：
- `@version` 与 `EMH_API.version` 3.7.8 → 3.7.9。
- `@require https://update.greasyfork.org/scripts/600709/1965283/PageDock.js`。
- 登记前调用 `PageDock.mount()`。线上库是 v1.3.1，不调用 `mount()` 不会画出图标。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：元信息、`createToggleButton`

---

## 六、dock/docs/integration/（跨脚本协议文档域）

### 项目约束（integration 文档域）

- 本目录只放**跨脚本协作协议**：当前仅 JCS ⇄ EMH 集成指南；后续新增跨项目协议（如扩展宿主与第三方库的双向协议细则）放此处。
- 单项目内部设计不得放本目录——JCS 文档去 `dock/docs/jav-code-scanner/`，EMH 文档去 `dock/docs/enhanced-media-helper/`。
- 协议文档必须写明**双向版本锚点**（如 scanner v1.5.71+ / EMH v3.7.2+），任一侧 API 变更时同步更新版本锚点与 API 参考表。
- 文档内引用其它目录文档一律用**相对路径**（如 `../jav-code-scanner/README.md`）。
- 编码统一 UTF-8 **无 BOM**；中文正文。
- 引用完整性：本文档的 API 参考表与两侧架构文档、两侧源码 `mountPublicApi` / kit 暴露段必须三方一致。

### 2026-09-07 · 文档重组落位（迁移）

**功能**：按项目分域整理 docs/，跨脚本协议文档归入本目录。

**修改内容**：
- `integration-emh-scanner.md` 由 `git mv` 自 `docs/` 迁入，文内 3 处交叉引用更新为相对路径（jav-code-scanner、enhanced-media-helper、standalone 各 1 处）。

**涉及文件与位置**：
- `docs/integration/integration-emh-scanner.md`（迁移 + 引用修复 :132-134 区域）

### 2026-10-17 · JCS 架构文档删除后改引用

**功能**：JCS 行号架构文档已删除，本目录交叉引用改到使用指南。

**修改内容**：
- `integration-emh-scanner.md` 相关文件中的 scanner 架构链接改为 `../jav-code-scanner/README.md`。
- 本文件约束示例路径同步。

**涉及文件与位置**：
- `docs/integration/integration-emh-scanner.md`（相关文件）
- `dock/docs/integration/MODIFICATIONS.md`（约束示例）

### 2026-10-17 · 版本锚点对齐

**功能**：集成指南头部改为当前脚本版本。

**修改内容**：
- 头部版本从 scanner v1.5.71 / EMH v3.7.2 改为 scanner v1.5.94 / EMH v3.7.17。
- 说明悬浮坞不改变 `EMH_API`。

**涉及文件与位置**：
- `dock/docs/integration/integration-emh-scanner.md`

---

## 七、docs/superpowers/（设计 spec）

### 项目约束

- 只放设计 spec（`specs/`），不放实现代码。
- 编码 UTF-8 无 BOM。

### 2026-09-20 · 18mh 书籍黑名单 spec

**功能**：记录 18mh 黑名单标记设计。

**涉及文件**：`docs/superpowers/specs/2026-09-20-18mh-book-blacklist-design.md`

### 2026-10-18 · 18mh 黑名单列表毛玻璃

**功能**：spec 与实现对齐：列表卡改为封面、书名各自毛玻璃，不再写「不半透明」。

**涉及文件**：`docs/superpowers/specs/2026-09-20-18mh-book-blacklist-design.md`

### 2026-09-22 · 18mh 书目状态 spec

**功能**：记录 18mh 书目状态（连载/完结 + 更新时间）设计。

**涉及文件**：`docs/superpowers/specs/2026-09-22-18mh-book-status-design.md`

### 2026-09-22 · 18mh 阅读器直连 spec

**功能**：记录 18mh 果核阅读器直连设计。

**涉及文件**：`docs/superpowers/specs/2026-09-22-18mh-reader-link-design.md`

### 2026-09-22 · 18mh Dock 动作菜单 spec

**功能**：记录 18mh Dock ⋯ 动作菜单设计。

**涉及文件**：`docs/superpowers/specs/2026-09-22-18mh-dock-action-menu-design.md`

### 2026-09-22 · 18mh 列表卡阅读器入口 spec

**功能**：记录 18mh 站点列表卡「📖 阅读」入口设计。

**涉及文件**：`docs/superpowers/specs/2026-09-22-18mh-list-reader-entry-design.md`

### 2026-09-22 · 18mh 收藏更新提醒 spec

**功能**：记录 18mh 收藏更新提醒设计。

**涉及文件**：`docs/superpowers/specs/2026-09-22-18mh-fav-update-alert-design.md`

---

## 八、.opencode/skills/（项目级 skills）

### 目录约束

- 本目录是**项目级 skills**（opencode 平台加载，frontmatter `name` + `description`）；新增业务 skill 不得覆盖/修改其他 skill 目录。
- skill 命名 kebab-case；SKILL.md 正文为可执行工作流（模板/清单/常见坑），不留占位符。
- 引用项目内文档一律相对仓库根写明路径（如 `dock/docs/jav-code-scanner/jcs-extension-contract.md`）。

### 2026-09-07 · jcs-build skill（新增，原名 jcs-extension-dev 后更名）

**功能**：把「为 JCS 扩展宿主写扩展」的方法论沉淀为可加载 skill，供后续会话在用户要求写 JCS 扩展/改造油猴脚本接入时直接调用。

**修改内容**：
- 新建 `.opencode/skills/jcs-build/SKILL.md`（原目录名 `jcs-extension-dev`，按用户要求更名）：宿主环境事实（两种形态/GM 可用性）、manifest 模板与校验规则、ctx 对象、三保险握手模板、生命周期要点表 + 5 条常见坑、参考实现指引（契约 §9 M3U8 示例 + `tools/test-extension.js`）、7 步自测验收清单、宿主侧排障锚点。

**涉及文件与位置**：
- `.opencode/skills/jcs-build/SKILL.md`（新建）

### 2026-09-07 · Jable 实时预览扩展改造（新增参考实现）

**功能**：把「Jable 3年前视频也支持时间条实时预览」（greasyfork 581315）改造成契约 v1 mounts 型扩展，作为第二个参考实现。

**修改内容**：
- 新建 `tools/jable-live-preview.extension.js`（manifest id `jable-live-preview`，`match: ['*.jable.tv']`）：原 boot 轮询搬进 `mount(ctx)`；路径判断 `/videos/` 移入 mount 内（宿主 match 只到 host）；state 全部移入 mount 闭包支持宿主 SPA 重放；UI/样式 id 改 `jcs-ext-{id}` 前缀；新增总 `ctx.onCleanup`——boot 重试 timer、seek throttle、`hls.destroy()`、进度条事件监听（具名引用可解绑）、fullscreenchange/beforeunload、预览 box 与样式标签全量清理。
- 官方 VTT 检测跳过、HLS 取流、节流 seek 等原逻辑不变；`@match` 放宽为 `https://jable.tv/*`（非视频页 mount 空转），形态 A/B 共用一份代码。

**涉及文件与位置**：
- `tools/jable-live-preview.extension.js`（新建，~600 行）

**状态**：`node --check` + 契约断言（前缀/onCleanup 全量/握手）通过；未提交。

**关联**：规范源 `dock/docs/jav-code-scanner/jcs-extension-contract.md`（契约 v1）；宿主实现 JCS v1.5.73。

### 2026-09-10 · Trellis 卸载（移除 trellis-* skills）

**功能**：应用户要求完整卸载 Trellis 工作流框架。

**修改内容**：
- 删除本目录下全部 trellis-* 技能（trellis-before-dev / trellis-brainstorm / trellis-break-loop / trellis-check / trellis-update-spec / trellis-channel / trellis-meta / trellis-session-insight / trellis-spec-bootstrap）及 references 子目录；jcs-build 与本文件不受影响。
- 同步移除：`.trellis/` 整目录、`.opencode/` 下 trellis 的 agents/plugins/commands/lib/package.json/node_modules/package-lock.json/.gitignore、项目根 `AGENTS.md`；全局 CLI `@mindfoldhq/trellis` 已 `npm uninstall -g`。
- 目录约束一节原「trellis-* 并列」条款随之失效，已改写。

**涉及文件与位置**：本目录 9 个 trellis-* 技能目录（删除）；`.opencode/skills/MODIFICATIONS.md`（本条记录 + 约束改写）

**状态**：未提交，git 可查（全部为删除记录，可从历史恢复）

---
