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
