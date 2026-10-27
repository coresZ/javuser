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
