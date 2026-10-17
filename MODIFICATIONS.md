# MODIFICATIONS · 仓库根目录

> 本目录协议：修改本目录任意文件前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。

## 项目约束

- 根目录独立油猴脚本各自维护 `@version`。行为变化必须递增版本，并同步本文件。
- `jable & miss.user.js` 不接入 JCS / EMH。字幕层用 DOM overlay，不依赖站点播放器字幕轨。
- 字幕位置写入 `localStorage`：`msv-subtitle-pos-v1`（字幕 `bottom` / `x`），`msv-dock-pos-v1`（控制台坐标）。

## 2026-10-17 · 字幕控制台重写与横向位置

**功能**：重写 Missav / Jable 字幕控制台样式，并支持横向调节字幕位置。

**修改内容**：
- `@version` 5.3 → 5.4。
- 控制台改为可拖动 dock：标题栏与 CC 都可拖，位置写入 `msv-dock-pos-v1`，窗口缩放时夹在视口内。
- 主界面增加「横向」滑杆（0%–100%，默认 50%）。字幕层 `left` 跟随 `STATE.x`，与垂直位置一并写入 `msv-subtitle-pos-v1`。
- 去掉失效的垂直加减按钮绑定。搜索、开关、时间偏移、本地下载逻辑不变。

**涉及文件与位置**：
- `jable & miss.user.js`：`@version`、`STATE` / `savePos`、`GM_addStyle`、`Renderer.forceDomSubtitleLayer`、`UIBuilder.build`
- `README.md`：根目录脚本表补上 `jable & miss.user.js` v5.4

## 2026-10-17 · 隐藏控制台改为收成小图标

**功能**：点「收成小图标」不再把入口藏没，只把面板收成可再打开的 CC 小圆点。

**修改内容**：
- `@version` 5.4 → 5.5。
- `#msv-dock.is-mini` 强制隐藏面板，CC 缩成 28px 半透明圆点。再点 CC 去掉 `is-mini` 并打开面板。

**涉及文件与位置**：
- `jable & miss.user.js`：`GM_addStyle`、`#msv-hide-fab` 文案与点击、`#msv-fab` 点击

## 2026-10-17 · 打开面板时小图标保持不动

**功能**：点 CC 只弹出面板，小图标位置不跳。

**修改内容**：
- `@version` 5.5 → 5.6。
- dock 尺寸固定为图标大小。面板 `position: absolute; right: 0; bottom: 44px`，从图标上方弹出，不再把图标顶走。
- 拖动夹取改用 dock 的图标尺寸，不再用面板撑开后的外框。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-dock` / `#msv-fab` / `#msv-panel` 样式，`clampDock`，打开与收起时不再重排 dock

## 2026-10-17 · CC 图标尺寸固定

**功能**：收起面板时图标大小不再变化。

**修改内容**：
- `@version` 5.6 → 5.7。
- 去掉 `.is-mini` 把 dock / CC 缩到 28px 的样式。收起只隐藏面板，图标保持 36px。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-dock.is-mini` 样式

## 2026-10-17 · CC 图标去掉描边

**功能**：CC 图标不再显示边框。

**修改内容**：
- `@version` 5.7 → 5.8。
- `#msv-fab` 边框设为 0；`.ok` 只改文字颜色，不再加边框。

**涉及文件与位置**：
- `jable & miss.user.js`：`#msv-fab` / `#msv-fab.ok`
