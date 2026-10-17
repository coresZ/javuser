# MODIFICATIONS · 仓库根目录

> 本目录协议：修改本目录任意文件前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。

## 项目约束

- 根目录独立油猴脚本各自维护 `@version`。行为变化必须递增版本，并同步本文件。
- `jable & miss.user.js` 不接入 JCS / EMH。字幕层用 DOM overlay，不依赖站点播放器字幕轨。
- 字幕位置写入 `localStorage`：`msv-subtitle-pos-v1`（字幕 `bottom` / `x`），`msv-dock-pos-v1`（控制台坐标）。

## 2026-10-17 · 字幕控制台重写与横向位置

**功能**：重写 Missav / Jable 字幕控制台样式，并支持横向调节字幕位置。

**修改内容**：
- `@version` 5.3 → 5.4。
- 控制台改为可拖动 dock：标题栏与 CC 都可拖，位置写入 `msv-dock-pos-v1`，窗口缩放时夹在视口内。
- 主界面增加「横向」滑杆（0%–100%，默认 50%）。字幕层 `left` 跟随 `STATE.x`，与垂直位置一并写入 `msv-subtitle-pos-v1`。
- 去掉失效的垂直加减按钮绑定。搜索、开关、时间偏移、本地下载逻辑不变。

**涉及文件与位置**：
- `jable & miss.user.js`：`@version`、`STATE` / `savePos`、`GM_addStyle`、`Renderer.forceDomSubtitleLayer`、`UIBuilder.build`
- `README.md`：根目录脚本表补上 `jable & miss.user.js` v5.4

## 2026-10-17 · 隐藏控制台改为收成小图标

**功能**：点「收成小图标」不再把入口藏没，只把面板收成可再打开的 CC 小圆点。

**修改内容**：
- `@version` 5.4 → 5.5。
- `#msv-dock.is-mini` 强制隐藏面板，CC 缩成 28px 半透明圆点。再点 CC 去掉 `is-mini` 并打开面板。

**涉及文件与位置**：
- `jable & miss.user.js`：`GM_addStyle`、`#msv-hide-fab` 文案与点击、`#msv-fab` 点击

## 2026-10-17 · 打开面板时小图标保持不动

**功能**：点 CC 只弹出面板，小图标位置不跳。

**修改内容**：
- `@version` 5.5 → 5.6。
- dock 尺寸固定为图标大小。面板 `position: absolute; right: 0; bottom: 44px`，从图标上方弹出，不再把图标顶走。
- 拖动夹取改用 dock 的图标尺寸，不再用面板撑开后的外框。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-dock` / `#msv-fab` / `#msv-panel` 样式，`clampDock`，打开与收起时不再重排 dock

## 2026-10-17 · CC 图标尺寸固定

**功能**：收起面板时图标大小不再变化。

**修改内容**：
- `@version` 5.6 → 5.7。
- 去掉 `.is-mini` 把 dock / CC 缩到 28px 的样式。收起只隐藏面板，图标保持 36px。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-dock.is-mini` 样式

## 2026-10-17 · CC 图标去掉描边

**功能**：CC 图标不再显示边框。

**修改内容**：
- `@version` 5.7 → 5.8。
- `#msv-fab` 边框设为 0；`.ok` 只改文字颜色，不再加边框。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-fab` / `#msv-fab.ok`

## 2026-10-17 · 页面悬浮坞

**功能**：各脚本的悬浮图标可以登记进同一个可拖动入口。

**修改内容**：
- 新建 `page-dock.user.js` v1.0.0。`document-start` 挂 `PageDock.register / unregister / setBadge / close`。无登记项时入口隐藏。位置写入 `page-dock-pos-v1`。
- 字幕脚本 v5.8 → v5.9。检测到 `PageDock` 时隐藏自己的 CC，登记「字幕」；没有悬浮坞时仍用原来的 CC。

**涉及文件与位置**：
- `page-dock.user.js`：新建
- `jable & miss.user.js`：`openPanel`、`PageDock.register`
- `README.md`：根目录脚本表

## 2026-10-17 · 番号库收进悬浮坞

**功能**：EMH 番号库入口在有悬浮坞时不再单独漂按钮。

