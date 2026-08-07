# Component Guidelines

> How components are built in this project.

---

## Overview

本项目包含两个用户脚本，UI 采用两种组件模式：

1. **Preact + htm 面板**（`Enhanced_Media_Helper.js`）：注入 javgg.net。所有组件在 `buildPanel()` 工厂闭包内，共享 `PanelStore`（external-store 状态）和 `html`（htm 绑定 Preact `h`）。
2. **原生 DOM + 模板字符串**（`jav-code-scanner.user.js`）：ensure* 工厂函数逐组件构建 DOM，挂载到 `#jcs-host` 视口宿主层。

两脚本共用同一套**设计 token 体系**（见 `design-system.md`），组件命名 `<缩写>-*` 前缀。

---

## 原生 DOM 组件模式（jav-code-scanner 实证）

`jav-code-scanner.user.js` 的 UI 全部走「ensure* 工厂」模式：

- **挂载层隔离**：所有组件挂 `#jcs-host`（`ensureHost` 868，fixed inset:0 + `pointer-events:none`，z-index 2147483000），避免被站点 body transform/滚动影响。
- **幂等构建**：`ensurePanel`/`ensurePopup`/`ensureSubtitleModal`/`ensureSelPickUi` 检测根 id 已存在则复用，否则构建；检测 `data-ver !== SCRIPT_VER` 整体重建（版本自愈，5490）。
- **防重绑**：逐按钮 `onclick` 直绑 + `dataset.jcsBound`/`_bound` 防重复。
- **事件委托**：全局热键单点 `bindGlobalHotkeys`（790）；选源浮卡外部关闭用 document capture `pointerdown`（6302）；页面色标用 root 级事件委托读 `data-code`。
- **DOM 重建纪律**：组件在版本升级时靠 data-ver 重建，不清除已绑的页面色标（`clearPageHighlight` 1589 显式调用）。

> **Gotcha（本仓库真实教训）**：MutationObserver 循环里反复「全量重建」UI 会自反馈闪烁——组件构建必须幂等（已存在则跳过），仅重建真正失效部分。

---

## Preact 组件结构（Enhanced_Media_Helper 实证）

Key components: `StatusTag`, `ItemRow`, `DetailDrawer`, `ConfirmModal`, `PromptModal`, `MagnetListModal`, `BatchProgressModal`, `HelpModal`, `ToastContainer`, `CodeManagerApp`; magnet lightbox + 缩略图索引条由 `MAGNET_PREVIEW`（原生 DOM）管理，宫格懒加载用 `LAZY` IntersectionObserver。

---

## Component Structure

- Function components using hooks: `useReducer` + `PanelStore.subscribe` for re-render (NOT `useSyncExternalStore` — the hooks UMD build does not export it).
- State lives in `PanelStore` (external store), components read `PanelStore.get()` and dispatch via `actions` object in `CodeManagerApp`.
- Component renders are pure: derive `items`/`view`/empty-state inside the component body each render.

---

## Props Conventions

- Pass data + callbacks down explicitly; components never touch `CODE_LIBRARY` directly (except `DetailDrawer` read-only fields passed via props).
- `ItemRow` receives `view` prop (`'unmarked' | 'favorite' | 'watched' | 'trash'`) that drives which action buttons render — per-view action sets, not a fixed button bar.
- Modal-style components (`ConfirmModal`/`PromptModal`) render `null` when their store field is null, and are mounted once in the root Fragment.

---

## Styling Patterns

