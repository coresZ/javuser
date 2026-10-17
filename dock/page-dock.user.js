// ==UserScript==
// @name         PageDock
// @namespace    http://tampermonkey.net/
// @version      1.3.8
// @description  悬浮坞。界面写在真实页面上；多个脚本引用时共用同一个实例。
// @author       ron
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==
(function (factory) {
    const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (page.__PAGE_DOCK__) return;
    const api = factory();
    const stub = {
        version: '1.3.8',
        mount() { return page.__PAGE_DOCK__ || api; },
        register(item) { return (page.__PAGE_DOCK__ || api).register(item); },
        unregister(id) { return (page.__PAGE_DOCK__ || api).unregister(id); },
        setBadge(id, badge) { return (page.__PAGE_DOCK__ || api).setBadge(id, badge); },
        setChecked(id, checked) { return (page.__PAGE_DOCK__ || api).setChecked(id, checked); },
        setActive(id, active) { return (page.__PAGE_DOCK__ || api).setActive(id, active); },
        close() { return (page.__PAGE_DOCK__ || api).close(); }
    };
    [page, typeof window !== 'undefined' ? window : null, typeof globalThis !== 'undefined' ? globalThis : null].forEach((target) => {
        try { if (target) target.PageDock = stub; } catch {}
    });
    page.__PAGE_DOCK__ = api;
}(function () {
    'use strict';

    const root = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const POS_KEY = 'page-dock-pos-v1';
    const items = new Map();
    let host = null;
    let fab = null;
    let menu = null;
    let open = false;

    const api = {
        mount() {
            mount();
            return api;
        },
        register(item) {
            if (!item || !item.id || typeof item.onClick !== 'function') return () => {};
            items.set(item.id, {
                id: String(item.id),
                label: String(item.label || item.id),
                title: String(item.title || item.label || item.id),
                badge: item.badge ? String(item.badge) : '',
                enabled: item.enabled !== false,
                active: Boolean(item.active),
                checked: Boolean(item.checked),
                onToggle: typeof item.onToggle === 'function' ? item.onToggle : null,
                onActive: typeof item.onActive === 'function' ? item.onActive : null,
                onClick: item.onClick
            });
            renderMenu();
            return () => api.unregister(item.id);
        },
        unregister(id) {
            items.delete(id);
            renderMenu();
        },
        setBadge(id, badge) {
            const item = items.get(id);
            if (!item) return;
            item.badge = badge ? String(badge) : '';
            renderMenu();
        },
        setChecked(id, checked) {
            const item = items.get(id);
            if (!item) return;
            item.enabled = Boolean(checked);
            item.checked = item.enabled;
            if (!item.enabled) item.active = false;
            paintItem(item);
        },
        setActive(id, active) {
            const item = items.get(id);
            if (!item) return;
            item.active = Boolean(active);
            paintItem(item);
        },
        close() {
            setOpen(false);
        }
    };

    const publish = () => {
        root.PageDock = api;
        try { window.PageDock = api; } catch {}
    };

    const point = (event) => event.touches ? event.touches[0] : event;
    const readPos = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
            if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
        } catch {}
        return null;
    };
    const clamp = (x, y) => ({
        x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - 44)),
        y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - 44))
    });
    const place = (x, y, persist) => {
        if (!host) return;
        const next = clamp(x, y);
        host.style.left = next.x + 'px';
        host.style.top = next.y + 'px';
        host.dataset.x = String(next.x);
        host.dataset.y = String(next.y);
        if (persist) {
            try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch {}
        }
    };
    const placeMenu = () => {
        if (!host || !menu) return;
        const rect = host.getBoundingClientRect();
        const openLeft = rect.left > window.innerWidth * 0.55;
        const openUp = rect.top > window.innerHeight * 0.55;
        menu.dataset.side = openLeft ? 'left' : 'right';
        menu.dataset.rise = openUp ? 'up' : 'down';
    };
    const setOpen = (next) => {
        open = Boolean(next) && items.size > 0;
        if (!menu || !fab) return;
        if (open) placeMenu();
        menu.hidden = !open;
        fab.setAttribute('aria-expanded', open ? 'true' : 'false');
        fab.classList.toggle('is-open', open);
    };
    const paintItem = (item) => {
        const row = item.row;
        if (!row) return;
        row.classList.toggle('is-off', !item.enabled);
        row.classList.toggle('is-active', item.active);
        if (item.button) {
            item.button.disabled = !item.enabled;
            item.button.title = item.enabled ? (item.active ? '关闭面板' : '打开面板') : '脚本已关闭';
        }
        if (item.toggle) {
            item.toggle.classList.toggle('is-on', item.enabled);
            item.toggle.title = item.enabled ? '关闭脚本' : '开启脚本';
            item.toggle.setAttribute('aria-label', item.label + (item.enabled ? ' 脚本已开启' : ' 脚本已关闭'));
            item.toggle.setAttribute('aria-pressed', item.enabled ? 'true' : 'false');
        }
    };
    const renderMenu = () => {
        if (!menu || !host) return;
        menu.replaceChildren();
        items.forEach((item) => {
            const row = pageDocument().createElement('div');
            item.row = row;
            row.className = 'page-dock-item';
            const button = pageDocument().createElement('button');
            item.button = button;
            button.type = 'button';
            button.className = 'page-dock-main';
            button.title = item.enabled ? (item.active ? '关闭面板' : '打开面板') : '脚本已关闭';
            button.disabled = !item.enabled;
            const mark = pageDocument().createElement('span');
            mark.className = 'page-dock-mark';
            mark.textContent = item.label.slice(0, 1);
            const name = pageDocument().createElement('span');
            name.className = 'page-dock-name';
            name.textContent = item.label;
            button.append(mark, name);
            if (item.badge) {
                const badge = pageDocument().createElement('span');
                badge.className = 'page-dock-badge';
                badge.textContent = item.badge;
                button.appendChild(badge);
            }
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!item.enabled) return;
                item.active = !item.active;
                row.classList.toggle('is-active', item.active);
                if (item.onActive) item.onActive(item.active);
                else if (item.active) item.onClick();
            });
            if (item.onToggle) {
                const toggle = pageDocument().createElement('button');
                item.toggle = toggle;
                toggle.type = 'button';
                toggle.className = 'page-dock-switch';
                toggle.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const next = !item.enabled;
                    item.enabled = next;
                    item.checked = next;
                    if (!next) item.active = false;
                    paintItem(item);
                    item.onToggle(next);
                });
                row.appendChild(toggle);
            }
            row.insertBefore(button, row.firstChild);
            paintItem(item);
            menu.appendChild(row);
        });
        host.hidden = items.size === 0;
        if (!items.size) setOpen(false);
    };

    const addStyle = (css) => {
        const doc = pageDocument();
        if (doc.getElementById('page-dock-style')) return;
        const style = doc.createElement('style');
        style.id = 'page-dock-style';
        style.textContent = css;
        (doc.head || doc.documentElement).appendChild(style);
    };
    const pageDocument = () => {
        try { return root.document || document; } catch { return document; }
    };
    const mount = () => {
        const doc = pageDocument();
        if (host || !doc.documentElement) return;
        const existing = doc.getElementById('page-dock');
        if (existing) existing.remove();
        addStyle(`
            #page-dock {
                position: fixed; z-index: 2147483647; width: 36px; height: 36px;
                transform: translate3d(0, 0, 0);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
                color: rgba(255,255,255,0.92); touch-action: none;
            }
            #page-dock[hidden] { display: none !important; }
            #page-dock-fab {
                width: 36px; height: 36px; padding: 0; border: 0; border-radius: 12px;
                display: flex; align-items: center; justify-content: center;
                background: rgba(28,28,30,0.78); color: rgba(255,255,255,0.82);
                box-shadow: 0 8px 20px rgba(0,0,0,0.28);
                cursor: grab; user-select: none;
            }
            #page-dock-fab:hover { color: #fff; background: rgba(44,44,48,0.88); }
            #page-dock-fab:active { cursor: grabbing; }
            #page-dock-fab.is-open { color: #fff; background: rgba(52,52,58,0.92); }
            #page-dock-menu {
                position: absolute; min-width: 148px; display: flex; flex-direction: column; gap: 2px;
                padding: 6px; border-radius: 14px;
                background: rgba(24,24,27,0.9);
                box-shadow: 0 16px 36px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08);
                transform-origin: bottom left;
            }
            #page-dock-menu[data-side="left"] { right: 0; transform-origin: bottom right; }
            #page-dock-menu[data-side="right"] { left: 0; }
            #page-dock-menu[data-rise="down"] { top: 44px; animation: page-dock-down 160ms cubic-bezier(.2,.8,.2,1); }
            #page-dock-menu[data-rise="up"] { bottom: 44px; transform-origin: top left; animation: page-dock-up 160ms cubic-bezier(.2,.8,.2,1); }
            #page-dock-menu[data-side="left"][data-rise="up"] { transform-origin: top right; }
            #page-dock-menu[hidden] { display: none !important; }
            @keyframes page-dock-down { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
            @keyframes page-dock-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
            .page-dock-item {
                display: flex; align-items: center; gap: 8px; min-height: 36px; width: 100%;
                border-radius: 9px; padding: 4px 8px 4px 4px; color: inherit;
            }
            .page-dock-item.is-active { background: rgba(255,255,255,0.08); }
            .page-dock-item.is-off { opacity: 0.45; }
            .page-dock-main {
                display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; min-height: 32px;
                border: 0; border-radius: 8px; padding: 4px 6px;
                background: transparent; color: inherit; font: inherit; font-size: 13px;
                text-align: left; cursor: pointer; white-space: nowrap;
            }
            .page-dock-main:hover { background: rgba(255,255,255,0.1); }
            .page-dock-main:disabled { cursor: default; }
            .page-dock-main:disabled:hover { background: transparent; }
            .page-dock-mark {
                width: 22px; height: 22px; flex: none; border-radius: 7px;
                display: inline-flex; align-items: center; justify-content: center;
                background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.72);
                font-size: 12px; font-weight: 650;
            }
            .page-dock-name { flex: 1; min-width: 0; }
            .page-dock-badge {
                min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
                background: #0a84ff; color: #fff; font-size: 10px; line-height: 16px; text-align: center;
            }
            .page-dock-switch {
                width: 36px; height: 28px; flex: none; margin-left: auto; padding: 0; border: 0; border-radius: 99px;
                background: transparent; position: relative; cursor: pointer;
            }
            .page-dock-switch::after {
                content: ""; position: absolute; left: 2px; top: 5px; width: 32px; height: 18px; border-radius: 99px;
                background: rgba(255,255,255,0.18);
            }
            .page-dock-switch::before {
                content: ""; position: absolute; top: 7px; left: 4px; width: 14px; height: 14px; border-radius: 50%;
                background: #fff; transition: transform 140ms ease;
            }
            .page-dock-switch.is-on::after { background: rgba(255,255,255,0.42); }
            .page-dock-switch.is-on::before { transform: translateX(14px); }
        `);
        host = doc.createElement('div');
        host.id = 'page-dock';
        host.hidden = true;
        fab = doc.createElement('button');
        fab.id = 'page-dock-fab';
        fab.type = 'button';
        fab.title = '工具';
        fab.setAttribute('aria-label', '工具');
        fab.setAttribute('aria-expanded', 'false');
        fab.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="3.5" r="1.35" fill="currentColor"/><circle cx="8" cy="3.5" r="1.35" fill="currentColor"/><circle cx="12.5" cy="3.5" r="1.35" fill="currentColor"/><circle cx="3.5" cy="8" r="1.35" fill="currentColor"/><circle cx="8" cy="8" r="1.35" fill="currentColor"/><circle cx="12.5" cy="8" r="1.35" fill="currentColor"/><circle cx="3.5" cy="12.5" r="1.35" fill="currentColor"/><circle cx="8" cy="12.5" r="1.35" fill="currentColor"/><circle cx="12.5" cy="12.5" r="1.35" fill="currentColor"/></svg>';
        menu = doc.createElement('div');
        menu.id = 'page-dock-menu';
        menu.hidden = true;
        host.append(menu, fab);
        (doc.body || doc.documentElement).appendChild(host);

        const saved = readPos();
        place(saved ? saved.x : window.innerWidth - 56, saved ? saved.y : window.innerHeight - 88, false);

        let dragging = false;
        let moved = false;
        let originX = 0;
        let originY = 0;
        let dragX = 0;
        let dragY = 0;
        const start = (event) => {
            if (event.target.closest('.page-dock-item')) return;
            const p = point(event);
            dragging = true;
            moved = false;
            dragX = Number(host.dataset.x || 0);
            dragY = Number(host.dataset.y || 0);
            originX = p.clientX - dragX;
            originY = p.clientY - dragY;
        };
        const move = (event) => {
            if (!dragging) return;
            const p = point(event);
            const next = clamp(p.clientX - originX, p.clientY - originY);
            if (Math.abs(next.x - dragX) + Math.abs(next.y - dragY) > 4) moved = true;
            if (moved && event.cancelable) event.preventDefault();
            dragX = next.x;
            dragY = next.y;
            host.style.transform = `translate3d(${dragX - Number(host.dataset.x || 0)}px, ${dragY - Number(host.dataset.y || 0)}px, 0)`;
        };
        const end = () => {
            if (!dragging) return;
            dragging = false;
            host.style.transform = 'translate3d(0, 0, 0)';
            if (moved) place(dragX, dragY, true);
            if (open) placeMenu();
        };
        fab.addEventListener('mousedown', start);
        pageDocument().addEventListener('mousemove', move);
        pageDocument().addEventListener('mouseup', end);
        fab.addEventListener('touchstart', start, { passive: true });
        pageDocument().addEventListener('touchmove', move, { passive: false });
        pageDocument().addEventListener('touchend', end);
        fab.addEventListener('click', (event) => {
            event.stopPropagation();
            if (moved) {
                moved = false;
                return;
            }
            setOpen(!open);
        });
        pageDocument().addEventListener('click', (event) => {
            if (!host.contains(event.target)) setOpen(false);
        });
        window.addEventListener('resize', () => {
            place(Number(host.dataset.x || 0), Number(host.dataset.y || 0), false);
            if (open) placeMenu();
        }, { passive: true });
        renderMenu();
    };

    const boot = () => api.mount();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
    return api;
}));