**修改内容**：
- `Enhanced_Media_Helper.js` 3.7.5 → 3.7.6。详见 `docs/enhanced-media-helper/MODIFICATIONS.md`。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`
- `README.md`：版本表

## 2026-10-17 · 字幕 CC 真正收进悬浮坞

**功能**：有 `PageDock` 时 CC 不再和悬浮坞同时出现。

**修改内容**：
- 字幕脚本 5.9 → 5.10。
- `#msv-fab { display: flex }` 会盖掉 `hidden`。改为加 `is-docked`，用 `display: none !important` 隐藏。
- 登记失败时每 250ms 重试，最多约 5 秒，避免悬浮坞晚挂载时 CC 漏出来。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-fab.is-docked`、`joinPageDock`

## 2026-10-17 · 字幕就绪不再把 CC 放回页面

**功能**：字幕加载成功后，已收进悬浮坞的 CC 不再重新出现。

**修改内容**：
- 字幕脚本 5.10 → 5.11。
- 两处 `fab.className = 'ok'` 改为 `classList.add('ok')`，避免清掉 `is-docked`。

**涉及文件与位置**：
- `jable & miss.user.js`：`Engine.dl`、本地字幕加载

## 2026-10-17 · 悬浮坞改成直接可见的文字条

**功能**：不再用抽象九宫格打开菜单。登记项直接显示成可点击的文字按钮。

**修改内容**：
- `page-dock.user.js` 1.0.0 → 1.1.0。
- 去掉九宫格和弹出菜单。条上直接是「字幕」「番号库」这类名字，点名字打开对应面板。空白处仍可拖动整条。
- `PageDock.register / setBadge / close` 接口保留。`close` 现在没有菜单可关。

**涉及文件与位置**：
- `page-dock.user.js`：`renderMenu`、样式、拖动绑定

## 2026-10-17 · 悬浮坞恢复图标菜单并提高完成度

**功能**：撤回直接摊开的文字条，恢复「小图标点开菜单」。

**修改内容**：
- `page-dock.user.js` 1.1.0 → 1.2.0。
- 图标改为三道长短线，不再用九宫格圆点。36px、无描边，打开时只加深底色。
- 菜单从图标旁边弹出，项里有首字标记和名字。点空白或点一项后关闭。`close()` 重新可用。

**涉及文件与位置**：
- `page-dock.user.js`：样式、`setOpen`、`renderMenu`
- `README.md`：版本表

## 2026-10-17 · 悬浮坞里的字幕入口改回 CC

**功能**：收进悬浮坞后，菜单项叫 CC，点开后面板出现在悬浮坞旁边。

**修改内容**：
- 字幕脚本 5.11 → 5.12。
- 登记名从「字幕」改为「CC」。
- 从悬浮坞打开时，把字幕面板锚点移到 `#page-dock` 的位置，避免面板还停在已经隐藏的旧 CC 坐标上。

**涉及文件与位置**：
- `jable & miss.user.js`：`openPanel`、`PageDock.register`

## 2026-10-17 · 悬浮坞图标改回九宫格

**功能**：入口图标恢复为原来的九个圆点。

**修改内容**：
- `page-dock.user.js` 1.2.0 → 1.2.1。
- 图标 SVG 从三道线改回 3×3 圆点。菜单、拖动和登记接口不变。

**涉及文件与位置**：
- `page-dock.user.js`：`#page-dock-fab` 的 SVG

## 2026-10-17 · 悬浮坞改为可 @require 的库

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

## 2026-10-17 · 多个脚本引用悬浮坞时只建一个

**功能**：字幕脚本和 EMH 都 `@require` 悬浮坞时，页面上不会出现两个图标。

**修改内容**：
- `page-dock.user.js` 1.3.0 → 1.3.1。
- 库加载时如果页面已有 `__PAGE_DOCK__`，后来的副本直接退出，不再创建第二套状态。
- 各沙箱的 `PageDock` 是转发桩，`register` 一律转到页面上的那一个实例。
- 字幕脚本和 EMH 优先读 `unsafeWindow.PageDock`。

**涉及文件与位置**：
- `page-dock.user.js`：库包装
- `jable & miss.user.js`、`Enhanced_Media_Helper.js`：`dockApi` 取值顺序

## 2026-10-17 · 悬浮坞恢复为可独立启用

**功能**：装上 `page-dock.user.js` 就能看到图标，不再依赖会让其它脚本起不来的本地 `@require`。

**修改内容**：
- `page-dock.user.js` 1.3.1 → 1.3.2。加回 `@match *://*/*` 和 `document-start` 自动 `mount()`。单例转发保留，所以独立脚本和 `@require` 副本不会画出两个图标。
- 字幕脚本 5.13 → 5.14，EMH 3.7.7 → 3.7.8。去掉本地 `file:///` 引用。检测到 `unsafeWindow.PageDock` 再登记；没有悬浮坞时保留各自原来的按钮。

**涉及文件与位置**：
- `page-dock.user.js`：元信息、`boot`
- `jable & miss.user.js`：去掉 `@require`，`joinPageDock` 每次读取页面 API
- `Enhanced_Media_Helper.js`：去掉 `@require`，`createToggleButton`