- Design tokens as CSS custom properties on `:root` — **Linear 系，深色优先**：ground `#08090A`、surfaces `#16171C/#1E1F25/#26272E`、hairline `rgba(255,255,255,0.06)`、accent `#5E6AD2`（<5% 像素）、语义三色 `#F87171/#34D399/#FBBF24`。
- **Theme mechanism**: `THEME` module 驱动 `<html data-emh-theme="dark|light|system">`（GM key `emh_ui_theme`，默认 `dark`）。`:root` 基础即深色（防 FOUC）；`:root[data-emh-theme="light"]` 反相；`@media (prefers-color-scheme: light)` **仅**对 `[data-emh-theme="system"]` 生效。
- Three injected `<style>` blocks: `injectCoreStyles()`（全局 token + toggle/javgg/状态点/toast）、`CodeManagerPanel.createStyles()`（面板）、`MAGNET_PREVIEW.ensureUi()`（灯箱）。
- Text on primary fills must use `var(--emh-on-primary)`（accent `#5E6AD2` 两主题下均为白）；solid 语义填充用 `var(--emh-on-solid)`。
- Radius ≤ 16（6/12/16）；阴影极淡（无发光/彩色）；动效 hover 150ms ease-out、布局 `cubic-bezier(0.22,1,0.36,1)`。
- **Re-theming 时保持 token 名稳定**（`--emh-primary`/`--emh-text`/…）：消费者只引用 var，换值不换名，避免改所有调用点。
- Spacing rhythm: horizontal padding **20px**；item row `10px 14px` + `margin-bottom 6px`；action icon 触点 ≥ 28×28。
- Panel width **520px**；detail drawer **360px**；磁力预览宫格格 cell min 64px（16:9）用 `background-image` 懒加载（`LAZY` IntersectionObserver）。
- Icons are inline SVG（`stroke="currentColor"`）— 禁止 emoji 当图标、禁止 `::before { content: "✓" }` 字符图标（用真实 `<svg>`）。
- 状态点/状态标签颜色只走 `CONFIG.statusColors` 与 `--emh-danger/--emh-success` 语义色，不新造色相（语义色 ≤3）。

---

## Interaction Model (ItemRow / DetailDrawer)

| Status / view | List actions | Detail main | Detail danger |
|---|---|---|---|
| unmarked (all/unmarked views) | 关注 · 标记已看 | same + 编辑备注 | 删除到回收站 |
| favorite | 标记已看 · 取消关注 | same + 编辑备注 | 删除到回收站 |
| watched | 删除到回收站 | 删除到回收站 | (none — already primary) |
| trash | 恢复 · 彻底删除 | 恢复 · 彻底删除 | magnets read-only |

- Light ops (关注/取消关注/标记已看/恢复): no confirm, toast only.
- 删除到回收站: ConfirmModal `danger: 'soft'`.
- 彻底删除: ConfirmModal `danger: 'hard'`.
- Resolve items for read-only ops with `getItem || trash.items.find` (`resolveItem`); never mutate trash via `markItem`.

---

## Keyboard Navigation (panel)

- 统一键盘处理器用 **kbdRef 模式**：`kbdRef.current = fn` 每次渲染刷新，`useEffect(() => { document.addEventListener('keydown', onKey); return cleanup; }, [])` 单次注册。避免在 `useEffect` 里直接绑定并依赖 `[st.x]`（会造成过期闭包/重复绑定）。
- 映射：`↑↓/Home/End` 选择（`kbdStep/kbdJump`，维护 `PanelStore.selectedIndex`）；`Enter` 详情；`Esc` 逐层关（help→prompt→confirm→magnetSearch→detail→panel）；`/` 聚焦搜索；`n` 新建；`Del` 回收站；`⌘C/Ctrl+C` 复制；`r` 刷新预览（详情内）；`?` 帮助浮层。
- 守卫顺序（关键）：
  1. 灯箱打开时（`MAGNET_PREVIEW._open`）**整体交还**键盘；
  2. 文本输入焦点（INPUT/TEXTAREA/contentEditable）时**不劫持**（否则 `/`、`n`、`Del` 会被吞）；
  3. `Enter` 时若焦点在面板内 BUTTON/A/SELECT 上，交给原生激活（否则按钮失效）；
  4. 弹窗/详情打开时列表导航键失效；`r` 仅在详情内生效。
