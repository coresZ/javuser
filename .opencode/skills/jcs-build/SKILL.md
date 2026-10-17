---
name: jcs-build
description: "为 jav-code-scanner（JCS）扩展宿主编写第三方扩展。当用户要求「写一个 JCS 扩展」「接入 JavCodeKit」「给 JCS 加扩展按钮/样式/挂载/选源按钮组」「把某个油猴脚本改造成 JCS 扩展」时使用。涵盖契约 v1.1 的 manifest 规范、四类扩展点（actions/pickButtons/styles/mounts）、注册握手、生命周期与验收清单。"
---

# JCS 扩展开发（Extension Contract v1.1）

为 jav-code-scanner 宿主编写扩展。**权威规范**：`dock/docs/jav-code-scanner/jcs-extension-contract.md`（v1.1，宿主 JCS ≥ v1.5.81）——本 skill 是实操摘要，两者冲突时以契约为准。v1 扩展在 v1.1 宿主上**完全兼容**（新增字段均为增量）。

## 宿主环境事实（写之前先知道）

- 宿主脚本：`dock/jav-code-scanner.user.js`，暴露 `window.JavCodeKit`（页面 world 与沙箱双挂载，`_pageWin` 双写）。
- 注册入口：`JavCodeKit.extensions.register(manifest[, source])`；另有 `unregister(id)` / `list()`（含 actions/pickButtons/styles/mounts 各项计数）/ `isEnabled(id)` / `setEnabled(id, on)`。
- 握手事件：`jcs:kit-ready`（宿主 kit 挂载后双 dispatch）。
- 扩展运行环境：
  - **形态 A**（独立油猴脚本）：沙箱 world，无页面 JS 全局（除非用 unsafeWindow）；`@grant none` 即可。
  - **形态 B**（URL 注入）：页面 world，能拿 `window.JavCodeKit`，**拿不到任何 GM_* API**。不传 `source` 时宿主按「当前注入中的 URL」自动归属，注册成功回填列表的名称/ID/状态。
- 校验失败 register 会抛 Error：id 必须 `/^[a-z0-9][a-z0-9-]*$/i` ≤64、name ≤40、version ≤20；actions：act 唯一 ≤32、title ≤20、icon 含 `<svg` ≤2048；pickButtons：顶层 ≤4、id kebab ≤32 且唯一、label 必填 ≤16、title ≤20、icon 同上、`items` 组 1~8 个；mounts[].match 必填。

## Manifest 模板

```js
const MANIFEST = {
    id: 'my-extension',            // 必填，kebab-case，全局唯一（同 id 重注册 = 覆盖旧版且保留启用开关）
    name: '我的扩展',               // 必填，≤40 字符
    version: '1.0.0',              // 必填
    actions: [{                    // 可选：番号操作条图标按钮
        act: 'do-it',              // 扩展内唯一 ≤32
        title: '执行操作',          // ≤20，按钮 tooltip
        icon: '<svg ...>...</svg>',// 可选 ≤2KB；缺省用宿主默认齿轮图标，继承 currentColor
        onClick(code, ctx) {       // code=当前番号
            // 'done' 或 {ok:true} → 闪 ✓；Promise → 宿主等 resolve（半透明防重复）；抛错只记日志+toast
            return 'done';
        }
    }],
    pickButtons: [{                // 可选（v1.1 新增）：选源面板内的文字按钮 / 二级按钮组
        id: 'whos-actions',        // kebab ≤32，扩展内唯一；配置 key = extpick:{extId}:{btnId}
        label: 'whosTv',           // 必填 ≤16（展示截断，靠 title 补全含义）
        title: 'whos.tv 操作',     // 可选 ≤20，缺省「扩展名 · label」
        icon: '',                  // 可选；用户开「图标优先」(compact) 样式时展示
        order: 10,                 // 可选 number 默认 0，升序排列
        match: ['*.example.com'],  // 可选 host glob，缺省=全站
        // —— 形态一：叶子按钮（onClick 必填，无 items）——
        onClick(code, ctx) { return { ok: true, close: true }; }, // close → 执行后收起选源面板
        // —— 形态二：二级按钮组（items 1~8，组级不写 onClick）——
        // items: [{ id: 'favorite', label: '收藏', title, icon, onClick(code, ctx){...} }]
    }],                            // 每扩展顶层 ≤4；全部扩展合计 ≤8，超出按 order 截断
    styles: [{                     // 可选：样式注入
        css: '.my-ext-x{color:red}',
        match: ['*.example.com']   // 可选 host glob，缺省=全站
    }],
    mounts: [{                     // 可选：页面 DOM 挂载
        match: ['*.example.com'],  // 必填！禁止全站扫描
        mount(ctx) {
            const el = document.createElement('div');
            el.id = 'jcs-ext-my-extension-ui';   // 必须带 jcs-ext-{id} 前缀
            ctx.onCleanup(() => { el.remove(); }); // 可多次登记
        },
        unmount(ctx) {}            // 可选（v1.1）：卸载时先跑 unmount，再逆序跑 onCleanup
    }]
};
```

## ctx 对象（宿主注入）

```js
ctx = {
    code: 'ABC-123',      // actions / pickButtons 场景的当前番号
    getCode(),            // 实时番号（state.active 优先）
    showToast(msg, type), // type 现为保留参数，宿主视觉统一
    onCleanup(fn)         // 可多次调用，逆序执行；mounts 场景生效
}
```

