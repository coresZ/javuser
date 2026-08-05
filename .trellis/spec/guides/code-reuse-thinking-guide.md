# Code Reuse Thinking Guide

> **Purpose**: Stop and think before creating new code - does it already exist?

---

## The Problem

**Duplicated code is the #1 source of inconsistency bugs.**

When you copy-paste or rewrite existing logic:
- Bug fixes don't propagate
- Behavior diverges over time
- Codebase becomes harder to understand

---

## Before Writing New Code

### Step 1: Search First

```bash
# Search for similar function names
grep -r "functionName" .

# Search for similar logic
grep -r "keyword" .
```

### Step 2: Ask These Questions

| Question | If Yes... |
|----------|-----------|
| Does a similar function exist? | Use or extend it |
| Is this pattern used elsewhere? | Follow the existing pattern |
| Could this be a shared utility? | Create it in the right place |
| Am I copying code from another file? | **STOP** - extract to shared |

---

## Common Duplication Patterns

### Pattern 1: Copy-Paste Functions

**Bad**: Copying a validation function to another file

**Good**: Extract to shared utilities, import where needed

### Pattern 2: Similar Components

**Bad**: Creating a new component that's 80% similar to existing

**Good**: Extend existing component with props/variants

### Pattern 3: Repeated Constants

**Bad**: Defining the same constant in multiple files

**Good**: Single source of truth, import everywhere

### Pattern 4: Repeated Payload Field Extraction

**Bad**: Multiple consumers cast the same JSON/event fields locally:

```typescript
const description = (ev as { description?: string }).description;
const context = (ev as { context?: ContextEntry[] }).context;
```

This is duplicated contract logic even when the code is only two lines. Each
consumer now has its own definition of what a valid payload means.

**Good**: Put the decoder, type guard, or projection next to the data owner:

```typescript
if (isThreadEvent(ev)) {
  renderThreadEvent(ev);
}
```

**Rule**: If the same untyped payload field is read in 2+ places, create a
shared type guard / normalizer / projection before adding a third reader.

---

## When to Abstract

**Abstract when**:
- Same code appears 3+ times
- Logic is complex enough to have bugs
- Multiple people might need this

**Don't abstract when**:
- Only used once
- Trivial one-liner
- Abstraction would be more complex than duplication

---

## After Batch Modifications

When you've made similar changes to multiple files:

1. **Review**: Did you catch all instances?
2. **Search**: Run grep to find any missed
3. **Consider**: Should this be abstracted?

### Reducers Should Use Exhaustive Structure

When state is derived from action-like values (`action`, `kind`, `status`,
`phase`), prefer a reducer with one `switch` over scattered `if/else` updates.

```typescript
// BAD - action-specific state transitions are hard to audit
if (action === "opened") { ... }
else if (action === "comment") { ... }
else if (action === "status") { ... }

// GOOD - one reducer owns the transition table
switch (event.action) {
  case "opened":
    ...
    return;
  case "comment":
    ...
    return;
}
```

This matters when the event log is the source of truth. A reducer is the
documented replay model; display code and commands should not duplicate pieces
of that replay model.

---

## Checklist Before Commit

- [ ] Searched for existing similar code
- [ ] No copy-pasted logic that should be shared
- [ ] No repeated untyped payload field extraction outside a shared decoder
- [ ] Constants defined in one place
- [ ] Similar patterns follow same structure
- [ ] Reducer/action transitions live in one reducer or command dispatcher

---

## Userscript Capability Extraction Pattern（javuser → favjs kit）

> **⚠️ 2026-08-06 已废弃**：首个实践项目 `jav-code-detector-kit` 因用户判定「失败」已删除。以下技术结论仍有效（来自实测），但**模式本身未经受住实践验证**，未来做类似抽取前先与用户确认价值与维护意愿，不要默认套用。

**Problem**: javuser 用户脚本能力（番号检测/高亮/弹窗等）被多个脚本复用时，若继续 copy-paste，bug 修复不传播、行为漂移。

**Solution**: 跨仓库抽取为独立 kit 项目。javuser 是源仓库，`D:\source\favjs\` 下放可复用的 kit 项目（独立 git 仓库），消费方用 `@require` 引入、以全局对象调用。

```
javuser/jav-code-scanner.user.js  (源，只读参考，不改动)
  └── 抽取能力 → D:\source\favjs\jav-code-detector-kit
        src/ + esbuild + banner.txt → dist/jav-code-detector-kit.js
        globalName 'JavCodeDetector' 暴露 window.JavCodeDetector
  消费方：page-picker-kit 等 @require 该产物
