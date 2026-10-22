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

## 2026-10-17 · 扫描数量显示在悬浮坞

**功能**：原浮钮上的扫描数量改到悬浮坞「扫描」旁边。

**修改内容**：
- JCS 1.5.95 → 1.5.96。
- `renderPanelMeta` 调用已有的 `PageDock.setBadge('jcs-scanner', 数量)`。没有结果时清空。超过 99 显示 `99+`。
- 不改悬浮坞。

**涉及文件与位置**：
- `dock/jav-code-scanner.user.js`：`renderPanelMeta`

## 2026-10-17 · Jable 评论时间并入字幕脚本

**功能**：评论时间列表只在 Jable 启用，默认打开，和 CC 共用同一个脚本开关。

**修改内容**：
- `jable-time-jump.js` 1.9.0 → 1.10.0。去掉自动启动，改为 `window.JableTimeJump.setEnabled`。关闭时移除时间列表。
- 字幕脚本 5.27 → 5.28。`@require ./jable-time-jump.js`。脚本开关变化时同步时间列表。
- Missav 页面不调用这个模块。

**涉及文件与位置**：
- `dock/jable-time-jump.js`：`setEnabled`
- `dock/jable & miss.user.js`：`@require`、`setScriptEnabled`

## 2026-10-17 · 评论时间代码直接迁入字幕脚本

**功能**：不再通过独立文件或 `@require` 挂评论时间功能。

**修改内容**：
- 字幕脚本 5.28 → 5.29。
- `jable-time-jump.js` 的时间解析、评论链接、自动加载和时间列表代码直接放进字幕脚本的 `JableTimeJump`。
- 删除 `dock/jable-time-jump.js`。Jable 上仍和 CC 共用 `STATE.enabled`，Missav 不启动。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`JableTimeJump`
- `dock/jable-time-jump.js`：删除

## 2026-10-17 · 时间列表显隐只跟右侧开关

**功能**：评论更新不能在脚本关闭后把时间列表重新画出来。

**修改内容**：
- 字幕脚本 5.29 → 5.30。
- `JableTimeJump.setEnabled` 写入 `timeEnabled`。`renderSidebar` 在关闭时直接移除列表，不再因为评论变化重建。
- 列表上的关闭也走同一个关闭状态。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`timeEnabled`、`renderSidebar`、`setEnabled`

## 2026-10-17 · 右侧开关当场控制时间列表

**功能**：不刷新页面，右侧开关关闭就隐藏时间列表，打开就重新显示。

**修改内容**：
- 字幕脚本 5.30 → 5.31。
- 开关不再直接调用内层的 `JableTimeJump`。它在另一个函数作用域里，调用不到。
- 改为派发 `msv-script-enabled`。时间模块监听后立刻移除或重建列表。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`setScriptEnabled`、`JableTimeJump.setEnabled`

## 2026-10-17 · 评论时间显示在进度条上

**功能**：时间点和时间段画在播放器进度条上，全屏时跟着进度条显示。

**修改内容**：
- 字幕脚本 5.31 → 5.32。
- 单个时间画成刻度，时间段画成区间。点击跳到起点。
- 右侧开关关闭时，进度条标记和时间列表一起移除。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`renderProgressMarks`

## 2026-10-17 · 全屏右侧时间刻度

**功能**：全屏时不再把时间点压在进度条上，改为播放器右侧的横向刻度。

**修改内容**：
- 字幕脚本 5.32 → 5.33。
- 刻度挂在 `.plyr` 内，只在全屏显示。单个时间是短横线，时间段是更长的横线，点击热区比进度条上的点大。
- 点击仍跳到起点。右侧开关关闭时移除。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

## 2026-10-17 · 右侧刻度按数量均匀排列

**功能**：全屏右侧刻度不再按片长时间隔拉开。

**修改内容**：
- 字幕脚本 5.35 → 5.36。
- 每个时间点和时间段各占一行，行高 16px。数量少时尺子短，数量多时变长，最高 70%，超出后在刻度区内滚动。
- 点击仍跳到真实时间。时间段只是横线更长，不再按时间跨度拉高。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

## 2026-10-17 · 选中刻度保持变长

**功能**：选中的右侧刻度保持长线，直到选择另一个，或播放进入下一个时间段。

**修改内容**：
- 字幕脚本 5.36 → 5.37。
- 刻度记录起止秒数。播放进入某个时间段时自动选中该段；离开后如果没有进入下一段，仍保持上次选中。
- 点击刻度或侧栏时间也会更新选中状态。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`currentRailPoint`、`updateSelectedSidebarItem`

## 2026-10-17 · 修正字幕脚本版本号

**功能**：避免把脚本版本从 5.37 误写成 71。

**修改内容**：
- `@version` 改为 5.38。脚本名已包含评论时间跳转。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`@version`

## 2026-10-17 · 字幕脚本升到 6.0

**功能**：版本号从 5.38 升到 6.0。

**修改内容**：
- `@version` 5.38 → 6.0。行为没有另外改动。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`@version`
- `README.md`：版本表

## 2026-10-17 · 右侧刻度区不再误暂停

**功能**：全屏时点右侧刻度附近，不会再点到画面导致暂停。

**修改内容**：
- 字幕脚本 5.34 → 5.35。
- 右侧刻度条改为可点击区域，挡住背后的播放器点击。
- 刻度热区加高到 12px。点空白只拦截，不暂停；点刻度仍跳转。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`、`renderProgressMarks`

## 2026-10-17 · 右侧时间刻度收短

**功能**：全屏右侧刻度不再拉满播放器高度，相邻刻度更近。

**修改内容**：
- 字幕脚本 5.33 → 5.34。
- 刻度尺改为垂直居中，高度 `min(240px, 42%)`。时间百分比仍按这条较短的尺计算。

**涉及文件与位置**：
- `dock/jable & miss.user.js`：`#jable-comment-time-rail`

## 2026-10-21 · 字号 / 垂直 / 横向三项记忆

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

## 2026-10-21 · 移动端面板与字幕字号收敛

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

## 2026-10-21 · 修复滑杆轨道不可见，时间点适配移动端

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

## 2026-10-21 · 修复字幕脚本在 iOS 上完全不工作

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
