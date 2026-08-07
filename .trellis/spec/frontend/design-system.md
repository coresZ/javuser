# 前端设计公约（通用）

> **通用约束**：本文档定义的是一套跨脚本复用的前端设计语言，**所有脚本一律遵循**。
> 每个脚本以自身的 `<缩写>` 前缀套用（如 `jcs` / `emh`），token 用 `--<缩写>-*`，类用 `<缩写>-*`，存储键用 `<缩写>_*`。
>
> 来源：从 `jav-code-scanner.user.js`（`--jcs-*`）与 `Enhanced_Media_Helper.js`（`--emh-*`）两个已运行脚本的共同实践中提炼。两脚本虽主色/圆角尺度不同，但设计语言高度同构；本文档取**共同结构**，色值给参考值（脚本可按品牌自定义）。

## 1. token 体系：CSS 变量优先

**约定**：所有颜色/圆角/字号/阴影/动效/焦点环**必须走 CSS 变量**，禁止硬编码色值。变量以 `--<缩写>-*` 前缀、语义命名，在 `:root` 定义。

参考结构（`jcs` 实证：`:root` 3711-3729；`emh` 实证：`injectCoreStyles` 1248 起，`:root` 深色块 1254-1297）：

```css
:root{
  --<abbr>-bg:#0e1014; --<abbr>-surface:#151922; --<abbr>-text:#e8eaef; --<abbr>-muted:#8b93a7;
  --<abbr>-accent:#d4534a; --<abbr>-accent-dim:rgba(212,83,74,.16); --<abbr>-accent-line:rgba(212,83,74,.4);
  --<abbr>-ok:#34d399; --<abbr>-danger:#f43f5e; --<abbr>-warn:#fbbf24;
  --<abbr>-radius:14px; --<abbr>-radius-md:10px; --<abbr>-radius-sm:8px; --<abbr>-radius-xs:6px;
  --<abbr>-font:12px/1.45 "Segoe UI",system-ui,"PingFang SC","Microsoft YaHei",sans-serif;
  --<abbr>-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --<abbr>-shadow:0 18px 48px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.03) inset;
  --<abbr>-ease:cubic-bezier(.2,.8,.2,1); --<abbr>-fast:.12s; --<abbr>-med:.18s;
  --<abbr>-focus:0 0 0 3px var(--<abbr>-accent-dim)
}
```

**Required**：颜色、圆角、动效时长/曲线、焦点环全部 token 化；命名语义化（-bg/-surface/-text/-muted/-accent/-ok/-danger/-warn/-radius/-shadow/-ease/-fast/-med/-focus/-mono）。

**反例**：在样式里写 `#d4534a`、`10px`、`.2s` 散落各处——改主题/统一缩放时需逐个改。

## 2. 主题机制：深色默认 + 覆盖块切换

**约定**：`:root` 默认即深色；浅色用 `[data-theme="light"]` 属性选择器覆盖块**重定义同一组变量**，实现零 JS 换肤。

参考（`jcs`：3730-3759 双块；`emh`：1254-1335 深+浅两块，system 块 1337-1376）：

```css
:root{ /* 深色默认 */ --<abbr>-bg:#0e1014; --<abbr>-text:#e8eaef; ... }
[data-<abbr>-theme="light"], #<abbr>-host[data-theme="light"]{
  --<abbr>-bg:#f0f2f5; --<abbr>-text:#1a1d26; --<abbr>-accent:#c9443c; ...
}
```

**Required**：
- 主题由根属性（`html[data-<abbr>-theme]`）驱动，切换只改属性 + 写存储
- 支持三态：dark / light / system（system 用 `@media (prefers-color-scheme)` 覆盖块，`emh` 实证 1337-1376）
- 读取顺序：存储 → 系统偏好 → 默认 dark

**反例**：JS 里条件判断颜色值；浅色时 JS 覆盖内联样式——维护两套颜色成本高。

## 3. 主色派生族

**约定**：主色一套派生 token，覆盖 hover、浅底、描边、对比文本、焦点环。

参考（`emh`：primary #5e6ad2 / -hover / -soft rgba(94,106,210,.14) / -on-primary #fff；`jcs`：accent #d4534a / accent2 / accent-dim / accent-line）：

```css
--<abbr>-accent: 主色;
--<abbr>-accent-hover: 悬停变体;
--<abbr>-accent-dim: rgba(主色,.14~.16);   /* 浅底/选中 */
--<abbr>-accent-line: rgba(主色,.35~.4);   /* 描边 */
--<abbr>-accent2: 亮变体（浅色场景或强调）;
--<abbr>-on-accent: #fff;                  /* 彩色底上的文本 */
```

**Required**：主按钮用主色渐变 + 深色投影（`jcs` 实证 3917-3919：`linear-gradient(145deg,#e05a50,var(--jcs-accent))`）；选中/激活态统一 accent-dim 底 + accent-line 边 + accent2 字。

