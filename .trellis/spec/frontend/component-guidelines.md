# Component Guidelines

> How components are built in this project.

---

## Overview

This project's UI is a Preact + htm userscript panel (`Enhanced_Media_Helper.js`) injected into javgg.net. All components live inside `buildPanel()` in a factory closure sharing `PanelStore` (external-store state) and `html` (htm bound to Preact's `h`).

Key components: `StatusTag`, `ItemRow`, `DetailDrawer`, `ConfirmModal`, `PromptModal`, `ToastContainer`, `CodeManagerApp`.

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

- Design tokens as CSS custom properties on `:root` / `.emh-theme-dark` / `@media (prefers-color-scheme: dark)` — indigo accent + zinc neutrals (`--emh-*`).
- Two injected `<style>` blocks: `injectCoreStyles()` (global: toggle, javgg controls, status indicator, toast) and `CodeManagerPanel.createStyles()` (panel internals).
- Text on primary fills must use `--emh-on-primary` (light: white, dark: near-black). Never hardcode `color: #fff` on `var(--emh-primary)` backgrounds — dark-mode primary is a light indigo.
- Solid semantic fills (success/danger/warning toasts & hover) use `--emh-on-solid` for readable contrast.
- Shared mono stack: `--emh-font-mono` (list code 13px, detail code 16px, tabular-nums).
- Spacing rhythm: horizontal padding **20px** (header/search/list header/footer/detail); item row `10px 14px` + `margin-bottom 6px`; action icon hit area ≥ 28×28 with `gap: 2px`.
- Panel width stays **520px**; item action column ~80px for 1–2 icons.
- Per-action hover colors via `emh-act-*` classes; confirm dialogs grade danger via `danger: 'soft' | 'hard'`.

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

## Accessibility

- Icon buttons carry `title` + `aria-label`.
- `role="group"` on button groups.
- Dialog inputs auto-focus (`useRef` + `useEffect`).
- `prefers-reduced-motion` respected for toggle, toast, panel slide, items, actions, filters, detail drawer.

---

## Common Mistakes

> **Warning**: `CODE_LIBRARY.markItem` writes the **singular `remark`** field, but UI reads the **plural `remarks`** (and `add()` writes plural). Marking an item then editing remarks would appear to "not save". Always read/write `remarks`; read `remark` only as legacy fallback.

> **Warning**: Never call `markItem` (or `add`) on a **trash item**. `markItem` finds no existing item in `data.items`, so it creates a NEW main-library entry, silently "restoring" a deleted item with wrong semantics. Restore must move `trash.items → data.items` directly, preserving the original `status` and dropping `deleteDate`.

> **Warning**: Trash detail must keep magnets **read-only** (copy OK; hide edit/delete/search/add). Any path that calls `markItem` / magnet mutators on a trash-only code silently recreates a main-library row. Guard mutators with an early return + warning toast; use `resolveItem` only for read paths (copy).

> **Warning**: Trash view must hide multi-select and the header checkbox. Batch-mark on trash items re-creates them in the main library via the `markItem` bug above. Clear `multiSelectMode`/`selectedItems` when switching filters.

> **Warning**: When a dialog is open over the detail drawer, its z-index must exceed the drawer's (panel 10010 < detail backdrop 10012 < drawer 10013 < modal 10014), or the dialog gets occluded.

> **Warning**: Do not put `color: #fff` on primary-filled controls. Dark theme primary is light (`#a5b4fc`); use `var(--emh-on-primary)`.
