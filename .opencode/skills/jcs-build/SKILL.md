---
name: jcs-build
description: "为 jav-code-scanner（JCS）扩展宿主编写第三方扩展。当用户要求「写一个 JCS 扩展」「接入 JavCodeKit」「给 JCS 加扩展按钮/样式/挂载」「把某个油猴脚本改造成 JCS 扩展」时使用。涵盖契约 v1 的 manifest 规范、三类扩展点、注册握手、生命周期与验收清单。"
---

# JCS 扩展开发（Extension Contract v1）

为 jav-code-scanner 宿主编写扩展。**权威规范**：`docs/jav-code-scanner/jcs-extension-contract.md`——本 skill 是实操摘要，两者冲突时以契约为准。

## 宿主环境事实（写之前先知道）

- 宿主脚本：`jav-code-scanner.user.js`，暴露 `window.JavCodeKit`（页面 world 与沙箱双挂载，`_pageWin` 双写）。
- 注册入口：`JavCodeKit.extensions.register(manifest)`；另有 `unregister(id)` / `list()` / `isEnabled(id)` / `setEnabled(id, on)`。
- 握手事件：`jcs:kit-ready`（宿主 kit 挂载后双 dispatch）。
- 扩展运行环境：
  - **形态 A**（独立油猴脚本）：沙箱 world，无页面 JS 全局（除非用 unsafeWindow）；`@grant none` 即可。
  - **形态 B**（URL 注入）：页面 world，能拿 `window.JavCodeKit`，**拿不到任何 GM_* API**。
- 校验失败 register 会抛 Error：id 必须 `/^[a-z0-9][a-z0-9-]*$/i` ≤64、name ≤40、version ≤20、act 唯一 ≤32、title ≤20、icon 含 `<svg` ≤2048 字符、`mounts[].match` 必填。

## Manifest 模板

```js
const MANIFEST = {
    id: 'my-extension',            // 必填，kebab-case，全局唯一（同 id 重注册 = 覆盖旧版）
    name: '我的扩展',               // 必填，≤40 字符
    version: '1.0.0',              // 必填
    actions: [{                    // 可选：番号操作按钮（进【操作】条）
        act: 'do-it',              // 扩展内唯一 ≤32
        title: '执行操作',          // ≤20，按钮 tooltip
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...</svg>', // 可选，≤2KB，继承按钮 currentColor
        onClick(code, ctx) {       // code=当前番号
            // 返回 'done' 或 {ok:true} → 按钮闪 ✓
            // 返回 Promise → 宿主等 resolve（期间按钮半透明防重复点击）
            // 抛错 → 宿主 console.error + toast，不崩
            return 'done';
        }
    }],
    styles: [{                     // 可选：全站样式注入
        css: '.my-ext-x{color:red}',
        match: ['*.example.com']   // 可选 host glob，缺省=全站
    }],
    mounts: [{                     // 可选：页面 DOM 挂载
        match: ['*.example.com'],  // 必填！禁止全站扫描
        mount(ctx) {
            const el = document.createElement('div');
            el.id = 'jcs-ext-my-extension-ui';   // 必须带 jcs-ext-{id} 前缀
            // ... 构建 UI / setInterval 轮询 ...
            ctx.onCleanup(() => {              // 禁用/卸载/SPA 离站时宿主触发
                el.remove();
            });
        }
    }]
};
```

## ctx 对象（宿主注入）

```js
ctx = {
    code: 'ABC-123',      // actions 场景的当前番号
    getCode(),            // 实时番号
    showToast(msg, type), // type 现为保留参数，宿主视觉统一
    onCleanup(fn)         // 可多次调用，逆序执行
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
| 同 id 重注册 | 先对旧实例跑全部 cleanup 再激活新实例 | mount 需可重入：不依赖“只执行一次” |
| 扩展开关关闭 | actions 按钮隐藏 + styles 移除 + mounts cleanup | cleanup 里清掉**一切**定时器/observer/挂载 DOM |
| SPA 导航 | unmount→mount 重放（600ms 防抖） | 不要在 mount 外持久持有 DOM 引用判断 |
| 页面刷新 | 全部重放 | 无需处理 |

**常见坑**：
1. `setInterval` 没放进 `ctx.onCleanup` → 禁用后仍在跑。
2. UI 元素 id 没带 `jcs-ext-{id}` 前缀 → 与宿主/其它扩展冲突。
3. mount 里 `document.querySelector` 找不到目标就静默失败 → 用轮询（参考 M3U8 示例的 1s 轮询模式）。
4. actions.onClick 里假设有番号 → 任何场景 code 可能为空字符串，先判空。
5. 形态 B 想用 GM_* → 不可能，需持久化请等待 v2 存储代理或自建（页面 localStorage 注意按域名隔离）。

## 参考实现（可复制的完整例子）

- **M3U8 直链提取器**（mounts 型，轮询 + onCleanup）：契约文档 §9。
- **测试样例**（actions×2 + styles + mounts 全类型）：`tools/test-extension.js`（本仓库）——含 Promise 异步按钮、样式生效角标、挂载横幅，改 id/name 即可当脚手架。

## 自测验收清单（写完必过）

1. 形态 A 装入 Tampermonkey（或形态 B 走本地 http 服务 + 「扩展」tab 添加 URL）。
2. 打开任意 jav 站：配置 → 「扩展」tab → 「已注册扩展」出现你的扩展，按钮/样式/挂载数量正确。
3. 每个 action 点击一次：同步的闪 ✓、异步的按钮半透明后恢复。
4. 「扩展」tab 关掉你的扩展开关：按钮消失、样式消失、挂载 DOM 消失（cleanup 生效）；再打开恢复。
5. 刷新页面：默认恢复启用；SPA 站点切路由后挂载点仍在（重放生效）。
6. 控制台无 `[JCS ext]` 开头的报错。
7. （形态 B）列表显示 `@name` 预取名而非裸 URL；「复制」按钮能复制链接。

## 宿主侧对应实现位置（排障用）

- 宿主模块：`jav-code-scanner.user.js` 搜 `JCS_EXT_KEY` / `registerExtension` / `validateExtensionManifest` / `bindExtSpaHook` / `injectExtensionScripts`。
- 按钮插槽渲染与点击路由：搜 `ext:`（`data-act="ext:{id}:{act}"`）。
- 配置 UI：搜 `renderExtensionsTab` / `bindExtensionsTab`。
- 元数据预取名：搜 `parseExtensionScriptMeta` / `fetchExtensionMeta`。
