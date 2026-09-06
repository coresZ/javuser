# MODIFICATIONS · docs/

> 本目录协议：修改本目录任意文件前先检查本文件及子目录 MODIFICATIONS.md；修改完成后必须回填对应层级。新建功能性子目录时，同步创建该目录的 MODIFICATIONS.md。

## 目录约定（2026-09-07 重组生效）

- 按项目分域，**不再直接在 docs/ 根下新建单项目文档**：
  - `docs/jav-code-scanner/` — JCS 单项目文档（架构、对外契约）
  - `docs/enhanced-media-helper/` — EMH 单项目文档（架构、功能设计）
  - `docs/integration/` — 跨脚本协作协议（JCS ⇄ EMH 集成等）
- 各子目录约束见各自 MODIFICATIONS.md；引用跨目录文档一律相对路径。
- 编码统一 UTF-8 无 BOM。
- 根目录仅保留本文件（目录级协议与重组记录）。

## 2026-09-07 · 文档重组（目录化）

**功能**：将 docs/ 内混合存放的多项目文档按项目分域重组。

**修改内容**：
- 新建三个项目子目录：`jav-code-scanner/`、`enhanced-media-helper/`、`integration/`，各配 MODIFICATIONS.md（项目约束 + 修改记录）。
- 4 份已跟踪文档 `git mv` 迁入（架构×2、standalone、integration）；未跟踪的契约文档直接迁入 JCS 目录。
- 修复 4 份文档共 10 处交叉引用为相对路径；写回统一去除 BOM。
- 本文件原记录的「JCS 扩展宿主契约 v1」条目随文档迁移至 `docs/jav-code-scanner/MODIFICATIONS.md`。

**涉及文件与位置**：
- `docs/jav-code-scanner/`（architecture-jav-code-scanner.md、jcs-extension-contract.md、MODIFICATIONS.md）
- `docs/enhanced-media-helper/`（architecture-enhanced-media-helper.md、standalone-mode.md、MODIFICATIONS.md）
- `docs/integration/`（integration-emh-scanner.md、MODIFICATIONS.md）
- `docs/MODIFICATIONS.md`（本文件，目录约定）

**状态**：重组完成；引用检查通过（无 `docs/architecture-*` / `docs/integration-emh-scanner` / `docs/standalone-mode` 旧路径残留）。
