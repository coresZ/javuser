# Directory Structure

> How frontend code is organized in this project.

---

## Overview

本项目是**油猴用户脚本仓库**，无构建工具链。脚本以单文件 IIFE 交付，内部按 `// ─── 分区 ───` 注释组织。目录结构反映两种形态：独立脚本 + Trellis 规范文档。

---

## Directory Layout

```
javuser/
├── jav-code-scanner.user.js       # 单文件脚本（8575 行，12 分区 IIFE）
├── Enhanced_Media_Helper.js       # 单文件脚本（3588 行，IIFE + 模块对象 + buildPanel 工厂）
├── docs/                          # 正式文档（standalone-mode / architecture）
├── .trellis/spec/frontend/        # 前端规范（design-system / component / quality / …）
└── .trellis/tasks/                # Trellis 任务工件（本地，不入库）
```

---

## Module Organization（单文件 IIFE 分区约定）

jav-code-scanner 的 12 个分区（`// ─── xxx ───` 注释）是单文件的模块边界，新功能按分区归属落位：

| 分区 | 职责 | 新增功能示例 |
|---|---|---|
| ① 基础设施 | 存储层/主题/热键/宿主/拖拽 | 新存储键、新全局热键 |
| ② 番号识别 | 解析/校验/扫描 | 新番号形态正则 |
| ③ provider | 搜索源 CRUD | 新搜索源字段 |
| ⑥ 点选器 | 鼠标拾取 | 新拾取交互 |
| ⑦ 字幕/网络 | 字幕/加密/WebDAV | 新网络 API |
| ⑧ 高亮引擎 | 页面高亮 | 新高亮策略 |
| ⑨ UI | 样式 + 面板 | 新面板控件、新设置 tab |

Enhanced_Media_Helper 用模块对象组织：`CONFIG`/`CODE_LIBRARY`/`UTILS`/`THEME`/`STANDALONE`/`MAGNET_PREVIEW`/`LAZY`/`SITE_HANDLERS` → `buildPanel()` 工厂 → `bootPanel()` → `initialize()`。

---

## Naming Conventions

- 脚本内：`<缩写>-*` 前缀类/id（`jcs-` / `emh-`），存储键 `<缩写>_*` 蛇形（建议 `_vN` 版本号），状态类 `is-*`
- 文件：油猴脚本 `.user.js`；文档 `kebab-case.md`
- 完整命名表见 `design-system.md` §12

---

## Examples

- 单文件分区范例：`jav-code-scanner.user.js`（分区地图见 `docs/architecture-jav-code-scanner.md`）
- 模块对象范例：`Enhanced_Media_Helper.js`（CONFIG→模块→工厂→boot 结构）
