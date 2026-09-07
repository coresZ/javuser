# MODIFICATIONS · .opencode/skills/

> 本目录协议：新增/修改 skill 前先检查本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。新建 skill 子目录时同步在此登记。

## 目录约束

- 本目录是**项目级 skills**（opencode 平台加载，frontmatter `name` + `description`）；与 `.opencode/skills/trellis-*` 系统技能并列，新增业务 skill 不得覆盖/修改 trellis-* 目录。
- skill 命名 kebab-case；SKILL.md 正文为可执行工作流（模板/清单/常见坑），不留占位符。
- 引用项目内文档一律相对仓库根写明路径（如 `docs/jav-code-scanner/jcs-extension-contract.md`）。

## 2026-09-07 · jcs-build skill（新增，原名 jcs-extension-dev 后更名）

**功能**：把「为 JCS 扩展宿主写扩展」的方法论沉淀为可加载 skill，供后续会话在用户要求写 JCS 扩展/改造油猴脚本接入时直接调用。

**修改内容**：
- 新建 `.opencode/skills/jcs-build/SKILL.md`（原目录名 `jcs-extension-dev`，按用户要求更名）：宿主环境事实（两种形态/GM 可用性）、manifest 模板与校验规则、ctx 对象、三保险握手模板、生命周期要点表 + 5 条常见坑、参考实现指引（契约 §9 M3U8 示例 + `tools/test-extension.js`）、7 步自测验收清单、宿主侧排障锚点。

**涉及文件与位置**：
- `.opencode/skills/jcs-build/SKILL.md`（新建）

## 2026-09-07 · Jable 实时预览扩展改造（新增参考实现）

**功能**：把「Jable 3年前视频也支持时间条实时预览」（greasyfork 581315）改造成契约 v1 mounts 型扩展，作为第二个参考实现。

**修改内容**：
- 新建 `tools/jable-live-preview.extension.js`（manifest id `jable-live-preview`，`match: ['*.jable.tv']`）：原 boot 轮询搬进 `mount(ctx)`；路径判断 `/videos/` 移入 mount 内（宿主 match 只到 host）；state 全部移入 mount 闭包支持宿主 SPA 重放；UI/样式 id 改 `jcs-ext-{id}` 前缀；新增总 `ctx.onCleanup`——boot 重试 timer、seek throttle、`hls.destroy()`、进度条事件监听（具名引用可解绑）、fullscreenchange/beforeunload、预览 box 与样式标签全量清理。
- 官方 VTT 检测跳过、HLS 取流、节流 seek 等原逻辑不变；`@match` 放宽为 `https://jable.tv/*`（非视频页 mount 空转），形态 A/B 共用一份代码。

**涉及文件与位置**：
- `tools/jable-live-preview.extension.js`（新建，~600 行）

**状态**：`node --check` + 契约断言（前缀/onCleanup 全量/握手）通过；未提交。

**关联**：规范源 `docs/jav-code-scanner/jcs-extension-contract.md`（契约 v1）；宿主实现 JCS v1.5.73。
