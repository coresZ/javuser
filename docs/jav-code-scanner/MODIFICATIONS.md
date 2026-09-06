# MODIFICATIONS · docs/jav-code-scanner/

> 本目录协议：修改本目录任意文档前先完整读取本文件；修改完成后必须回填（功能 → 修改内容 → 涉及文件与位置）。新建功能性子目录时同步创建 MODIFICATIONS.md。

## 项目约束（jav-code-scanner 文档域）

- 本目录只放 **jav-code-scanner（JCS）单项目文档**：架构说明、对外契约、设计规范。
- 跨两脚本协作的协议文档放 `docs/integration/`；EMH 侧文档放 `docs/enhanced-media-helper/`。
- 文档内引用其它目录文档一律用**相对路径**（如 `../integration/integration-emh-scanner.md`）。
- 文档头部必须标注对应的脚本版本号（如 v1.5.72+），脚本改动推进时同步更新版本锚点。
- 编码统一 UTF-8 **无 BOM**；中文正文，代码示例保留原格式。
- 契约类文档（如 jcs-extension-contract.md）是对外发布物：改动契约语义时必须同步核对宿主实现章节（§11）与 JCS 源码一致性。

## 2026-09-07 · 文档重组落位 + 契约文档迁入（新增）

**功能**：按项目分域整理 docs/，JCS 文档归入本目录。

**修改内容**：
- `architecture-jav-code-scanner.md` 由 `git mv` 自 `docs/` 迁入，文内 3 处交叉引用更新为相对路径（integration ×2、enhanced-media-helper ×1）。
- `jcs-extension-contract.md`（契约 v1）自 `docs/` 根迁入本目录，文内 1 处引用更新为 `../integration/integration-emh-scanner.md`。

**涉及文件与位置**：
- `docs/jav-code-scanner/architecture-jav-code-scanner.md`（迁移 + 引用修复 :106/:233/:270-272 区域）
- `docs/jav-code-scanner/jcs-extension-contract.md`（迁移 + 引用修复 §10 表格）

## 2026-09-07 · JCS 扩展宿主契约 v1（新增，自 docs/ 根迁入）

**功能**：JCS 对外扩展宿主标准约定（actions / styles / mounts 三类扩展点）。

**修改内容**：契约 v1 全文（273 行）：两种接入形态、manifest 规范、ctx 对象、match 语法、生命周期、安全须知、M3U8 提取器示例、v1 边界、宿主实现对照。

**涉及文件与位置**：`docs/jav-code-scanner/jcs-extension-contract.md`

**关联决策**：JavCodeKit 既有方法签名全部保留；内置 lib/shot 按钮维持 `EMH_API` 直连；宿主版本实施时 v1.5.72 → v1.5.73。
