# Hook Guidelines

> How hooks are used in this project.

---

## Overview

仅 `Enhanced_Media_Helper.js`（Preact）使用 hooks。`jav-code-scanner.user.js`（原生 DOM）不用 React 体系。

关键约束：依赖 **preact.umd.js + hooks.umd.js 的 UMD 构建**，`useSyncExternalStore` 与 `memo` 均**不导出**——这是本项目的硬约束。

---

## Custom Hook Patterns

- 组件用函数式 + hooks：`useReducer` + `PanelStore.subscribe` 触发重渲染。
- **kbdRef 模式**（键盘统一处理器）：`kbdRef.current = fn` 每次渲染刷新，`useEffect(() => { document.addEventListener('keydown', onKey); return cleanup; }, [])` 单次注册——避免 `useEffect` 内依赖 `[st.x]` 造成过期闭包/重复绑定。
- **actionsRef 模式**（稳定回调）：`actions` 每次渲染重建，直接传 `actions.x` 破坏 memo。用 `actionsRef.current = actions` + `useCallback((...a) => actionsRef.current.x(...a), [])` 委托——稳定且无过期闭包。
- 搜索防抖：本地 `useState(searchDraft)` 受控 + `onInput` 200ms 定时写 store + `clearTimeout` 清理。

---

## Data Fetching

- 数据源为 GM 存储（`CODE_LIBRARY` 模块）+ 页面 DOM，无服务端拉取。
- 懒加载图片：`LAZY` IntersectionObserver（`data-lazy` 标记）。
- 跨页同步：`GM_addValueChangeListener('emh_sync_timestamp')` + 2s 轮询兜底。

---

## Naming Conventions

- 无自定义 hook 命名约束（不导出自定义 hook 模块）；组件内部函数命名语义化。
- 组件在 `buildPanel()` 工厂内定义，不全局暴露。

---

## Common Mistakes

> **Warning**: 不要用 `preact.memo` / `useSyncExternalStore`——UMD 构建不导出（实证 `Object.keys(preact)` 无 memo）。行 memo 用自定义 `Memorize`（class extends `preact.Component` + `shouldComponentUpdate` 浅比较）。

> **Warning (TDZ)**：`useEffect` 依赖数组 `[x.length, …]` 在 hook 调用时就求值——把它放在 `let items` 之前会抛 `ReferenceError: Cannot access 'x' before initialization`，首次渲染即崩面板。依赖/引用后置变量的 effect 必须放在该变量声明之后。

> **Warning**: 滚动跟随 effect 的依赖**只能**是 `[selectedIndex]`，绝不能含 `items`（每次渲染重建的数组会重置滚动、破坏鼠标滚轮）。
