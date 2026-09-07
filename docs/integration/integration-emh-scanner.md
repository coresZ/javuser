# jav-code-scanner ↔ Enhanced_Media_Helper 集成指南

> 跨脚本桥协议（2026-08）。scanner v1.5.71+ / EMH v3.7.2+（桥本体 3.6.1+）。
> 本文档描述两个油猴脚本之间"番号库"协作的全部机制、时序、降级行为与扩展方法。

## 背景：为什么要"桥"

| 障碍 | 说明 |
|---|---|
| GM 存储按脚本隔离 | scanner 无法直接读写 EMH 的 `emh_code_library`（GM_* 存储空间按脚本独立） |
| 沙箱（isolated world）互不可见 | 两个脚本各自的 `window` 是独立沙箱，直接 `window.xxx` 访问不到对方 |
| 页面 DOM 共享但全局不共享 | 唯一双方都能读写的交汇点是**页面主 world（unsafeWindow）** |

结论：在页面主 world 挂一个全局 API 对象，双方通过它通信——这就是 `EMH_API`。

## 桥协议

### 挂载（EMH 侧，v3.6.1+）

```js
// mountPublicApi()，document-start 阶段立即执行，不依赖 Preact
unsafeWindow.EMH_API = api;   // 主 world（scanner 走这条）
window.EMH_API = api;         // EMH 沙箱
window.__EMH_API__ = api;     // 幂等标记
```

- 挂载时防覆盖（`!unsafeWindow.EMH_API` 才写主 world）；
- 需要 `@grant unsafeWindow`（Violentmonkey 严格模式必需）；
- **检测**：scanner `isEmhInstalled()` 查 `EMH_API.addCode` 是否为函数。

### API 参考（EMH 3.7.2）

| 方法 | 返回 | 版本 | 说明 |
|---|---|---|---|
| `addCode(code, title?, remarks?)` | `{ok}` / `{ok:false, exists:true}` / `{ok:false, message}` | 3.6.1 | 添加（先查重，不触发内部重复 toast） |
| `removeCode(code)` | `{ok}` / `{ok:false, missing:true}` | 3.6.2 | 移除（进回收站，7 天可恢复） |
| `markItem(code, status)` | `{ok}` / `{ok:false, message}` | 3.6.1 | status: `favorite`/`watched`/`unmarked` |
| `getItem(code)` | 深拷贝 item / `null` | 3.6.1 | 含 `magnet` 字段 |
| `getStatus(code)` | 状态字符串 | 3.6.1 | 注意：**不存在时返回 `'unmarked'`**，判在库要用 `getItem` |
| `getAll()` | 深拷贝全部 items | 3.6.1 | scanner 用它做 30s 状态缓存 |
| `openPanel()` | — | 3.6.1 | 打开 EMH 面板 |
| `refresh()` | — | 3.6.1 | 刷新指示器/面板 |
| `previewAvwiki(code, {force, onDone})` | `{ok}` | 3.6.3 / 回调 3.6.4 | 打开 AVWikiDB 宫格截图灯箱；`onDone(errMsg, preview)` 异步回传结果（errMsg 空串=成功） |
| `exportData(filter?)` | `{version, exportDate, filter, items}` | 3.7.0 | 导出番号库（`all`/`favorite`/`watched`/`unmarked`/`trash`，缺省 `all`） |
| `importData(data, mode?)` | `{success, message}` | 3.7.0 | 导入（`merge` 缺省 / `replace` 覆盖；清洗：大写、remarks 字符串化、磁力归一） |
| `getWebdavOpts()` | `{url,user,file,encrypt,hasPass,hasSecret}` | 3.7.0 | 只回传密码存在位，明文不出脚本存储 |
| `saveWebdavOpts(partial)` | `{url,file,encrypt}` | 3.7.0 | 合并保存设置，不回传密码 |
| `webdavTest(opts?)` | Promise→`{ok,status,url,mode,exists?}` | 3.7.0 | 测试连接（PROPFIND→GET 兜底）；`opts` 缺省用已存设置 |
| `webdavUpload(opts?)` | Promise→`{url,bytes,encrypted}` | 3.7.0 | 上传 `exportData('all')` 全量备份 |
| `webdavDownload(opts?)` | Promise→`{text,encrypted,url,data,items}` | 3.7.0 | 下载并解密解析；恢复由调用方 `importData(data, mode)` 完成 |

### 反向桥：EMH WebDAV 卡读取 jav 已存设置（v3.7.1+）

EMH 的「WebDAV 云端备份」设置卡顶部分区会检测 `unsafeWindow.JavCodeKit`：

- **读**：`JavCodeKit.getWebdavOpts()` → `{url, user, file, hasPass, encrypt, hasSecret}`；EMH 一键导入 **服务器 + 账号 + 加密开关**（文件名除外——EMH 固定 `emh-library.json`，与 jav 的 `jcs-config.json` 区分互不覆盖）
- **密码不跨脚本**：jav 的桥与 EMH 的桥一致，出于安全不回传明文密码；`hasPass=true` 时 EMH 卡内提示「jav 已存密码，此处需手动输入一次」
- 未检测到 jav 配置（未装 scanner / jav 未填 WebDAV）时该分区显示独立填写提示，不影响本卡使用

## scanner 侧消费点