- 键盘选中项滚动跟随用 `scrollTop = el.offsetTop - cont.clientHeight/2`（禁用 `scrollIntoView`，会破坏 iframe 外层滚动）。滚动跟随 effect 的依赖**只能是 `[selectedIndex]`**，绝不能含 `items`（每次渲染重建的数组会重置滚动、破坏鼠标滚轮）。
- 选中索引 clamp effect（收敛到 `[0, len-1]`）与滚动 effect 必须放在 `items` 计算/过滤**之后**（见 Common Mistakes TDZ）。
- 快捷键 chips 样式：mono + hairline + dim bg（`.emh-kbd-chip`），`?` 帮助浮层列出全表。

## List Rendering & Performance

- **`preact.umd.js` 不导出 `memo`**（实证 `Object.keys(preact)` 无 memo）。行级 memo 用自定义 `Memorize`（class extends `preact.Component` + `shouldComponentUpdate` 浅比较），**不要用 `preact.memo`**。
- memo 行要能感知数据变化：**变更必须产生新对象引用**。`markItem` 用不可变更新（`{ ...cur, status }` 替换数组元素）；增删走 splice/unshift。就地 mutate + memo 行 = 状态标签/备注不刷新。
- **稳定回调**：`actions` 每次渲染重建，直接传 `actions.x` 会破坏 memo。用 `actionsRef.current = actions`（渲染时赋值）+ `useCallback((...a) => actionsRef.current.x(...a), [])` 委托——既稳定又无过期闭包。
- **搜索防抖**：输入框用本地 `useState(searchDraft)` 受控（不丢焦点）；`onInput` 200ms 定时写 `PanelStore.searchQuery`；`clearSearch` 须先 `clearTimeout` 再清 store（否则 pending 定时器回填旧值）；`useEffect(() => setSearchDraft(st.searchQuery), [st.searchQuery])` 放 `const st` 之后同步外部清空。

## Standalone 独立页模式

- **真实网址后台加载（原生 GM，无桥）**：`STANDALONE.open()` 用 `GM_openInTab(standaloneUrl(), { active: false, insert: true })` 后台加载同源真实网址（`location.href.split('#')[0] + '#emh-standalone'`），`GM_openInTab` 不可用时回退 `window.open`。脚本在独立页**原生运行**，GM 存储/网络齐全，父页可关闭；无 postMessage 桥、无 Blob URL、无源码捕获。
- **standalone 检测**：`initialize()` 最前判断 `location.hash/search` 含 `emh-standalone` → 置 `window.__EMH_STANDALONE = true` + 标题「番号库 · 独立页」。后续所有 standalone 分支（双栏布局注入、自动展示、详情联动、菜单入口隐藏）都以该标志驱动。
- **加载封面（@run-at document-start）**：脚本 `@run-at document-start`，standalone 页在 `initialize()` 立即 `injectStandaloneCover()`——`body { visibility: hidden }` + 全屏「加载中」spinner，避免闪现站点内容；`bootPanel` 等 `document.body` 出现后再挂载面板，面板 `showPanel()` 后 `removeStandaloneCover()`（成功/降级/异常三路都需移除，防卡加载）。**document-start 下 DOM 未就绪**：样式注入须 `(document.head || document.documentElement)`；`bootPanel` 内先等 body。
- **standalone 首帧展开用 init() 预置 visible，勿在 render 后同步 showPanel**：`CodeManagerPanel.init()` 里先 `PanelStore.set({ visible: true })` 再 `render()`（preact `useEffect` 延迟执行，render 后同步 `showPanel()` 会先于 `PanelStore.subscribe` 注册，notify 时无监听者 → 状态更新丢失、面板永不显示；外部 2s 轮询不一定触发重渲染）。非 standalone 页保持 `visible:false` 由用户点击 toggle 展开。
- **灯箱方向键 vs 浏览器历史导航**：Chrome/Edge 在无横向滚动页面对 ←/→ 会触发前进/后退。灯箱 keydown 必须 `e.preventDefault()`（+ `stopPropagation()`、`{ passive: false }`、以「`_open` 或 lightbox 根含 `open` 类」判断可见性兜底）；面板 kbdRef 在 `MAGNET_PREVIEW._open` 时对 ←/→ 也 `preventDefault` 兜底。任何接管方向键的全局 keydown 都必须 preventDefault，否则浏览器历史导航吞掉切换。
- **入口**：Header `⋯` 菜单「在新标签页打开」→ `actions.openStandalone` → `STANDALONE.open()`；standalone 页自身不显示该入口（`onOpenStandalone` 传 null）。
- **重载必须 force**：`CODE_LIBRARY.init()` 幂等早退会让 cross-tab/2s poll 的「重载」变 no-op → `init(force)`，cross-tab/2s poll 一律 `init(true)`。
- **样式注入顺序**：`createStyles()` 在 `await ensurePreact()` 之后注入，会覆盖早先的 `injectStandaloneStyles()` override（同特异性后到者胜）→ 冲突属性用 `!important`。
- `@grant` 需含 `GM_openInTab`；无跨页同步协议（两页各自读同一 GM 存储，经 cross-tab 变更监听收敛）。

