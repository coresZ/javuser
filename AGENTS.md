# AGENTS.md

本仓库的开发约束。改代码或文档前先读本节。

## 全局约束

- **禁止自动提交**：除非用户主动明确要求（如「提交」「commit」「push」），不得执行 `git commit` / `git push` / `git merge` / `git branch -d` 等写操作。变更停留在工作区。
- **代码更新须递增版本号**：改脚本行为前，同步该脚本的版本号。纯文档、配置、注释、不改变行为的排版，不递增版本号。
  - 版本号可能有多处，**必须全部同步**：JCS 是 `@version` + `STYLE_VER` + `SCRIPT_VER`；EMH 是 `@version` + `EMH_API.version`；其余脚本为 `@version`。
  - 本仓库无 `package.json`、无构建产物、无 `dist/`，不要去找它们。
- **每一次修改代码都必须更新文档**，与代码改动同一轮完成，不得只改代码：
  1. 更新受影响的用户向 / 开发向文档，使描述与改后行为一致。不得留下已知过时的步骤、版本号或行为说明。
  2. 回填仓库根 `MODIFICATIONS.md` 的对应目录小节（功能 → 修改内容 → 涉及文件与位置）。
  3. 若行为变化会让某份文档整篇失真，且无法用小改对齐，删除该文档并改掉所有活引用；不要保留一份已知错误的说明。

## MODIFICATIONS.md 协议（单文件制）

**本仓库只在根目录维护一份 `MODIFICATIONS.md`，按目录分节记录。禁止新建子目录级 `MODIFICATIONS.md`。**

- **改前必读**：修改任何文件前，先完整读取根 `MODIFICATIONS.md`，找到覆盖该路径的小节，遵守其中记录的规则、验证基线与已知取舍。
- **改后必回填**：修改完成后，在**同一小节**追加记录，格式为「功能 → 修改内容 → 涉及文件与位置」。
- **小节划分**：

| 小节 | 覆盖路径 |
|---|---|
| 一、仓库根目录 | 根目录脚本（`webdev-library.user.js`、`18mh/` 以外的根级 `.js`）与根级文档 |
| 二、dock/ | `dock/` 下全部脚本 |
| 三、18mh/ | `18mh/` |
| 四、dock/docs/jav-code-scanner/ | JCS 文档域 |
| 五、dock/docs/enhanced-media-helper/ | EMH 文档域 |
| 六、dock/docs/integration/ | 跨脚本协议文档域 |
| 七、docs/superpowers/ | 设计 spec |
| 八、.opencode/skills/ | 项目级 skills |

- **新增目录**：若新目录不属于上表任何小节，在根 `MODIFICATIONS.md` 末尾新增一节，并在上表补一行。不要为新目录建独立文件。
- 该文件已合并历史记录，早期条目里出现 `docs/xxx/MODIFICATIONS.md` 之类的路径是历史事实，不是当前结构。

## 文档落点

| 改动 | 必须更新 |
|---|---|
| `dock/jav-code-scanner.user.js` 的用户可见行为 | `dock/docs/jav-code-scanner/README.md`；扩展契约有变时再改 `dock/docs/jav-code-scanner/jcs-extension-contract.md` |
| `dock/Enhanced_Media_Helper.js` / `webdev-library.user.js` | `dock/docs/enhanced-media-helper/` 中描述该行为的文档 |
| `dock/` 内悬浮坞脚本的目录或接入行为 | `dock/docs/page-dock.md`，并同步仓库根 `README.md` |
| JCS ⇄ EMH 桥、`EMH_API`、`JavCodeKit` 跨脚本面 | `dock/docs/integration/integration-emh-scanner.md` |
| 根目录版本表、安装入口、工作流 | 仓库根 `README.md` |
| `18mh/` | `18mh/` 内说明文档与根 `MODIFICATIONS.md` 的「三、18mh/」小节 |

