# Frontend Development Guidelines

> 本项目前端开发规范（两个油猴脚本：jav-code-scanner.user.js 原生 DOM + Enhanced_Media_Helper.js Preact）。

---

## Overview

本目录沉淀两个油猴脚本的实际约定。**通用设计公约**（design-system.md）是最高优先级——所有脚本遵守；其余文件记录各技术栈的具体模式。

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Design System（通用公约）](./design-system.md) | 跨脚本通用设计语言：token/主题/主色/语义色/圆角/焦点/动效/弹层/响应式/命名 | Done |
| [Directory Structure](./directory-structure.md) | 单文件 IIFE 分区约定 + 目录布局 | Done |
| [Component Guidelines](./component-guidelines.md) | 原生 DOM ensure* 工厂 + Preact 组件模式 | Done |
| [Hook Guidelines](./hook-guidelines.md) | Preact hooks 模式（kbdRef/actionsRef/memo 约束） | Done |
| [State Management](./state-management.md) | 存储双轨 + PanelStore + 站点总表 | Done |
| [Quality Guidelines](./quality-guidelines.md) | 质量标准 + 禁止模式 + 审查清单 | Done |
| [Type Safety](./type-safety.md) | 纯 JS 防御式类型安全 + 校验 | Done |

---

## 阅读顺序建议

1. 新脚本开发 → 先读 `design-system.md`（通用公约）
2. 原生 DOM UI → `component-guidelines.md` 原生 DOM 节 + `docs/architecture-jav-code-scanner.md`
3. Preact UI → `component-guidelines.md` Preact 节 + `hook-guidelines.md`
4. 存储/状态 → `state-management.md`
5. 提交前 → `quality-guidelines.md` 审查清单

---

**Language**: 中文（项目实际文档语言；代码注释亦为中文）。
