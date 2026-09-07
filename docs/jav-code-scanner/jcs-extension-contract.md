# JCS 扩展宿主契约（Extension Contract v1）

> 宿主：jav-code-scanner（JCS）v1.5.73+ · 契约版本：v1（2026-09 制定）
> 本文档是**对外发布的标准约定**：任何油猴脚本/JS 库按本文规则注册，即可接入 JCS 的
> 【操作】按钮插槽、全站样式注入、页面 DOM 挂载三类扩展点，并受 JCS 配置面板统一管控。
>
> 设计原则：JCS 既有调用入口 `JavCodeKit`（openSearch/copyCode/…约 40 方法）**全部保留不动**；
> 扩展机制是纯增量，第三方库出问题只影响自身，不波及宿主核心功能。

---

## 1. 背景与动机

| 现状 | 问题 |
|---|---|
| JCS【操作】tab 的「加入番号库」「剧照预览」按钮硬编码探测 `EMH_API` | 换名/其它库脚本无法接入；探测逻辑散落 6 处 |
| 想接入的库形态多样（独立油猴脚本 / 纯 JS 库 URL） | 没有统一的注册协议、生命周期、管控开关 |
| 自执行库（如 l.userjs.min.js）直接注入能跑 | 不受开关管控、无冲突隔离、无统一 UI 展示 |

结论：把【操作】背后的能力抽象为**标准契约**——JCS 作为宿主提供注册与管控，
第三方脚本作为扩展（extension）声明能力（capability），双方只依赖本文档，不互相感知内部实现。

## 2. 术语

- **宿主（Host）**：jav-code-scanner.user.js。挂载 `window.JavCodeKit`，管理扩展生命周期。
- **扩展（Extension）**：按契约注册的第三方脚本/库。
- **扩展点（Extension Point）**：宿主开放的能力插槽，v1 共三类：`actions` / `styles` / `mounts`。

## 3. 两种接入形态

### 形态 A：独立油猴脚本（推荐）

保留 `// ==UserScript==` 元数据头，正常装进 Tampermonkey。脚本在**沙箱 world** 运行，
通过握手拿到宿主 API 后注册（宿主可能先于或晚于扩展加载）。

```js
function tryRegister() {
    const kit = window.JavCodeKit;
    if (kit && kit.__ready && kit.extensions) {
        try { kit.extensions.register(MANIFEST); } catch (e) { console.warn('[扩展名]', e); }
        return true;
    }
    return false;
}
if (tryRegister()) return;
window.addEventListener('jcs:kit-ready', tryRegister, { once: true });  // 宿主后到
let n = 0;
const t = setInterval(() => { if (tryRegister() || ++n > 120) clearInterval(t); }, 500); // 兜底 60s
```

> 时序三保险：`__ready` 直注册 → 监听 `jcs:kit-ready` → 兜底轮询。
> 宿主在挂载 `JavCodeKit` 后于 `window` 与页面 world（unsafeWindow）双 dispatch `jcs:kit-ready`。

### 形态 B：纯库 URL（无油猴头）

同一份代码去掉元数据头。在 JCS 配置弹窗的**「扩展」tab** 添加脚本 URL（http/https），
宿主在 boot 末尾按列表顺序创建 `<script src>` 注入**页面 world**——注入时机保证
`window.JavCodeKit` 已就绪，扩展直接注册即可（握手代码保留亦无害）。

- 任意站点生效（不受 `@connect` 白名单限制）；扩展运行在页面 world，**拿不到 GM_* API**。
- 每次页面加载都会重新注入（遵循列表中的启用开关）。
- `l.userjs.min.js` 类**自执行库**：可注入运行，但只要不调用 `register` 就不出现在
  扩展列表、不受开关管控——建议改造为契约注册以获得管理能力。

## 4. Manifest 规范

```js
const MANIFEST = {
    id: 'm3u8-direct-link',      // 必填。全局唯一，建议 kebab-case；同 id 重复注册 = 覆盖旧版
    name: 'M3U8 直链提取',        // 必填。展示名（扩展 tab、按钮 tooltip）
    version: '2.1',              // 必填。字符串，仅展示
    actions: [ /* 扩展点 1：番号操作按钮（数组，可空） */ ],
    styles:  [ /* 扩展点 2：全站样式注入（数组，可空） */ ],
    mounts:  [ /* 扩展点 3：页面 DOM 挂载（数组，可空） */ ]
};
```

校验规则（宿主 `register` 时执行，不合格抛 `Error`）：

| 字段 | 规则 |
|---|---|
| `id` | 非空、≤64 字符、`/^[a-z0-9][a-z0-9-]*$/i`；与已注册 id 重复时覆盖并 toast 提示 |
| `name` | 非空、≤40 字符 |
| `version` | 非空、≤20 字符 |
| `actions[].act` | 非空、≤32 字符、同扩展内唯一（运行时 key 为 `ext:{id}:{act}`） |
| `actions[].icon` | 可选。SVG 字符串 ≤2KB（`<svg viewBox=… stroke="currentColor">` 风格，继承按钮配色）；缺省用「拼图」通用图标 |
| `actions[].title` | 非空、≤20 字符 |
| `actions[].onClick` | 必须为 function |
| `styles[].css` | 非空字符串 |
| `styles[].match` / `mounts[].match` | 可选。缺省 = 所有站点；见 §6 match 语法 |
| `mounts[].mount` | 必须为 function |
| `mounts[].unmount` | 可选 function（推荐改用 `ctx.onCleanup`，见 §5） |

