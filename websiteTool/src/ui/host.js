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
    // 用 CSSOM 样式表，而非 <style>：严格 CSP 站点会丢弃 Shadow DOM 内的 <style>
    adoptStyleSheet(uiShadow, style_default);
    adoptStyleSheet(uiShadow, style_refine);
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