**反例**：每处按钮单独调色、无派生 token。

## 4. 语义色板

**约定**：成功/警告色两脚本**完全同源**（Tailwind 系），危险色在同一区间。

| 语义 | 参考值 | 用途 |
|---|---|---|
| success / ok | `#34d399` | 成功（emh `#34d399` / jcs `#34d399`） |
| warning | `#fbbf24` | 警告（两脚本同值） |
| danger | `#f87171` ~ `#f43f5e` | 危险/删除（emh `#f87171` / jcs `#f43f5e`） |

**Required**：语义色必须 token 化并全项目一致；深/浅主题下语义色转深——浅色下 jcs 为 success `#059669` / danger `#e11d48` / warn `#d97706`（jcs 3740-3741），emh 为 success `#059669` / danger `#dc2626` / warn `#d97706`（emh 1318-1322）。

**反例**：新造语义色相（每处自定义深浅红/绿）、色值散写不 token 化——语义色漂移、主题切换不同步。

## 5. hairline 边框

**约定**：边框用半透明 hairline，深色白、浅色黑，不用实色。

```css
--<abbr>-line:rgba(255,255,255,.1);        /* 深色边框 */
[data-<abbr>-theme="light"]{ --<abbr>-line:rgba(15,23,42,.1); }
```

**Required**：`--<abbr>-line`（细边框）+ `--<abbr>-line-strong`（强调边框 rgba(255,255,255,.12)）层级；配合 `box-shadow` inset hairline 做悬浮层次（`jcs` 3724）。

**反例**：实色边框（`#fff`/`#000` 或纯灰 `#ccc`）；深色主题下 1px 白线刺眼，浅色下黑线过重——用半透明 hairline 自适应。

## 6. 圆角阶梯

**约定**：圆角按层级用阶梯 token，pill/胶囊一律 999px。

| token | 参考值 | 用途 |
|---|---|---|
| `-radius` | 12-14px | 大容器（面板/弹窗/抽屉） |
| `-radius-md` | 10px | 中控件（卡片） |
| `-radius-sm` | 8px | 小控件（按钮/输入） |
| `-radius-xs` | 6px | 微控件（tag/色标） |
| pill | 999px | 徽章/状态标签/seg 按钮 |

**Required**：所有圆角走 token；胶囊类一律 999px（两脚本实证：jcs 4488、emh 1380/3218）。

**反例**：散写 `3px`/`5px`/`7px` 圆角；同类控件圆角不一致（按钮 6px 另一处 8px）——统一走阶梯 token。

## 7. 字体

**约定**：正文基础 12-13px；标题 14-15px/700；辅助 10.5-11.5px；强语义用 700-800 字重 + letter-spacing。代码/番号/URL/文件名用 mono token。

```css
--<abbr>-font:12px/1.45 system-ui,"PingFang SC","Microsoft YaHei",sans-serif;
--<abbr>-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
```

**Required**：正文与 mono 双 token；`font:var(--<abbr>-font)` 统一；番号/磁力/URL 一律 `--<abbr>-mono`（emh 3178-3179、jcs 3723）。

**反例**：番号/URL 用正文比例字体（数字宽窄不一、对不齐）；每处单独 `font-family` 写全栈——用 mono token。

## 8. 焦点可见性

**约定**：所有可交互元素统一 `:focus-visible` 焦点环，颜色用主色。

```css
:focus-visible{ outline:2px solid var(--<abbr>-accent); outline-offset:2px; }
/* 或统一 box-shadow 环 */
:focus-visible{ outline:none; box-shadow:var(--<abbr>-focus); }
```

**Required**：主色焦点环全项目一致（jcs `box-shadow` 环 3728、emh `outline` 1395）；键盘可达元素配 `role="button"` + `tabindex="0"`（键盘操作类，jcs 3215-3235）。

**反例**：仅 `:hover` 有视觉反馈、`:focus-visible` 无环（键盘用户看不到焦点位置）；依赖默认 outline 未统一覆写——环须全项目一致。

## 9. 动效

**约定**：
- 时长 token 化（`--<abbr>-fast:.12s` hover/按压、`--<abbr>-med:.18s` 面板/卡片）；曲线统一（jcs `cubic-bezier(.2,.8,.2,1)` / emh expo-out）
- 入场动画：位移 + 缩放 + 淡入（jcs panel-in 3960、emh modal-in 0.18s translateY(6px) scale(.98)）
- 按压反馈：`:active { transform:scale(.92~.96) }`（jcs / emh 1417）
- hover 抬升：`translateY(-1px)`（emh 3172）

**Required**：**必须支持 `prefers-reduced-motion` 全量兜底**：

```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{ transition:none!important; animation:none!important; transform:none!important }
}
```