```

**三层抽象**（检测/高亮/动作）：
- **检测层**：纯函数，零 DOM 零 GM（extract/extractAll/fromDmmCid/makeCode）——任何脚本可直接复用
- **高亮层**：DOM 操作（linkify/clear），产物为色标 `[data-code]`
- **动作层**：可插拔注册表（`registerAction({id,label,available,run})`），点击策略经 `onCodeClick: 'search' | 'menu' | fn(ctx)` 切换

**Why**: 分层使「检测」「高亮」「动作」可独立复用；动作策略化让「点击直接搜索」vs「点击弹菜单」只是配置差异。

**关键约定**：
- kit 目录结构参照 `popup-viewer-v2`：`package.json`（scripts build/dev）、`build.mjs`（esbuild iife + globalName）、`banner.txt`（`==UserScript==` 头）、`src/`、`dist/`
- GM 依赖能力（如字幕 API）在动作层 `available()` 返回 false，无 GM 时菜单自动隐藏——库本身零硬依赖
- 抽取时行为零改动：直接搬运 + 样例矩阵比对（FC2/HEYZO/紧凑/带店码 CID 各形态）验证一致性
- 需 `@grant` 的能力（GM_xmlhttpRequest 等）在 banner 声明，但实现上带降级路径

### Gotcha: esbuild globalName 返回的是 CommonJS 包装

**Problem**: `globalName: 'JavCodeDetector'` 产物末尾是 `var JavCodeDetector = __toCommonJS(index_exports)`，返回 `{ default: kit, ... }` 而非 kit 本体。

**Fix**: 在 `src/index.js` 内部显式 `window.JavCodeDetector = kit` 兜底赋值，调用方读 `window.JavCodeDetector` 而不是 esbuild 生成的全局变量。

### Gotcha: 裸引用 `GM` 抛 ReferenceError

**Problem**: `typeof GM_xmlhttpRequest === 'function' || typeof GM.xmlHttpRequest === 'function'` 在无 GM 环境直接抛 `ReferenceError: GM is not defined`。

**Fix**:
```javascript
function hasGmHttp() {
  if (typeof GM_xmlhttpRequest === 'function') return true;
  if (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') return true;
  return false;
}
```

### 同步策略

检测/高亮逻辑从源脚本搬运后，源脚本后续改进需回同步（README 注明出处与同步职责）。每次同步用样例矩阵回归。

---

## Gotcha: Python if/elif/else Exhaustive Check

**Problem**: Python's if/elif/else chains have no compile-time exhaustive check. When you add a new value to a `Literal` type (e.g., `Platform`), existing if/elif/else chains silently fall through to `else` with wrong defaults.

**Symptom**: New platform works partially — some methods return Claude defaults instead of platform-specific values. No error is raised.

**Example** (`cli_adapter.py`):
```python
# BAD: "gemini" falls through to else, returns "claude"
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    else:
        return "claude"  # gemini silently gets "claude"!

# GOOD: explicit branch for every platform
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    elif self.platform == "gemini":
        return "gemini"
    else:
        return "claude"
```

**Prevention**: When adding a new value to a Python `Literal` type, search for ALL if/elif/else chains that switch on that type and add explicit branches. Don't rely on `else` being correct for new values.

---

## Gotcha: Asymmetric Mechanisms Producing Same Output

**Problem**: When two different mechanisms must produce the same file set (e.g., recursive directory copy for init vs. manual `files.set()` for update), structural changes (renaming, moving, adding subdirectories) only propagate through the automatic mechanism. The manual one silently drifts.

**Symptom**: Init works perfectly, but update creates files at wrong paths or misses files entirely.

**Prevention**:
- **Best**: Eliminate the asymmetry — have the manual path call the automatic one (e.g., `collectTemplateFiles()` calls `getAllScripts()` instead of maintaining its own list)
- **If asymmetry is unavoidable**: Add a regression test that compares outputs from both mechanisms
- When migrating directory structures, search for ALL code paths that reference the old structure

**Real example**: `trellis update` had a manual `files.set()` list for 11 scripts that `getAllScripts()` already tracked. Fix: replaced the manual list with a `for..of getAllScripts()` loop. See `update.ts` refactor in v0.4.0-beta.3.

---

## Template File Registration (Trellis-specific)

When adding new files to `src/templates/trellis/scripts/`:

**Single registration point**: `src/templates/trellis/index.ts`

1. Add `export const xxxScript = readTemplate("scripts/path/file.py");`
2. Add to `getAllScripts()` Map

That's it. `commands/update.ts` uses `getAllScripts()` directly — no manual sync needed.

**Why this matters**: Without registration in `getAllScripts()`, `trellis update` won't sync the file to user projects. Bug fixes and features won't propagate.

**History**: Before v0.4.0-beta.3, `update.ts` had its own hand-maintained file list that frequently fell out of sync with `getAllScripts()`. This caused 11 Python files to be silently skipped during `trellis update`. The fix was to eliminate the duplicate list and use `getAllScripts()` as the single source of truth.

### Quick Checklist for New Scripts

```bash
# After adding a new .py file, verify it's in getAllScripts():
grep -l "newFileName" src/templates/trellis/index.ts  # Should match
```

### Template Sync Convention

`.trellis/scripts/` (dogfooded) and `packages/cli/src/templates/trellis/scripts/` (template) must stay identical. After editing `.trellis/scripts/`, always sync:

```bash
rsync -av --delete --exclude='__pycache__' .trellis/scripts/ packages/cli/src/templates/trellis/scripts/
```

**Gotcha**: Running rsync with wrong source/destination paths can create nested garbage directories (e.g., `.trellis/scripts/packages/cli/...`). Always double-check paths before running.
