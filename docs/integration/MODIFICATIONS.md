# MODIFICATIONS · docs/integration/

> 本目录协议：修改本目录任意文档前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。

## 项目约束（integration 文档域）

- 本目录只放**跨脚本协作协议**：当前仅 JCS ⇄ EMH 集成指南；后续新增跨项目协议（如扩展宿主与第三方库的双向协议细则）放此处。
- 单项目内部设计不得放本目录——JCS 文档去 `docs/jav-code-scanner/`，EMH 文档去 `docs/enhanced-media-helper/`。
- 协议文档必须写明**双向版本锚点**（如 scanner v1.5.71+ / EMH v3.7.2+），任一侧 API 变更时同步更新版本锚点与 API 参考表。
- 文档内引用其它目录文档一律用**相对路径**（如 `../jav-code-scanner/architecture-jav-code-scanner.md`）。
- 编码统一 UTF-8 **无 BOM**；中文正文。
- 引用完整性：本文档的 API 参考表与两侧架构文档、两侧源码 `mountPublicApi` / kit 暴露段必须三方一致。

## 2026-09-07 · 文档重组落位（迁移）

**功能**：按项目分域整理 docs/，跨脚本协议文档归入本目录。

**修改内容**：
- `integration-emh-scanner.md` 由 `git mv` 自 `docs/` 迁入，文内 3 处交叉引用更新为相对路径（jav-code-scanner、enhanced-media-helper、standalone 各 1 处）。

**涉及文件与位置**：
- `docs/integration/integration-emh-scanner.md`（迁移 + 引用修复 :132-134 区域）