**反例**：时长散写 `.2s`/`.3s` 无 token；入场动画硬切（display none→flex）；忽略 reduced-motion。

## 10. 弹层纪律

**约定**：z-index 分层阶梯、Esc 逐层关闭、遮罩点击关闭、打开锁滚动、遮罩 blur。

- **z-index 阶梯**：宿主层固定高值（jcs host 2147483000）+ 内部相对阶梯（toast 20 / 点选 50-52 / 面板 4 / fab 3 / 大窗 10 / 选源 12 / 字幕 14 / 设置 5）；EMH 用 10000-10060 阶梯。**同一脚本内必须成体系**。
- **Esc 逐层关闭**：点选→字幕→选源→设置→大窗→面板，全局唯一 keydown 监听，各层注册进关闭链（jcs 790-865）
- **遮罩点击关闭**：root click 且 `e.target === root`（jcs 5812）
- **滚动锁定**：弹层打开 `lockBodyScroll`（jcs 953）/ `body overflow:hidden`（emh 2702）
- **遮罩 blur**：`backdrop-filter: blur(4~6px)`（jcs 4789 / emh 693）

**Required**：弹层打开时隐藏下层常驻组件（`html.jcs-popup-open` 隐藏 fab/panel）；`role="dialog"` + `aria-modal`（emh 774）。

**弹层栈健壮性（page-picker-kit 实践沉淀）**：
- `pushLayer` 按 `el` **去重**——同一层重复打开不重复入栈（否则滚动锁泄漏）
- Esc 处理**强制出栈**——即使 `close()` 内部提前 return（守卫如 `if (picking)`），条目也不滞留栈顶（否则 Esc 被死条目永久消费）
- 滚动锁按「实际入栈/出栈计数」管理，出栈用 `el` 匹配、幂等
- 各层 `close()` 与栈交互必须配对：隐藏前 pop、恢复显示时 push

**反例**：弹层 z-index 与宿主层平级/乱序（新弹层盖不住旧层）；打开弹层不锁 body 滚动（背景可滚动）；不注册进 Esc 关闭链（各层自己监听导致层级混乱）；重复打开弹层导致滚动锁泄漏（push 不按 el 去重）。

## 11. 响应式

**约定**：移动端自适配，桌面居中弹窗 → 移动全屏；侧栏 → 底部抽屉。

- 断点参考：`820px` + `(pointer:coarse) and (max-width:1024px)`（jcs 4980）；`640px` 灯箱 / `576px` 面板全宽（emh 763/3452）
- 移动端行为：面板变底部抽屉（72dvh + 顶部拉手 + 上圆角，jcs 5024-5040）；弹窗全屏；列表横滑 chips
- 所有定位考虑 `env(safe-area-inset-*)`

**Required**：`isMobile` 判定统一（jcs 589：matchMedia + UA 兜底）；移动/桌面共用同一 DOM、仅布局差异。

**反例**：桌面/移动各渲染一套 DOM（状态不同步、维护两倍）；忽略 `env(safe-area-inset-*)`（刘海屏遮挡）——一套 DOM 只切布局。

## 12. 命名约定

**约定**：

| 对象 | 规则 | 示例 |
|---|---|---|
| CSS 变量 | `--<缩写>-*` | `--jcs-accent` / `--emh-primary` |
| id / class | `<缩写>-*` | `#jcs-panel` / `.emh-item` |
| 存储键（GM） | `<缩写>_*` 小写蛇形，建议带 `_vN` | `jcs_theme_v1` / `emh_code_library` |
| 自定义事件 | `<缩写>_*` 蛇形 | `emh_library_updated` |
| 状态类 | `is-*` 前缀（建议统一，jcs 风格） | `.is-on` / `.is-active` |
| 数据属性 | `data-<缩写>-*` | `data-jcs-code` |
| 防重绑 | `data-<缩写>-bound` / 函数 `_bound` | `dataset.jcsBound` |

**Required**：**必须用 `<缩写>` 常量（`const NS='jcs'`）拼接选择器，不硬编码字符串**（jcs 56 实证；emh 硬编码是反例）；避免全局接管宿主站类名（jcs 自建 `.jcs-btn` 优于 emh 覆盖 `.btn`）。

## 验证清单

- [ ] 所有颜色/圆角/时长走 CSS 变量
- [ ] 主题切块零 JS 换肤，三态支持
- [ ] 主色派生族 + 语义色板 token 化
- [ ] hairline 边框、圆角阶梯、mono 字体 token
- [ ] focus-visible 焦点环全交互元素
- [ ] prefers-reduced-motion 兜底
- [ ] 弹层 z-index 成体系、Esc 关闭链、滚动锁定
- [ ] 移动端自适配 + safe-area
- [ ] 选择器统一 `<缩写>` 常量拼接，不硬编码