行号会随改动漂移。文档写函数名和行为，不把行号当长期锚点。

## 滚动条规范（强制）

**核心要求：滚动条不允许有任何背景色。轨道（track）必须透明，只美化 thumb。** 深浅主题都只调 thumb，绝不铺整条底色。

### 必须同时处理的三件事

1. **显式声明轨道透明**：不写 track 规则时浏览器会绘制原生底色（尤其深色模式下是中性灰块，与深色页面严重色差）。
2. **同时覆盖两套语法**：`scrollbar-color`（Firefox/新版 Chromium）+ `::-webkit-scrollbar-*`（Safari/WebKit）。
3. **检查 `color-scheme`**：`<meta name="color-scheme" content="dark">` 或 CSS `color-scheme: dark` 会启用**原生深色滚动条**，即使没写任何滚动条 CSS 也会出现灰底轨道。这是「页面莫名有滚动条背景」的最常见根因——排查时先查它，再查 `::-webkit-scrollbar`。

### 标准写法（照此实现）

```css
/* Firefox + 新版 Chromium：track 用 transparent */
html { scrollbar-color: #3a4760 transparent; scrollbar-width: thin; }

/* WebKit：轨道显式透明，thumb 用 border + background-clip 做留边 */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track,
::-webkit-scrollbar-corner { background: transparent; }   /* 关键，不可省略 */
::-webkit-scrollbar-thumb {
  background: #3a4760;
  border-radius: 999px;
  border: 2px solid transparent;        /* 制造内缩留边 */
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background: #4a5a78; }
```

配色用主题变量，不要硬编码（示例中的 `#3a4760` 仅为占位，应换成项目 `--muted` / `--line` 一类的语义色）。

### 禁止项

- ❌ `::-webkit-scrollbar-track { background: #fff / rgba(255,255,255,.05) / 任意色 }`
- ❌ `::-webkit-scrollbar { background: ... }`（会染到轨道）
- ❌ 只写 thumb 而不写 track 透明（会回落原生底色）
- ❌ 只写 `::-webkit-scrollbar` 而漏 `scrollbar-color`（Firefox 无效果）
- ❌ 用 `scrollbar-gutter: stable` 当作「美化」（它只预留空槽，反而让无色槽位更显眼，且不解决底色问题）

### 例外与验证

- 唯一例外：整条滚动条被有意隐藏（`@media (hover:none),(pointer:coarse)` 下 `scrollbar-width:none` + `::-webkit-scrollbar{display:none}`）。
- 验证：改完后实际滚动一次检查——轨道区域应与父元素背景**完全同色（视觉不可见）**，只剩 thumb；深色/浅色两套主题都要看。

## 排查纪律

- **先取证再下结论**：报告「某个页面/功能有问题」时，先定位到具体文件行号与根因，再给结论；不要凭猜测回答。
- **区分「项目没做」与「规则没生效」**：AI 的指令性规则不会被自动应用到历史代码。若历史页面不符合某规则，说明该规则写入前已存在问题，而不是规则失效——除非该规则明确要求「主动扫描修复」。
- **报根因不报现象**：例如「滚动条有背景」应回答为「`color-scheme: dark` 触发原生深色轨道，且项目未写 track 透明」，而不是复述现象。
- **只读排查不动文件**：用户说「排查/不要改」时，只读不写，并在结论中标注「本次未修改任何文件」。

## 交付纪律

- **改动范围最小化**：只改用户要求的部分，不顺带重构、不调整无关代码风格、不删除看似「没用」的代码。
- **不夸大完成度**：未验证的部分要如实说明「未验证/待真机确认」，不要把「写了代码」说成「已通过测试」。
- **报告结论时给证据**：涉及统计、排查、验证的结论，附上命令输出或文件行号作为依据。
- **用户脚本文件名含空格与 `&`**（如 `jable & miss.user.js`），shell 操作一律加引号。
- **编码统一 UTF-8 无 BOM、LF 换行**。
