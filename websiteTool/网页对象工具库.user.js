// ==UserScript==
// @name          网页对象工具库
// @namespace     http://tampermonkey.net/
// @version       0.4.1
// @description   取选任意网页元素，识别对象类型，绑定动作；支持远程规则订阅；导入导出全局存储
// @author        cores
// @match         *://*/*
// @run-at        document-end
// @noframes
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// @connect       *
// @license       MIT
// @downloadURL https://update.greasyfork.org/scripts/590111/%E7%BD%91%E9%A1%B5%E5%AF%B9%E8%B1%A1%E5%B7%A5%E5%85%B7%E5%BA%93.user.js
// @updateURL https://update.greasyfork.org/scripts/590111/%E7%BD%91%E9%A1%B5%E5%AF%B9%E8%B1%A1%E5%B7%A5%E5%85%B7%E5%BA%93.meta.js
// ==/UserScript==


(() => {
  // src/config.js
  var config = {
    observer: {
      debounceMs: 300
    },
    popup: {
      width: "50%",
      height: "75%"
    }
  };

  // src/utils/gm.js
  // iOS Safari / Userscripts / Stay: 不要直接写 GM_addStyle，未声明时会 ReferenceError 导致整脚本退出
  function gmApi(name) {
    const short = name.indexOf("GM_") === 0 ? name.slice(3, 4).toLowerCase() + name.slice(4) : name;
    const alts = [name, short];
    const bags = [];
    try { if (typeof GM !== "undefined" && GM) bags.push(GM); } catch {}
    try { bags.push(globalThis); } catch {}
    try { bags.push(window); } catch {}
    for (let i = 0; i < bags.length; i++) {
      const bag = bags[i];
      if (!bag) continue;
      for (let j = 0; j < alts.length; j++) {
        try {
          const fn = bag[alts[j]];
          if (typeof fn === "function") return fn.bind(bag);
        } catch {}
      }
    }
    return null;
  }
  function injectStyle(css) {
    const style = document.createElement("style");
    style.setAttribute("data-cores-style", "page");
    style.textContent = css;
    const root = document.head || document.documentElement;
    if (root) root.appendChild(style);
    return style;
  }
  function localGet(key, fallback) {
    try {
      const raw = localStorage.getItem("ppk:" + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function localSet(key, value) {
    try {
      localStorage.setItem("ppk:" + key, JSON.stringify(value));
    } catch {
    }
  }
  var gm = {
    addStyle(css) {
      const fn = gmApi("GM_addStyle");
      if (fn) {
        try { return fn(css); } catch {}
      }
      return injectStyle(css);
    },
    xmlhttpRequest(options) {
      const fn = gmApi("GM_xmlhttpRequest") || gmApi("GM.xmlHttpRequest");
      if (fn) {
        try {
          return fn({
            timeout: options.timeout || 15e3,
            ...options
          });
        } catch {}
      }
      return fetch(options.url, { method: options.method || "GET" }).then(
        async (res) => options.onload?.({
          status: res.status,
          statusText: res.statusText,
          responseText: await res.text(),
          finalUrl: res.url
        })
      ).catch((err) => options.onerror?.(err));
    },
    _cache: Object.create(null),
    readScriptValue(key, fallback) {
      const fn = gmApi("GM_getValue") || gmApi("getValue");
      if (fn) {
        try {
          const v = fn(key, fallback);
          if (!(v && typeof v.then === "function") && v !== undefined && v !== null) {
            this._cache[key] = v;
            return v;
          }
        } catch {}
      }
      try {
        if (typeof GM !== "undefined" && GM && typeof GM.getValue === "function") {
          const v = GM.getValue(key, fallback);
          if (!(v && typeof v.then === "function") && v !== undefined && v !== null) {
            this._cache[key] = v;
            return v;
          }
        }
      } catch {}
      if (Object.prototype.hasOwnProperty.call(this._cache, key) && this._cache[key] != null) {
        return this._cache[key];
      }
      return fallback;
    },
    writeScriptValue(key, value) {
      this._cache[key] = value;
      let ok = false;
      const fn = gmApi("GM_setValue") || gmApi("setValue");
      if (fn) {
        try { fn(key, value); ok = true; } catch {}
      }
      try {
        if (typeof GM !== "undefined" && GM && typeof GM.setValue === "function") {
          GM.setValue(key, value);
          ok = true;
        }
      } catch {}
      try { localSet(key, value); } catch {}
      return ok;
    },
    getValue(key, fallback) {
      const scriptVal = this.readScriptValue(key, undefined);
      if (scriptVal !== undefined) return scriptVal;
      if (Object.prototype.hasOwnProperty.call(this._cache, key)) {
        const cached = this._cache[key];
        return cached === undefined ? fallback : cached;
      }
      return fallback;
    },
    setValue(key, value) {
      this.writeScriptValue(key, value);
      const fn = gmApi("GM_setValue") || gmApi("setValue");
      if (fn) {
        try { fn(key, value); } catch {}
      }
      try {
        if (typeof GM !== "undefined" && GM && typeof GM.setValue === "function") {
          GM.setValue(key, value);
        }
      } catch {}
      return value;
    },
    hydrate(keys) {
      const list = keys || [];
      const tasks = list.map((key) => {
        const fn = gmApi("GM_getValue") || gmApi("getValue");
        let p = null;
        if (fn) {
          try {
            const v = fn(key, undefined);
            if (v && typeof v.then === "function") p = v;
            else if (v !== undefined && v !== null) this._cache[key] = v;
          } catch {}
        }
        try {
          if (!p && typeof GM !== "undefined" && GM && typeof GM.getValue === "function") {
            p = Promise.resolve(GM.getValue(key, undefined));
          }
        } catch {}
        if (!p) {
          const local = localGet(key, undefined);
          if (local !== undefined) this._cache[key] = local;
          return Promise.resolve();
        }
        return p.then((resolved) => {
          const local = localGet(key, undefined);
          const picked = resolved !== undefined && resolved !== null ? resolved : local;
          if (picked !== undefined) this._cache[key] = picked;
        }).catch(() => {
          const local = localGet(key, undefined);
          if (local !== undefined) this._cache[key] = local;
        });
      });
      return Promise.all(tasks);
    }
  };

  // src/ui/style.css

  // src/ui/host.js — Shadow DOM 根，隔离宿主站点 CSS，并逃出 overflow/transform
  var uiHost = null;
  var uiShadow = null;
  function getUIShadow() {
    if (uiShadow && uiHost && uiHost.isConnected) return uiShadow;
    uiHost = document.getElementById("cores-ppk-root");
    if (!uiHost) {
      uiHost = document.createElement("div");
      uiHost.id = "cores-ppk-root";
    }
    uiHost.setAttribute("data-cores", "root");
    uiHost.setAttribute("data-cores-ui", "1");
    uiHost.setAttribute("data-author", "cores");
    applyThemeClass();
    uiHost.style.cssText = [
      "all:initial",
      "position:fixed",
      "inset:0",
      "width:100vw",
      "height:100vh",
      "height:100dvh",
      "margin:0",
      "padding:0",
      "border:0",
      "background:transparent",
      "pointer-events:none",
      "z-index:2147483646",
      "overflow:visible",
      "transform:none",
      "filter:none",
      "contain:none",
      "display:block",
      "opacity:1",
      "visibility:visible"
    ].join(";");
    if (!uiHost.shadowRoot) {
      uiShadow = uiHost.attachShadow({ mode: "open" });
      const st = document.createElement("style");
      st.textContent = style_default;
      uiShadow.appendChild(st);
      const st2 = document.createElement("style");
      st2.textContent = style_refine;
      uiShadow.appendChild(st2);
    } else {
      uiShadow = uiHost.shadowRoot;
    }
    const parent = document.body || document.documentElement;
    if (parent && uiHost.parentNode !== parent) parent.appendChild(uiHost);
    return uiShadow;
  }
  function uiAppend(node) {
    getUIShadow().appendChild(node);
    return node;
  }
  function uiGet(id) {
    return getUIShadow().getElementById(id);
  }
  function isPpkNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.id === "cores-ppk-root" || node.getAttribute && node.getAttribute("data-cores") === "root") return true;
    try {
      const root = node.getRootNode && node.getRootNode();
      if (uiShadow && root === uiShadow) return true;
    } catch {
    }
    return false;
  }
  function eventFromUI(e) {
    try {
      const path = e && e.composedPath ? e.composedPath() : [e && e.target];
      return path.some((n) => n && (n === uiHost || isPpkNode(n)));
    } catch {
      return isPpkNode(e && e.target);
    }
  }

  var style_default = "/* ===== Shadow DOM \u5185\u6837\u5f0f\uff1a\u4e0e\u5bbf\u4e3b\u9875\u9762\u5b8c\u5168\u9694\u79bb ===== */\n:host {\n  all: initial;\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\",\n    \"Microsoft YaHei\", Roboto, \"Helvetica Neue\", Arial, sans-serif;\n  color: #1a2233;\n  font-size: 13px;\n  line-height: 1.45;\n  text-align: left;\n  -webkit-font-smoothing: antialiased;\n}\n:host *,\n:host *::before,\n:host *::after {\n  box-sizing: border-box;\n}\n\n:host, :root {\n  --cores-ppk-accent: #2563eb;\n  --cores-ppk-accent-hover: #1d4ed8;\n  --cores-ppk-accent-soft: rgba(37, 99, 235, 0.1);\n  --cores-ppk-danger: #dc2626;\n  --cores-ppk-danger-soft: rgba(220, 38, 38, 0.1);\n  --cores-ppk-header-bg: #fafbfc;\n  --cores-ppk-border: #e4e7ec;\n  --cores-ppk-text: #1a2233;\n  --cores-ppk-muted: #64748b;\n  --cores-ppk-faint: #94a3b8;\n  --cores-ppk-bg: #ffffff;\n  --cores-ppk-surface: #ffffff;\n  --cores-ppk-btn-bg: rgba(15, 23, 42, 0.07);\n  --cores-ppk-btn-hover: rgba(15, 23, 42, 0.12);\n  --cores-ppk-btn-active: rgba(15, 23, 42, 0.17);\n  --cores-ppk-focus-ring: rgba(37, 99, 235, 0.4);\n  --cores-ppk-shadow:\n    0 0 0 1px rgba(15, 23, 42, 0.04),\n    0 24px 60px -18px rgba(15, 23, 42, 0.28),\n    0 8px 24px -12px rgba(15, 23, 42, 0.16);\n  --cores-ppk-overlay: rgba(15, 23, 42, 0.28);\n}\n\n:host(.cores-ppk-theme-dark), :root.cores-ppk-theme-dark {\n  --cores-ppk-accent: #60a5fa;\n  --cores-ppk-accent-hover: #93c5fd;\n  --cores-ppk-accent-soft: rgba(96, 165, 250, 0.14);\n  --cores-ppk-danger: #f87171;\n  --cores-ppk-danger-soft: rgba(248, 113, 113, 0.14);\n  --cores-ppk-header-bg: #121a2b;\n  --cores-ppk-border: #263247;\n  --cores-ppk-text: #e2e8f0;\n  --cores-ppk-muted: #94a3b8;\n  --cores-ppk-faint: #64748b;\n  --cores-ppk-bg: #0f172a;\n  --cores-ppk-surface: #151e30;\n  --cores-ppk-btn-bg: rgba(148, 163, 184, 0.14);\n  --cores-ppk-btn-hover: rgba(148, 163, 184, 0.22);\n  --cores-ppk-btn-active: rgba(148, 163, 184, 0.28);\n  --cores-ppk-focus-ring: rgba(96, 165, 250, 0.5);\n  --cores-ppk-shadow:\n    0 0 0 1px rgba(255, 255, 255, 0.04),\n    0 28px 70px -20px rgba(0, 0, 0, 0.72),\n    0 10px 28px -14px rgba(0, 0, 0, 0.5);\n  --cores-ppk-overlay: rgba(0, 0, 0, 0.52);\n}\n\n/* \u6eda\u52a8\u6761\uff08\u89c4\u5219\u5217\u8868 / \u83dc\u5355\uff09 */\n#cores-ppk-rules-list,\n#cores-ppk-rules-panel-body,\n.cores-ppk-toolbar-menu-list,\n.cores-ppk-rules-hosts-chips,\n.cores-ppk-picker-cands {\n  scrollbar-width: thin;\n  scrollbar-color: var(--cores-ppk-btn-active) transparent;\n}\n#cores-ppk-rules-list::-webkit-scrollbar,\n#cores-ppk-rules-panel-body::-webkit-scrollbar,\n.cores-ppk-toolbar-menu-list::-webkit-scrollbar,\n.cores-ppk-rules-hosts-chips::-webkit-scrollbar {\n  width: 8px;\n  height: 8px;\n}\n#cores-ppk-rules-list::-webkit-scrollbar-thumb,\n#cores-ppk-rules-panel-body::-webkit-scrollbar-thumb,\n.cores-ppk-toolbar-menu-list::-webkit-scrollbar-thumb,\n.cores-ppk-rules-hosts-chips::-webkit-scrollbar-thumb {\n  background: var(--cores-ppk-btn-active);\n  border-radius: 99px;\n}\n#cores-ppk-rules-list::-webkit-scrollbar-track,\n#cores-ppk-rules-panel-body::-webkit-scrollbar-track,\n.cores-ppk-toolbar-menu-list::-webkit-scrollbar-track {\n  background: transparent;\n}\n\n/* ===== \u60ac\u6d6e\u5de5\u5177\u6309\u94ae ===== */\n#cores-ppk-toolbar {\n  position: fixed;\n  right: 20px;\n  bottom: 20px;\n  z-index: 10001;\n  width: 42px;\n  min-width: 42px;\n  height: 42px;\n  min-height: 42px;\n  padding: 0;\n  border-radius: 50%;\n  border: 1px solid var(--cores-ppk-border);\n  background-color: var(--cores-ppk-surface);\n  color: var(--cores-ppk-muted);\n  box-shadow: 0 4px 16px -4px rgba(15, 23, 42, 0.25);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  pointer-events: auto;\n  flex-shrink: 0;\n  overflow: visible;\n  opacity: 1;\n  visibility: visible;\n  transform: none;\n  transition: box-shadow 0.15s ease, color 0.15s ease;\n  touch-action: none;\n  user-select: none;\n  -webkit-user-select: none;\n}\n#cores-ppk-toolbar svg {\n  width: 18px;\n  height: 18px;\n  fill: none;\n  stroke: currentColor;\n  pointer-events: none;\n}\n#cores-ppk-toolbar:hover {\n  color: var(--cores-ppk-accent);\n  box-shadow: 0 6px 20px -4px rgba(15, 23, 42, 0.3);\n}\n#cores-ppk-toolbar:active {\n  color: var(--cores-ppk-accent);\n}\n\n/* ===== \u60ac\u6d6e\u52a8\u4f5c\u83dc\u5355 ===== */\n#cores-ppk-toolbar-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 10008;\n  background: transparent;\n  pointer-events: auto;\n}\n#cores-ppk-toolbar-backdrop.hidden {\n  display: none;\n}\n#cores-ppk-toolbar-menu {\n  position: fixed;\n  z-index: 10009;\n  width: 260px;\n  max-width: calc(100vw - 16px);\n  max-height: calc(100vh - 24px);\n  max-height: calc(100dvh - 24px);\n  display: flex;\n  flex-direction: column;\n  background-color: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 12px;\n  box-shadow: var(--cores-ppk-shadow);\n  padding: 6px;\n  font-size: 13px;\n  overflow: hidden;\n  pointer-events: auto;\n}\n#cores-ppk-toolbar-menu.hidden {\n  opacity: 0;\n  visibility: hidden;\n  pointer-events: none;\n}\n.cores-ppk-toolbar-menu-head {\n  flex: 0 0 auto;\n}\n.cores-ppk-toolbar-menu-list {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n.cores-ppk-toolbar-menu-foot {\n  flex: 0 0 auto;\n  border-top: 1px solid var(--cores-ppk-border);\n  margin-top: 4px;\n  padding-top: 4px;\n}\n.cores-ppk-toolbar-menu-title {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.05em;\n  color: var(--cores-ppk-faint);\n  padding: 4px 8px 8px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.cores-ppk-toolbar-menu-empty {\n  color: var(--cores-ppk-faint);\n  text-align: center;\n  padding: 14px 8px;\n  font-size: 12px;\n}\n.cores-ppk-toolbar-menu-site {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 7px 10px;\n  border-top: 1px solid var(--cores-ppk-border);\n  border-bottom: 1px solid var(--cores-ppk-border);\n  margin-bottom: 4px;\n}\n.cores-ppk-toolbar-menu-site-label {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--cores-ppk-text);\n}\n.cores-ppk-toolbar-menu .cores-ppk-switch {\n  transform: scale(0.85);\n  transform-origin: center;\n}\n.cores-ppk-toolbar-menu-item {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  border: none;\n  background: transparent;\n  color: var(--cores-ppk-text);\n  border-radius: 8px;\n  padding: 8px 10px;\n  cursor: pointer;\n  transition: background 0.15s ease;\n}\n.cores-ppk-toolbar-menu-item:hover {\n  background-color: var(--cores-ppk-btn-hover);\n}\n.cores-ppk-toolbar-menu-item:active {\n  background-color: var(--cores-ppk-btn-active);\n}\n.cores-ppk-toolbar-menu-item-label {\n  font-weight: 600;\n  color: var(--cores-ppk-accent);\n}\n.cores-ppk-toolbar-menu-item-meta {\n  font-size: 11px;\n  color: var(--cores-ppk-faint);\n  white-space: nowrap;\n}\n.cores-ppk-toolbar-menu-manage {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  margin-top: 4px;\n  border: 1px solid var(--cores-ppk-border);\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  border-radius: 8px;\n  padding: 7px 10px;\n  font-size: 12px;\n  cursor: pointer;\n  transition: background 0.15s ease, color 0.15s ease;\n}\n.cores-ppk-toolbar-menu-manage:hover {\n  color: var(--cores-ppk-accent);\n  background-color: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-toolbar-menu-manage svg {\n  width: 13px;\n  height: 13px;\n  fill: none;\n  stroke: currentColor;\n}\n.cores-ppk-toolbar-menu-reset {\n  width: 100%;\n  border: none;\n  background: transparent;\n  color: var(--cores-ppk-faint);\n  border-radius: 8px;\n  padding: 5px 10px;\n  font-size: 11px;\n  text-align: center;\n  cursor: pointer;\n  transition: color 0.15s ease, background 0.15s ease;\n}\n.cores-ppk-toolbar-menu-reset:hover {\n  color: var(--cores-ppk-accent);\n  background-color: var(--cores-ppk-accent-soft);\n}\n#cores-ppk-toolbar-toast {\n  position: fixed;\n  left: 50%;\n  bottom: 28px;\n  transform: translateX(-50%) translateY(8px);\n  z-index: 10015;\n  background-color: var(--cores-ppk-text);\n  color: var(--cores-ppk-bg);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  font-size: 12px;\n  padding: 8px 16px;\n  border-radius: 999px;\n  opacity: 0;\n  pointer-events: none;\n  box-shadow: var(--cores-ppk-shadow);\n  transition: opacity 0.18s ease, transform 0.18s ease;\n}\n#cores-ppk-toolbar-toast.visible {\n  opacity: 1;\n  transform: translateX(-50%) translateY(0);\n}\n\n/* ===== \u5f39\u7a97 ===== */\n#cores-ppk-popup-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 9998;\n  background-color: var(--cores-ppk-overlay);\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.3s ease-in-out;\n  backdrop-filter: blur(6px);\n  -webkit-backdrop-filter: blur(6px);\n}\n#cores-ppk-popup-overlay.visible {\n  opacity: 1;\n  pointer-events: auto;\n}\n#cores-ppk-popup {\n  position: fixed;\n  z-index: 10000;\n  width: 50%;\n  height: 75%;\n  overscroll-behavior: contain;\n  max-width: min(2560px, calc(100vw - 24px));\n  max-height: min(1440px, calc(100vh - 24px));\n  max-height: min(1440px, calc(100dvh - 24px));\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%) scale(0.96);\n  transform-origin: center;\n  background-color: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  box-shadow: var(--cores-ppk-shadow);\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 12px;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);\n}\n#cores-ppk-popup.visible {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translate(-50%, -50%) scale(1);\n}\n#cores-ppk-popup-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 0 10px 0 14px;\n  background-color: var(--cores-ppk-header-bg);\n  border-bottom: 1px solid var(--cores-ppk-border);\n  height: 46px;\n  min-height: 46px;\n  flex: 0 0 auto;\n}\n#cores-ppk-popup-title {\n  flex: 1;\n  min-width: 0;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--cores-ppk-text);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.cores-ppk-popup-actions {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  flex: 0 0 auto;\n}\n.cores-ppk-popup-btn {\n  width: 30px;\n  height: 30px;\n  padding: 0;\n  border: 1px solid transparent;\n  border-radius: 8px;\n  background-color: var(--cores-ppk-btn-bg);\n  color: var(--cores-ppk-muted);\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition: background-color 0.15s ease, color 0.15s ease;\n}\n.cores-ppk-popup-btn svg {\n  width: 15px;\n  height: 15px;\n  fill: none;\n  stroke: currentColor;\n  pointer-events: none;\n}\n.cores-ppk-popup-btn:hover {\n  color: var(--cores-ppk-accent);\n  background-color: var(--cores-ppk-accent-soft);\n}\n#cores-ppk-popup-body {\n  flex: 1;\n  min-height: 0;\n}\n#cores-ppk-popup-frame {\n  width: 100%;\n  height: 100%;\n  border: none;\n  background-color: #fff;\n}\n\n/* ===== \u89c4\u5219\u9762\u677f ===== */\n#cores-ppk-rules-panel-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 10002;\n  background-color: var(--cores-ppk-overlay);\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.2s ease;\n}\n#cores-ppk-rules-panel-backdrop.visible {\n  opacity: 1;\n  pointer-events: auto;\n}\n#cores-ppk-rules-panel {\n  position: fixed;\n  z-index: 10003;\n  width: 520px;\n  max-width: calc(100vw - 24px);\n  height: min(720px, calc(100vh - 24px));\n  height: min(720px, calc(100dvh - 24px));\n  max-height: min(720px, calc(100vh - 24px));\n  max-height: min(720px, calc(100dvh - 24px));\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -48%) scale(0.97);\n  background-color: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 14px;\n  box-shadow: var(--cores-ppk-shadow);\n  display: flex;\n  flex-direction: column;\n  font-size: 13px;\n  overflow: hidden;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);\n}\n#cores-ppk-rules-panel.visible {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translate(-50%, -50%) scale(1);\n}\n#cores-ppk-rules-panel-header {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 12px 14px;\n  border-bottom: 1px solid var(--cores-ppk-border);\n  background-color: var(--cores-ppk-header-bg);\n  flex: 0 0 auto;\n}\n.cores-ppk-rules-title {\n  font-size: 14px;\n  font-weight: 600;\n}\n#cores-ppk-rules-host {\n  flex: 1;\n  font-size: 11px;\n  color: var(--cores-ppk-faint);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n#cores-ppk-rules-panel .cores-ppk-panel-btn {\n  width: 30px;\n  height: 30px;\n  padding: 0;\n  border: 1px solid transparent;\n  border-radius: 8px;\n  background-color: transparent;\n  color: var(--cores-ppk-muted);\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transition: background-color 0.15s ease, color 0.15s ease;\n}\n#cores-ppk-rules-panel .cores-ppk-panel-btn svg {\n  width: 15px;\n  height: 15px;\n  fill: none;\n  stroke: currentColor;\n  pointer-events: none;\n}\n#cores-ppk-rules-panel .cores-ppk-panel-btn:hover {\n  color: var(--cores-ppk-danger);\n  background-color: var(--cores-ppk-danger-soft);\n}\n#cores-ppk-rules-panel-body {\n  flex: 1 1 auto;\n  min-height: 0;\n  padding: 14px 10px 8px 14px;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n.cores-ppk-rules-tip {\n  font-size: 11px;\n  line-height: 1.5;\n  color: var(--cores-ppk-faint);\n  flex: 0 0 auto;\n}\n#cores-ppk-rules-list {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  flex: 1 1 auto;\n  min-height: 80px;\n  overflow-y: auto;\n  overflow-x: hidden;\n  overscroll-behavior: contain;\n  -webkit-overflow-scrolling: touch;\n  padding-right: 6px;\n}\n.cores-ppk-rules-empty {\n  color: var(--cores-ppk-faint);\n  text-align: center;\n  padding: 18px 0;\n  border: 1px dashed var(--cores-ppk-border);\n  border-radius: 10px;\n}\n.cores-ppk-rules-row {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 9px 12px;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 10px;\n  background-color: var(--cores-ppk-bg);\n}\n.cores-ppk-rules-row.disabled {\n  opacity: 0.55;\n}\n.cores-ppk-rules-row.disabled .cores-ppk-rules-row-sel {\n  text-decoration: line-through;\n}\n#cores-ppk-rules-panel.site-disabled .cores-ppk-rules-row:not(.disabled) {\n  opacity: 0.55;\n}\n#cores-ppk-rules-panel.site-disabled .cores-ppk-rules-row:not(.disabled) .cores-ppk-rules-row-sel {\n  text-decoration: line-through;\n}\n.cores-ppk-rules-row-top {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-width: 0;\n}\n.cores-ppk-rules-row-sel {\n  flex: 1;\n  min-width: 0;\n  font-family: Consolas, 'Courier New', monospace;\n  font-size: 12px;\n  color: var(--cores-ppk-accent);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.cores-ppk-rules-row-bottom {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n}\n.cores-ppk-rules-row-count {\n  flex: 0 0 auto;\n  font-size: 11px;\n  color: var(--cores-ppk-faint);\n  white-space: nowrap;\n}\n.cores-ppk-rules-row-spacer {\n  flex: 1;\n  min-width: 4px;\n}\n.cores-ppk-rules-chip {\n  flex: 0 0 auto;\n  display: inline-flex;\n  align-items: center;\n  padding: 0 7px;\n  height: 17px;\n  border-radius: 999px;\n  font-size: 10px;\n  font-weight: 600;\n  color: var(--cores-ppk-accent);\n  background-color: var(--cores-ppk-accent-soft);\n  border: 1px solid var(--cores-ppk-accent-soft);\n}\n.cores-ppk-rules-action-sel {\n  flex: 0 0 auto;\n  appearance: none;\n  -webkit-appearance: none;\n  border: 1px solid var(--cores-ppk-border);\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  border-radius: 8px;\n  padding: 4px 8px;\n  font-size: 11px;\n  cursor: pointer;\n  max-width: 110px;\n  transition: border-color 0.15s ease, color 0.15s ease;\n}\n.cores-ppk-rules-action-sel:hover {\n  color: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-rules-action-sel:focus-visible {\n  outline: 2px solid var(--cores-ppk-focus-ring);\n  outline-offset: 1px;\n}\n.cores-ppk-rules-del {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  padding: 0;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 7px;\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  cursor: pointer;\n  flex: 0 0 auto;\n}\n.cores-ppk-rules-del:hover {\n  color: var(--cores-ppk-danger);\n  border-color: var(--cores-ppk-danger-soft);\n  background-color: var(--cores-ppk-danger-soft);\n}\n.cores-ppk-rules-del.confirming {\n  color: #fff;\n  background-color: var(--cores-ppk-danger);\n  border-color: var(--cores-ppk-danger);\n}\n.cores-ppk-rules-exec {\n  flex: 0 0 auto;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 4px;\n  border: 1px solid var(--cores-ppk-accent);\n  background: var(--cores-ppk-accent-soft);\n  color: var(--cores-ppk-accent);\n  border-radius: 7px;\n  padding: 4px 12px;\n  font-size: 11px;\n  font-weight: 600;\n  line-height: 1;\n  cursor: pointer;\n  transition: background 0.15s ease, color 0.15s ease;\n}\n.cores-ppk-rules-exec:hover {\n  background-color: var(--cores-ppk-accent);\n  color: #fff;\n}\n#cores-ppk-rules-pick {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  background-color: var(--cores-ppk-accent);\n  border: 1px solid var(--cores-ppk-accent);\n  color: #fff;\n  font-weight: 500;\n  padding: 8px 16px;\n  border-radius: 8px;\n  cursor: pointer;\n  transition: background 0.15s ease;\n  margin-left: auto;\n}\n#cores-ppk-rules-pick:hover {\n  background-color: var(--cores-ppk-accent-hover);\n}\n#cores-ppk-rules-pick:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n#cores-ppk-rules-pick svg {\n  width: 14px;\n  height: 14px;\n}\n#cores-ppk-rules-panel-foot {\n  flex: 0 0 auto;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 10px 14px 14px;\n  border-top: 1px solid var(--cores-ppk-border);\n  background-color: var(--cores-ppk-surface);\n}\n#cores-ppk-rules-toast {\n  position: fixed;\n  left: 50%;\n  bottom: 28px;\n  transform: translateX(-50%) translateY(8px);\n  z-index: 10006;\n  background-color: var(--cores-ppk-text);\n  color: var(--cores-ppk-bg);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  font-size: 12px;\n  padding: 8px 16px;\n  border-radius: 999px;\n  opacity: 0;\n  pointer-events: none;\n  box-shadow: var(--cores-ppk-shadow);\n  transition: opacity 0.18s ease, transform 0.18s ease;\n}\n#cores-ppk-rules-toast.visible {\n  opacity: 1;\n  transform: translateX(-50%) translateY(0);\n}\n\n/* ===== \u5f00\u5173 ===== */\n.cores-ppk-switch {\n  position: relative;\n  display: inline-block;\n  width: 38px;\n  height: 22px;\n  flex: 0 0 auto;\n  cursor: pointer;\n}\n.cores-ppk-switch input {\n  position: absolute;\n  opacity: 0;\n  width: 0;\n  height: 0;\n}\n.cores-ppk-switch-track {\n  position: absolute;\n  inset: 0;\n  border-radius: 999px;\n  background-color: var(--cores-ppk-btn-active);\n  transition: background-color 0.2s ease;\n}\n.cores-ppk-switch-track::after {\n  content: '';\n  position: absolute;\n  left: 2px;\n  top: 2px;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  background-color: #fff;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);\n  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);\n}\n.cores-ppk-switch input:checked + .cores-ppk-switch-track {\n  background-color: var(--cores-ppk-accent);\n}\n.cores-ppk-switch input:checked + .cores-ppk-switch-track::after {\n  transform: translateX(16px);\n}\n.cores-ppk-rules-row .cores-ppk-switch {\n  transform: scale(0.85);\n  transform-origin: center;\n}\n\n/* ===== \u53d6\u9009 ===== */\n.cores-ppk-picker-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 10010;\n  background-color: rgba(15, 23, 42, 0.35);\n  pointer-events: none;\n}\n.cores-ppk-picker-bar {\n  position: fixed;\n  z-index: 10011;\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 10px 14px;\n  border-radius: 10px;\n  font-size: 13px;\n  color: var(--cores-ppk-text);\n  background-color: var(--cores-ppk-surface);\n  border: 1px solid var(--cores-ppk-border);\n  box-shadow: var(--cores-ppk-shadow);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  pointer-events: none;\n}\n#cores-ppk-picker-hint {\n  top: 16px;\n  left: 50%;\n  transform: translateX(-50%);\n  max-width: calc(100vw - 24px);\n  white-space: nowrap;\n}\n.cores-ppk-picker-confirm {\n  position: fixed;\n  bottom: 20px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 10011;\n  width: min(600px, calc(100vw - 24px));\n  max-height: calc(100vh - 48px);\n  max-height: calc(100dvh - 48px);\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  padding: 12px 14px;\n  border-radius: 12px;\n  font-size: 13px;\n  color: var(--cores-ppk-text);\n  background-color: var(--cores-ppk-surface);\n  border: 1px solid var(--cores-ppk-border);\n  box-shadow: var(--cores-ppk-shadow);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  pointer-events: auto;\n}\n.cores-ppk-picker-confirm.hidden,\n#cores-ppk-picker-hint.hidden,\n.cores-ppk-picker-highlight.hidden {\n  display: none;\n}\n.cores-ppk-picker-c-title {\n  font-weight: 600;\n  font-size: 13px;\n}\n.cores-ppk-picker-cands {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  max-height: 140px;\n  overflow-y: auto;\n}\n.cores-ppk-picker-cand {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  border: 1px solid var(--cores-ppk-border);\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  border-radius: 8px;\n  padding: 4px 9px;\n  font-size: 12px;\n  cursor: pointer;\n  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;\n}\n.cores-ppk-picker-cand.is-on {\n  border-color: var(--cores-ppk-accent);\n  color: var(--cores-ppk-accent);\n  background-color: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-picker-cand code {\n  font-family: Consolas, 'Courier New', monospace;\n  font-size: 11px;\n}\n.cores-ppk-picker-cand em {\n  font-style: normal;\n  color: var(--cores-ppk-faint);\n  font-size: 11px;\n}\n.cores-ppk-picker-input {\n  padding: 6px 9px;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 8px;\n  background-color: var(--cores-ppk-bg);\n  color: var(--cores-ppk-text);\n  font-family: Consolas, 'Courier New', monospace;\n  font-size: 12px;\n  outline: none;\n  transition: border-color 0.15s ease, box-shadow 0.15s ease;\n}\n.cores-ppk-picker-input:focus {\n  border-color: var(--cores-ppk-accent);\n  box-shadow: 0 0 0 3px var(--cores-ppk-focus-ring);\n}\n.cores-ppk-picker-c-label {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.05em;\n  color: var(--cores-ppk-faint);\n}\n.cores-ppk-picker-c-chips {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 5px;\n}\n.cores-ppk-picker-chip {\n  appearance: none;\n  -webkit-appearance: none;\n  border: 1px solid var(--cores-ppk-border);\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  border-radius: 999px;\n  padding: 3px 10px;\n  font-size: 11px;\n  cursor: pointer;\n  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;\n}\n.cores-ppk-picker-chip:hover {\n  color: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-picker-chip.is-on {\n  border-color: var(--cores-ppk-accent);\n  color: var(--cores-ppk-accent);\n  background-color: var(--cores-ppk-accent-soft);\n  font-weight: 600;\n}\n.cores-ppk-picker-c-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n.cores-ppk-picker-action {\n  appearance: none;\n  -webkit-appearance: none;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  border: 1px solid var(--cores-ppk-border);\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  border-radius: 8px;\n  padding: 6px 14px;\n  font-size: 12px;\n  cursor: pointer;\n  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;\n}\n.cores-ppk-picker-action:hover {\n  color: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent-soft);\n  background-color: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-picker-action.is-on {\n  border-color: var(--cores-ppk-accent);\n  color: var(--cores-ppk-accent);\n  background-color: var(--cores-ppk-accent-soft);\n  font-weight: 600;\n}\n.cores-ppk-picker-c-empty {\n  font-size: 12px;\n  color: var(--cores-ppk-faint);\n  padding: 4px 0;\n}\n.cores-ppk-picker-c-meta {\n  font-size: 12px;\n  color: var(--cores-ppk-muted);\n}\n.cores-ppk-picker-c-btns {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n}\n.cores-ppk-picker-btn {\n  appearance: none;\n  -webkit-appearance: none;\n  border: 1px solid var(--cores-ppk-border);\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  border-radius: 8px;\n  padding: 5px 14px;\n  font-size: 12px;\n  cursor: pointer;\n  transition: background 0.15s ease, color 0.15s ease;\n}\n.cores-ppk-picker-btn:hover {\n  color: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent-soft);\n  background-color: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-picker-btn.primary {\n  background-color: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent);\n  color: #fff;\n  font-weight: 500;\n}\n.cores-ppk-picker-btn.primary:hover {\n  background-color: var(--cores-ppk-accent-hover);\n  color: #fff;\n}\n.cores-ppk-picker-highlight {\n  position: fixed;\n  z-index: 10012;\n  pointer-events: none;\n  border: 2px solid var(--cores-ppk-accent);\n  border-radius: 4px;\n  background-color: var(--cores-ppk-accent-soft);\n  transition: left 0.08s ease, top 0.08s ease, width 0.08s ease, height 0.08s ease;\n}\n\n/* ===== \u9002\u7528\u7f51\u5740 / \u5bfc\u5165\u5bfc\u51fa ===== */\n.cores-ppk-rules-hosts {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 10px 12px;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 10px;\n  background-color: var(--cores-ppk-bg);\n  flex: 0 0 auto;\n}\n.cores-ppk-rules-hosts-title {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.04em;\n  color: var(--cores-ppk-faint);\n}\n.cores-ppk-rules-hosts-chips {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  max-height: 88px;\n  overflow-y: auto;\n}\n.cores-ppk-rules-host-chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 3px 6px 3px 10px;\n  border-radius: 999px;\n  font-size: 11px;\n  color: var(--cores-ppk-muted);\n  background: var(--cores-ppk-btn-bg);\n  border: 1px solid var(--cores-ppk-border);\n  max-width: 100%;\n}\n.cores-ppk-rules-host-chip.is-current {\n  color: var(--cores-ppk-accent);\n  background: var(--cores-ppk-accent-soft);\n  border-color: var(--cores-ppk-accent-soft);\n  font-weight: 600;\n}\n.cores-ppk-rules-host-chip span {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  max-width: 200px;\n}\n.cores-ppk-rules-host-rm {\n  border: none;\n  background: transparent;\n  color: var(--cores-ppk-faint);\n  cursor: pointer;\n  font-size: 14px;\n  line-height: 1;\n  padding: 0 4px;\n  border-radius: 4px;\n}\n.cores-ppk-rules-host-rm:hover {\n  color: var(--cores-ppk-danger);\n  background: var(--cores-ppk-danger-soft);\n}\n.cores-ppk-rules-hosts-add {\n  display: flex;\n  gap: 6px;\n  align-items: center;\n}\n.cores-ppk-rules-hosts-input {\n  flex: 1;\n  min-width: 0;\n  padding: 6px 9px;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 8px;\n  background-color: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  font-size: 12px;\n  outline: none;\n}\n.cores-ppk-rules-hosts-input:focus {\n  border-color: var(--cores-ppk-accent);\n  box-shadow: 0 0 0 3px var(--cores-ppk-focus-ring);\n}\n.cores-ppk-rules-hosts-btn {\n  flex: 0 0 auto;\n  border: 1px solid var(--cores-ppk-border);\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  border-radius: 8px;\n  padding: 6px 12px;\n  font-size: 12px;\n  cursor: pointer;\n}\n.cores-ppk-rules-hosts-btn:hover {\n  color: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent-soft);\n  background: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-rules-io-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  align-items: center;\n  width: 100%;\n}\n.cores-ppk-rules-io {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border: 1px solid var(--cores-ppk-border);\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  border-radius: 8px;\n  padding: 8px 14px;\n  font-size: 12px;\n  cursor: pointer;\n  transition: background 0.15s ease, color 0.15s ease;\n}\n.cores-ppk-rules-io:hover {\n  color: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent-soft);\n  background: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-rules-io-menu {\n  position: fixed;\n  z-index: 10020;\n  min-width: 180px;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  padding: 6px;\n  background: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 10px;\n  box-shadow: var(--cores-ppk-shadow);\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',\n    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  font-size: 12px;\n  pointer-events: auto;\n}\n.cores-ppk-rules-io-menu button {\n  border: none;\n  background: transparent;\n  color: var(--cores-ppk-text);\n  text-align: left;\n  padding: 8px 10px;\n  border-radius: 7px;\n  cursor: pointer;\n}\n.cores-ppk-rules-io-menu button:hover {\n  background: var(--cores-ppk-btn-hover);\n  color: var(--cores-ppk-accent);\n}\n\n@media (max-width: 560px), (max-height: 560px) {\n  #cores-ppk-popup {\n    max-width: calc(100vw - 16px);\n    max-height: calc(100vh - 16px);\n  }\n  #cores-ppk-rules-panel {\n    width: calc(100vw - 16px);\n    height: calc(100dvh - 16px);\n    max-height: calc(100dvh - 16px);\n    border-radius: 12px;\n  }\n  #cores-ppk-toolbar {\n    right: 12px;\n    bottom: 12px;\n  }\n}\n";
  var style_page = "\nhtml > #cores-ppk-root[data-cores=\"root\"],\n#cores-ppk-root[data-cores=\"root\"][data-author=\"cores\"] {\n  all: initial !important;\n  position: fixed !important;\n  inset: 0 !important;\n  width: 100vw !important;\n  height: 100vh !important;\n  height: 100dvh !important;\n  max-width: none !important;\n  max-height: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  border: 0 !important;\n  background: transparent !important;\n  pointer-events: none !important;\n  z-index: 2147483646 !important;\n  overflow: visible !important;\n  transform: none !important;\n  filter: none !important;\n  clip: auto !important;\n  clip-path: none !important;\n  contain: none !important;\n  display: block !important;\n  opacity: 1 !important;\n  visibility: visible !important;\n  zoom: 1 !important;\n}\n#cores-ppk-root:popover-open {\n  position: fixed !important;\n  inset: 0 !important;\n  width: 100vw !important;\n  height: 100vh !important;\n  height: 100dvh !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  border: none !important;\n  background: transparent !important;\n  overflow: visible !important;\n}\n.cores-ppk-bold[data-cores-bold],\n.cores-ppk-bold {\n  font-weight: 700 !important;\n}\n";
  var style_refine = "\n/* ===== 0.3.1 UI refine: unified chrome, single-line primary ===== */\n:host, :root {\n  --cores-ppk-accent: #1e3a5f;\n  --cores-ppk-accent-hover: #152c49;\n  --cores-ppk-accent-fg: #fffcf8;\n  --cores-ppk-accent-soft: rgba(30, 58, 95, 0.10);\n  --cores-ppk-header-bg: #fbfaf7;\n  --cores-ppk-bg: #fffcf8;\n  --cores-ppk-surface: #fffcf8;\n  --cores-ppk-border: #e7e2d8;\n  --cores-ppk-text: #1a2230;\n  --cores-ppk-muted: #5c6573;\n  --cores-ppk-faint: #8b93a0;\n  --cores-ppk-radius: 16px;\n  --cores-ppk-radius-sm: 10px;\n}\n:host(.cores-ppk-theme-dark), :root.cores-ppk-theme-dark {\n  --cores-ppk-accent: #8fb0d6;\n  --cores-ppk-accent-hover: #b7cce6;\n  --cores-ppk-accent-fg: #101826;\n  --cores-ppk-accent-soft: rgba(143, 176, 214, 0.16);\n  --cores-ppk-header-bg: #141b28;\n  --cores-ppk-bg: #101826;\n  --cores-ppk-surface: #161e2c;\n  --cores-ppk-border: #2a3548;\n  --cores-ppk-text: #e8edf5;\n  --cores-ppk-muted: #9aa6b8;\n  --cores-ppk-faint: #6e7a8c;\n}\n\n#cores-ppk-toolbar {\n  width: 44px;\n  min-width: 44px;\n  height: 44px;\n  min-height: 44px;\n}\n\n#cores-ppk-rules-panel {\n  width: min(440px, calc(100vw - 24px));\n  border-radius: var(--cores-ppk-radius);\n  background: var(--cores-ppk-surface);\n}\n#cores-ppk-rules-panel-header {\n  height: 52px;\n  min-height: 52px;\n  padding: 0 10px 0 16px;\n  gap: 8px;\n  background: var(--cores-ppk-header-bg);\n}\n.cores-ppk-rules-title {\n  font-size: 15px;\n  font-weight: 650;\n  letter-spacing: -0.01em;\n  flex: 0 0 auto;\n}\n#cores-ppk-rules-host {\n  flex: 1;\n  min-width: 0;\n  display: inline-flex;\n  align-items: center;\n  height: 28px;\n  max-width: 56%;\n  padding: 0 10px;\n  border-radius: 999px;\n  background: var(--cores-ppk-btn-bg);\n  color: var(--cores-ppk-muted);\n  font-size: 12px;\n  font-weight: 500;\n}\n#cores-ppk-rules-panel .cores-ppk-panel-btn {\n  width: 32px;\n  height: 32px;\n  border-radius: 8px;\n}\n.cores-ppk-rules-tip { display: none; }\n\n#cores-ppk-rules-panel-body {\n  padding: 14px 16px 8px;\n  gap: 12px;\n  background: var(--cores-ppk-bg);\n}\n\n.cores-ppk-rules-empty {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  min-height: 160px;\n  padding: 28px 20px;\n  border: 1px dashed var(--cores-ppk-border);\n  border-radius: 12px;\n  color: var(--cores-ppk-muted);\n  font-size: 13.5px;\n  font-weight: 600;\n  background: transparent;\n}\n.cores-ppk-rules-empty small {\n  font-size: 12.5px;\n  font-weight: 400;\n  color: var(--cores-ppk-faint);\n}\n\n.cores-ppk-rules-hosts {\n  border-radius: 12px;\n  padding: 12px;\n  background: var(--cores-ppk-header-bg);\n}\n.cores-ppk-rules-hosts-title {\n  font-size: 11px;\n  letter-spacing: 0.02em;\n}\n.cores-ppk-rules-host-chip {\n  height: 28px;\n  padding: 0 6px 0 10px;\n  font-size: 12px;\n}\n.cores-ppk-rules-hosts-input {\n  height: 36px;\n  padding: 0 12px;\n  border-radius: var(--cores-ppk-radius-sm);\n  font-size: 12.5px;\n}\n.cores-ppk-rules-hosts-btn {\n  height: 36px;\n  padding: 0 14px;\n  border-radius: var(--cores-ppk-radius-sm);\n  font-size: 13px;\n  font-weight: 600;\n  white-space: nowrap;\n}\n\n#cores-ppk-rules-panel-foot {\n  height: auto;\n  min-height: 60px;\n  padding: 12px 16px 14px;\n  background: var(--cores-ppk-surface);\n}\n.cores-ppk-rules-io-row {\n  display: flex;\n  flex-wrap: nowrap;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n}\n.cores-ppk-rules-io {\n  height: 36px;\n  padding: 0 14px;\n  border-radius: var(--cores-ppk-radius-sm);\n  font-size: 13px;\n  font-weight: 550;\n  color: var(--cores-ppk-text);\n  background: var(--cores-ppk-surface);\n  white-space: nowrap;\n  flex: 0 0 auto;\n}\n.cores-ppk-rules-io:hover {\n  color: var(--cores-ppk-accent);\n}\n\n#cores-ppk-rules-pick {\n  display: inline-flex !important;\n  flex-direction: row !important;\n  flex-wrap: nowrap !important;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  height: 36px;\n  min-height: 36px;\n  max-height: 36px;\n  padding: 0 16px;\n  margin-left: auto;\n  border-radius: var(--cores-ppk-radius-sm);\n  font-size: 13.5px;\n  font-weight: 650;\n  line-height: 1;\n  letter-spacing: 0;\n  color: var(--cores-ppk-accent-fg);\n  background: var(--cores-ppk-accent);\n  border: 1px solid var(--cores-ppk-accent);\n  white-space: nowrap !important;\n  flex: 0 0 auto;\n  width: auto;\n}\n#cores-ppk-rules-pick span {\n  display: inline;\n  white-space: nowrap !important;\n  line-height: 1;\n}\n#cores-ppk-rules-pick svg {\n  width: 15px;\n  height: 15px;\n  flex: 0 0 auto;\n  stroke: currentColor;\n  fill: none;\n}\n#cores-ppk-rules-pick:hover {\n  background: var(--cores-ppk-accent-hover);\n  border-color: var(--cores-ppk-accent-hover);\n}\n\n@media (max-width: 420px) {\n  .cores-ppk-rules-io-row { flex-wrap: wrap; }\n  #cores-ppk-rules-pick { margin-left: 0; }\n}\n\n.cores-ppk-picker-bar,\n.cores-ppk-picker-confirm {\n  border-radius: var(--cores-ppk-radius);\n  border: 1px solid var(--cores-ppk-border);\n  box-shadow: var(--cores-ppk-shadow);\n  background: var(--cores-ppk-surface);\n}\n.cores-ppk-picker-confirm {\n  width: min(440px, calc(100vw - 24px));\n  padding: 16px;\n  gap: 10px;\n  bottom: 24px;\n}\n.cores-ppk-picker-c-title {\n  font-size: 15px;\n  font-weight: 650;\n}\n.cores-ppk-picker-c-label {\n  font-size: 11px;\n  font-weight: 650;\n}\n.cores-ppk-picker-input {\n  height: 36px;\n  padding: 0 12px;\n  border-radius: var(--cores-ppk-radius-sm);\n  font-size: 12.5px;\n}\n.cores-ppk-picker-chip,\n.cores-ppk-picker-cand {\n  height: 28px;\n  padding: 0 10px;\n  font-size: 12px;\n  border-radius: 999px;\n}\n.cores-ppk-picker-action {\n  height: 32px;\n  padding: 0 12px;\n  font-size: 12.5px;\n  border-radius: var(--cores-ppk-radius-sm);\n}\n.cores-ppk-picker-c-btns {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  padding-top: 4px;\n}\n.cores-ppk-picker-btn {\n  height: 36px;\n  padding: 0 14px;\n  border-radius: var(--cores-ppk-radius-sm);\n  font-size: 13px;\n  font-weight: 550;\n  white-space: nowrap;\n}\n.cores-ppk-picker-btn.primary {\n  background: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent);\n  color: var(--cores-ppk-accent-fg);\n  font-weight: 650;\n}\n\n#cores-ppk-popup { border-radius: var(--cores-ppk-radius); }\n#cores-ppk-popup-header { height: 52px; min-height: 52px; }\n#cores-ppk-popup-title { font-size: 15px; font-weight: 650; }\n.cores-ppk-popup-btn { width: 32px; height: 32px; }\n\n#cores-ppk-toolbar-menu { border-radius: var(--cores-ppk-radius); }\n\n.cores-ppk-rules-action-sel {\n  appearance: none;\n  -webkit-appearance: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  height: 36px;\n  min-height: 36px;\n  padding: 0 10px 0 12px;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: var(--cores-ppk-radius-sm);\n  background: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  font-family: inherit;\n  font-size: 13px;\n  font-weight: 550;\n  line-height: 1;\n  cursor: pointer;\n  white-space: nowrap;\n  flex: 0 0 auto;\n  max-width: 160px;\n}\n.cores-ppk-rules-action-sel span {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.cores-ppk-rules-action-sel svg {\n  width: 12px;\n  height: 12px;\n  stroke: currentColor;\n  fill: none;\n  opacity: 0.5;\n  flex: 0 0 auto;\n}\n.cores-ppk-rules-action-sel:hover {\n  color: var(--cores-ppk-accent);\n  border-color: var(--cores-ppk-accent-soft);\n  background: var(--cores-ppk-accent-soft);\n}\n.cores-ppk-rules-exec {\n  height: 36px;\n  padding: 0 12px;\n  border-radius: var(--cores-ppk-radius-sm);\n  font-size: 13px;\n}\n.cores-ppk-rules-del {\n  width: 36px;\n  height: 36px;\n  border-radius: var(--cores-ppk-radius-sm);\n}\n.cores-ppk-rules-io-menu,\n.cores-ppk-choice-menu {\n  min-width: 168px;\n  padding: 6px;\n  border-radius: 12px;\n  background: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  border: 1px solid var(--cores-ppk-border);\n  box-shadow: var(--cores-ppk-shadow);\n}\n.cores-ppk-rules-io-menu button,\n.cores-ppk-choice-menu button {\n  width: 100%;\n  height: 36px;\n  padding: 0 12px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--cores-ppk-text);\n  font-family: inherit;\n  font-size: 13px;\n  font-weight: 550;\n  text-align: left;\n  cursor: pointer;\n}\n.cores-ppk-rules-io-menu button:hover,\n.cores-ppk-choice-menu button:hover {\n  background: var(--cores-ppk-accent-soft);\n  color: var(--cores-ppk-accent);\n}\n.cores-ppk-choice-item.is-on {\n  background: var(--cores-ppk-accent-soft);\n  color: var(--cores-ppk-accent);\n  font-weight: 650;\n}\n\n.cores-ppk-remote-row { display:flex; gap:6px; align-items:center; }\n.cores-ppk-remote-input { flex:1; min-width:0; height:36px; padding:0 12px; border:1px solid var(--cores-ppk-border); border-radius: var(--cores-ppk-radius-sm); background: var(--cores-ppk-surface); color: var(--cores-ppk-text); font-size:12.5px; outline:none; }\n.cores-ppk-remote-input:focus { border-color: var(--cores-ppk-accent); box-shadow: 0 0 0 3px var(--cores-ppk-focus-ring); }\n.cores-ppk-remote-meta { font-size:11px; color: var(--cores-ppk-faint); line-height:1.45; }\n.cores-ppk-remote-opts { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }\n.cores-ppk-remote-check { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color: var(--cores-ppk-muted); cursor:pointer; user-select:none; }\n\n#cores-ppk-remote-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 10002;\n  background: var(--cores-ppk-overlay);\n  opacity: 0;\n  pointer-events: none;\n}\n#cores-ppk-remote-backdrop.visible {\n  opacity: 1;\n  pointer-events: auto;\n}\n#cores-ppk-remote-panel {\n  position: fixed;\n  z-index: 10003;\n  left: 50%;\n  top: 50%;\n  transform: translate(-50%, -48%) scale(0.97);\n  width: min(440px, calc(100vw - 24px));\n  height: auto;\n  max-height: min(560px, calc(100dvh - 24px));\n  background: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: 16px;\n  box-shadow: var(--cores-ppk-shadow);\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  opacity: 0;\n  pointer-events: none;\n}\n#cores-ppk-remote-panel.visible {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translate(-50%, -50%) scale(1);\n}\n#cores-ppk-remote-header {\n  height: 52px;\n  min-height: 52px;\n  padding: 0 10px 0 16px;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border-bottom: 1px solid var(--cores-ppk-border);\n  background: var(--cores-ppk-header-bg);\n  flex: 0 0 auto;\n}\n#cores-ppk-remote-panel .cores-ppk-panel-btn {\n  width: 32px;\n  height: 32px;\n  margin-left: auto;\n  border: 1px solid transparent;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--cores-ppk-muted);\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n#cores-ppk-remote-panel { width: min(440px, calc(100vw - 24px)); height: auto; max-height: min(520px, calc(100dvh - 24px)); }\n#cores-ppk-remote-body { padding: 16px; display:flex; flex-direction:column; gap:12px; }\n#cores-ppk-remote-toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%) translateY(8px); z-index:10006; background:var(--cores-ppk-text); color:var(--cores-ppk-bg); font-size:12px; padding:8px 16px; border-radius:999px; opacity:0; pointer-events:none; }\n#cores-ppk-remote-toast.visible { opacity:1; transform:translateX(-50%) translateY(0); }\n.cores-ppk-rules-panel-header { display:flex; align-items:center; gap:10px; }\n\\n}\\n\n.cores-ppk-remote-row {\n  display: flex;\n  gap: 6px;\n  align-items: center;\n}\n.cores-ppk-remote-input {\n  flex: 1;\n  min-width: 0;\n  height: 36px;\n  padding: 0 12px;\n  border: 1px solid var(--cores-ppk-border);\n  border-radius: var(--cores-ppk-radius-sm);\n  background: var(--cores-ppk-surface);\n  color: var(--cores-ppk-text);\n  font-size: 12.5px;\n  outline: none;\n}\n.cores-ppk-remote-input:focus {\n  border-color: var(--cores-ppk-accent);\n  box-shadow: 0 0 0 3px var(--cores-ppk-focus-ring);\n}\n.cores-ppk-remote-meta {\n  font-size: 11px;\n  color: var(--cores-ppk-faint);\n  line-height: 1.45;\n}\n.cores-ppk-remote-opts {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex-wrap: wrap;\n}\n.cores-ppk-remote-check {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 12.5px;\n  color: var(--cores-ppk-muted);\n  cursor: pointer;\n  user-select: none;\n}\n.cores-ppk-remote-check input {\n  width: 14px;\n  height: 14px;\n}\n";


  var THEME_KEY = "ppk.theme";
  function readTheme() {
    const v = gm.getValue(THEME_KEY, "light");
    return v === "dark" ? "dark" : "light";
  }
  function applyThemeClass() {
    const dark = readTheme() === "dark";
    if (uiHost) uiHost.classList.toggle("cores-ppk-theme-dark", dark);
  }
  function toggleTheme() {
    gm.setValue(THEME_KEY, readTheme() === "dark" ? "light" : "dark");
    applyThemeClass();
  }

  // src/core/actionRegistry.js
  var registry = /* @__PURE__ */ new Map();
  function registerAction(def) {
    if (!def || !def.id) throw new Error("action requires id");
    if (registry.has(def.id)) throw new Error("action already registered: " + def.id);
    registry.set(def.id, {
      kind: "apply",
      targetTypes: null,
      // null = 任意类型；数组 = 仅这些类型可选
      label: def.id,
      description: "",
      ...def
    });
    return def;
  }
  function getActions(targetType) {
    const list = [];
    for (const action of registry.values()) {
      if (!action.targetTypes || action.targetTypes.includes(targetType)) list.push(action);
    }
    return list;
  }
  function getAction(id) {
    return registry.get(id) || null;
  }
  registerAction({
    id: "popup-open",
    label: "弹窗打开",
    description: "点击匹配的元素，在页内弹窗打开内容",
    kind: "intercept",
    targetTypes: ["link", "card", "button", "region"]
  });
  registerAction({
    id: "hide",
    label: "隐藏",
    description: "隐藏匹配的元素（可在规则面板关闭恢复）",
    apply(el2) {
      if (el2.__coresPpkDisplay === void 0) el2.__coresPpkDisplay = el2.style.display || "";
      el2.style.display = "none";
    },
    undo(el2) {
      if (el2.__coresPpkDisplay !== void 0) {
        el2.style.display = el2.__coresPpkDisplay;
        delete el2.__coresPpkDisplay;
      }
    }
  });
  registerAction({
    id: "bold",
    label: "加粗",
    description: "将匹配的元素文字加粗",
    targetTypes: ["text", "card", "region", "link", "button"],
    apply(el2) {
      el2.classList.add("cores-ppk-bold");
      el2.setAttribute("data-cores-bold", "1");
    },
    undo(el2) {
      el2.classList.remove("cores-ppk-bold");
      el2.removeAttribute("data-cores-bold");
    }
  });
  registerAction({
    id: "remove",
    label: "移除",
    description: "从页面移除匹配的元素（不可恢复）",
    apply(el2) {
      el2.remove();
    }
  });
  registerAction({
    id: "copy",
    label: "复制",
    description: "批量提取匹配元素的数据并复制到剪贴板",
    kind: "data",
    targetTypes: ["link", "card", "image", "video", "text", "table", "region"],
    needs: ["title", "text", "url", "price", "image"],
    run(items) {
      const lines = items.map((it) => {
        const parts = [it.title, it.text, it.url, it.price, it.image].filter(Boolean);
        return parts.join(" | ");
      });
      const text = lines.join("\n");
      copyToClipboard(text);
      return text;
    }
  });
  registerAction({
    id: "export",
    label: "导出CSV",
    description: "批量提取匹配元素并导出为 CSV 文件",
    kind: "data",
    targetTypes: ["card", "link", "table", "region", "text", "image", "video"],
    needs: ["title", "text", "url", "image", "price"],
    run(items) {
      const headers = ["title", "text", "url", "image", "price"];
      const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      const rows = items.map((it) => headers.map((h) => esc(it[h] ?? "")).join(","));
      const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      downloadFile("page-picker-export.csv", csv);
      return csv;
    }
  });
  function copyToClipboard(text) {
    const clip = gmApi("GM_clipboard") || gmApi("GM.setClipboard");
    if (clip) {
      try {
        if (typeof clip.setData === "function") { clip.setData(text); return; }
        if (typeof clip === "function") { clip(text); return; }
      } catch {}
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(text)).catch(() => {});
        return;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = String(text);
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;width:1px;height:1px;";
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch {}
  }
  function downloadViaAnchor(filename, dataUrl) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    const parent = document.body || document.documentElement;
    parent.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 0);
  }
  function gmDownload(filename, dataUrl) {
    const fn = gmApi("GM_download");
    if (!fn) return false;
    try {
      fn({ url: dataUrl, name: filename, saveAs: true });
      return true;
    } catch {
      return false;
    }
  }
  function downloadFile(filename, content) {
    const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(content);
    if (!gmDownload(filename, dataUrl)) downloadViaAnchor(filename, dataUrl);
  }

  // src/core/RulesManager.js
  var KEY = "ppk:rules";
  var SITE_KEY = "ppk:siteEnabled";
  var DEFAULT_ACTION = "popup-open";
  function fallbackAction(targetType) {
    const list = getActions(targetType);
    if (!list.length) return DEFAULT_ACTION;
    return (list.find((a) => a.id === "popup-open") || list[0]).id;
  }
  function normalizeRule(r) {
    const rule = {
      selector: (r.selector || "").trim(),
      targetType: r.targetType || "link",
      action: r.action || DEFAULT_ACTION,
      enabled: r.enabled !== false
    };
    if (!getAction(rule.action) || !getActions(rule.targetType).some((a) => a.id === rule.action)) {
      rule.action = fallbackAction(rule.targetType);
    }
    return rule;
  }
  function uid() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }
  /** 主机名是否命中规则包 hosts（支持 *.example.com 通配） */
  function hostMatches(pattern, hostname) {
    const p = String(pattern || "").trim().toLowerCase();
    const h = String(hostname || "").trim().toLowerCase();
    if (!p || !h) return false;
    if (p === h) return true;
    if (p.startsWith("*.")) {
      const suf = p.slice(1); // .example.com
      return h === p.slice(2) || h.endsWith(suf);
    }
    return false;
  }
  function normalizeHosts(list) {
    const out = [];
    const seen = /* @__PURE__ */ Object.create(null);
    for (const raw of list || []) {
      let s = String(raw || "").trim().toLowerCase();
      if (!s) continue;
      // 允许用户贴完整 URL，自动取 hostname
      try {
        if (/^https?:\/\//i.test(s)) s = new URL(s).hostname.toLowerCase();
      } catch {
      }
      s = s.replace(/\/+$/, "");
      if (!s || seen[s]) continue;
      seen[s] = 1;
      out.push(s);
    }
    return out;
  }
  function normalizePack(pack) {
    const hosts = normalizeHosts(pack && pack.hosts);
    const rules = Array.isArray(pack && pack.rules) ? pack.rules.filter((r) => r && typeof r.selector === "string" && r.selector.trim()).map(normalizeRule) : [];
    return {
      id: pack && pack.id || uid(),
      name: pack && typeof pack.name === "string" ? pack.name : "",
      hosts: hosts.length ? hosts : [],
      enabled: pack && pack.enabled !== false,
      rules
    };
  }
  var RulesManager = class {
    constructor() {
      this.packs = [];
      this.siteEnabled = {};
      this._loaded = false;
      this._siteLoaded = false;
    }
    load() {
      if (this._loaded) return this.packs;
      this._loaded = true;
      const fromScript = this._migrate(gm.readScriptValue(KEY, null));
      const fromLocal = this._migrate(localGet(KEY, null));
      this.packs = this._mergePacks(fromScript, fromLocal);
      if (fromLocal.length && fromScript.length !== this.packs.length) {
        gm.writeScriptValue(KEY, { version: 2, packs: this.packs });
      }
      return this.packs;
    }
    reloadFromStorage() {
      this._loaded = false;
      if (gm._cache) delete gm._cache[KEY];
      return this.load();
    }
    _mergePacks(a, b) {
      const map = Object.create(null);
      const order = [];
      const take = (list) => {
        for (const pack of list || []) {
          if (!pack) continue;
          const id = pack.id || (pack.hosts || []).join("|") || uid();
          if (!map[id]) {
            map[id] = normalizePack(pack);
            order.push(id);
          } else {
            const cur = map[id];
            const hosts = normalizeHosts([].concat(cur.hosts || [], pack.hosts || []));
            const seen = Object.create(null);
            const rules = [];
            for (const r of [].concat(cur.rules || [], pack.rules || [])) {
              const k = (r.selector || "") + "\0" + (r.action || "") + "\0" + (r.targetType || "");
              if (seen[k]) continue;
              seen[k] = 1;
              rules.push(normalizeRule(r));
            }
            map[id] = normalizePack({ ...cur, hosts, rules, enabled: cur.enabled !== false && pack.enabled !== false });
          }
        }
      };
      take(a);
      take(b);
      return order.map((id) => map[id]).filter(Boolean);
    }
    /** 兼容旧版 { host: Rule[] } 与新版 { version:2, packs:[] } */
    _migrate(raw) {
      if (!raw) return [];
      if (Array.isArray(raw)) {
        return raw.map(normalizePack).filter((p) => p.hosts.length);
      }
      if (typeof raw !== "object") return [];
      if (raw.version === 2 && Array.isArray(raw.packs)) {
        return raw.packs.map(normalizePack).filter((p) => p.hosts.length || (p.rules && p.rules.length));
      }
      // 旧格式：按 hostname 分桶
      const packs = [];
      for (const [host, list] of Object.entries(raw)) {
        if (!Array.isArray(list)) continue;
        const rules = list.filter((r) => r && typeof r.selector === "string" && r.selector.trim()).map(normalizeRule);
        if (!host) continue;
        packs.push(normalizePack({ id: uid(), hosts: [host], rules, enabled: true }));
      }
      return packs;
    }
    _persist() {
      const existing = this._migrate(gm.readScriptValue(KEY, null));
      this.packs = this._mergePacks(existing, this.packs || []);
      gm.writeScriptValue(KEY, { version: 2, packs: this.packs });
    }
    getPacks() {
      return this.load();
    }
    /** 命中某 hostname 的所有规则包 */
    findPacks(hostname) {
      this.load();
      const h = String(hostname || "").toLowerCase();
      return this.packs.filter((p) => p.hosts.some((pat) => hostMatches(pat, h)));
    }
    /**
     * 获取/创建当前站点的主规则包（优先精确包含该 host 的包，否则新建）。
     * 规则面板的增删改都作用在这个包上；一套规则可通过 hosts 绑定多个网址。
     */
    getOrCreatePack(hostname) {
      this.load();
      const h = String(hostname || "").toLowerCase();
      if (!h) return null;
      let pack = this.packs.find((p) => p.hosts.some((pat) => pat === h));
      if (!pack) {
        pack = this.packs.find((p) => p.hosts.some((pat) => hostMatches(pat, h)));
      }
      if (!pack) {
        pack = normalizePack({ id: uid(), hosts: [h], rules: [], enabled: true });
        this.packs.push(pack);
        this._persist();
      }
      return pack;
    }
    getRules(hostname) {
      const packs = this.findPacks(hostname).filter((p) => p.enabled !== false);
      const out = [];
      const seen = /* @__PURE__ */ Object.create(null);
      for (const p of packs) {
        for (const r of p.rules) {
          const k = r.selector + "\0" + r.action;
          if (seen[k]) continue;
          seen[k] = 1;
          out.push(r);
        }
      }
      return out;
    }
    /** 站点级开关：当前站点规则是否整体启用（缺省启用） */
    isSiteEnabled(hostname) {
      if (!this._siteLoaded) {
        this._siteLoaded = true;
        const raw = gm.getValue(SITE_KEY, {});
        if (raw && typeof raw === "object") this.siteEnabled = raw;
      }
      return this.siteEnabled[hostname] !== false;
    }
    setSiteEnabled(hostname, enabled) {
      this.isSiteEnabled(hostname);
      this.siteEnabled[hostname] = !!enabled;
      gm.setValue(SITE_KEY, this.siteEnabled);
      return this.siteEnabled[hostname];
    }
    getRule(hostname, index) {
      const pack = this.getOrCreatePack(hostname);
      return pack && pack.rules[index] || null;
    }
    /** 当前站点主包的规则列表（面板编辑用，不合并其它包） */
    getPackRules(hostname) {
      const pack = this.getOrCreatePack(hostname);
      return pack ? pack.rules : [];
    }
    addRule(hostname, { selector, targetType = "link", action = DEFAULT_ACTION }) {
      const pack = this.getOrCreatePack(hostname);
      if (!pack) return [];
      const rule = normalizeRule({ selector, targetType, action });
      if (!rule.selector) return pack.rules;
      if (!pack.rules.some((r) => r.selector === rule.selector && r.action === rule.action)) {
        pack.rules.push(rule);
        this._persist();
      }
      return pack.rules;
    }
    removeRule(hostname, index) {
      const pack = this.getOrCreatePack(hostname);
      if (!pack) return [];
      pack.rules.splice(index, 1);
      this._persist();
      return pack.rules;
    }
    updateRule(hostname, index, patch) {
      const pack = this.getOrCreatePack(hostname);
      if (!pack) return [];
      const rule = pack.rules[index];
      if (!rule) return pack.rules;
      Object.assign(rule, normalizeRule({ ...rule, ...patch }));
      this._persist();
      return pack.rules;
    }
    toggleRule(hostname, index) {
      const pack = this.getOrCreatePack(hostname);
      if (!pack) return [];
      const rule = pack.rules[index];
      if (!rule) return pack.rules;
      rule.enabled = !(rule.enabled !== false);
      this._persist();
      return pack.rules;
    }
    /** 设置主规则包适用的网址列表（至少保留当前 hostname） */
    setPackHosts(hostname, hosts) {
      const pack = this.getOrCreatePack(hostname);
      if (!pack) return [];
      let list = normalizeHosts(hosts);
      const h = String(hostname || "").toLowerCase();
      if (h && !list.some((pat) => hostMatches(pat, h) || pat === h)) {
        list = [h, ...list];
      }
      if (!list.length && h) list = [h];
      pack.hosts = list;
      this._persist();
      return pack.hosts;
    }
    getPackHosts(hostname) {
      const pack = this.getOrCreatePack(hostname);
      return pack ? [...pack.hosts] : [];
    }
    /** 导出全部配置（所有规则包 / 所有域名，不只当前站） */
    exportAll() {
      this.reloadFromStorage();
      this.isSiteEnabled("x");
      const packs = this.packs.map((p) => ({
        id: p.id,
        name: p.name || "",
        hosts: [...p.hosts],
        enabled: p.enabled !== false,
        rules: p.rules.map((r) => ({ ...r }))
      }));
      const hosts = [];
      const seen = Object.create(null);
      for (const p of packs) {
        for (const h of p.hosts || []) {
          if (!h || seen[h]) continue;
          seen[h] = 1;
          hosts.push(h);
        }
      }
      return {
        version: 2,
        exportedAt: new Date().toISOString(),
        name: "网页对象工具库配置",
        hosts,
        packs,
        siteEnabled: { ...this.siteEnabled }
      };
    }
    /** 仅导出当前站点主规则包 */
    exportPack(hostname) {
      const pack = this.getOrCreatePack(hostname);
      if (!pack) return null;
      return {
        version: 2,
        exportedAt: new Date().toISOString(),
        name: pack.name || hostname,
        packs: [{
          id: pack.id,
          name: pack.name || "",
          hosts: [...pack.hosts],
          enabled: pack.enabled !== false,
          rules: pack.rules.map((r) => ({ ...r }))
        }]
      };
    }
    /**
     * 导入配置。
     * mode: 'merge' 按 hosts 合并进已有包 / 新建；'replace' 清空后整份替换。
     * @returns {{ ok:boolean, packs:number, rules:number, message:string }}
     */
    importConfig(data, mode = "merge") {
      let parsed = data;
      if (typeof data === "string") {
        try {
          parsed = JSON.parse(data);
        } catch (err) {
          return { ok: false, packs: 0, rules: 0, hosts: [], message: "JSON 解析失败" };
        }
      }
      if (!parsed || typeof parsed !== "object") {
        return { ok: false, packs: 0, rules: 0, hosts: [], message: "无效的配置数据" };
      }
      let incoming = [];
      if (Array.isArray(parsed.packs)) {
        incoming = parsed.packs.map(normalizePack);
      } else if (Array.isArray(parsed)) {
        incoming = parsed.map(normalizePack);
      } else if (parsed.rules && !parsed.packs) {
        incoming = [normalizePack(parsed)];
      } else {
        for (const [host, list] of Object.entries(parsed)) {
          if (host === "version" || host === "exportedAt" || host === "name" || host === "siteEnabled" || host === "hosts") continue;
          if (!Array.isArray(list)) continue;
          incoming.push(normalizePack({ hosts: [host], rules: list }));
        }
      }
      incoming = incoming.filter((p) => (p.hosts && p.hosts.length) || (p.rules && p.rules.length));
      incoming = incoming.map((p) => {
        if (!p.hosts.length && parsed && parsed.name) p.hosts = normalizeHosts([parsed.name]);
        return p;
      }).filter((p) => p.hosts.length);
      if (!incoming.length) {
        return { ok: false, packs: 0, rules: 0, hosts: [], message: "配置中没有可导入的规则包" };
      }
      this.reloadFromStorage();
      if (mode === "replace") {
        this.packs = incoming.map((p) => normalizePack({ ...p, id: p.id || uid() }));
      } else {
        for (const src of incoming) {
          let target = this.packs.find((p) => p.id && src.id && p.id === src.id);
          if (!target) {
            target = this.packs.find((p) => p.hosts.some((h) => src.hosts.some((x) => hostMatches(h, x) || hostMatches(x, h))));
          }
          if (!target) {
            this.packs.push(normalizePack({ ...src, id: src.id || uid() }));
          } else {
            for (const r of src.rules) {
              if (!target.rules.some((x) => x.selector === r.selector && x.action === r.action)) {
                target.rules.push(normalizeRule(r));
              }
            }
            target.hosts = normalizeHosts([...target.hosts, ...src.hosts]);
          }
        }
      }
      if (parsed.siteEnabled && typeof parsed.siteEnabled === "object") {
        this.isSiteEnabled("x");
        if (mode === "replace") this.siteEnabled = { ...parsed.siteEnabled };
        else this.siteEnabled = { ...this.siteEnabled, ...parsed.siteEnabled };
        this._siteLoaded = true;
        gm.writeScriptValue(SITE_KEY, this.siteEnabled);
      }
      gm.writeScriptValue(KEY, { version: 2, packs: this.packs });
      this._loaded = true;
      const hostSet = [];
      const seenH = Object.create(null);
      for (const p of this.packs) {
        for (const h of p.hosts || []) {
          if (!h || seenH[h]) continue;
          seenH[h] = 1;
          hostSet.push(h);
        }
      }
      const ruleCount = this.packs.reduce((n, pack) => n + ((pack.rules || []).length), 0);
      const incomingHosts = [];
      const seenIn = Object.create(null);
      for (const p of incoming) {
        for (const h of p.hosts || []) {
          if (!h || seenIn[h]) continue;
          seenIn[h] = 1;
          incomingHosts.push(h);
        }
      }
      return {
        ok: true,
        packs: this.packs.length,
        rules: ruleCount,
        hosts: hostSet,
        incomingHosts,
        message: (mode === "replace" ? "已替换全局配置" : "已合并进全局存储") + "：" + incomingHosts.length + " 个域名 · 现在共 " + hostSet.length + " 站 · " + ruleCount + " 条规则"
      };
    }
    /**
     * 命中当前站点「弹窗打开」规则的链接（仅 intercept 类动作参与拦截）。
     * @returns {{url:string,title:string,element:Element}|null}
     */
    match(event, hostname) {
      if (!this.isSiteEnabled(hostname)) return null;
      const rules = this.getRules(hostname);
      if (!rules.length) return null;
      for (const rule of rules) {
        if (rule.enabled === false) continue;
        const action = getAction(rule.action);
        if (!action || action.kind !== "intercept") continue;
        let el2 = null;
        try {
          el2 = event.target.closest ? event.target.closest(rule.selector) : null;
        } catch {
          el2 = null;
        }
        if (!el2) continue;
        const link = this._extractLink(el2);
        if (link) return link;
      }
      return null;
    }
    _extractLink(el2) {
      const get = (a) => el2.getAttribute ? el2.getAttribute(a) : null;
      if (el2.tagName === "A") {
        const url = this._resolve(get("href"));
        if (url) return { url, title: el2.title || (el2.textContent || "").trim() || "查看内容", element: el2 };
      }
      const dataUrl = get("data-topic-url") || get("data-href");
      if (dataUrl) {
        const url = this._resolve(dataUrl);
        if (url) {
          return { url, title: el2.title || (el2.textContent || "").trim().slice(0, 60) || "查看内容", element: el2 };
        }
      }
      const inner = el2.querySelector ? el2.querySelector("a[href]") : null;
      if (inner) {
        const url = this._resolve(inner.getAttribute("href"));
        if (url) return { url, title: inner.title || (inner.textContent || "").trim() || "查看内容", element: inner };
      }
      const outer = el2.closest ? el2.closest("a[href]") : null;
      if (outer) {
        const url = this._resolve(outer.getAttribute("href"));
        if (url) return { url, title: outer.title || (outer.textContent || "").trim() || "查看内容", element: outer };
      }
      return null;
    }
    _resolve(href) {
      if (!href || typeof href !== "string") return null;
      try {
        return new URL(href, window.location.href).href;
      } catch {
        return null;
      }
    }
  };
  var rulesManager = new RulesManager();

  // src/core/ruleEngine.js
  var RuleEngine = class {
    applyRules(hostname) {
      if (!rulesManager.isSiteEnabled(hostname)) return;
      const rules = rulesManager.getRules(hostname);
      for (const rule of rules) {
        if (rule.enabled === false) continue;
        this.applyRule(rule);
      }
    }
    /** 回滚某站点所有 apply 类规则（站点整体关闭时调用） */
    unapplyRules(hostname) {
      const rules = rulesManager.getRules(hostname);
      for (const rule of rules) {
        if (rule.enabled === false) continue;
        this.unapplyRule(rule);
      }
    }
    applyRule(rule) {
      const action = getAction(rule.action);
      if (!action || action.kind !== "apply") return;
      let nodes = [];
      try {
        nodes = document.querySelectorAll(rule.selector);
      } catch {
        return;
      }
      for (const node of nodes) {
        try {
          action.apply(node, { rule });
        } catch (err) {
          console.error("[RuleEngine] apply error", err);
        }
      }
    }
    unapplyRule(rule) {
      const action = getAction(rule.action);
      if (!action || action.kind !== "apply" || typeof action.undo !== "function") return;
      let nodes = [];
      try {
        nodes = document.querySelectorAll(rule.selector);
      } catch {
        return;
      }
      for (const node of nodes) {
        try {
          action.undo(node, { rule });
        } catch (err) {
          console.error("[RuleEngine] undo error", err);
        }
      }
    }
  };
  var ruleEngine = new RuleEngine();

  // src/core/pickerState.js
  var picking = false;
  var pickerState = {
    get picking() {
      return picking;
    },
    setPicking(v) {
      picking = !!v;
    }
  };

  // src/utils/dom.js
  var ICON_PATHS = {
    close: { path: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' },
    moon: { path: '<path d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3z"></path>' },
    chevron: { path: '<polyline points="6 9 12 15 18 9"></polyline>' },
    plus: { path: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>' },
    settings: {
      path: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
    },
    external: {
      path: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>'
    },
    target: {
      path: '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>'
    }
  };
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === void 0) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of children.flat()) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }


  function viewportBox() {
    const vv = window.visualViewport;
    if (vv && vv.width && vv.height) {
      return {
        left: vv.offsetLeft || 0,
        top: vv.offsetTop || 0,
        w: vv.width,
        h: vv.height
      };
    }
    return { left: 0, top: 0, w: window.innerWidth || 320, h: window.innerHeight || 480 };
  }
  function placeFloatingMenu(anchor, menu) {
    if (!menu.parentNode) uiAppend(menu);
    menu.style.position = "fixed";
    menu.style.zIndex = "2147483646";
    menu.style.maxWidth = "min(280px, calc(100vw - 16px))";
    menu.style.overflowY = "auto";
    menu.style.webkitOverflowScrolling = "touch";
    const pad = 8;
    const place = () => {
      if (!menu.isConnected || !anchor) return;
      const vp = viewportBox();
      const rect = anchor.getBoundingClientRect();
      menu.style.maxHeight = Math.max(96, vp.h - pad * 2) + "px";
      const mw = Math.min(Math.max(menu.offsetWidth || 180, rect.width), vp.w - pad * 2);
      const mh = menu.offsetHeight || 160;
      let left = rect.left;
      if (left + mw > vp.left + vp.w - pad) left = vp.left + vp.w - pad - mw;
      if (left < vp.left + pad) left = vp.left + pad;
      const spaceBelow = vp.top + vp.h - (rect.bottom) - pad;
      const spaceAbove = rect.top - vp.top - pad;
      let top;
      if (mh <= spaceBelow) {
        top = rect.bottom + 6;
      } else if (mh <= spaceAbove) {
        top = rect.top - mh - 6;
      } else if (spaceAbove > spaceBelow) {
        top = vp.top + pad;
      } else {
        top = vp.top + vp.h - pad - Math.min(mh, vp.h - pad * 2);
      }
      if (top < vp.top + pad) top = vp.top + pad;
      if (top + Math.min(mh, vp.h - pad * 2) > vp.top + vp.h - pad) {
        top = vp.top + vp.h - pad - Math.min(mh, vp.h - pad * 2);
      }
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      menu.style.minWidth = mw + "px";
    };
    place();
    requestAnimationFrame(place);
    const closer = (ev) => {
      const path = ev.composedPath ? ev.composedPath() : [ev.target];
      if (!path.includes(menu) && !path.includes(anchor)) {
        menu.remove();
        document.removeEventListener("mousedown", closer, true);
        document.removeEventListener("touchstart", closer, true);
      }
    };
    setTimeout(() => {
      document.addEventListener("mousedown", closer, true);
      document.addEventListener("touchstart", closer, true);
    }, 0);
    return menu;
  }

  function dismissChoiceMenus() {
    try {
      getUIShadow().querySelectorAll(".cores-ppk-choice-menu").forEach((n) => n.remove());
    } catch {}
  }
  function openChoiceMenu(anchor, items, currentValue, onPick) {
    dismissChoiceMenus();
    const menu = el("div", { class: "cores-ppk-rules-io-menu cores-ppk-choice-menu" });
    items.forEach((item) => {
      const b = el("button", {
        type: "button",
        class: "cores-ppk-choice-item" + (item.value === currentValue ? " is-on" : ""),
        text: item.label
      });
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.remove();
        if (item.value !== currentValue) onPick(item.value);
      });
      menu.appendChild(b);
    });
    placeFloatingMenu(anchor, menu);
    return menu;
  }

  function svg(inner, attrs = {}) {
    const ns = "http://www.w3.org/2000/svg";
    const node = document.createElementNS(ns, "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor");
    node.setAttribute("stroke-width", "2");
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    const holder = document.createElement("div");
    holder.innerHTML = inner.trim();
    moveSvgChildren(node, holder);
    return node;
  }
  function moveSvgChildren(svgParent, container) {
    for (const child of [...container.childNodes]) {
      if (child.nodeType !== 1) continue;
      const el2 = document.createElementNS(svgParent.namespaceURI, child.localName);
      for (const attr of [...child.attributes]) el2.setAttribute(attr.name, attr.value);
      moveSvgChildren(el2, child);
      svgParent.appendChild(el2);
    }
  }
  function svgIcon(iconName, { size = 18 } = {}) {
    const icon = ICON_PATHS[iconName];
    if (!icon) return svg("", { width: size, height: size });
    const node = svg(icon.path, { width: size, height: size });
    for (const [key, value] of Object.entries(icon.attrs || {})) node.setAttribute(key, value);
    return node;
  }

  // src/ui/PopupPanel.js
  var PopupPanel = class {
    constructor() {
      this.root = null;
      this.overlay = null;
      this.titleEl = null;
      this.frame = null;
    }
    ensure() {
      if (this.root) return;
      this.overlay = el("div", { id: "cores-ppk-popup-overlay", onclick: () => this.close() });
      this.titleEl = el("span", { id: "cores-ppk-popup-title", text: "加载中…" });
      const openBtn = el("button", { type: "button", class: "cores-ppk-popup-btn", title: "在新标签页打开", onclick: () => this._openExternal() });
      openBtn.appendChild(svgIcon("external", { size: 15 }));
      const closeBtn = el("button", { type: "button", class: "cores-ppk-popup-btn", title: "关闭 (Esc)", onclick: () => this.close() });
      closeBtn.appendChild(svgIcon("close", { size: 15 }));
      const actions = el("div", { class: "cores-ppk-popup-actions" }, openBtn, closeBtn);
      const header = el("div", { id: "cores-ppk-popup-header" }, this.titleEl, actions);
      this.frame = el("iframe", { id: "cores-ppk-popup-frame" });
      const body = el("div", { id: "cores-ppk-popup-body" }, this.frame);
      this.root = el("div", { id: "cores-ppk-popup" }, header, body);
      uiAppend(this.overlay);
      uiAppend(this.root);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.close();
      });
    }
    show(title, url) {
      this.ensure();
      this.titleEl.textContent = title || "查看内容";
      this.frame.src = url;
      this.root.classList.add("visible");
      this.overlay.classList.add("visible");
    }
    close() {
      if (!this.root) return;
      this.root.classList.remove("visible");
      this.overlay.classList.remove("visible");
      this.frame.src = "about:blank";
    }
    _openExternal() {
      const url = this.frame.src;
      if (url && url !== "about:blank") window.open(url, "_blank", "noopener");
    }
  };

  // src/core/extractor.js
  function cleanText(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim();
  }
  var extractors = {
    link: {
      extract(el2) {
        const a = el2.closest ? el2.closest("a[href]") : null;
        const url = a && a.href || el2.href || "";
        return { url, title: a?.title || cleanText(el2.textContent) || "" };
      }
    },
    image: {
      extract(el2) {
        const img = el2.tagName === "IMG" ? el2 : el2.querySelector?.("img");
        const url = img && (img.getAttribute("data-original") || img.getAttribute("data-src") || img.src) || (el2.tagName === "IMG" ? el2.src : "");
        const link = el2.closest?.("a[href]");
        return { image: url, url: link?.href || "", title: img?.alt || "" };
      }
    },
    video: {
      extract(el2) {
        const v = el2.tagName === "VIDEO" ? el2 : el2.querySelector?.("video");
        return {
          image: v?.poster || "",
          url: v?.src || el2.querySelector?.("source")?.src || "",
          title: el2.getAttribute?.("title") || cleanText(el2.textContent) || ""
        };
      }
    },
    text: {
      extract(el2) {
        return { text: cleanText(el2.innerText || el2.textContent) };
      }
    },
    table: {
      extract(el2) {
        const table = el2.tagName === "TABLE" ? el2 : el2.querySelector?.("table");
        const rows = [];
        if (table) {
          for (const tr of table.querySelectorAll("tr")) {
            const cells = [...tr.querySelectorAll("th,td")].map((c) => cleanText(c.textContent));
            if (cells.length) rows.push(cells);
          }
        }
        return { rows, text: rows.map((r) => r.join(",")).join("\n") };
      }
    },
    card: {
      extract(el2) {
        const a = el2.closest ? el2.closest("a[href]") : null;
        const link = a && a.href || el2.href || "";
        const img = el2.querySelector?.("img");
        const image = img ? img.getAttribute("data-original") || img.getAttribute("data-src") || img.src : "";
        const title = a && (a.title || cleanText(a.textContent)) || el2.querySelector?.('h1,h2,h3,h4,[class*="title"],[class*="tt"]')?.textContent?.trim() || cleanText(el2.textContent).slice(0, 80);
        const priceMatch = (el2.textContent || "").match(/(?:¥|￥|＄|\$)\s?\d[\d,.]*/);
        return {
          title: title || "",
          url: link,
          image,
          text: cleanText(el2.innerText || el2.textContent),
          price: priceMatch ? priceMatch[0].trim() : ""
        };
      }
    },
    button: {
      extract(el2) {
        return { text: cleanText(el2.textContent), value: el2.value || "" };
      }
    },
    input: {
      extract(el2) {
        const input = el2.closest?.("input,textarea,select") || el2;
        return { value: input.value ?? "", text: input.value ?? "" };
      }
    },
    region: {
      extract(el2) {
        return { text: cleanText(el2.innerText || el2.textContent), html: el2.outerHTML || "" };
      }
    }
  };
  function resolveUrl(raw) {
    if (!raw) return "";
    try {
      return new URL(raw, window.location.href).href;
    } catch {
      return raw;
    }
  }
  var URL_FIELDS = ["url", "image"];
  function extractElement(el2, targetType, fields) {
    const t = targetType && extractors[targetType] ? targetType : "region";
    const ex = extractors[t];
    let raw = {};
    try {
      raw = ex.extract(el2) || {};
    } catch (err) {
      console.error("[Extractor]", err);
    }
    const out = { type: t };
    for (const f of fields || []) {
      if (f in raw) out[f] = URL_FIELDS.includes(f) ? resolveUrl(raw[f]) : raw[f];
    }
    return out;
  }
  function extractFieldsFor(targetType) {
    const t = targetType && extractors[targetType] ? targetType : "region";
    const ex = extractors[t];
    try {
      return Object.keys(ex.extract(document.createElement("div")) || {});
    } catch {
      return [];
    }
  }

  // src/core/executeRule.js
  function executeDataRule(rule) {
    const action = rule ? getAction(rule.action) : null;
    if (!action || action.kind !== "data" || typeof action.run !== "function") {
      return { ok: false, count: 0, message: "该规则不是可执行的数据动作" };
    }
    const fields = action.needs && action.needs.length ? action.needs : extractFieldsFor(rule.targetType);
    let nodes = [];
    try {
      nodes = document.querySelectorAll(rule.selector);
    } catch {
      nodes = [];
    }
    const items = [];
    for (const node of nodes) {
      const item = extractElement(node, rule.targetType, fields);
      if (Object.keys(item).length > 1) items.push(item);
    }
    if (!items.length) {
      return { ok: false, count: 0, message: "未匹配到元素" };
    }
    try {
      const result = action.run(items);
      return {
        ok: true,
        count: items.length,
        message: typeof result === "string" && result ? result : "已执行 " + items.length + " 项"
      };
    } catch (err) {
      console.error("[Execute]", err);
      return { ok: false, count: 0, message: "执行失败: " + (err && err.message ? err.message : err) };
    }
  }

  // src/utils/targetType.js
  var TYPE_LABELS = {
    link: "链接",
    image: "图片",
    video: "视频",
    text: "文本",
    table: "表格",
    card: "卡片",
    button: "按钮",
    input: "输入框",
    region: "区域"
  };
  var TARGET_TYPES = Object.keys(TYPE_LABELS);
  var TARGET_LABELS = TYPE_LABELS;
  function detectTargetType(el2) {
    if (!el2 || el2.nodeType !== 1) return "region";
    const tag = (el2.tagName || "").toLowerCase();
    if (el2.matches && el2.matches("input, textarea, select")) return "input";
    if (el2.matches && el2.matches('button, [role="button"], a[role="button"]')) return "button";
    if (tag === "table" || tag === "tr" || tag === "td" || tag === "th" || el2.querySelector && el2.querySelector("table")) {
      return "table";
    }
    if (tag === "video" || el2.querySelector && el2.querySelector('video, iframe[src*="youtube"], iframe[src*="bilibili"], iframe[src*="player"]')) {
      return "video";
    }
    const hasImg = tag === "img" || el2.querySelector && el2.querySelector("img");
    if (hasImg) {
      const textLen = (el2.textContent || "").trim().length;
      const isCardLike = textLen > 20 && !!el2.querySelector("a[href]");
      return isCardLike ? "card" : "image";
    }
    const hasLink = tag === "a" || el2.querySelector && el2.querySelector("a[href]");
    if (hasLink) {
      const innerImg = el2.querySelector && el2.querySelector("img");
      const textLen = (el2.textContent || "").trim().length;
      if (innerImg || textLen > 40) return "card";
      return "link";
    }
    const text = (el2.textContent || "").trim();
    if (text) {
      const cls = String(el2.className || "").toString();
      if (text.length >= 8 && text.length <= 5e3) return "text";
      if (cls && cls.split(/\s+/).filter(Boolean).length) return "text";
      return "region";
    }
    return "region";
  }

  // src/ui/Toolbar.js
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
      remoteBox.appendChild(el("div", { class: "cores-ppk-remote-row" }, mergeBtn, replaceBtn));
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
      const foot = el("div", { class: "cores-ppk-toolbar-menu-foot" }, manage, remoteBtn, resetBtn);
      menu.appendChild(head);
      if (list.childNodes.length) menu.appendChild(list);
      menu.appendChild(foot);
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

  // src/utils/selector.js
  function cssEscapeIdent(s) {
    const t = String(s || "");
    try {
      if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(t);
    } catch {
    }
    return t.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }
  function isStableClassName(c) {
    const s = String(c || "");
    if (!s || s.length < 2 || s.length > 48) return false;
    if (/^(pv-|cores-ppk-|popup)/i.test(s)) return false;
    if (/^(is-|has-|js-|ng-|v-|css-|sc-|sx-|emotion|svelte-|cssmodule)/i.test(s)) return false;
    if (/^(active|hover|focus|selected|current|open|show|hide|hidden|visible|disabled|checked|on|off)$/i.test(s)) return false;
    if (/^[a-f0-9]{8,}$/i.test(s)) return false;
    if (/\d{5,}/.test(s)) return false;
    return /^[a-zA-Z_:-][\w:-]*$/.test(s);
  }
  function isStableId(id) {
    const s = String(id || "");
    if (!s || s.length > 64) return false;
    if (/^(ember|react|vue|ng|app|pv-|cores-ppk-|popup)-/i.test(s)) return false;
    if (/^[a-f0-9-]{12,}$/i.test(s)) return false;
    if (/\d{6,}/.test(s)) return false;
    return /^[a-zA-Z][\w:-]*$/.test(s);
  }
  function countMatches(sel) {
    try {
      return document.body ? document.body.querySelectorAll(sel).length : 0;
    } catch {
      return -1;
    }
  }
  function buildSelectorCandidates(el2) {
    const list = [];
    const seen = /* @__PURE__ */ Object.create(null);
    if (!el2 || el2.nodeType !== 1 || !el2.tagName) return list;
    const tag = el2.tagName.toLowerCase();
    const id = el2.id ? String(el2.id) : "";
    const classes = Array.prototype.slice.call(el2.classList || []).filter(isStableClassName).slice(0, 4);
    const push = (sel, note) => {
      const s = String(sel || "").trim();
      if (!s || seen[s]) return;
      const n = countMatches(s);
      if (n < 1) return;
      seen[s] = 1;
      list.push({ sel: s, count: n, note: note || "" });
    };
    if (id && isStableId(id)) push("#" + cssEscapeIdent(id), "id");
    if (classes.length) {
      push("." + classes.map(cssEscapeIdent).join("."), "class");
      push(tag + "." + classes.map(cssEscapeIdent).join("."), "tag+class");
      if (classes[0]) {
        push("." + cssEscapeIdent(classes[0]), "主 class");
        push(tag + "." + cssEscapeIdent(classes[0]), "tag+主 class");
      }
    } else if (tag && tag !== "div" && tag !== "span") {
      push(tag, "标签");
    }
    let p = el2.parentElement;
    let depth = 0;
    while (p && p !== document.body && depth < 4) {
      const pTag = p.tagName.toLowerCase();
      const pClasses = Array.prototype.slice.call(p.classList || []).filter(isStableClassName).slice(0, 2);
      if (pClasses.length) {
        const pSel = pTag + "." + pClasses.map(cssEscapeIdent).join(".");
        if (classes[0]) {
          push(pSel + " " + tag + "." + cssEscapeIdent(classes[0]), "父级范围");
          push(pSel + " ." + cssEscapeIdent(classes[0]), "父级+class");
        }
        push(pSel + " " + tag, "父级+标签");
        if (depth === 0 && pClasses[0]) push("." + cssEscapeIdent(pClasses[0]), "父 class（整块）");
      }
      p = p.parentElement;
      depth++;
    }
    try {
      const parts = [];
      let node = el2;
      let guard = 0;
      while (node && node.nodeType === 1 && node !== document.body && guard < 5) {
        if (node.id && isStableId(node.id)) {
          parts.unshift("#" + cssEscapeIdent(node.id));
          break;
        }
        const t = node.tagName.toLowerCase();
        const parent = node.parentElement;
        if (!parent) break;
        const kids = parent.children;
        let idx = 1;
        let same = 0;
        for (let i = 0; i < kids.length; i++) {
          if (kids[i].tagName === node.tagName) {
            same++;
            if (kids[i] === node) idx = same;
          }
        }
        parts.unshift(same > 1 ? t + ":nth-of-type(" + idx + ")" : t);
        node = parent;
        guard++;
      }
      if (parts.length) push(parts.join(" > "), "路径");
    } catch {
    }
    list.sort((a, b) => {
      const score = (c) => {
        if (c.count >= 2 && c.count <= 200) return 0;
        if (c.count === 1) return 2;
        if (c.count > 200 && c.count <= 800) return 1;
        return 3;
      };
      const d = score(a) - score(b);
      if (d) return d;
      return a.sel.length - b.sel.length;
    });
    return list.slice(0, 8);
  }

  // src/ui/ElementPicker.js
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

  // src/ui/RulesPanel.js

  var REMOTE_KEY = "ppk:remote";
  function getRemoteSettings() {
    const raw = (gm.readScriptValue ? gm.readScriptValue(REMOTE_KEY, null) : null) || gm.getValue(REMOTE_KEY, null);
    if (raw && typeof raw === "object") {
      return {
        url: String(raw.url || "").trim(),
        auto: !!raw.auto,
        mode: raw.mode === "replace" ? "replace" : "merge",
        lastAt: raw.lastAt || "",
        lastMsg: raw.lastMsg || "",
        lastHash: raw.lastHash || ""
      };
    }
    if (typeof raw === "string") {
      return { url: raw.trim(), auto: false, mode: "merge", lastAt: "", lastMsg: "", lastHash: "" };
    }
    return { url: "", auto: false, mode: "merge", lastAt: "", lastMsg: "", lastHash: "" };
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
        empty.appendChild(el("small", { text: "点击「取选对象」，在页面上点选要操作的元素" }));
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

  // src/main.js
  var fallbackPanel = null;
  function openPopup(url, title) {
    const kit = window.PopupKit;
    if (kit && typeof kit.open === "function") {
      return kit.open({ url, title });
    }
    if (!fallbackPanel) fallbackPanel = new PopupPanel();
    fallbackPanel.show(title, url);
    return true;
  }
  function isInIframe() {
    try {
      if (window.frameElement && window.frameElement.id === "cores-ppk-popup-frame") return true;
    } catch {}
    try {
      if (window.self === window.top) return false;
    } catch {}
    try {
      if (window.frameElement) return true;
    } catch {}
    return false;
  }
  function isSafeUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }
  function onDocumentClick(e) {
    if (pickerState.picking) return;
    if (e.defaultPrevented) return;
    const hostname = window.location.hostname;
    const hit = rulesManager.match(e, hostname);
    if (!hit || !isSafeUrl(hit.url)) return;
    e.preventDefault();
    e.stopPropagation();
    openPopup(hit.url, hit.title);
  }
  var debouncedApply = null;
  function setupObserver() {
    const hostname = window.location.hostname;
    ruleEngine.applyRules(hostname);
    debouncedApply = debounce(() => ruleEngine.applyRules(window.location.hostname), config.observer.debounceMs, {
      leading: true
    });
    const observer = new MutationObserver(debouncedApply);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function debounce(fn, wait, { leading = false } = {}) {
    let timer = null;
    let lastArgs = null;
    const invoke = () => {
      timer = null;
      if (lastArgs) {
        const args = lastArgs;
        lastArgs = null;
        fn.apply(null, args);
      }
    };
    return function(...args) {
      lastArgs = args;
      if (leading && !timer) fn.apply(null, args);
      if (timer) clearTimeout(timer);
      timer = setTimeout(invoke, wait);
    };
  }
  function init() {
    try {
      if (isInIframe()) return;
      gm.addStyle(style_page);
      getUIShadow();
      applyThemeClass();
      rulesManager.load();
      document.addEventListener("click", onDocumentClick, true);
      setupObserver();
      const rulesPanel = createRulesPanel({});
      const remotePanel = createRemotePanel();
      createToolbar({
        onManage: () => rulesPanel.open(),
        onRemote: () => remotePanel.open()
      });
      const remote = getRemoteSettings();
      if (remote.auto && remote.url) {
        pullRemoteRules({ silent: true, force: false }).then((res) => {
          if (res && res.ok && !res.skipped) {
            try { ruleEngine.applyRules(window.location.hostname); } catch {}
          }
        });
      }
    } catch (err) {
      try { console.warn("[cores-ppk] init failed", err); } catch {}
    }
  }
  function boot() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
      setTimeout(boot, 50);
      return;
    }
    const keys = ["ppk:rules", "ppk:siteEnabled", "ppk:toolbarPos", "ppk.theme"];
    const ready = gm.hydrate ? gm.hydrate(keys) : Promise.resolve();
    Promise.resolve(ready).then(() => init()).catch(() => init());
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();