注册成功：toast「已接入扩展：{name}」，【扩展】tab 出现能力卡，按钮插槽即时刷新。

## 5. ctx 对象（宿主传给扩展的运行时上下文）

```js
ctx = {
    code: 'ABC-123',          // 当前番号（actions 场景必有；styles/mounts 场景可能为 ''）
    showToast(msg, type),     // 轻提示。type 保留参数（'info' 等），当前宿主视觉统一不区分
    getCode(),                // 实时读取当前番号（可在 onClick 任意时机调用）
    onCleanup(fn),            // 注册清理回调：扩展被禁用/删除、或挂载点站点离开时由宿主触发
}                             // onCleanup 可多次调用，按注册逆序执行
```

- **actions.onClick(code, ctx) 返回值约定**：
  - `'done'` 或 `{ ok: true }` → 按钮闪「✓」反馈（同内置复制按钮）
  - `'fail'`、`{ ok: false }`、不返回 → 无成功动画
  - 宿主**不吞异常**：onClick 抛错时 console.error 并 toast「扩展 {name} 执行失败」，按钮不崩
- **异步操作**：onClick 可返回 Promise，宿主等待期间按钮半透明防重复点击，按 resolve 值走上述约定

## 6. match 语法（站点命中）

数组元素为 host glob 字符串，如 `*.jable.tv`、`fs1.app`：

- `fs1.app` → 精确匹配 host `fs1.app`
- `*.jable.tv` → 匹配 `jable.tv` 及任意层级子域（`www.jable.tv`、`a.b.jable.tv`）
- 端口/协议不参与匹配；大小写不敏感
- `match` 缺省 = 全站生效（仅建议 styles 使用；mounts 必须写 match 防止全站扫描）

## 7. 生命周期

```text
register(manifest)
  ├─ 校验 → 入注册表（同 id 覆盖旧版，先对旧实例跑 cleanup）
  ├─ actions →【操作】按钮插槽渲染（受【扩展】tab 扩展开关整体控制，缺省开启；
  │            会话级：关闭后本次页面生效，刷新恢复；内置 4 键的逐键开关仍在【操作】tab）
  ├─ styles  → match 命中当前站 → <style id="jcs-ext-style-{id}-{i}"> 注入
  └─ mounts  → match 命中当前站 → mount(ctx)（ctx.onCleanup 已登记）
SPA 导航（pushState/replaceState/popstate）
  ├─ 站点未变：宿主对 mounts 重放 unmount→mount（防 DOM 被路由冲掉）
  └─ 站点变更：旧站 mounts 全部 cleanup，新命中站 mount
扩展开关关闭（【扩展】tab 单项开关，会话级）
  └─ actions 按钮隐藏、styles 标签移除、mounts cleanup；再开启则重放
扩展删除 / 同 id 重注册覆盖
  └─ 全量 cleanup → 移出注册表
```

## 8. 安全须知（对外规则的一部分）

- 扩展 = **任意代码**。形态 B 的 URL 仅接受 `http(s)`；添加时 toast 显示来源域名，
  由使用者自行担保可信。
- 扩展拿不到 `GM_*`（页面 world 无沙箱 API）；如需持久化，v1 暂不提供宿主代理（见 §10）。
- UI 元素 id / class 必须带 `jcs-ext-{manifestId}` 前缀，避免与宿主或其它扩展冲突。
- 宿主对 manifest 做深度只读快照？——不做。契约要求扩展**注册后不得改写 manifest 对象**；
  宿主注册时对 manifest 做 `JSON.parse(JSON.stringify())` 之外的函数保留拷贝
  （结构化浅拷贝顶层 + 数组元素引用原函数），改写原对象不影响已注册实例。

## 9. 完整示例：Jable & FS1 M3U8 直链提取器（形态 A）