## 2026-10-17 · 接入 Greasy Fork PageDock

**功能**：字幕脚本和 EMH 引用已发布的悬浮坞库。

**修改内容**：
- 线上库为 v1.3.1：`https://update.greasyfork.org/scripts/600709/1965283/PageDock.js`。它不会自动挂载，引用方必须调用 `PageDock.mount()`。
- 字幕脚本 5.14 → 5.15，EMH 3.7.8 → 3.7.9。两者都加上该 `@require`，登记前先 `mount()`。
- 多个脚本引用时，库内 `__PAGE_DOCK__` 保证页面只有一个实例。

**涉及文件与位置**：
- `jable & miss.user.js`：元信息、`joinPageDock`
- `Enhanced_Media_Helper.js`：元信息、`createToggleButton`

## 2026-10-17 · 悬浮坞写入真实页面

**功能**：修复 UI 被建在油猴隔离文档、页面上看不到的问题。

**修改内容**：
- `page-dock.user.js` 1.3.2 → 1.3.3。元素和事件都走 `unsafeWindow.document`。
- 字幕脚本 5.16 → 5.17，EMH 3.7.10 → 3.7.11。优先使用页面上的 `PageDock`。
- 线上 Greasy Fork 仍是旧版时，必须用本文件覆盖库 600709，并让 Tampermonkey 重新拉取 `@require`。

**涉及文件与位置**：
- `page-dock.user.js`：`pageDocument`、元素创建、事件绑定

## 2026-10-17 · 改用 PageDock 新版本地址

**功能**：停止引用钉死的旧库版本。

**修改内容**：
- Greasy Fork 600709 的 v1.3.3 地址是 `1965297`。旧地址 `1965283` 永远返回 v1.3.1。
- 字幕脚本 5.17 → 5.18，EMH 3.7.11 → 3.7.12。`@require` 改为新地址。

**涉及文件与位置**：
- `jable & miss.user.js`、`Enhanced_Media_Helper.js`：`@require`

## 2026-10-17 · 悬浮坞拖动不再一卡一卡

**功能**：拖动时图标跟手，不再每帧触发布局。

**修改内容**：
- `page-dock.user.js` 1.3.3 → 1.3.4。
- 拖动中只改 `transform`，不再连续写 `left`/`top`，也不在移动中重算菜单位置。松手后一次落位。
- 去掉拖动元素上的 `backdrop-filter`，避免移动时整层重绘。

**涉及文件与位置**：
- `page-dock.user.js`：拖动处理、`#page-dock` 样式

需要重新发布到 Greasy Fork 600709。不钉版本的 `@require` 会拿到新代码，但 Tampermonkey 可能要手动更新外部库缓存。

## 2026-10-17 · 悬浮坞菜单项增加开关

**功能**：登记项可以在菜单右侧带一个开关，点开关不打开面板。

**修改内容**：
- `page-dock.user.js` 1.3.4 → 1.3.5。`register` 增加可选 `checked` 与 `onToggle`。新增 `setChecked(id, checked)`。
- 字幕脚本 5.19 → 5.20。CC 的开关控制字幕显示，并和面板里的原开关同步。

**涉及文件与位置**：
- `page-dock.user.js`：`register`、`renderMenu`、`.page-dock-switch`
- `jable & miss.user.js`：`setSubtitleVisible`、`PageDock.register`

## 2026-10-17 · 番号库开关收进悬浮坞

**功能**：悬浮坞里的番号库项可以打开和关闭面板。

**修改内容**：
- `Enhanced_Media_Helper.js` 3.7.13 → 3.7.14。详见 `docs/enhanced-media-helper/MODIFICATIONS.md`。

**涉及文件与位置**：
- `Enhanced_Media_Helper.js`：`createToggleButton`

## 2026-10-17 · 悬浮坞开关改为整个脚本开关

**功能**：开关控制脚本功能，不再只控制面板或字幕显示层。

**修改内容**：
- 字幕脚本 5.20 → 5.21。开关写入 `localStorage` 的 `msv-script-enabled`。关闭后停止渲染和自动搜索，再打开才恢复。
- EMH 3.7.14 → 3.7.15。详见 `docs/enhanced-media-helper/MODIFICATIONS.md`。

**涉及文件与位置**：
- `jable & miss.user.js`：`STATE.enabled`、`setScriptEnabled`
- `Enhanced_Media_Helper.js`：`setScriptEnabled`

## 2026-10-17 · 脚本关闭后点菜单项无反应

