var POS_KEY = "ppk:toolbarPos";

function createRemotePanel() {
  const backdrop = el("div", { id: "cores-ppk-remote-backdrop", class: "cores-ppk-rules-panel-backdrop", onclick: () => close() });
  const closeBtn = el("button", { type: "button", class: "cores-ppk-panel-btn", title: "关闭", onclick: () => close() });
  closeBtn.appendChild(svgIcon("close", { size: 15 }));
  const header = el(
    "div",
    { id: "cores-ppk-remote-header", class: "cores-ppk-rules-panel-header" },
    el("span", { class: "cores-ppk-rules-title", text: "远程规则" }),
    el("span", { id: "cores-ppk-remote-host", class: "cores-ppk-rules-host", text: "全局订阅" }),
    closeBtn
  );
  const remoteBox = el("div", { class: "cores-ppk-rules-hosts cores-ppk-remote" });
  const body = el("div", { id: "cores-ppk-remote-body" }, remoteBox);
  const root = el("div", { id: "cores-ppk-remote-panel", class: "cores-ppk-rules-panel" }, header, body);
  uiAppend(backdrop);
  uiAppend(root);
  const toastEl = el("div", { id: "cores-ppk-remote-toast", class: "cores-ppk-rules-toast" });
  uiAppend(toastEl);
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 1800);
  }
  function formatRemoteTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      const p = (n) => (n < 10 ? "0" : "") + n;
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    } catch {
      return "";
    }
  }
  function renderRemote() {
    remoteBox.innerHTML = "";
    const cfg = getRemoteSettings();
    remoteBox.appendChild(el("div", { class: "cores-ppk-rules-hosts-title", text: "规则地址（改远端即可同步到所有网站）" }));
    const urlInput = el("input", {
      type: "url",
      class: "cores-ppk-remote-input",
      placeholder: "https://example.com/ppk-rules.json"
    });
    urlInput.value = cfg.url;
    const saveUrl = () => saveRemoteSettings({ url: urlInput.value.trim() });
    urlInput.addEventListener("change", saveUrl);
    urlInput.addEventListener("blur", saveUrl);
    const pull = (mode) => {
      saveRemoteSettings({ url: urlInput.value.trim(), mode });
      toast("正在拉取远程规则…");
      pullRemoteRules({ url: urlInput.value.trim(), mode, force: true }).then((res) => {
        renderRemote();
        if (res.ok) {
          try { ruleEngine.applyRules(window.location.hostname); } catch {}
        }
        toast(res.message || (res.ok ? "远程规则已更新" : "拉取失败"));
      });
    };
    const mergeBtn = el("button", { type: "button", class: "cores-ppk-rules-hosts-btn", text: "拉取合并" });
    mergeBtn.addEventListener("click", () => pull("merge"));
    const replaceBtn = el("button", { type: "button", class: "cores-ppk-rules-hosts-btn", text: "拉取替换" });
    replaceBtn.addEventListener("click", () => {
      if (!confirm("将用远程 JSON 覆盖脚本里的全部规则，确定？")) return;
      pull("replace");
    });
    remoteBox.appendChild(el("div", { class: "cores-ppk-remote-row" }, urlInput));
    const cleanBtn = el("button", { type: "button", class: "cores-ppk-rules-hosts-btn", text: "清理脏数据" });
    cleanBtn.addEventListener("click", () => {
      if (!confirm("将清空本脚本本地规则，再按远程地址重新拉取。确定？")) return;
      rulesManager.packs = [];
      rulesManager._loaded = true;
      gm.writeScriptValue(KEY, { version: 2, packs: [] });
      if (gm._cache) delete gm._cache[KEY];
      pull("replace");
    });
    remoteBox.appendChild(el("div", { class: "cores-ppk-remote-row" }, mergeBtn, replaceBtn, cleanBtn));
    const auto = el("input", { type: "checkbox" });
    auto.checked = !!cfg.auto;
    auto.addEventListener("change", () => {
      saveRemoteSettings({ url: urlInput.value.trim(), auto: auto.checked });
      toast(auto.checked ? "已开启打开网页时自动拉取" : "已关闭自动拉取");
    });
    remoteBox.appendChild(el("label", { class: "cores-ppk-remote-check" }, auto, el("span", { text: "打开网页时自动拉取" })));
    const when = formatRemoteTime(cfg.lastAt);
    const meta = when ? ("上次：" + when + (cfg.lastMsg ? " · " + cfg.lastMsg : "")) : "使用「导出全部配置」的 JSON。GitHub raw / gist / 自建静态地址均可。";
    remoteBox.appendChild(el("div", { class: "cores-ppk-remote-meta", text: meta }));
  }
  function open() {
    renderRemote();
    root.classList.add("visible");
    backdrop.classList.add("visible");
    closeBtn.focus();
  }
  function close() {
    root.classList.remove("visible");
    backdrop.classList.remove("visible");
  }
  return { open, close };
}