```js
// ==UserScript==
// @name         Jable & FS1 M3U8 直链提取器 · JCS 扩展
// @version      2.1
// @match        *://*.jable.tv/*
// @match        *://*.fs1.app/*
// @run-at       document-idle
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const MANIFEST = {
        id: 'm3u8-direct-link',
        name: 'M3U8 直链提取',
        version: '2.1',
        mounts: [{
            match: ['*.jable.tv', '*.fs1.app'],
            mount(ctx) {
                const ui = document.createElement('div');
                ui.id = 'jcs-ext-m3u8-direct-link-ui';
                let timer = null;

                function findVideoUrl() {
                    for (const s of document.querySelectorAll('script')) {
                        const m = s.innerHTML.match(/hlsUrl\s*=\s*['"](https?[^'"]+\.m3u8[^'"]*)['"]/);
                        if (m) return m[1];
                    }
                    const v = document.querySelector('video');
                    if (v) {
                        if (v.src && v.src.includes('.m3u8')) return v.src;
                        const src = v.querySelector('source[src*=".m3u8"]');
                        if (src) return src.src;
                    }
                    return null;
                }

                function getCleanTitle() {
                    const og = document.querySelector('meta[property="og:title"]');
                    const hd = document.querySelector('.header-left h4') || document.querySelector('.header-left h6');
                    const raw = (og && og.content) || (hd && hd.innerText) || document.title;
                    return raw.replace(/\s*-\s*Jable\.tv.*$/i, '')
                              .replace(/\s*-\s*fs1\.app.*$/i, '')
                              .replace(/\s*-\s*免費高清成人.*$/i, '')
                              .trim() || '未命名视频';
                }

                function build(url, title) {
                    ui.style.cssText = 'margin:15px 0;padding:12px;background:#1a1a1a;border-radius:8px;' +
                        'border:1px dashed #555;display:flex;flex-direction:column;gap:10px;width:100%;box-sizing:border-box;clear:both';
                    ui.innerHTML =
                        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                        '<span style="font-size:14px;font-weight:bold;color:#00ff00;">✅ M3U8 直链提取成功</span></div>' +
                        '<div style="font-size:12px;color:#aaa;background:#000;padding:8px;border-radius:4px;word-break:break-all;">' + url + '</div>' +
                        '<button id="jcs-ext-m3u8-copy" style="background:#ff8c00;color:#fff;padding:8px 20px;border-radius:6px;' +
                        'font-size:13px;cursor:pointer;font-weight:bold;border:none;align-self:flex-start;">🔗 一键复制</button>';
                    ui.querySelector('#jcs-ext-m3u8-copy').onclick = function () {
                        navigator.clipboard.writeText(title + ' ' + url).then(() => {
                            this.innerText = '✅ 已复制';
                            this.style.background = '#ffcc88';
                            setTimeout(() => { this.innerText = '🔗 一键复制'; this.style.background = '#ff8c00'; }, 2000);
                        });
                    };
                    const target = document.querySelector('.info-header')
                        || document.querySelector('.header-left')
                        || document.querySelector('h4')
                        || document.querySelector('.player');
                    if (target && !ui.isConnected) {
                        target.nextSibling ? target.parentNode.insertBefore(ui, target.nextSibling)
                                           : target.parentNode.appendChild(ui);
                    }
                }

                timer = setInterval(() => {
                    if (ui.isConnected) return;
                    const url = findVideoUrl();
                    if (url) { clearInterval(timer); timer = null; build(url, getCleanTitle()); }
                }, 1000);

                ctx.onCleanup(() => {           // 宿主禁用扩展 / 站点离开时触发
                    if (timer) clearInterval(timer);
                    ui.remove();
                });
            }
        }]
    };

    // 注册握手（§3 形态 A 三保险）
    function tryRegister() {
        const kit = window.JavCodeKit;
        if (kit && kit.__ready && kit.extensions) {
            try { kit.extensions.register(MANIFEST); } catch (e) { console.warn('[m3u8-ext]', e); }
            return true;
        }
        return false;
    }
    if (tryRegister()) return;
    window.addEventListener('jcs:kit-ready', tryRegister, { once: true });
    let n = 0;
    const t = setInterval(() => { if (tryRegister() || ++n > 120) clearInterval(t); }, 500);
})();
```

## 10. 契约边界（v1 明确不做）

| 不做 | 理由 / 去向 |
|---|---|
| 扩展专用存储代理（GM get/set 按扩展 id 隔离） | v2 再评估；v1 扩展自管持久化 |
| 扩展 URL 自动更新检查 / 版本对比 | 管理负担重，v1 手动改 URL 即刷新 |
| 外部注册**搜索源**（复用现有搜索源配置体系） | 与「搜索源」tab 语义重叠，另行设计 |
| EMH 迁移为契约 provider | `EMH_API` 桥保持现状（见 ../integration/integration-emh-scanner.md）；迁移属 EMH 侧改动 |
| 扩展间通信 / 依赖声明 | 单扩展自治，无编排 |
| actions 按钮开放自定义颜色/角标 | 与内置 4 按钮同款外观，视觉统一 |

## 11. 宿主实现对照（供 JCS 侧开发，扩展作者无需阅读）

- 注册 API：`JavCodeKit.extensions = { register, unregister, list, isEnabled, setEnabled }`
- 存储：GM key `jcs_extensions_v1` = `[{url, enabled, name, id, lastStatus, lastLoadAt}]`
- 配置 UI：配置弹窗新增「扩展」tab（与常规/高亮/操作/搜索源/备份并列）
- 添加 URL 时宿主预取一次脚本头解析 `@name`/`@version` 作为列表显示名；无油猴头或拉取失败回退显示主机名，不阻塞添加；扩展注册成功后以 manifest 的 name/version 为准回填
- 注入时机：boot 尾部按列表顺序串行 `<script src>` 注入，单条失败记 `lastStatus` 不阻塞后续
- 内置 lib/shot 按钮维持 `EMH_API` 直连，不走扩展注册表
