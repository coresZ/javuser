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
    if (remote.auto !== false && remote.url) {
      pullRemoteRules({ url: remote.url, mode: remote.mode || "merge", force: false }).then((res) => {
        if (res && res.ok) {
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
