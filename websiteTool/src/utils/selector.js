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
