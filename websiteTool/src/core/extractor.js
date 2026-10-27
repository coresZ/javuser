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