function createToolbar({ onManage, onRemote }) {
  const hostname = () => window.location.hostname;
  const btn = el("button", { type: "button", id: "cores-ppk-toolbar", title: "站点动作", onclick: () => onClick() });
  btn.appendChild(svgIcon("settings", { size: 18 }));
  const menu = el("div", { id: "cores-ppk-toolbar-menu", class: "hidden" });
  const backdrop = el("div", { id: "cores-ppk-toolbar-backdrop", class: "hidden", onclick: () => hide() });
  uiAppend(backdrop);
  uiAppend(menu);
  uiAppend(btn);
  function loadPos() {
    const all = gm.getValue(POS_KEY, {});
    return all && typeof all === "object" && all[hostname()] || null;
  }
  function savePos() {
    const all = gm.getValue(POS_KEY, {}) || {};
    const rect = btn.getBoundingClientRect();
    all[hostname()] = { left: rect.left + "px", top: rect.top + "px" };
    gm.setValue(POS_KEY, all);
  }
  function viewportSize() {
    const vv = window.visualViewport;
    return {
      w: Math.max(1, vv && vv.width ? vv.width : window.innerWidth),
      h: Math.max(1, vv && vv.height ? vv.height : window.innerHeight)
    };
  }
  function clampToolbar() {
    const size = viewportSize();
    const bw = Math.max(btn.offsetWidth || 42, 36);
    const bh = Math.max(btn.offsetHeight || 42, 36);
    const maxL = Math.max(4, size.w - bw - 4);
    const maxT = Math.max(4, size.h - bh - 4);
    const rect = btn.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    if (!Number.isFinite(left) || !Number.isFinite(top) || rect.width < 8 || rect.height < 8) {
      left = size.w - bw - 20;
      top = size.h - bh - 20;
    }
    left = Math.min(Math.max(4, left), maxL);
    top = Math.min(Math.max(4, top), maxT);
    btn.style.left = left + "px";
    btn.style.top = top + "px";
    btn.style.right = "auto";
    btn.style.bottom = "auto";
    btn.style.display = "flex";
    btn.style.opacity = "1";
    btn.style.visibility = "visible";
  }
  function applyPos() {
    const pos = loadPos();
    if (pos && pos.left) {
      btn.style.left = pos.left;
      btn.style.top = pos.top || "";
      btn.style.right = "auto";
      btn.style.bottom = "auto";
    }
    clampToolbar();
  }
  function resetPos() {
    const all = gm.getValue(POS_KEY, {}) || {};
    delete all[hostname()];
    gm.setValue(POS_KEY, all);
    btn.style.left = "";
    btn.style.top = "";
    btn.style.right = "";
    btn.style.bottom = "";
    clampToolbar();
  }
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    moved = false;
    const rect = btn.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    try {
      if (e.pointerId != null && btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
    } catch {
    }
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
    if (!moved) return;
    const size = viewportSize();
    const bw = Math.max(btn.offsetWidth || 42, 36);
    const bh = Math.max(btn.offsetHeight || 42, 36);
    const left = Math.max(4, Math.min(size.w - bw - 4, startLeft + dx));
    const top = Math.max(4, Math.min(size.h - bh - 4, startTop + dy));
    btn.style.left = left + "px";
    btn.style.top = top + "px";
    btn.style.right = "auto";
    btn.style.bottom = "auto";
  }
  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    clampToolbar();
    if (moved) savePos();
  }
  btn.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("resize", clampToolbar);
  window.addEventListener("orientationchange", clampToolbar);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", clampToolbar);
    window.visualViewport.addEventListener("scroll", clampToolbar);
  }
  function onClick() {
    if (moved) {
      moved = false;
      return;
    }
    toggle();
  }
  let visible = false;
  function render() {
    menu.innerHTML = "";
    const siteOn = rulesManager.isSiteEnabled(hostname());
    const title = el("div", { class: "cores-ppk-toolbar-menu-title", text: hostname() + " · 站点动作" + (siteOn ? "" : "（已关闭）") });
    const siteSw = el("input", { type: "checkbox", id: "cores-ppk-toolbar-site-sw" });
    siteSw.checked = siteOn;
    siteSw.addEventListener("change", () => {
      const enabled = siteSw.checked;
      rulesManager.setSiteEnabled(hostname(), enabled);
      if (!enabled) {
        ruleEngine.unapplyRules(hostname());
        showToast("本站规则已关闭");
      } else {
        ruleEngine.applyRules(hostname());
        showToast("本站规则已开启");
      }
      render();
    });
    const siteSwitchWrap = el("label", { class: "cores-ppk-switch" }, siteSw, el("span", { class: "cores-ppk-switch-track" }));
    const siteRow = el(
      "div",
      { class: "cores-ppk-toolbar-menu-site" },
      el("span", { class: "cores-ppk-toolbar-menu-site-label", text: "本站规则" }),
      siteSwitchWrap
    );
    const head = el("div", { class: "cores-ppk-toolbar-menu-head" }, title, siteRow);
    const list = el("div", { class: "cores-ppk-toolbar-menu-list" });
    if (siteOn) {
      const rules = rulesManager.getRules(hostname()).filter((r) => {
        const a = getAction(r.action);
        return r.enabled !== false && a && a.kind === "data";
      });
      rules.forEach((r) => {
          const action = getAction(r.action);
          let count = 0;
          try {
            count = document.querySelectorAll(r.selector).length;
          } catch {
          }
          const item = el("button", {
            type: "button",
            class: "cores-ppk-toolbar-menu-item",
            title: r.selector,
            onclick: () => {
              const res = executeDataRule(r);
              hide();
              showToast(res.message || (res.ok ? "已执行" : "未执行"));
            }
          });
          item.appendChild(el("span", { class: "cores-ppk-toolbar-menu-item-label", text: action.label }));
          item.appendChild(el("span", { class: "cores-ppk-toolbar-menu-item-meta", text: TARGET_LABELS[r.targetType] + " · " + count + " 个" }));
          list.appendChild(item);
      });
    }
    const applyBtn = el("button", {
      type: "button",
      class: "cores-ppk-toolbar-menu-manage",
      title: "把已有规则包绑定到当前域名，换线后不用重配选择器"
    }, el("span", { text: "应用到当前站" }), svgIcon("chevron", { size: 13 }));
    applyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openApplyToCurrentMenu(applyBtn);
    });
    const manage = el("button", {
      type: "button",
      class: "cores-ppk-toolbar-menu-manage",
      onclick: () => {
        hide();
        onManage?.();
      }
    }, el("span", { text: "管理规则" }), svgIcon("external", { size: 13 }));
    const remoteBtn = el("button", {
      type: "button",
      class: "cores-ppk-toolbar-menu-manage",
      onclick: () => {
        hide();
        onRemote?.();
      }
    }, el("span", { text: "远程规则" }), svgIcon("settings", { size: 13 }));
    const resetBtn = el("button", {
      type: "button",
      class: "cores-ppk-toolbar-menu-reset",
      title: "将按钮恢复到默认位置",
      onclick: () => {
        resetPos();
        hide();
        showToast("按钮位置已重置");
      }
    }, el("span", { text: "重置按钮位置" }));
    const foot = el("div", { class: "cores-ppk-toolbar-menu-foot" }, applyBtn, manage, remoteBtn, resetBtn);
    menu.appendChild(head);
    if (list.childNodes.length) menu.appendChild(list);
    menu.appendChild(foot);
  }
  function openApplyToCurrentMenu(anchor) {
    const candidates = rulesManager.listApplyCandidates(hostname());
    if (!candidates.length) {
      showToast("本地还没有可应用的规则包，请先远程拉取或在其它站配置");
      return;
    }
    const pick = candidates.filter((c) => !c.bound);
    const list = (pick.length ? pick : candidates).slice(0, 12);
    if (!pick.length) showToast("当前站已绑定全部规则包");
    const items = list.map((c) => ({ value: c.id, label: c.label }));
    openChoiceMenu(anchor, items, null, (packId) => {
      const res = rulesManager.bindPackToHostname(packId, hostname());
      if (res.ok) {
        rulesManager.setSiteEnabled(hostname(), true);
        try { ruleEngine.applyRules(hostname()); } catch {}
        hide();
        showToast(res.message || "已应用");
      } else {
        showToast(res.message || "应用失败");
      }
    });
  }
  function show() {
    render();
    const r = btn.getBoundingClientRect();
    let right = Math.max(8, window.innerWidth - r.right);
    let bottom = window.innerHeight - r.top + 8;
    const mh = Math.min(menu.offsetHeight || 300, window.innerHeight - 120);
    if (bottom + mh > window.innerHeight - 8) {
      bottom = Math.max(8, window.innerHeight - r.bottom - 8);
    }
    menu.style.left = "auto";
    menu.style.top = "auto";
    menu.style.right = right + "px";
    menu.style.bottom = bottom + "px";
    menu.classList.remove("hidden");
    backdrop.classList.remove("hidden");
    visible = true;
  }
  function hide() {
    menu.classList.add("hidden");
    backdrop.classList.add("hidden");
    visible = false;
  }
  function toggle() {
    if (visible) hide();
    else show();
  }
  function showToast(msg) {
    let t = uiGet("cores-ppk-toolbar-toast");
    if (!t) {
      t = el("div", { id: "cores-ppk-toolbar-toast" });
      uiAppend(t);
    }
    t.textContent = msg;
    t.classList.add("visible");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("visible"), 1800);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && visible) hide();
  });
  applyPos();
  return { btn, open: show, close: hide };
}
