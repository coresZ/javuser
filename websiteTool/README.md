# 网页对象工具库

油猴脚本：在任意网页上取选元素、识别对象类型并绑定动作（弹窗打开 / 隐藏 / 加粗 / 复制 / 导出 CSV 等），支持远程规则订阅与全局配置导入导出。

## 工程结构

```
网页对象工具库/
├── meta.header.js          # 油猴元数据头（@name / @grant / @match …）
├── build.mjs               # 构建：CSS → JS 常量 + 模块拼接 → dist/*.user.js
├── package.json
├── styles/                 # 可编辑的真实 CSS（构建时内联进脚本）
│   ├── default.css         # Shadow DOM 基础样式
│   ├── page.css            # 宿主页面注入样式（根节点隔离）
│   └── refine.css          # 0.3.x UI 精修主题
├── src/
│   ├── config.js           # 全局配置
│   ├── main.js             # 启动、点击拦截、MutationObserver
│   ├── core/
│   │   ├── actionRegistry.js
│   │   ├── RulesManager.js
│   │   ├── ruleEngine.js
│   │   ├── pickerState.js
│   │   ├── extractor.js
│   │   └── executeRule.js
│   ├── utils/
│   │   ├── gm.js           # GM_* / localStorage 兼容层
│   │   ├── dom.js
│   │   ├── selector.js
│   │   └── targetType.js
│   └── ui/
│       ├── host.js         # Shadow DOM 宿主
│       ├── theme.js
│       ├── styles.gen.js   # 构建生成，勿手改
│       ├── PopupPanel.js
│       ├── Toolbar.js
│       ├── ElementPicker.js
│       └── RulesPanel.js
└── dist/
    └── 网页对象工具库.user.js   # 安装用产物
```

## 开发

需要 Node.js ≥ 18。

```bash
# 生成 dist/网页对象工具库.user.js
npm run build

# 指定版本号构建（临时覆盖 package.json 的 version）
PPK_VERSION=0.4.7 npm run build
```

构建流程：

1. 读取 `styles/*.css` → 生成 `src/ui/styles.gen.js`（`style_default` / `style_page` / `style_refine`）
2. 按固定顺序拼接 `src/**` 模块
3. 包进 IIFE，前置 `meta.header.js`，写入 `dist/`

**版本号以 `package.json` 的 `version` 为唯一来源**：`build.mjs` 每次构建都会把该值写入产物头部，`meta.header.js` 里的 `@version` 只是占位（构建时会被覆盖）。升级版本用 `npm run version:bump`，然后 `npm run build`，不要手工改多处。

源码仍使用共享作用域（与原先单体脚本一致），避免大范围改 import/export 带来的行为回归；模块边界清晰，便于单独阅读与修改。

## 样式注入与严格 CSP

工具的所有样式都通过 `adoptStyleSheet()`（`src/utils/gm.js`）注入，优先使用 **CSSOM 构造样式表**：`new CSSStyleSheet()` + `root.adoptedStyleSheets`，只在浏览器不支持时才回落到 `<style>` 元素。

原因：内联 `<style>` 走 `style-src` 校验，遇到只写 `style-src 'self'`（无 `unsafe-inline` / nonce / hash）的站点会被整份丢弃——元素虽插进 DOM，但 `style.sheet` 为 `null`，一条规则都不生效，**Shadow DOM 内的 `<style>` 一样被丢**。此时工具 UI 完全无样式：悬浮按钮不出现、面板文字裸堆在页面左上角。CSSOM 样式表不受 `style-src` 约束，是这类站点上唯一可行的注入方式。

- 页面级样式（`styles/page.css`）→ `document.adoptedStyleSheets`
- Shadow 内样式（`styles/default.css` + `styles/refine.css`）→ `shadowRoot.adoptedStyleSheets`
- 动态几何（按钮位置、取选高亮框、浮动菜单）继续用 `el.style.xxx = ...`，属于 CSSOM 属性写入，不受 `style-src` 影响；真正会被拦的只有 `setAttribute('style', ...)` 这种整串解析，代码里不要用。
- 若未来新增"注入 CSS"的代码路径，一律走 `adoptStyleSheet()`，不要再直接 `createElement("style")`。


## 安装

1. `npm run build`
2. 用 Tampermonkey / Violentmonkey / Userscripts 安装 `dist/网页对象工具库.user.js`
3. 或把该文件发布到 Greasy Fork（`@downloadURL` / `@updateURL` 已写在 meta 中）

## 功能摘要

| 能力 | 说明 |
|------|------|
| 取选对象 | 页面上点选元素，自动生成候选选择器与对象类型 |
| 绑定动作 | 弹窗打开、隐藏、加粗、移除、复制、导出 CSV |
| 规则包 | 一套规则可绑定多域名（支持 `*.example.com`） |
| 站点开关 | 按 hostname 整体启停 |
| 远程规则 | 订阅 JSON 地址，打开网页时可自动拉取合并/替换 |
| 导入导出 | 当前包 / 全部配置 JSON |
| 主题 | 浅色 / 深色 |

## 版本

当前版本见 `package.json` 的 `version`，与脚本头 `@version` 在构建时同步。
