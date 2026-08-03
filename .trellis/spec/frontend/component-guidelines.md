# Component Guidelines

> How components are built in this project.

---

## Overview

This project's UI is a Preact + htm userscript panel (`Enhanced_Media_Helper.js`) injected into javgg.net. All components live inside `buildPanel()` in a factory closure sharing `PanelStore` (external-store state) and `html` (htm bound to Preact's `h`).

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

> **Warning**: z-index 层级：toggle 10000 < panel backdrop 10009 < panel 10010 < detail backdrop 10012 < drawer 10013 < modal 10014 < lightbox 10050 < **toast container 10060**。Toast 必须高于面板/灯箱，否则面板打开时 toast 被暗层盖住（历史 bug）。

> **Warning**: 不要硬编码 `color: #fff` 在 primary 填充上。用 `var(--emh-on-primary)` / `var(--emh-on-solid)` token，保证主题化一致。

> **Warning**: `animation-fill-mode: both` 的 `transform` 键帧会**永久覆盖** hover 的 `transform`（CSS 动画优先级高于普通规则）。若元素需要 hover 位移（如 `.emh-item` 悬停上浮），入场动画只做 opacity 键帧，transform 留给 hover。

> **Warning**: Magnet entries are `{ id, value, preview? }`. `preview` is whatslink cache (`screenshots` as `{ screenshot, time? }[]`). `normMagnets` must preserve `preview`. Changing `value` must drop `preview`. Preview fetch uses `MAGNET_PREVIEW.fetchAndCache` + `@connect whatslink.info`; never call `markItem` solely to attach preview — use `CODE_LIBRARY.setMagnetPreview` (works for main + trash).

> **Warning (TDZ)**: 组件体内任何**在 `let x = ...` 声明之前**对 `x` 的求值都会抛 `ReferenceError: Cannot access 'x' before initialization`。最典型：`useEffect` 的依赖数组 `[x.length, ...]` 在 hook 调用时就求值——把它放在 `let items` 之前会在首次渲染直接崩掉整个 Preact 面板（P5 验收真实抓到）。凡是依赖/引用 `items` 等后置变量的 effect，必须放在该变量 `let` 声明与所有过滤**之后**。

> **Warning (htm 字符串子节点)**: htm 的 `${...}` 插值把**字符串当作文本节点**，不会解析为 HTML。内联 SVG 图标必须写嵌套 `html\`<svg …>\`` 模板，不能 `"${'<svg>…'}"` 字符串插值（会渲染成字面文本）。

> **Warning (预览宫格缓存路径)**: 宫格点击走 `previewMagnetAt` → 直接 `MAGNET_PREVIEW.open(urls, idx, meta)`，**不发新请求**，仅在缓存命中时渲染宫格；强制刷新（右键/Shift+点击/`r`）才走 `fetchAndCache`。两条路径不得混用，避免宫格点击意外触发 GM_xmlhttpRequest。
