# MODIFICATIONS · docs/enhanced-media-helper/

> 本目录协议：修改本目录任意文档前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。

## 项目约束（enhanced-media-helper 文档域）

- 本目录只放 **Enhanced_Media_Helper（EMH）单项目文档**：架构说明、功能设计（如 standalone 模式）。
- 与 JCS 的协作协议放 `docs/integration/`；JCS 侧文档放 `docs/jav-code-scanner/`。
- 文档内引用其它目录文档一律用**相对路径**（如 `../integration/integration-emh-scanner.md`）。
- 文档头部必须标注对应脚本版本号（如 v3.7.2+），脚本版本推进时同步更新版本锚点与行号基准。
- 编码统一 UTF-8 **无 BOM**；中文正文，代码示例保留原格式。
- EMH 对外 API 以 `EMH_API`（mountPublicApi）为准；对外契约变更须同步核对 `docs/integration/integration-emh-scanner.md` 的 API 参考表。

## 2026-09-07 · 文档重组落位（迁移）

**功能**：按项目分域整理 docs/，EMH 文档归入本目录。

**修改内容**：
- `architecture-enhanced-media-helper.md` 由 `git mv` 自 `docs/` 迁入，文内 3 处交叉引用更新为相对路径（standalone 同目录、integration、jav-code-scanner 各 1 处）。
- `standalone-mode.md` 由 `git mv` 自 `docs/` 迁入（文内无外部引用，未改动内容）。

**涉及文件与位置**：
- `docs/enhanced-media-helper/architecture-enhanced-media-helper.md`（迁移 + 引用修复 :187-189 区域）
- `docs/enhanced-media-helper/standalone-mode.md`（纯迁移）
