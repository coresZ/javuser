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
