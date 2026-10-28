// iOS Safari / Userscripts / Stay: 不要直接写 GM_addStyle，未声明时会 ReferenceError 导致整脚本退出
function gmApi(name) {
  // typeof 未声明变量不会抛错；油猴把 GM_* 注在沙箱作用域，不在 window 上
  try {
    if (name === "GM_getValue" && typeof GM_getValue === "function") return GM_getValue;
    if (name === "GM_setValue" && typeof GM_setValue === "function") return GM_setValue;
    if (name === "GM_xmlhttpRequest" && typeof GM_xmlhttpRequest === "function") return GM_xmlhttpRequest;
    if (name === "GM_addStyle" && typeof GM_addStyle === "function") return GM_addStyle;
    if (name === "GM_download" && typeof GM_download === "function") return GM_download;
    if (name === "GM_listValues" && typeof GM_listValues === "function") return GM_listValues;
  } catch {}
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
// 严格 CSP 站点（例：hills.im 响应头 `style-src 'self'`，无 unsafe-inline / nonce / hash）
// 会丢弃所有内联 <style>：元素能插进 DOM，但 `style.sheet` 为 null，一条规则都不生效，
// Shadow DOM 内的 <style> 同样被丢。结果是工具 UI 完全无样式（按钮不出现、面板文字堆在左上角）。
// CSSOM 构造的样式表（`new CSSStyleSheet()` + `adoptedStyleSheets`）不受 style-src 约束，
// 所以优先走这条路；不支持时再回落到 <style>（老 Safari / 老 Firefox）。
function canAdoptStyle(target) {
  try {
    if (typeof CSSStyleSheet !== "function" || typeof CSSStyleSheet.prototype.replaceSync !== "function") return false;
    const proto = target === document ? Document.prototype : ShadowRoot.prototype;
    return "adoptedStyleSheets" in proto;
  } catch {
    return false;
  }
}
function adoptStyleSheet(target, css) {
  if (canAdoptStyle(target)) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
      return sheet;
    } catch {}
  }
  const style = document.createElement("style");
  style.textContent = css;
  const host = target === document ? document.head || document.documentElement : target;
  if (host) host.appendChild(style);
  return style;
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
    // 先试 CSSOM 样式表（严格 CSP 站点唯一可行的注入方式），再退 GM_addStyle / <style>
    if (canAdoptStyle(document)) {
      try { return adoptStyleSheet(document, css); } catch {}
    }
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