## 注册握手（三种时序全保险，直接抄）

```js
function tryRegister() {
    const kit = window.JavCodeKit;
    if (kit && kit.__ready && kit.extensions) {
        try { kit.extensions.register(MANIFEST); } catch (e) { console.warn('[my-extension]', e); }
        return true;
    }
    return false;
}
if (tryRegister()) return;
window.addEventListener('jcs:kit-ready', tryRegister, { once: true });
let n = 0;
const t = setInterval(() => { if (tryRegister() || ++n > 120) clearInterval(t); }, 500);
```

形态 B（纯库 URL）：去掉 `// ==UserScript==` 头即可，其余相同；宿主会在配置「扩展」tab 添加 URL 并在页面加载时注入。

## 生命周期要点（决定代码怎么写）

| 事件 | 宿主行为 | 扩展必须做的 |
|---|---|---|
| 同 id 重注册 | 先对旧实例跑全部 cleanup 再激活新实例，**enabled 开关沿用旧值** | mount 需可重入：不依赖“只执行一次” |
| 扩展开关关闭 | actions/pickButtons 入口隐藏 + styles 移除 + mounts 卸载（unmount→onCleanup 逆序） | cleanup 里清掉**一切**定时器/observer/挂载 DOM；开关为会话级，刷新后按注册恢复 |
| SPA 导航 | mounts 重放 unmount→mount（600ms 防抖，hook pushState/replaceState/popstate） | 不要在 mount 外持久持有 DOM 引用判断 |
| 页面刷新 | 全部重放 | 无需处理 |
| pickButtons 执行 | code 为空 → toast「请先选择番号」不跑 onClick；抛错 → console.error + toast，不崩 | onClick 先判空 code |

**常见坑**：
1. `setInterval` 没放进 `ctx.onCleanup` → 禁用后仍在跑。
2. UI 元素 id 没带 `jcs-ext-{id}` 前缀 → 与宿主/其它扩展冲突。
3. mount 里 `document.querySelector` 找不到目标就静默失败 → 用轮询或 MutationObserver（参考 jable 扩展的挂载等待模式）。
4. actions/pickButtons 的 onClick 里假设有番号 → code 可能为空字符串，先判空。
5. pickButtons 组内 items 全在「操作」tab 关掉 → 组入口整体隐藏（正常行为，不是 bug）。
6. 顶层按钮超过全局 8 个上限 → 按 order 截断，你的高 order 按钮可能不出现。
7. 形态 B 想用 GM_* → 不可能，需持久化请等待存储代理或自建（页面 localStorage 注意按域名隔离）。

## 参考实现（可复制的完整例子）

- **whostv.user.js**（本仓库根）：pickButtons **二级按钮组**实战——Promise 异步收藏 + `{ok:true, close:true}`、组面板、注册兜底轮询。
- **契约文档 §10**：完整示例（actions + pickButtons 叶子/按钮组混合）。
- **tools/test-extension.js**：actions×2 + styles + mounts 全类型，改 id/name 即可当脚手架。
- **tools/jable-live-preview.extension.js**：mounts 型真实扩展（video 元素挂 hover 预览），含挂载轮询与 onCleanup 模式。

## 自测验收清单（写完必过）

1. 形态 A 装入 Tampermonkey（或形态 B 走本地 http 服务 + 「扩展」tab 添加 URL）。
2. 打开任意 jav 站：配置 → 「扩展」tab → 「已注册扩展」出现你的扩展，按钮/选源/样式/挂载数量正确。
3. 每个 action 点击一次：同步的闪 ✓、异步的按钮半透明后恢复。
4. 点番号弹选源面板：pickButtons 叶子出现且点击生效（`{close:true}` 会收起面板）；按钮组可展开二级，组内逐项点击各自闪 ✓。
5. 「操作」tab 逐项关闭你的 action / pickButton / 组内 item，再打开恢复（actions 另有「折叠进 ⋯」开关；pickButtons 仅显示/隐藏）。
6. 「扩展」tab 关掉扩展总开关：所有入口、样式、挂载 DOM 消失（cleanup 生效）；再打开恢复。
7. 刷新页面：默认恢复启用；SPA 站点切路由后挂载点仍在（重放生效）。
8. 控制台无 `[JCS ext]` 开头的报错。
9. （形态 B）列表显示 `@name` 预取名而非裸 URL，注册后回填真实 ID/名称；「复制」按钮能复制链接。

## 宿主侧对应实现位置（排障用，均在本仓库 `dock/jav-code-scanner.user.js`）

- 宿主模块：搜 `JCS_EXT_KEY` / `EXT_LIMITS` / `registerExtension` / `validateExtensionManifest` / `bindExtSpaHook` / `injectExtensionScripts`。
- pickButtons：搜 `collectPickButtons`（收集+排序+限流）/ `EXT_PICK_GLOBAL_MAX` / `resolveExtPickDef`（`ext:{id}:{btnId}[:{itemId}]` 路由）/ `runExtPickButtonClick`（返回值处理）/ `renderPanelPickButtons`（大窗同步渲染）/ `listExtPickSlots`（「操作」tab 开关清单）。
- 操作条按钮：搜 `ext:`（`data-act="ext:{id}:{act}"`）与 `EXT_DEFAULT_ICON`。
- 配置 UI：搜 `renderExtensionsTab` / `bindExtensionsTab`；元数据预取名搜 `parseExtensionScriptMeta` / `fetchExtensionMeta`。
