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

- Design tokens as CSS custom properties on `:root` (blue accent theme, `--emh-*`).
- Two injected `<style>` blocks: `injectCoreStyles()` (global: toggle button, javgg controls, status indicator, toast) and `CodeManagerPanel.createStyles()` (panel internals).
- Per-action hover colors via `emh-act-*` classes; confirm dialogs grade danger via `danger: 'soft' | 'hard'`.

---

## Accessibility

- Icon buttons carry `title` + `aria-label`.
- `role="group"` on button groups.
- Dialog inputs auto-focus (`useRef` + `useEffect`).
- `prefers-reduced-motion` respected for panel/item/toast transitions.

---

## Common Mistakes

> **Warning**: `CODE_LIBRARY.markItem` writes the **singular `remark`** field, but UI reads the **plural `remarks`** (and `add()` writes plural). Marking an item then editing remarks would appear to "not save". Always read/write `remarks`; read `remark` only as legacy fallback.

> **Warning**: Never call `markItem` (or `add`) on a **trash item**. `markItem` finds no existing item in `data.items`, so it creates a NEW main-library entry, silently "restoring" a deleted item with wrong semantics. Restore must move `trash.items → data.items` directly, preserving the original `status` and dropping `deleteDate`.

> **Warning**: Trash view must hide multi-select and the header checkbox. Batch-mark on trash items re-creates them in the main library via the `markItem` bug above. Clear `multiSelectMode`/`selectedItems` when switching filters.

> **Warning**: When a dialog is open over the detail drawer, its z-index must exceed the drawer's (panel 10010 < detail backdrop 10012 < drawer 10013 < modal 10014), or the dialog gets occluded.
