function pickElement() {
  return new Promise((resolve) => {
    let done = false;
    let phase = "hover";
    let hoverEl = null;
    let cands = [];
    let pickedType = "link";
    let pickedAction = "";
    const overlay = el("div", { class: "cores-ppk-picker-overlay" });
    const hint = el("div", { class: "cores-ppk-picker-bar", id: "cores-ppk-picker-hint" });
    const highlight = el("div", { class: "cores-ppk-picker-highlight hidden" });
    const cTitle = el("div", { class: "cores-ppk-picker-c-title", text: "确认对象与动作" });
    const cCands = el("div", { class: "cores-ppk-picker-cands" });
    const cInput = el("input", { type: "text", class: "cores-ppk-picker-input", placeholder: "可手动改写选择器" });
    const cTypeLabel = el("div", { class: "cores-ppk-picker-c-label", text: "对象类型" });
    const cTypes = el("div", { class: "cores-ppk-picker-c-chips" });
    const cActionLabel = el("div", { class: "cores-ppk-picker-c-label", text: "绑定动作" });
    const cActions = el("div", { class: "cores-ppk-picker-c-actions" });
    const cMeta = el("div", { class: "cores-ppk-picker-c-meta" });
    const okBtn = el("button", { type: "button", class: "cores-ppk-picker-btn primary", text: "确认" });
    const againBtn = el("button", { type: "button", class: "cores-ppk-picker-btn", text: "重新选" });
    const cancelBtn = el("button", { type: "button", class: "cores-ppk-picker-btn", text: "取消" });
    const cBtns = el("div", { class: "cores-ppk-picker-c-btns" }, againBtn, cancelBtn, okBtn);
    const confirm = el(
      "div",
      { class: "cores-ppk-picker-confirm hidden" },
      cTitle,
      cCands,
      cInput,
      cTypeLabel,
      cTypes,
      cActionLabel,
      cActions,
      cMeta,
      cBtns
    );
    uiAppend(overlay);
    uiAppend(hint);
    uiAppend(confirm);
    uiAppend(highlight);
    overlay.style.pointerEvents = "none";
    hint.style.pointerEvents = "none";
    confirm.style.pointerEvents = "auto";
    function finish(result) {
      if (done) return;
      done = true;
      cleanup();
      resolve(result);
    }
    function cleanup() {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseover", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      window.removeEventListener("scroll", onRepaint, true);
      window.removeEventListener("resize", onRepaint, true);
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      hint.remove();
      confirm.remove();
      highlight.remove();
    }
    function isOwn(node) {
      return isPpkNode(node);
    }
    function resolveTarget(raw) {
      let node = raw;
      if (!node || node.nodeType !== 1) node = node && node.parentElement;
      if (!node || node.nodeType !== 1) return null;
      if (isOwn(node)) return null;
      if (node.tagName === "SPAN" && node.parentElement) {
        const firstCls = String((node.className || "").toString().split(/\s+/).filter(Boolean)[0] || "");
        const p = node.parentElement;
        if ((!firstCls || !isStableClassName(firstCls)) && p && p !== document.body && p.tagName !== "BODY") {
          node = p;
        }
      }
      return node;
    }
    function pickFromPoint(x, y) {
      let nodes;
      try {
        nodes = document.elementsFromPoint(x, y);
      } catch {
        return null;
      }
      for (const node of nodes || []) {
        if (isOwn(node)) continue;
        return resolveTarget(node);
      }
      return null;
    }
    function paint(node) {
      const box = highlight;
      if (!node || !node.getBoundingClientRect) {
        box.classList.add("hidden");
        return;
      }
      const r = node.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) {
        box.classList.add("hidden");
        return;
      }
      box.style.left = Math.max(0, r.left) + "px";
      box.style.top = Math.max(0, r.top) + "px";
      box.style.width = r.width + "px";
      box.style.height = r.height + "px";
      box.classList.remove("hidden");
    }
    function onRepaint() {
      if (phase === "hover" && hoverEl) paint(hoverEl);
    }
    function onMove(e) {
      if (phase !== "hover") return;
      const node = pickFromPoint(e.clientX, e.clientY);
      if (node === hoverEl) return;
      hoverEl = node;
      paint(node);
      if (node) {
        const tag = node.tagName.toLowerCase();
        const cls = Array.prototype.slice.call(node.classList || []).filter(isStableClassName).slice(0, 2).join(".");
        hint.textContent = "取选：" + tag + (cls ? "." + cls : "") + (node.id ? "#" + node.id : "") + " · 单击选定 · Esc 取消";
      } else {
        hint.textContent = "取选：移动鼠标高亮，单击要操作的元素 · Esc 取消";
      }
    }
    function renderTypes() {
      cTypes.innerHTML = "";
      TARGET_TYPES.forEach((t) => {
        const btn = el("button", { type: "button", class: "cores-ppk-picker-chip" + (t === pickedType ? " is-on" : ""), text: TARGET_LABELS[t] });
        btn.addEventListener("click", () => {
          pickedType = t;
          renderTypes();
          renderActions();
        });
        cTypes.appendChild(btn);
      });
    }
    function renderActions() {
      cActions.innerHTML = "";
      const list = getActions(pickedType);
      if (!list.length) {
        cActions.appendChild(el("span", { class: "cores-ppk-picker-c-empty", text: "该类型暂无可用动作" }));
        return;
      }
      if (!list.some((a) => a.id === pickedAction)) {
        pickedAction = (list.find((a) => a.id === "popup-open") || list[0]).id;
      }
      list.forEach((a) => {
        const btn = el("button", {
          type: "button",
          class: "cores-ppk-picker-action" + (a.id === pickedAction ? " is-on" : ""),
          title: a.description || ""
        });
        btn.appendChild(el("span", { text: a.label }));
        btn.addEventListener("click", () => {
          pickedAction = a.id;
          renderActions();
        });
        cActions.appendChild(btn);
      });
    }
    function finishPick(node) {
      if (!node) return;
      cands = buildSelectorCandidates(node);
      if (!cands.length) return;
      phase = "confirm";
      pickedType = detectTargetType(node);
      highlight.classList.add("hidden");
      hint.classList.add("hidden");
      showConfirm();
    }
    function showConfirm() {
      renderTypes();
      renderActions();
      cCands.innerHTML = "";
      cands.forEach((c, i) => {
        const btn = el("button", { type: "button", class: "cores-ppk-picker-cand" + (i === 0 ? " is-on" : ""), title: c.note || "" });
        btn.appendChild(el("code", { text: c.sel }));
        btn.appendChild(el("em", { text: c.count + " 个" + (c.note ? " · " + c.note : "") }));
        btn.addEventListener("click", () => {
          cCands.querySelectorAll(".cores-ppk-picker-cand").forEach((b) => b.classList.remove("is-on"));
          btn.classList.add("is-on");
          cInput.value = c.sel;
          updateMeta(c.sel);
          try {
            const hit = document.body.querySelector(c.sel);
            if (hit) paint(hit);
          } catch {
          }
        });
        cCands.appendChild(btn);
      });
      cInput.value = cands[0].sel;
      updateMeta(cands[0].sel);
      confirm.classList.remove("hidden");
      cInput.focus();
      cInput.select();
    }
    function updateMeta(sel) {
      let n = 0;
      try {
        n = document.body.querySelectorAll(sel).length;
      } catch {
      }
      cMeta.textContent = "本页匹配 " + n + " 个元素";
    }
    function onClick(e) {
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (path.some((n) => n && n.classList && (n.classList.contains("cores-ppk-picker-confirm") || n.classList.contains("cores-ppk-picker-bar") || n.classList.contains("cores-ppk-picker-btn") || n.classList.contains("cores-ppk-picker-chip") || n.classList.contains("cores-ppk-picker-action") || n.classList.contains("cores-ppk-picker-cand")))) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      if (phase !== "hover") return;
      if (e.button != null && e.button !== 0) return;
      const node = pickFromPoint(e.clientX, e.clientY) || hoverEl;
      finishPick(node);
    }
    function onTouchEnd(e) {
      if (phase !== "hover") return;
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (path.some((n) => n && n.classList && (n.classList.contains("cores-ppk-picker-confirm") || n.classList.contains("cores-ppk-picker-bar")))) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      let node = null;
      try {
        const t = e.changedTouches && e.changedTouches[0];
        if (t) node = pickFromPoint(t.clientX, t.clientY);
      } catch {
      }
      node = node || hoverEl;
      finishPick(node);
    }
    function onKey(e) {
      if (e.key === "Escape") finish(null);
    }
    okBtn.addEventListener("click", () => {
      const v = cInput.value.trim();
      if (!v) return;
      finish({ selector: v, targetType: pickedType, action: pickedAction });
    });
    againBtn.addEventListener("click", () => {
      phase = "hover";
      confirm.classList.add("hidden");
      hint.classList.remove("hidden");
    });
    cancelBtn.addEventListener("click", () => finish(null));
    cInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = cInput.value.trim();
        if (v) finish({ selector: v, targetType: pickedType, action: pickedAction });
      }
    });
    cInput.addEventListener("input", () => {
      const v = cInput.value.trim();
      if (v) updateMeta(v);
    });
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseover", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("touchend", onTouchEnd, true);
    window.addEventListener("scroll", onRepaint, true);
    window.addEventListener("resize", onRepaint, true);
    document.addEventListener("keydown", onKey);
    hint.textContent = "取选：移动鼠标高亮，单击要操作的元素 · Esc 取消";
  });
}