**功能**：关闭后只能用开关重新打开，点名字不再把功能打开。

**修改内容**：
- 字幕脚本 5.21 → 5.22。`openPanel` 在 `STATE.enabled` 为假时直接返回。
- EMH 3.7.15 → 3.7.16。番号库菜单点击在 `scriptEnabled` 为假时直接返回。

**涉及文件与位置**：
- `jable & miss.user.js`：`openPanel`
- `Enhanced_Media_Helper.js`：`createToggleButton` 的 `onClick`

## 2026-10-17 · JCS 收进悬浮坞

**功能**：番号扫描入口收进悬浮坞，开关控制整个扫描脚本。

**修改内容**：
- `jav-code-scanner.user.js` 1.5.91 → 1.5.92。详见 `docs/jav-code-scanner/MODIFICATIONS.md`。

**涉及文件与位置**：
- `jav-code-scanner.user.js`：`joinPageDock`、`boot`

## 2026-10-17 · 有悬浮坞时隐藏 JCS 原浮钮

**功能**：有 PageDock 时，原来的红色扫描按钮不再出现。

**修改内容**：
- `jav-code-scanner.user.js` 1.5.92 → 1.5.93。详见 `docs/jav-code-scanner/MODIFICATIONS.md`。

**涉及文件与位置**：
- `jav-code-scanner.user.js`：`html.jcs-docked #jcs-fab`、`openScanPanel`

## 2026-10-17 · 悬浮坞左边管面板，右边管脚本

**功能**：同一行的两个控件分开。左边开关对应面板，右边开关整个脚本。

**修改内容**：
- `page-dock.user.js` 1.3.6 → 1.3.7。新增 `enabled`、`active`、`onActive`、`setActive`。脚本关闭时左边变灰且不可点。打开右边开关不会打开面板。
- 字幕 5.22 → 5.23，EMH 3.7.16 → 3.7.17，JCS 1.5.93 → 1.5.94。三个入口都按这个规则接线。

**涉及文件与位置**：
- `page-dock.user.js`：`register`、`renderMenu`
- `jable & miss.user.js`：`setPanelActive`
- `Enhanced_Media_Helper.js`：`onActive`
- `jav-code-scanner.user.js`：`setScanPanelActive`

## 2026-10-17 · 修复悬浮坞右边开关

**功能**：点右边开关不再把菜单重建掉，开关状态和点击区域稳定。

**修改内容**：
- `page-dock.user.js` 1.3.7 → 1.3.8。
- `setChecked` / `setActive` 改为更新已有行，不再 `renderMenu()`。
- 开关热区加高到 28px，轨道仍是 18px。回调里的状态回写不会拆掉正在点的按钮。

**涉及文件与位置**：
- `page-dock.user.js`：`paintItem`、`setChecked`、`.page-dock-switch`

## 2026-10-17 · 已接入悬浮坞的脚本移入 dock/

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

## 2026-10-17 · 悬浮坞开关打开态改为灰色

**功能**：打开状态不再用绿色。

**修改内容**：
- `page-dock.user.js` 1.3.5 → 1.3.6。
- `.page-dock-switch.is-on` 背景从 `#34c759` 改为 `rgba(255,255,255,0.42)`。

**涉及文件与位置**：
- `page-dock.user.js`：`.page-dock-switch.is-on`

## 2026-10-17 · PageDock 改用不钉版本的地址

**功能**：库更新后不用再改引用脚本里的 URL。

**修改内容**：
- Greasy Fork 页面给出的 `.../600709/<版本号>/PageDock.js` 每次更新都会变，旧版本号地址永久返回旧代码。
- 不带版本号的 `https://update.greasyfork.org/scripts/600709/PageDock.js` 返回当前最新版。
- 字幕脚本 5.18 → 5.19，EMH 3.7.12 → 3.7.13。`@require` 改为这个地址。

**涉及文件与位置**：
- `jable & miss.user.js`、`Enhanced_Media_Helper.js`：`@require`

## 2026-10-17 · 悬浮坞改用本脚本加载到的实例

**功能**：避免登记写进页面上尚未挂载的空壳，导致图标不出现。

**修改内容**：
- 字幕脚本 5.15 → 5.16，EMH 3.7.9 → 3.7.10。
- `dockApi` 只取当前沙箱的 `PageDock`，不再优先读 `unsafeWindow.PageDock`。
- 登记前仍调用 `mount()`。每个引用脚本都会挂载自己的 UI；这是当前线上库 v1.3.1 的限制。

**涉及文件与位置**：
- `jable & miss.user.js`：`joinPageDock`
- `Enhanced_Media_Helper.js`：`createToggleButton`
