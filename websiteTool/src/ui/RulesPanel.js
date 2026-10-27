var REMOTE_KEY = "ppk:remote";
var DEFAULT_REMOTE_URL = "https://raw.githubusercontent.com/coresZ/javuser/refs/heads/main/websiteTool/config/cores-ppk-rules-all.json";
function getRemoteSettings() {
  const raw = (gm.readScriptValue ? gm.readScriptValue(REMOTE_KEY, null) : null) || gm.getValue(REMOTE_KEY, null);
  let url = "";
  let auto = true;
  let mode = "merge";
  let lastAt = "";
  let lastMsg = "";
  let lastHash = "";
  if (raw && typeof raw === "object") {
    url = String(raw.url || "").trim();
    auto = raw.auto !== false;
    mode = raw.mode === "replace" ? "replace" : "merge";
    lastAt = raw.lastAt || "";
    lastMsg = raw.lastMsg || "";
    lastHash = raw.lastHash || "";
  } else if (typeof raw === "string") {
    url = raw.trim();
  }
  if (!url) url = DEFAULT_REMOTE_URL;
  return { url, auto, mode, lastAt, lastMsg, lastHash };
}
function saveRemoteSettings(next) {
  const cur = Object.assign(getRemoteSettings(), next || {});
  if (gm.writeScriptValue) gm.writeScriptValue(REMOTE_KEY, cur);
  else gm.setValue(REMOTE_KEY, cur);
  return cur;
}
function hashText(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function fetchRemoteText(url) {
  return new Promise((resolve, reject) => {
    const done = (status, body) => {
      if (status >= 200 && status < 300) resolve(String(body || ""));
      else reject(new Error("HTTP " + status));
    };
    const fn = gm.xmlhttpRequest;
    if (typeof fn === "function") {
      try {
        const ret = fn({
          method: "GET",
          url,
          timeout: 15e3,
          anonymous: true,
          onload: (res) => done(res.status || 0, res.responseText),
          onerror: () => reject(new Error("网络错误")),
          ontimeout: () => reject(new Error("超时"))
        });
        if (ret && typeof ret.then === "function") {
          ret.catch((err) => reject(err || new Error("网络错误")));
        }
        return;
      } catch (err) {
        /* fall through to fetch */
      }
    }
    fetch(url, { method: "GET", cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    }).then(resolve).catch((err) => reject(err || new Error("网络错误")));
  });
}
function pullRemoteRules(opts) {
  const options = opts || {};
  const cfg = getRemoteSettings();
  const url = String(options.url != null ? options.url : cfg.url).trim();
  const mode = options.mode || cfg.mode || "merge";
  if (!url) return Promise.resolve({ ok: false, message: "请先填写远程规则地址" });
  if (!isSafeUrl(url)) return Promise.resolve({ ok: false, message: "只支持 http/https 地址" });
  return fetchRemoteText(url).then((text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return { ok: false, message: "远程内容为空" };
    const digest = hashText(trimmed);
    if (!options.force && cfg.lastHash && cfg.lastHash === digest && mode === cfg.mode) {
      const skip = saveRemoteSettings({ url, mode, lastAt: new Date().toISOString(), lastMsg: "远程无变化", lastHash: digest });
      return { ok: true, skipped: true, message: "远程规则无变化", settings: skip };
    }
    const res = rulesManager.importConfig(trimmed, mode);
    const next = saveRemoteSettings({
      url,
      mode,
      lastAt: new Date().toISOString(),
      lastMsg: res.message || (res.ok ? "同步成功" : "同步失败"),
      lastHash: res.ok ? digest : cfg.lastHash
    });
    return Object.assign({ settings: next }, res);
  }).catch((err) => {
    const msg = "拉取失败：" + ((err && err.message) || "网络错误");
    saveRemoteSettings({ url, mode, lastAt: new Date().toISOString(), lastMsg: msg });
    return { ok: false, message: msg };
  });
}

function createRulesPanel({ onClose }) {
  const hostname = () => window.location.hostname;
  let picking2 = false;
  const backdrop = el("div", { id: "cores-ppk-rules-panel-backdrop", onclick: () => close() });
  const closeBtn = el("button", { type: "button", class: "cores-ppk-panel-btn", title: "关闭 (Esc)", onclick: () => close() });
  closeBtn.appendChild(svgIcon("close", { size: 15 }));
  const hostEl = el("span", { id: "cores-ppk-rules-host" });
  const siteSw = el("input", { type: "checkbox", id: "cores-ppk-rules-site-sw" });
  const siteSwitchWrap = el("label", { class: "cores-ppk-switch", title: "本站全部规则开关" }, siteSw, el("span", { class: "cores-ppk-switch-track" }));
  const themeBtn = el("button", { type: "button", class: "cores-ppk-panel-btn", title: "切换浅色 / 深色", onclick: () => toggleTheme() });
  themeBtn.appendChild(svgIcon("moon", { size: 15 }));
  const header = el(
    "div",
    { id: "cores-ppk-rules-panel-header" },
    el("span", { class: "cores-ppk-rules-title", text: "站点规则" }),
    hostEl,
    themeBtn,
    siteSwitchWrap,
    closeBtn
  );
  const listEl = el("div", { id: "cores-ppk-rules-list" });
  const hostsBox = el("div", { class: "cores-ppk-rules-hosts" });
  const pickBtn = el(
    "button",
    { type: "button", id: "cores-ppk-rules-pick", title: "在页面上点选要操作的元素", onclick: () => startPick() },
    svgIcon("target", { size: 15 }),
    el("span", { text: "取选对象" })
  );
  const exportBtn = el("button", { type: "button", class: "cores-ppk-rules-io", title: "导出当前规则包或全部配置" });
  exportBtn.appendChild(el("span", { text: "导出" }));
  const importBtn = el("button", { type: "button", class: "cores-ppk-rules-io", title: "从 JSON 文件或剪贴板导入" });
  importBtn.appendChild(el("span", { text: "导入" }));
  const ioRow = el("div", { class: "cores-ppk-rules-io-row" }, exportBtn, importBtn, pickBtn);
  const fileInput = el("input", { type: "file", accept: "application/json,.json,text/plain", style: "display:none" });
  const body = el(
    "div",
    { id: "cores-ppk-rules-panel-body" },
    el("div", { class: "cores-ppk-rules-tip", text: "点击「取选对象」生成规则。一套规则可绑定多个网址（支持 *.example.com）。配置可导出/导入 JSON。" }),
    hostsBox,
    listEl
  );
  const foot = el("div", { id: "cores-ppk-rules-panel-foot" }, ioRow, fileInput);
  const root = el("div", { id: "cores-ppk-rules-panel" }, header, body, foot);
  uiAppend(backdrop);
  uiAppend(root);
  const toastEl = el("div", { id: "cores-ppk-rules-toast" });
  uiAppend(toastEl);
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 1800);
  }
  function open() {
    root.classList.add("visible");
    backdrop.classList.add("visible");
    siteSw.checked = rulesManager.isSiteEnabled(hostname());
    renderList();
    closeBtn.focus();
  }
  function close() {
    if (picking2) return;
    root.classList.remove("visible");
    backdrop.classList.remove("visible");
    toastEl.classList.remove("visible");
    onClose?.();
  }
  function countMatches2(sel) {
    try {
      return document.querySelectorAll(sel).length;
    } catch {
      return 0;
    }
  }
  function downloadJson(filename, obj) {
    const text = JSON.stringify(obj, null, 2);
    const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(text);
    if (!gmDownload(filename, dataUrl)) downloadViaAnchor(filename, dataUrl);
  }
  function renderHosts() {
    hostsBox.innerHTML = "";
    const hosts = rulesManager.getPackHosts(hostname());
    const title = el("div", { class: "cores-ppk-rules-hosts-title", text: "适用网址（一套规则可多站共用）" });
    const chips = el("div", { class: "cores-ppk-rules-hosts-chips" });
    hosts.forEach((h) => {
      const chip = el("span", { class: "cores-ppk-rules-host-chip" + (h === hostname().toLowerCase() || hostMatches(h, hostname()) ? " is-current" : "") });
      chip.appendChild(el("span", { text: h }));
      const rm = el("button", {
        type: "button",
        class: "cores-ppk-rules-host-rm",
        title: "移除此网址",
        text: "×",
        onclick: (e) => {
          e.stopPropagation();
          if (hosts.length <= 1) {
            toast("至少保留一个网址");
            return;
          }
          const next = hosts.filter((x) => x !== h);
          // 不允许删到当前站完全不匹配
          if (!next.some((pat) => hostMatches(pat, hostname()) || pat === hostname().toLowerCase())) {
            toast("不能移除当前站点");
            return;
          }
          rulesManager.setPackHosts(hostname(), next);
          renderList();
          toast("已更新适用网址");
        }
      });
      chip.appendChild(rm);
      chips.appendChild(chip);
    });
    const addRow = el("div", { class: "cores-ppk-rules-hosts-add" });
    const input = el("input", {
      type: "text",
      class: "cores-ppk-rules-hosts-input",
      placeholder: "添加域名，如 www.example.com 或 *.example.com"
    });
    const addBtn = el("button", {
      type: "button",
      class: "cores-ppk-rules-hosts-btn",
      text: "添加",
      onclick: () => {
        const v = input.value.trim();
        if (!v) return;
        const next = [...hosts, v];
        rulesManager.setPackHosts(hostname(), next);
        input.value = "";
        renderList();
        toast("已添加网址");
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addBtn.click();
      }
    });
    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    hostsBox.appendChild(title);
    hostsBox.appendChild(chips);
    hostsBox.appendChild(addRow);
  }
  function renderList() {
    dismissChoiceMenus();
    listEl.innerHTML = "";
    const siteOn = rulesManager.isSiteEnabled(hostname());
    root.classList.toggle("site-disabled", !siteOn);
    // 面板编辑用主规则包，避免多包合并后索引错乱
    const rules = rulesManager.getPackRules(hostname());
    const hosts = rulesManager.getPackHosts(hostname());
    const allPacks = rulesManager.getPacks() || [];
    const allHosts = [];
    const seenAll = Object.create(null);
    for (const p of allPacks) {
      for (const h of p.hosts || []) {
        if (!h || seenAll[h]) continue;
        seenAll[h] = 1;
        allHosts.push(h);
      }
    }
    hostEl.textContent = hostname() + "（本站 " + rules.length + " 条 · 全局 " + allHosts.length + " 站）" + (siteOn ? "" : " · 已关闭");
    hostEl.title = allHosts.length ? ("全局域名：" + allHosts.join("、")) : "";
    renderHosts();
    if (!rules.length) {
      const empty = el("div", { class: "cores-ppk-rules-empty" });
      empty.appendChild(el("span", { text: "还没有规则" }));
      empty.appendChild(el("small", { text: "点击「取选对象」新建，或把已有规则包应用到当前站" }));
      const candidates = rulesManager.listApplyCandidates(hostname()).filter((c) => !c.bound);
      if (candidates.length) {
        const applyRow = el("div", { class: "cores-ppk-rules-io-row", style: "justify-content:center;margin-top:8px;flex-wrap:wrap;gap:6px" });
        candidates.slice(0, 5).forEach((c) => {
          const b = el("button", {
            type: "button",
            class: "cores-ppk-rules-io",
            title: c.meta || c.label,
            text: c.label,
            onclick: () => {
              const res = rulesManager.bindPackToHostname(c.id, hostname());
              if (res.ok) {
                rulesManager.setSiteEnabled(hostname(), true);
                try { ruleEngine.applyRules(hostname()); } catch {}
                renderList();
              }
              toast(res.message || (res.ok ? "已应用" : "应用失败"));
            }
          });
          applyRow.appendChild(b);
        });
        empty.appendChild(applyRow);
      }
      listEl.appendChild(empty);
      return;
    }
    rules.forEach((r, i) => {
      const count = countMatches2(r.selector);
      const row = el("div", { class: "cores-ppk-rules-row" + (r.enabled === false || !siteOn ? " disabled" : "") });
      const sw = el("input", { type: "checkbox", id: "cores-ppk-rules-sw-" + i });
      sw.checked = r.enabled !== false;
      sw.addEventListener("change", () => {
        const rule = rulesManager.getRule(hostname(), i);
        if (!rule) return;
        const action2 = getAction(rule.action);
        if (!sw.checked) {
          rulesManager.toggleRule(hostname(), i);
          if (action2 && action2.kind === "apply") ruleEngine.unapplyRule(rule);
          toast("已停用");
        } else {
          rulesManager.toggleRule(hostname(), i);
          ruleEngine.applyRules(hostname());
          toast("已启用");
        }
        renderList();
      });
      const switchWrap = el("label", { class: "cores-ppk-switch" }, sw, el("span", { class: "cores-ppk-switch-track" }));
      const top = el(
        "div",
        { class: "cores-ppk-rules-row-top" },
        el("div", { class: "cores-ppk-rules-row-sel", text: r.selector }),
        switchWrap
      );
      const available = getActions(r.targetType);
      const currentAction = available.find((a) => a.id === r.action) || available[0];
      const actionSel = el("button", { type: "button", class: "cores-ppk-rules-action-sel", title: "切换动作" });
      actionSel.appendChild(el("span", { text: currentAction ? currentAction.label : "选择动作" }));
      actionSel.appendChild(svgIcon("chevron", { size: 12 }));
      actionSel.addEventListener("click", (e) => {
        e.stopPropagation();
        openChoiceMenu(
          actionSel,
          available.map((a) => ({ value: a.id, label: a.label })),
          r.action,
          (value) => {
            const oldAction = getAction(r.action);
            if (oldAction && oldAction.kind === "apply") ruleEngine.unapplyRule(r);
            rulesManager.updateRule(hostname(), i, { action: value });
            const newRule = rulesManager.getRule(hostname(), i);
            const newAction = newRule ? getAction(newRule.action) : null;
            if (newAction && newAction.kind === "apply") ruleEngine.applyRule(newRule);
            renderList();
            toast("动作已更新");
          }
        );
      });
      const action = getAction(r.action);
      const isData = action && action.kind === "data";
      const execBtn = isData ? el("button", {
        type: "button",
        class: "cores-ppk-rules-exec",
        title: "执行：批量提取并应用动作",
        onclick: (e) => {
          e.stopPropagation();
          runDataRule(r);
        }
      }, el("span", { text: "执行" })) : null;
      const del = el(
        "button",
        { type: "button", class: "cores-ppk-rules-del", title: "删除", onclick: (e) => {
          e.stopPropagation();
          confirmDelete(del, i);
        } },
        svgIcon("close", { size: 13 })
      );
      const bottom = el(
        "div",
        { class: "cores-ppk-rules-row-bottom" },
        el("span", { class: "cores-ppk-rules-chip", text: TARGET_LABELS[r.targetType] || r.targetType }),
        el("span", { class: "cores-ppk-rules-row-count", text: "匹配 " + count }),
        el("div", { class: "cores-ppk-rules-row-spacer" }),
        actionSel,
        execBtn,
        del
      );
      row.appendChild(top);
      row.appendChild(bottom);
      listEl.appendChild(row);
    });
  }
  function confirmDelete(btn, index) {
    if (btn.dataset.confirm === "1") {
      const rule = rulesManager.getRule(hostname(), index);
      if (rule) {
        const action = getAction(rule.action);
        if (action && action.kind === "apply") ruleEngine.unapplyRule(rule);
      }
      rulesManager.removeRule(hostname(), index);
      renderList();
      toast("已删除");
      return;
    }
    btn.dataset.confirm = "1";
    btn.classList.add("confirming");
    setTimeout(() => {
      btn.dataset.confirm = "";
      btn.classList.remove("confirming");
    }, 2200);
  }
  function runDataRule(rule) {
    const res = executeDataRule(rule);
    if (res.message) toast(res.message);
  }
  async function startPick() {
    if (picking2) return;
    picking2 = true;
    pickerState.setPicking(true);
    pickBtn.disabled = true;
    root.classList.remove("visible");
    backdrop.classList.remove("visible");
    const result = await pickElement();
    root.classList.add("visible");
    backdrop.classList.add("visible");
    picking2 = false;
    pickerState.setPicking(false);
    pickBtn.disabled = false;
    if (!result) return;
    rulesManager.addRule(hostname(), result);
    ruleEngine.applyRules(hostname());
    renderList();
    toast("已添加规则");
  }
  function doImportText(text, mode) {
    const res = rulesManager.importConfig(text, mode);
    if (res.ok) {
      ruleEngine.applyRules(hostname());
      renderList();
    }
    toast(res.message || (res.ok ? "导入完成" : "导入失败"));
  }
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // 简单菜单：当前包 / 全部
    const menu = el("div", { class: "cores-ppk-rules-io-menu" });
    const b1 = el("button", {
      type: "button",
      text: "导出当前规则包",
      onclick: () => {
        menu.remove();
        const data = rulesManager.exportPack(hostname());
        if (!data) {
          toast("无可导出内容");
          return;
        }
        downloadJson("cores-ppk-rules-" + hostname() + ".json", data);
        toast("已导出当前规则包");
      }
    });
    const b2 = el("button", {
      type: "button",
      text: "导出全部配置",
      onclick: () => {
        menu.remove();
        const data = rulesManager.exportAll();
        const packN = (data.packs || []).length;
        const hostN = (data.hosts || []).length;
        const ruleN = (data.packs || []).reduce((n, p) => n + ((p.rules || []).length), 0);
        downloadJson("cores-ppk-rules-all.json", data);
        toast("已导出全部配置：" + packN + " 个规则包 · " + hostN + " 个域名 · " + ruleN + " 条规则");
      }
    });
    const b3 = el("button", {
      type: "button",
      text: "复制当前包 JSON",
      onclick: () => {
        menu.remove();
        const data = rulesManager.exportPack(hostname());
        const text = JSON.stringify(data, null, 2);
        copyToClipboard(text);
        toast("已复制到剪贴板");
      }
    });
    menu.appendChild(b1);
    menu.appendChild(b2);
    menu.appendChild(b3);
    placeFloatingMenu(exportBtn, menu);
  });
  importBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = el("div", { class: "cores-ppk-rules-io-menu" });
    const b1 = el("button", {
      type: "button",
      text: "从文件导入（合并）",
      onclick: () => {
        menu.remove();
        fileInput.dataset.mode = "merge";
        fileInput.click();
      }
    });
    const b2 = el("button", {
      type: "button",
      text: "从文件导入（替换全部）",
      onclick: () => {
        menu.remove();
        if (!confirm("将清空现有全部规则并替换为导入内容，确定？")) return;
        fileInput.dataset.mode = "replace";
        fileInput.click();
      }
    });
    const b3 = el("button", {
      type: "button",
      text: "从剪贴板导入（合并）",
      onclick: async () => {
        menu.remove();
        let text = "";
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            text = await navigator.clipboard.readText();
          }
        } catch {
        }
        if (!text) {
          text = prompt("请粘贴配置 JSON：", "") || "";
        }
        if (!text.trim()) {
          toast("剪贴板为空");
          return;
        }
        doImportText(text, "merge");
      }
    });
    menu.appendChild(b1);
    menu.appendChild(b2);
    menu.appendChild(b3);
    placeFloatingMenu(importBtn, menu);
  });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!f) return;
    const mode = fileInput.dataset.mode || "merge";
    const reader = new FileReader();
    reader.onload = () => {
      doImportText(String(reader.result || ""), mode);
    };
    reader.onerror = () => toast("读取文件失败");
    reader.readAsText(f, "utf-8");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("visible")) close();
  });
  siteSw.addEventListener("change", () => {
    const enabled = siteSw.checked;
    rulesManager.setSiteEnabled(hostname(), enabled);
    if (!enabled) {
      ruleEngine.unapplyRules(hostname());
      toast("本站规则已关闭");
    } else {
      ruleEngine.applyRules(hostname());
      toast("本站规则已开启");
    }
    renderList();
  });
  return { root, backdrop, open, close };
}
