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
