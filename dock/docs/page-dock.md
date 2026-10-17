# PageDock 接入说明

对应库：`dock/page-dock.user.js` v1.3.8。线上引用：

```text
// @require https://update.greasyfork.org/scripts/600709/PageDock.js
```

不要使用带版本号的地址。那个地址是某一版的永久快照，库更新后不会变。

## 使用者

1. 安装并启用 `dock/page-dock.user.js`。
2. 安装已经接入的脚本。当前是番号扫描、番号库、Missav / Jable 字幕。
3. 页面右下角出现九宫格。点开后，每一行左边是功能名，右边是脚本开关。
4. 拖九宫格可以移动，位置记在 `page-dock-pos-v1`。

## 一行里的两个控件

| 控件 | 行为 |
|---|---|
| 左边名字 | 打开或关闭该脚本自己的面板。脚本停用时变灰，点了没有反应 |
| 右边开关 | 启用或停用整个脚本。打开它不会顺便打开面板 |

脚本从自己的面板关闭时，要调用 `setActive(id, false)`，否则左边仍显示为打开。脚本停用时，要调用 `setChecked(id, false)`。

## 接入步骤

1. 在脚本头增加上面的 `@require`。需要读写页面上的 `PageDock` 时，同时保留 `@grant unsafeWindow`。
2. 检测到 `PageDock` 后调用 `mount()`，再 `register()`。没有悬浮坞时保留原来的按钮。
3. 有悬浮坞时隐藏自己的悬浮按钮。面板仍由本脚本创建。
4. 停用状态由接入脚本自己保存。刷新页面后，用保存的状态作为 `enabled` 传给 `register()`。
5. 接入完成后，把脚本移入 `dock/`，并在根 `README.md` 的 dock 表登记。

页面上已有实例时，后加载的副本不会再创建一个图标。各脚本的 `register()` 都进同一个菜单。

## 登记

```javascript
const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
const dock = page.PageDock || (typeof PageDock !== 'undefined' ? PageDock : null);
if (!dock) return;

dock.mount();
dock.register({
    id: 'my-tool',
    label: '工具',
    title: '打开或关闭工具面板',
    enabled: scriptEnabled,
    active: panelIsOpen,
    onActive(active) {
        if (!scriptEnabled) return;
        active ? openPanel() : closePanel();
    },
    onToggle(enabled) {
        setScriptEnabled(enabled);
    },
    onClick() {
        if (!scriptEnabled) return;
        openPanel();
    }
});
```

`id` 和 `onClick` 必填。同一 `id` 再次登记会覆盖旧项。`register()` 返回取消登记的函数。

## API

| 方法 | 作用 |
|---|---|
| `mount()` | 创建图标和菜单。重复调用不会创建第二个 |
| `register(item)` | 登记或覆盖一项 |
| `unregister(id)` | 移除一项。没有登记项时图标隐藏 |
| `setChecked(id, enabled)` | 同步右边脚本开关。传 `false` 时左边同时变为未打开 |
| `setActive(id, active)` | 同步左边面板状态 |
| `setBadge(id, text)` | 设置或清空名字旁的短标记 |
| `close()` | 关闭悬浮坞菜单，不关闭各脚本面板 |

`setChecked` 和 `setActive` 只更新已有行，不会重建菜单。接入脚本可以在开关回调里安全回写状态。