## 可调尺寸面板 & 图标按钮

- **面板宽度可调**：宽度由 CSS 变量 `--emh-panel-w`（默认 520）驱动；面板隐藏偏移 `right: calc(-1 * (var(--emh-panel-w) + 40px))`，`.visible` 置 0。左缘 `.emh-panel-resize` 手柄（pointer events）拖拽 320–900 clamp，持久化 GM `emh_panel_size`，启动恢复。**注意**：面板 `overflow: hidden` 会裁剪位于边缘的手柄——手柄须完全在面板内（`left:0` + 内部抓握条），并加 `touch-action: none`。拖动期间禁 `transition`。
- **视口溢出防护（DevTools/窄窗口/缩放）**：宽度与隐藏偏移均用 `min(var(--emh-panel-w, 520px), calc(100vw - 24px))` 约束——面板永不超出视口；`emh_panel_size` 仍存用户偏好（大屏恢复），显示宽度被视口实时裁剪。手机媒体查询（≤576px `width:100%`）在样式表更靠后、同特异性，仍优先于 `min()`（全宽行为不变）；standalone `width:auto` 不受影响。
- **详情层次统一（侧栏/新页签一致）**：`DetailDrawer` body 恒用 `.emh-detail-body.unified`：Hero 标题（`.emh-detail-hero`）→ meta 行（`.emh-detail-meta-line`）→ 信息/磁力卡片（`.emh-detail-section`），底部 meta 已移除。抽屉宽度 `clamp(320px, 42%, 460px)`；入场动画 `translateX(100%)`（勿用 `clamp()`，其百分比按元素自身宽度解析，与含块宽度分歧）。顶栏统一 52px 纯色、去毛玻璃；footer 同背景（勿残留 `--emh-glass`）。
- **图标按钮 + 展开标签**：文本按钮转 icon-only SVG + `<span class="emh-expand-label">`，`.btn.emh-expand` hover/`focus-visible` 时 label `max-width` 0→12em 滑出（`gap:0`，间距用 label `margin-left`）；必须带 `aria-label`；`prefers-reduced-motion` 下直显。紧凑按钮（如 `.emh-magnet-btn`）需单独覆盖 padding，防 `.emh-expand` 通用 padding 撑大。footer 用 `flex-wrap: wrap` + `flex: 0 0 auto` 防窄宽溢出。

## Accessibility

- Icon buttons carry `title` + `aria-label`; 键盘选中行加 `aria-selected`。
- 交互控件统一 `:focus-visible` 焦点环（`.btn`、theme-toggle、panel-close、search-clear、magnet-op、lightbox 按钮、tabs、filter chips）。
- Dialog inputs auto-focus (`useRef` + `useEffect`).
- `prefers-reduced-motion` respected for toggle, toast (含 `.custom-toast.leaving` 即时隐藏), panel slide, items, actions, filters, detail drawer, modal content.

---

## Common Mistakes

> **Warning**: `CODE_LIBRARY.markItem` writes the **singular `remark`** field, but UI reads the **plural `remarks`** (and `add()` writes plural). Marking an item then editing remarks would appear to "not save". Always read/write `remarks`; read `remark` only as legacy fallback.

