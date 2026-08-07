# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

两个油猴脚本（原生 DOM + Preact）共享的质量标准。无 lint/typecheck 工具链，质量靠规范 + 代码审查。

---

## Forbidden Patterns

1. **硬编码色值/圆角/时长**：颜色、圆角、动效时长必须走 `--<缩写>-*` token（见 design-system.md），禁止散落 `#d4534a`、`.2s`、`10px`。
2. **裸引用 GM**：`GM.x` 在无 GM 环境抛 ReferenceError。必须 `typeof GM !== 'undefined' && GM` 守卫后再访问（真实教训，见 history）。
3. **MutationObserver 里全量重建 DOM**：反复 `clear+linkify` 会自反馈闪烁（真实教训）。组件构建必须幂等，只重建失效部分。
4. **未经转义拼接 HTML**：`innerHTML` 模板的用户输入必须走 `escapeHtml`（jcs 2388）；番号/文件名类字段拼接前剔除引号。
5. **硬编码宿主站类名**：不覆盖站点 `.btn`/`.my-btn-*`（EMH 曾全局接管，jcs 自建 `.jcs-btn` 更优）。
6. **emoji/字符当图标**：图标用内联 SVG（`stroke="currentColor"`），禁止 `::before { content:"✓" }`（EMH 1406-1410 实证）。
7. **就地 mutate + memo 行**：不可变更新（`{ ...cur }` 替换数组元素），否则 memo 不刷新（EMH 78 实证）。

---

## Required Patterns

1. **选择器用 `<缩写>` 常量拼接**：`const NS='jcs'` + `${NS}-xxx`，不硬编码字符串（jcs 56 实证；emh 硬编码是反例）。
2. **幂等构建 + 防重绑**：ensure* 工厂检测已存在则复用；`dataset.jcsBound`/`_bound` 防重复绑定。
3. **GM 能力降级路径**：字幕等依赖 GM 的功能 `available()` 检测，无 GM 自动隐藏（真实教训）。
4. **focus-visible + aria**：可交互元素焦点环、`role`/`aria-label`/`aria-modal`。
5. **prefers-reduced-motion 兜底**：全局 `transition/animation:none`。
6. **事件委托 + 单点热键**：全局 keydown 唯一监听，Esc 关闭链集中管理。

---

## Testing Requirements

- 无自动化测试框架。改动后手工冒烟 + 记录。
- 关键逻辑（番号解析、存储迁移、高亮幂等）可临时用 Node 脚本验证（无 DOM 部分）或 jsdom 冒烟。
- 样式改动在 2 个目标站点实机验证（桌面 + 移动）。

---

## Code Review Checklist

- [ ] 所有颜色/圆角/时长走 token
- [ ] GM 引用有 typeof 守卫
- [ ] MutationObserver 回调幂等、无自反馈
- [ ] innerHTML 拼接已转义
- [ ] 选择器用 `<缩写>` 常量
- [ ] 有 reduced-motion 兜底
- [ ] 有 focus-visible 焦点环
- [ ] 无硬编码站点类名
