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
    this.packs = this._dedupePacks(this._mergePacks(fromScript, fromLocal));
    return this.packs;
  }
  _dedupePacks(list) {
    const packs = (list || []).filter(Boolean);
    const keep = [];
    const used = Object.create(null);
    for (let i = 0; i < packs.length; i++) {
      if (used[i]) continue;
      let cur = normalizePack(packs[i]);
      for (let j = i + 1; j < packs.length; j++) {
        if (used[j]) continue;
        const other = packs[j];
        const overlap = (cur.hosts || []).some((h) => (other.hosts || []).some((x) => h === x));
        if (!overlap && cur.id && other.id && cur.id === other.id) {
          /* same id */
        } else if (!overlap) continue;
        used[j] = 1;
        const hosts = normalizeHosts([].concat(cur.hosts || [], other.hosts || []));
        const seen = Object.create(null);
        const rules = [];
        for (const r of [].concat(cur.rules || [], other.rules || [])) {
          const k = (r.selector || "") + "\0" + (r.action || "") + "\0" + (r.targetType || "");
          if (seen[k]) continue;
          seen[k] = 1;
          rules.push(normalizeRule(r));
        }
        cur = normalizePack({ ...cur, hosts, rules });
      }
      keep.push(cur);
    }
    return keep;
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
    // 内存里的 packs 是准的。不能再和 GM 旧数据按规则并集，否则电脑上改动作/删除会被旧远程数据盖回去
    gm.writeScriptValue(KEY, { version: 2, packs: this.packs || [] });
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
  /**
   * 列出可「应用到当前站」的规则包：至少有 1 条规则。
   * @returns {{ id:string, name:string, hosts:string[], rules:number, bound:boolean, label:string }[]}
   */
  listApplyCandidates(hostname) {
    this.load();
    const h = String(hostname || "").toLowerCase();
    const shortHost = (s) => {
      const t = String(s || "");
      if (t.length <= 22) return t;
      return t.slice(0, 10) + "…" + t.slice(-8);
    };
    const out = [];
    for (const p of this.packs) {
      const rules = (p.rules || []).length;
      if (!rules) continue;
      const hosts = [...(p.hosts || [])];
      const bound = !!(h && hosts.some((pat) => hostMatches(pat, h) || pat === h));
      const primaryRaw = p.name && String(p.name).trim() || hosts[0] || p.id || "未命名";
      const primary = shortHost(primaryRaw);
      const label = primary + " · " + rules + "条" + (bound ? " ✓" : "");
      const meta = (hosts.length ? hosts.map(shortHost).join(", ") : "") + (bound ? "（已绑定）" : "");
      out.push({
        id: p.id,
        name: p.name || "",
        hosts,
        rules,
        bound,
        label,
        meta
      });
    }
    out.sort((a, b) => {
      if (a.bound !== b.bound) return a.bound ? 1 : -1;
      return b.rules - a.rules;
    });
    return out;
  }
  /**
   * 将已有规则包绑定到当前 hostname（写入 hosts，不复制规则）。
   * 会顺带删掉「仅含当前 host、且无规则」的空壳包，避免面板脏数据。
   * @returns {{ ok:boolean, already?:boolean, message:string, pack?:object }}
   */
  bindPackToHostname(packId, hostname) {
    this.load();
    const h = String(hostname || "").trim().toLowerCase();
    if (!h) return { ok: false, message: "无效的当前域名" };
    const pack = this.packs.find((p) => p && p.id === packId);
    if (!pack) return { ok: false, message: "规则包不存在" };
    if (!(pack.rules && pack.rules.length)) {
      return { ok: false, message: "该规则包没有规则" };
    }
    const already = pack.hosts.some((pat) => hostMatches(pat, h) || pat === h);
    if (!already) {
      pack.hosts = normalizeHosts([...(pack.hosts || []), h]);
    }
    // 清掉当前站自动生成的空壳包
    this.packs = this.packs.filter((p) => {
      if (!p || p.id === pack.id) return true;
      if ((p.rules || []).length) return true;
      const hs = p.hosts || [];
      if (hs.length === 1 && hs[0] === h) return false;
      if (!hs.length) return false;
      return true;
    });
    this._persist();
    const n = (pack.rules || []).length;
    return {
      ok: true,
      already,
      pack,
      message: already
        ? "当前站已在该规则包中（" + n + " 条规则）"
        : "已应用到当前站：" + h + " · " + n + " 条规则"
    };
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
