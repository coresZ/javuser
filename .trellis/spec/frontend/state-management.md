# State Management

> How state is managed in this project.

---

## Overview

两个脚本采用两种状态模型：

1. **原生 DOM 脚本**（jav-code-scanner）：模块级 `state` 对象 + 闭包变量 + GM 存储（跨站双轨：GM 优先、localStorage 回退自动迁入）。
2. **Preact 脚本**（Enhanced_Media_Helper）：`PanelStore`（external store）+ `useReducer` + `subscribe`。

跨页/跨站同步靠 `GM_addValueChangeListener` + 轮询兜底。

---

## State Categories

| 类别 | jav-code-scanner | Enhanced_Media_Helper |
|---|---|---|
| 运行态（页内） | `state` 对象（554-580：codes/active/provider/theme/viewed/linkifyBusy/scrollLocked/…） | `PanelStore` state（selectedIndex/searchQuery/view/…） |
| 持久态（跨站） | 14 个 GM 键 `jcs_*_v1`（81-85 常量表） | GM 键 `emh_code_library`/`emh_code_trash`/`emh_ui_theme`/`emh_panel_size` |
| 站点专属 | SITES_KEY 总表（hostname → 规则对象） | 无（单站） |
| URL 态 | `location.href`/pathname 参与番号扫描 | `#emh-standalone` 独立页标志 |

---

## When to Use Global State

- **跨站共享**：全局键（主题/搜索源/历史/高亮选项）用 GM 存储，`storeGetRaw` 自动把本站 localStorage 迁入 GM（`mergeLegacyLocalIntoGlobalStore` 209）。
- **单站专属**：进 SITES_KEY 站点总表（buildAllSitesSnapshot 263 归一入口）。
- **页内瞬态**（选中、面板开合、拖拽位置）：放 `state` 或 `PanelStore`，不落盘（拖拽位置除外：PANEL_KEY/FAB_POS_KEY 持久化）。

---

## Server State

- 无服务端状态。数据来源：页面 DOM 扫描（state.codes）+ 外部 API（迅雷字幕）。
- 网络请求封装：`gmRequest`（2419）返回 Promise，失败回落代理链（fetchTextViaProxies 2769）。
- 字幕竞态保护：`subReqSeq` 递增序号，过期响应丢弃（3128）。

---

## Common Mistakes

> **Warning**: 存储键**必须带版本号后缀**（`_v1`）以便迁移演进（jcs 实证）；emh 不带版本号是已知债务。

> **Warning**: `mergeLegacyLocalIntoGlobalStore` 在启动/导出/导入都会触发——迁移逻辑与业务读路径交织，改动存储结构时检查所有触发点。

> **Warning**: 就地 mutate + memo 行 = 状态不刷新（EMH 78）。不可变更新 `{ ...cur }`。

> **Warning**: 点击动作先改状态再渲染，锚点 DOM 可能被销毁——「选源浮卡锚定不重建」逻辑与 renderPanelList 缠绕（jcs 6409 实证），改这块最容易出 bug。
