# AGENTS.md

本仓库的开发约束。改代码或文档前先读本节。

## 全局约束

- **禁止自动提交**：除非用户主动明确要求（如「提交」「commit」「push」），不得执行 `git commit` / `git push` / `git merge` / `git branch -d` 等写操作。变更停留在工作区。
- **代码更新须递增版本号**：改脚本行为前，同步该脚本的版本号（用户脚本为 `@version`，以及同文件内的 `STYLE_VER` / `SCRIPT_VER` 等等价常量）。纯文档、配置、注释、不改变行为的排版，不递增版本号。
- **每一次修改代码都必须更新文档**，与代码改动同一轮完成，不得只改代码：
  1. 更新受影响的用户向 / 开发向文档，使描述与改后行为一致。不得留下已知过时的步骤、版本号或行为说明。
  2. 回填受影响目录的 `MODIFICATIONS.md`（功能 → 修改内容 → 涉及文件与位置）。
  3. 若行为变化会让某份文档整篇失真，且无法用小改对齐，删除该文档并改掉所有活引用；不要保留一份已知错误的说明。
- **MODIFICATIONS.md 协议**：修改任一目录前，先检查该目录及其祖先是否有 `MODIFICATIONS.md`。有则先完整读取并遵守。新建功能性子目录时，同步创建该目录的 `MODIFICATIONS.md`。

## 文档落点

| 改动 | 必须更新 |
|---|---|
| `jav-code-scanner.user.js` 的用户可见行为 | `docs/jav-code-scanner/README.md`；扩展契约有变时再改 `docs/jav-code-scanner/jcs-extension-contract.md` |
| `Enhanced_Media_Helper.js` / `webdev-library.user.js` | `docs/enhanced-media-helper/` 中描述该行为的文档 |
| JCS ⇄ EMH 桥、`EMH_API`、`JavCodeKit` 跨脚本面 | `docs/integration/integration-emh-scanner.md` |
| 根目录版本表、安装入口、工作流 | 仓库根 `README.md`；接手状态有变时再改 `PROJECT-STATUS.md` |
| 其它脚本目录（如 `18mh/`） | 该目录自己的说明与 `MODIFICATIONS.md` |

行号会随改动漂移。文档写函数名和行为，不把行号当长期锚点。