> **Warning**: Never call `markItem` (or `add`) on a **trash item**. `markItem` finds no existing item in `data.items`, so it creates a NEW main-library entry, silently "restoring" a deleted item with wrong semantics. Restore must move `trash.items → data.items` directly, preserving the original `status` and dropping `deleteDate`.

> **Warning**: Trash detail must keep magnets **read-only** (copy OK; hide edit/delete/search/add). Any path that calls `markItem` / magnet mutators on a trash-only code silently recreates a main-library row. Guard mutators with an early return + warning toast; use `resolveItem` only for read paths (copy).

> **Warning**: Trash view must hide multi-select and the header checkbox. Batch-mark on trash items re-creates them in the main library via the `markItem` bug above. Clear `multiSelectMode`/`selectedItems` when switching filters.

> **Warning**: z-index 层级：toggle 10000 < panel backdrop 10009 < panel 10010 < **header menu backdrop 10011 / header menu 10012** < detail backdrop 10012 < drawer 10013 < modal 10014 < lightbox 10050 < **toast container 10060**。Toast 必须高于面板/灯箱，否则面板打开时 toast 被暗层盖住（历史 bug）。Header 下拉菜单（如缓存总控 `⋯`）须纳入 Esc 链最优先关闭。

> **Warning**: `preact.umd.js`（dist 构建）**不导出 `memo`**——`preact.memo` 是 undefined。行 memo 必须用自定义 `Memorize`（见 List Rendering & Performance），否则 `TypeError: memo is not a function` 崩掉整个面板。

> **Warning**: `CODE_LIBRARY.setTags` / `previewCacheStats` / `clearAllPreviewCaches`：标签编辑、缓存统计与清除均应在 `CODE_LIBRARY` 层实现并 `save()` 触发同步；`clearAllPreviewCaches` 只删 `preview` 字段、**不得动 magnet value**；统计须计入 trash。清除类操作走 ConfirmModal（`danger: 'soft'`）。

> **Warning**: 不要硬编码 `color: #fff` 在 primary 填充上。用 `var(--emh-on-primary)` / `var(--emh-on-solid)` token，保证主题化一致。

> **Warning**: `animation-fill-mode: both` 的 `transform` 键帧会**永久覆盖** hover 的 `transform`（CSS 动画优先级高于普通规则）。若元素需要 hover 位移（如 `.emh-item` 悬停上浮），入场动画只做 opacity 键帧，transform 留给 hover。

> **Warning**: Magnet entries are `{ id, value, preview? }`. `preview` is whatslink cache (`screenshots` as `{ screenshot, time? }[]`). `normMagnets` must preserve `preview`. Changing `value` must drop `preview`. Preview fetch uses `MAGNET_PREVIEW.fetchAndCache` + `@connect whatslink.info`; never call `markItem` solely to attach preview — use `CODE_LIBRARY.setMagnetPreview` (works for main + trash).

> **Warning (TDZ)**: 组件体内任何**在 `let x = ...` 声明之前**对 `x` 的求值都会抛 `ReferenceError: Cannot access 'x' before initialization`。最典型：`useEffect` 的依赖数组 `[x.length, ...]` 在 hook 调用时就求值——把它放在 `let items` 之前会在首次渲染直接崩掉整个 Preact 面板（P5 验收真实抓到）。凡是依赖/引用 `items` 等后置变量的 effect，必须放在该变量 `let` 声明与所有过滤**之后**。

> **Warning (htm 字符串子节点)**: htm 的 `${...}` 插值把**字符串当作文本节点**，不会解析为 HTML。内联 SVG 图标必须写嵌套 `html\`<svg …>\`` 模板，不能 `"${'<svg>…'}"` 字符串插值（会渲染成字面文本）。

> **Warning (预览宫格缓存路径)**: 宫格点击走 `previewMagnetAt` → 直接 `MAGNET_PREVIEW.open(urls, idx, meta)`，**不发新请求**，仅在缓存命中时渲染宫格；强制刷新（右键/Shift+点击/`r`）才走 `fetchAndCache`。两条路径不得混用，避免宫格点击意外触发 GM_xmlhttpRequest。
