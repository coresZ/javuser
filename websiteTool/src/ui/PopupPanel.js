var PopupPanel = class {
  constructor() {
    this.root = null;
    this.overlay = null;
    this.titleEl = null;
    this.frame = null;
  }
  ensure() {
    if (this.root) return;
    this.overlay = el("div", { id: "cores-ppk-popup-overlay", onclick: () => this.close() });
    this.titleEl = el("span", { id: "cores-ppk-popup-title", text: "加载中…" });
    const openBtn = el("button", { type: "button", class: "cores-ppk-popup-btn", title: "在新标签页打开", onclick: () => this._openExternal() });
    openBtn.appendChild(svgIcon("external", { size: 15 }));
    const closeBtn = el("button", { type: "button", class: "cores-ppk-popup-btn", title: "关闭 (Esc)", onclick: () => this.close() });
    closeBtn.appendChild(svgIcon("close", { size: 15 }));
    const actions = el("div", { class: "cores-ppk-popup-actions" }, openBtn, closeBtn);
    const header = el("div", { id: "cores-ppk-popup-header" }, this.titleEl, actions);
    this.frame = el("iframe", { id: "cores-ppk-popup-frame" });
    const body = el("div", { id: "cores-ppk-popup-body" }, this.frame);
    this.root = el("div", { id: "cores-ppk-popup" }, header, body);
    uiAppend(this.overlay);
    uiAppend(this.root);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    });
  }
  show(title, url) {
    this.ensure();
    this.titleEl.textContent = title || "查看内容";
    this.frame.src = url;
    this.root.classList.add("visible");
    this.overlay.classList.add("visible");
  }
  close() {
    if (!this.root) return;
    this.root.classList.remove("visible");
    this.overlay.classList.remove("visible");
    this.frame.src = "about:blank";
  }
  _openExternal() {
    const url = this.frame.src;
    if (url && url !== "about:blank") window.open(url, "_blank", "noopener");
  }
};