| 消费点 | 位置（scanner） | 机制 |
|---|---|---|
| 操作条按钮（picker + 弹窗操作栏） | `buildCodeActions` 971 | 入库/截图按钮依赖 EMH，`setCode` 时未装自动隐藏 |
| 面板/弹窗 chip 徽标 | `bindChipLibBadge` 917 | ＋=入库；✓=已在库（两段式点击确认移除） |
| 页面高亮块 ✓ 徽标 | `bindCodeMarkClick` 3824 | `data-jcs-lib="1"` → CSS `::after` 显示 |
| Alt+Shift+点击 | `bindCodeMarkClick` | 快捷入库（与按钮并存） |
| 设置页「操作」tab | `syncCodeActionsUi` 2155 | EMH 未装时 lib/shot 开关置灰 |
| 库状态缓存 | `loadLibCache` 862 / `libStateOf` 879 | 30s 有效，`getAll()` 一次建 map |

## 关键时序

### 点击「入库」（操作条 / chip / Alt+Shift）

```
scanner 点击 → doAddToLibrary(code) → EMH_API.addCode(code)
  → EMH：查重 → CODE_LIBRARY.add → save()（广播 emh_library_updated + 写 emh_sync_timestamp）
  → 返回 {ok} → scanner：invalidateLibCache() + refreshLibBadges()
  → 徽标/✓ 即时更新；EMH 面板（若开）经事件自动刷新；其他标签页经 GM 监听同步
```

### 点击「截图预览」

```
scanner 点击 → 收起 picker（防遮挡）→ toast「正在获取…」
  → EMH_API.previewAvwiki(code, {force, onDone})
  → EMH：AVWIKI_PREVIEW.fetchAndShow → GM_xmlhttpRequest avwikidb.com（20s 超时）
  → 成功：EMH 开灯箱（z-index 2147483647，盖住 scanner 宿主）
  → 失败：onDone(errMsg) → scanner toast「截图预览失败：<原因>」
```

### 状态同步

- scanner 缓存 30s；入库/移除/导入后 `invalidateLibCache()`
- EMH 数据变更（任何标签页）→ `emh_sync_timestamp` → scanner 不感知（scanner 只读桥），下次操作/刷新自然取新状态
- 页面刷新后 `refreshScan` 末尾 `refreshLibBadges()` 全量同步徽标

## 降级行为矩阵

| 场景 | 表现 |
|---|---|
| EMH 未安装 | 操作条隐藏入库/截图按钮；chip 无徽标；Alt+Shift toast「未安装 EMH」；设置页 lib/shot 置灰 + 提示条 |
| EMH < 3.6.1（无桥） | 同"未安装"（`isEmhInstalled` 判 `addCode` 不存在） |
| EMH 3.6.1–3.6.2（无 previewAvwiki） | 截图按钮点击 toast「需 3.6.4+」 |
| EMH 3.6.3（无 onDone） | 截图无失败反馈（3.6.4 修复） |
| EMH 3.6.4（灯箱 z-index 低） | 灯箱被 scanner 宿主盖住（3.6.5 修复） |
| iframe 页面 | EMH `@noframes` 不进 iframe；iframe 内 scanner 是精简模式，无操作条；桥只在顶层可用 |

## 注意事项（踩坑记录）

1. **z-index 约定**：scanner 宿主 `2147483000` < EMH 灯箱 `2147483647`。预览灯箱必须置顶；scanner 侧截图前先 `closeProviderPicker()`；
2. **`getStatus` 语义陷阱**：不存在返回 `'unmarked'`，判断"是否在库"必须用 `getItem`/`getAll`；
3. **深拷贝隔离**：`getItem`/`getAll` 返回深拷贝，外部改动不会污染库内对象；
4. **移除是进回收站**（7 天可恢复），不是永久删除；
5. **版本同步**：scanner 的功能分支按方法存在性降级，升级 EMH 不必同步升级 scanner，但新按钮需要新 EMH；
6. **Toast 通道**：EMH 内部 toast 只在面板构建后显示，跨脚本调用方必须自带反馈（onDone / scanner toast）。

## 扩展指南：给操作条加新按钮（5 步）

以"复制磁力"为例：

1. **图标**：`PICK_ICON`（scanner 952）加 `magnet: '<svg…>'`；
2. **定义**：`CODE_ACT_DEF`（965）加 `magnet: { icon: 'magnet', title: '复制磁力', emh: true }`（emh=true 表示依赖 EMH，未装自动隐藏 + 设置页置灰）；
3. **配置默认**：`DEFAULT_CODE_ACTIONS`（429）加 `magnet: { on: true, fold: false }`（自动进入导出/导入）；
4. **设置 UI**：设置面板「操作」tab 加一行双开关（`${NS}-ca-magnet` / `-fold`）——`syncCodeActionsUi`/`bindCodeActionsUi` 用 `DEFAULT_CODE_ACTIONS` 遍历，自动覆盖；
5. **处理逻辑**：`buildCodeActions` 点击分发加 `if (act === 'magnet') { … api.getItem(code) → 复制 magnet… }`。

> picker 与预览弹窗操作栏自动同时生效，无需两处维护。

## 相关文件

- scanner 架构：`../jav-code-scanner/architecture-jav-code-scanner.md`
- EMH 架构：`../enhanced-media-helper/architecture-enhanced-media-helper.md`
- EMH standalone：`../enhanced-media-helper/standalone-mode.md`
