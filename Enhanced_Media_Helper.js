// ==UserScript==
// @name           Enhanced_Media_Helper
// @version        3.5.0
// @description    Code Manager Panel with javgg site support (Preact + htm) + magnet screenshot preview + Linear UI
// @author         cores
// @match          https://javgg.net/tag/to-be-release/*
// @match          https://javgg.net/featured/*
// @match          https://javgg.net/
// @match          https://javgg.net/new-post/*
// @match          https://javgg.net/jav/*
// @match          https://javgg.net/star/*
// @match          https://javgg.net/trending/*
// @include        *://*jav*/*
// @include        https://1cili.com/*
// @include        https://btnets.net/*
// @include        *://*av*/*
// @include        *://*fc2*/*
// @include        *://*missav*/*
// @include        *://*javdb*/*
// @include        *://*javlibrary*/*
// @include        *://*dmm.co.jp/*
// @include        *://*dmm.com/*
// @include        *://*heyzo*/*
// @include        *://*caribbeancom*/*
// @include        *://*1pondo*/*
// @include        *://*pacopaco*/*
// @include        *://*xvideos*/*
// @include        *://*pornhub*/*
// @include        *://*xhamster*/*
// @include        *://*reddit.com/*
// @include        *://*redditmedia.com/*
// @include        *://*t66y.com/*
// @include        *://*sis001.com/*
// @include        *://*cl*forum*/*
// @include        *://*91porn*/*
// @include        *://*jable*/*
// @include        *://*avple*/*
// @include        *://*.cbox.ws/*
// @include        *://cbox.ws/*
// @include        *://my.cbox.ws/*
// @require        https://cdn.jsdelivr.net/npm/preact@10.19.6/dist/preact.umd.js
// @require        https://cdn.jsdelivr.net/npm/preact@10.19.6/hooks/dist/hooks.umd.js
// @require        https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js
// @icon           data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant          GM_setValue
// @grant          GM_getValue
// @grant          GM_addValueChangeListener
// @grant          GM_xmlhttpRequest
// @grant          GM_openInTab
// @connect        1cili.com
// @connect        whatslink.info
// @run-at         document-start
// @noframes
// @license        MPL
// @namespace      cdn.bootcss.com
// @downloadURL https://update.greasyfork.org/scripts/531966/Enhanced_Media_Helper.user.js
// @updateURL https://update.greasyfork.org/scripts/531966/Enhanced_Media_Helper.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        codeManager: {
            storageKey: 'emh_code_library',
            trashStorageKey: 'emh_code_trash',
            trashRetentionDays: 7,
            statusColors: {
                unmarked: '#6b7280',
                favorite: '#f87171',
                watched: '#34d399'
            }
        },
        magnetPreview: {
            cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
            errorTtlMs: 5 * 60 * 1000
        },
        alternateUrl: {
            av123: 'https://123av.com/cn/v/',
            jable: 'https://jable.tv/videos/',
            cili1: 'https://1cili.com/search?q='
        }
    };

    const CODE_LIBRARY = {
        data: null,
        trash: null,
        initialized: false,

        init: function(force) {
            if (this.initialized && !force) return true;
            try {
                const savedData = GM_getValue(CONFIG.codeManager.storageKey);
                this.data = savedData ? JSON.parse(savedData) : {
                    items: [],
                    lastUpdated: new Date().toISOString()
                };
                const savedTrash = GM_getValue(CONFIG.codeManager.trashStorageKey);
                this.trash = savedTrash ? JSON.parse(savedTrash) : {
                    items: [],
                    lastUpdated: new Date().toISOString()
                };
                this.cleanupTrash();
                // 自愈：清理历史遗留的非字符串 remarks（如误写入的 [object Object]）
                let dataFixed = false;
                const fixRemarks = (list) => {
                    for (const it of list) {
                        if (it && it.remarks != null && typeof it.remarks !== 'string') {
                            it.remarks = '';
                            dataFixed = true;
                        }
                    }
                };
                if (Array.isArray(this.data.items)) fixRemarks(this.data.items);
                if (Array.isArray(this.trash.items)) fixRemarks(this.trash.items);
                if (dataFixed) {
                    this.data.lastUpdated = new Date().toISOString();
                    GM_setValue(CONFIG.codeManager.storageKey, JSON.stringify(this.data));
                    this.trash.lastUpdated = new Date().toISOString();
                    GM_setValue(CONFIG.codeManager.trashStorageKey, JSON.stringify(this.trash));
                }
                this.initialized = true;
                return true;
            } catch (e) {
                console.error('番号库初始化失败:', e);
                this.data = { items: [], lastUpdated: new Date().toISOString() };
                this.trash = { items: [], lastUpdated: new Date().toISOString() };
                this.initialized = true;
                return false;
            }
        },

        save: function() {
            try {
                this.data.lastUpdated = new Date().toISOString();
                GM_setValue(CONFIG.codeManager.storageKey, JSON.stringify(this.data));
                this.trash.lastUpdated = new Date().toISOString();
                GM_setValue(CONFIG.codeManager.trashStorageKey, JSON.stringify(this.trash));
                window.dispatchEvent(new CustomEvent('emh_library_updated', {
                    detail: { type: 'library_update', data: this.data }
                }));
                if (typeof GM_setValue !== 'undefined') {
                    GM_setValue('emh_sync_timestamp', Date.now().toString());
                }
                return true;
            } catch (e) {
                console.error('保存番号库失败:', e);
                UTILS.showToast('保存番号库失败', 'error');
                return false;
            }
        },

        getAll: function() {
            if (!this.initialized) this.init();
            return [...this.data.items];
        },

        getFavorites: function() {
            if (!this.initialized) this.init();
            return this.data.items.filter(item => item.status === 'favorite');
        },

        getWatched: function() {
            if (!this.initialized) this.init();
            return this.data.items.filter(item => item.status === 'watched');
        },

        getTrash: function() {
            if (!this.initialized) this.init();
            return [...this.trash.items];
        },

        add: function(code, title = '', remarks = '') {
            if (!this.initialized) this.init();
            if (!code) return false;
            const normalizedCode = code.toUpperCase();
            if (this.getItem(normalizedCode)) {
                UTILS.showToast(`番号 ${normalizedCode} 已存在于番号库中`, 'warning');
                return false;
            }
            this.data.items.unshift({
                code: normalizedCode,
                title: title || normalizedCode,
                status: 'unmarked',
                remarks: remarks || '',
                tags: [],
                createdDate: new Date().toISOString(),
                modifiedDate: new Date().toISOString()
            });
            this.save();
            return true;
        },

        delete: function(code) {
            if (!this.initialized) this.init();
            if (!code) return false;
            const normalizedCode = code.toUpperCase();
            const itemIndex = this.data.items.findIndex(item => item.code.toUpperCase() === normalizedCode);
            if (itemIndex === -1) return false;
            const item = this.data.items[itemIndex];
            item.deleteDate = new Date().toISOString();
            this.data.items.splice(itemIndex, 1);
            this.trash.items.unshift(item);
            return this.save();
        },

        cleanupTrash: function() {
            if (!this.trash || !this.trash.items || !this.trash.items.length) return;
            const now = new Date();
            const retentionPeriod = CONFIG.codeManager.trashRetentionDays * 24 * 60 * 60 * 1000;
            const before = this.trash.items.length;
            this.trash.items = this.trash.items.filter(item => {
                return (now - new Date(item.deleteDate)) < retentionPeriod;
            });
            if (this.trash.items.length !== before) {
                this.data.lastUpdated = new Date().toISOString();
                GM_setValue(CONFIG.codeManager.storageKey, JSON.stringify(this.data));
                this.trash.lastUpdated = new Date().toISOString();
                GM_setValue(CONFIG.codeManager.trashStorageKey, JSON.stringify(this.trash));
            }
        },

        getItem: function(code) {
            if (!this.initialized) this.init();
            if (!code) return null;
            const normalizedCode = code.toUpperCase();
            return this.data.items.find(item => item.code.toUpperCase() === normalizedCode);
        },

        getStatus: function(code) {
            const item = this.getItem(code);
            return item ? item.status : 'unmarked';
        },

        // 归一化 magnet 字段：兼容三种形态（单值字符串 / 旧字符串数组 / 新对象数组），
        // 统一返回对象数组 [{ id, value, preview? }]。旧数据自动生成 id（数据迁移）。
        // preview 为 whatslink 缓存：{ name, type, fileType, size, count, screenshots, fetchedAt, error? }
        normMagnets: function(m) {
            let arr = [];
            if (!m) {
                arr = [];
            } else if (Array.isArray(m)) {
                arr = m.slice();
            } else {
                arr = [m];
            }
            // 统一为 { id, value, preview? } 对象
            return arr.map((entry, i) => {
                if (entry && typeof entry === 'object' && entry.value) {
                    const out = { id: entry.id || ('m-' + Date.now().toString(36) + '-' + i), value: String(entry.value).trim() };
                    const pv = this.sanitizeMagnetPreview(entry.preview);
                    if (pv) out.preview = pv;
                    return out;
                }
                const v = entry == null ? '' : String(entry).trim();
                if (!v) return null;
                return { id: 'm-' + Date.now().toString(36) + '-' + i, value: v };
            }).filter(Boolean);
        },

        sanitizeMagnetPreview: function(preview) {
            if (!preview || typeof preview !== 'object' || Array.isArray(preview)) return null;
            const isSafeHttpUrl = (url) => {
                if (typeof url !== 'string') return false;
                try {
                    const u = new URL(url.trim());
                    return u.protocol === 'https:' || u.protocol === 'http:';
                } catch (_) { return false; }
            };
            const shotsRaw = Array.isArray(preview.screenshots) ? preview.screenshots : [];
            const screenshots = [];
            const seen = new Set();
            for (let i = 0; i < shotsRaw.length && screenshots.length < 48; i++) {
                const item = shotsRaw[i];
                if (item == null) continue;
                let url = '';
                let time = null;
                if (typeof item === 'string') url = item;
                else if (typeof item === 'object') {
                    url = item.screenshot || item.url || item.src || item.image || '';
                    if (item.time != null && Number.isFinite(Number(item.time))) time = Number(item.time);
                }
                url = String(url || '').trim();
                if (!isSafeHttpUrl(url) || seen.has(url)) continue;
                seen.add(url);
                screenshots.push(time != null ? { screenshot: url, time } : { screenshot: url });
            }
            const sizeN = Number(preview.size);
            const countN = Number(preview.count);
            return {
                name: typeof preview.name === 'string' ? preview.name : (typeof preview.title === 'string' ? preview.title : ''),
                type: typeof preview.type === 'string' ? preview.type : '',
                fileType: typeof preview.fileType === 'string' ? preview.fileType : (typeof preview.file_type === 'string' ? preview.file_type : ''),
                size: Number.isFinite(sizeN) ? sizeN : null,
                count: Number.isFinite(countN) ? countN : null,
                screenshots,
                fetchedAt: typeof preview.fetchedAt === 'string' ? preview.fetchedAt : (preview.fetchedAt ? String(preview.fetchedAt) : ''),
                error: typeof preview.error === 'string' ? preview.error : ''
            };
        },

        // 在 data / trash 中定位番号条目
        findItemRecord: function(code) {
            if (!this.initialized) this.init();
            if (!code) return null;
            const normalizedCode = String(code).toUpperCase();
            const mainIdx = this.data.items.findIndex(item => item.code.toUpperCase() === normalizedCode);
            if (mainIdx >= 0) return { list: this.data.items, index: mainIdx, item: this.data.items[mainIdx], inTrash: false };
            const trashIdx = this.trash.items.findIndex(item => item.code.toUpperCase() === normalizedCode);
            if (trashIdx >= 0) return { list: this.trash.items, index: trashIdx, item: this.trash.items[trashIdx], inTrash: true };
            return null;
        },

        // 写入某条磁力的 whatslink 预览缓存并持久化
        setMagnetPreview: function(code, magnetIdOrIdx, preview) {
            const rec = this.findItemRecord(code);
            if (!rec) return false;
            const magnets = this.normMagnets(rec.item.magnet);
            if (!magnets.length) return false;
            const t = String(magnetIdOrIdx);
            let idx = magnets.findIndex((e, i) => {
                const eid = this.magnetId(e);
                return (eid && String(eid) === t) || (!eid && String(i) === t);
            });
            if (idx < 0 && /^\d+$/.test(t)) idx = Number(t);
            if (idx < 0 || idx >= magnets.length) return false;
            const cleaned = this.sanitizeMagnetPreview(preview);
            if (cleaned) magnets[idx].preview = cleaned;
            else delete magnets[idx].preview;
            rec.item.magnet = magnets;
            rec.item.modifiedDate = new Date().toISOString();
            return this.save();
        },

        getMagnetPreview: function(code, magnetIdOrIdx) {
            const rec = this.findItemRecord(code);
            if (!rec) return null;
            const magnets = this.normMagnets(rec.item.magnet);
            const t = String(magnetIdOrIdx);
            let idx = magnets.findIndex((e, i) => {
                const eid = this.magnetId(e);
                return (eid && String(eid) === t) || (!eid && String(i) === t);
            });
            if (idx < 0 && /^\d+$/.test(t)) idx = Number(t);
            if (idx < 0 || idx >= magnets.length) return null;
            return this.sanitizeMagnetPreview(magnets[idx].preview);
        },

        // 取磁力对象的值（兼容对象/字符串）
        magnetValue: function(m) {
            if (m == null) return '';
            if (typeof m === 'object') return m.value || '';
            return String(m).trim();
        },

        // 取磁力对象的 id（兼容对象/字符串；字符串返回 null）
        magnetId: function(m) {
            if (m && typeof m === 'object') return m.id || null;
            return null;
        },

        // 清理磁力链接用于显示：去掉 &dn=xxx 参数（dn 可能带乱码/番号后缀）
        cleanMagnet: function(m) {
            const s = this.magnetValue(m);
            if (!s) return '';
            // 去掉以 &dn= 或 ?dn= 开头的参数（保留 magnet:?xt=urn:... 主体及其余 tr 参数）
            return s.replace(/([&?])dn=[^&]*/gi, '');
        },

        // 提取磁力链接的 dn 参数值作为展示名；无 dn 时返回 cleanMagnet 后的精简磁力
        magnetName: function(m) {
            const s = this.magnetValue(m);
            if (!s) return '';
            const dm = s.match(/(?:[&?])dn=([^&]*)/i);
            if (dm && dm[1]) {
                try { return decodeURIComponent(dm[1]); }
                catch (e) { return dm[1]; }
            }
            return this.cleanMagnet(s);
        },

        markItem: function(code, status, title = '', remark, magnet) {
            if (!this.initialized) this.init();
            if (!code) return false;
            // remark 规范化：仅接受字符串；对象/数组转为空（防止 [object Object] 写入）
            if (remark != null && typeof remark !== 'string') {
                remark = '';
            }
            const normalizedCode = code.toUpperCase();
            if (!['unmarked', 'favorite', 'watched'].includes(status)) {
                status = 'unmarked';
            }
            const existingIndex = this.data.items.findIndex(item => item.code.toUpperCase() === normalizedCode);
            if (existingIndex >= 0) {
                const cur = this.data.items[existingIndex];
                // 不可变更新：换新对象引用，保证 memo(ItemRow) 能感知状态/备注/磁力变化
                this.data.items[existingIndex] = {
                    ...cur,
                    status: status,
                    ...(title ? { title: title } : {}),
                    ...(remark !== undefined ? { remarks: remark } : {}),
                    ...(magnet !== undefined ? { magnet: this.normMagnets(magnet) } : {}),
                    modifiedDate: new Date().toISOString()
                };
            } else {
                this.data.items.unshift({
                    code: normalizedCode,
                    title: title || normalizedCode,
                    status: status,
                    remarks: remark || '',
                    magnet: this.normMagnets(magnet),
                    tags: [],
                    createdDate: new Date().toISOString(),
                    modifiedDate: new Date().toISOString()
                });
            }
            return this.save();
        },

        setTags: function(code, tags) {
            if (!this.initialized) this.init();
            if (!code) return false;
            const rec = this.findItemRecord(code);
            if (!rec || rec.inTrash) return false;
            const arr = Array.isArray(tags) ? tags : (tags == null ? [] : [tags]);
            const cleaned = [];
            const seen = new Set();
            for (const t of arr) {
                const s = String(t == null ? '' : t).trim();
                if (s && !seen.has(s.toLowerCase())) {
                    seen.add(s.toLowerCase());
                    cleaned.push(s);
                }
            }
            rec.item.tags = cleaned;
            rec.item.modifiedDate = new Date().toISOString();
            return this.save();
        },

        clearAllPreviewCaches: function() {
            if (!this.initialized) this.init();
            let cleared = 0;
            const scan = (list) => {
                for (const it of list) {
                    const ms = this.normMagnets(it && it.magnet);
                    let changed = false;
                    for (const m of ms) {
                        if (m.preview) { delete m.preview; changed = true; cleared++; }
                    }
                    if (changed) { it.magnet = ms; }
                }
            };
            scan(this.data.items);
            scan(this.trash.items);
            if (cleared) this.save();
            return cleared;
        },

        previewCacheStats: function() {
            if (!this.initialized) this.init();
            let magnets = 0, screenshots = 0, bytes = 0;
            const scan = (list) => {
                for (const it of list) {
                    const ms = this.normMagnets(it && it.magnet);
                    for (const m of ms) {
                        if (m.preview) {
                            magnets++;
                            screenshots += (Array.isArray(m.preview.screenshots) ? m.preview.screenshots.length : 0);
                            try { bytes += JSON.stringify(m.preview).length; } catch (e) {}
                        }
                    }
                }
            };
            scan(this.data.items);
            scan(this.trash.items);
            return { magnets, screenshots, bytes };
        },

        exportData: function(filter = 'all') {
            if (!this.initialized) this.init();
            let exportData = {
                version: "1.0",
                exportDate: new Date().toISOString(),
                filter: filter,
                items: []
            };
            if (filter === 'trash') {
                exportData.items = [...this.trash.items];
            } else if (filter === 'all') {
                exportData.items = [...this.data.items];
            } else {
                exportData.items = this.data.items.filter(item => item.status === filter);
            }
            return exportData;
        },

        importData: function(data, mode = 'merge') {
            if (!this.initialized) this.init();
            try {
                if (!data.items || !Array.isArray(data.items)) {
                    throw new Error('导入的数据格式不正确');
                }
                if (mode === 'replace') {
                    this.data.items = data.items;
                } else if (mode === 'merge') {
                    for (const importedItem of data.items) {
                        if (!importedItem.code) continue;
                        const normalizedCode = importedItem.code.toUpperCase();
                        const existingIndex = this.data.items.findIndex(item =>
                            item.code.toUpperCase() === normalizedCode
                        );
                        if (existingIndex >= 0) {
                            this.data.items[existingIndex] = {
                                ...this.data.items[existingIndex],
                                ...importedItem,
                                code: normalizedCode,
                                modifiedDate: new Date().toISOString()
                            };
                        } else {
                            this.data.items.unshift({
                                ...importedItem,
                                code: normalizedCode,
                                createdDate: importedItem.createdDate || new Date().toISOString(),
                                modifiedDate: new Date().toISOString()
                            });
                        }
                    }
                }
                this.save();
                return { success: true, message: `成功导入 ${data.items.length} 个番号条目` };
            } catch (e) {
                console.error('导入番号数据失败:', e);
                return { success: false, message: '导入失败: ' + e.message };
            }
        }
    };

    const UTILS = {
        showToast: (message, type = 'info') => {
            const evt = new CustomEvent('emh_toast', { detail: { message, type } });
            window.dispatchEvent(evt);
        },
        formatBytes: (bytes) => {
            const n = Number(bytes);
            if (!Number.isFinite(n) || n < 0) return '';
            if (n < 1024) return n + ' B';
            const units = ['KB', 'MB', 'GB', 'TB'];
            let v = n;
            let i = -1;
            do { v /= 1024; i += 1; } while (v >= 1024 && i < units.length - 1);
            return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i];
        },
        isSafeHttpUrl: (url) => {
            if (typeof url !== 'string') return false;
            try {
                const u = new URL(url.trim());
                return u.protocol === 'https:' || u.protocol === 'http:';
            } catch (_) { return false; }
        },
        formatTime: (sec) => {
            const s = Number(sec);
            if (!Number.isFinite(s) || s < 0) return '';
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const ss = Math.floor(s % 60);
            return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
        }
    };

    // 磁力宫格缩略图懒加载（IntersectionObserver）
    const LAZY = {
        _io: null,
        get io() {
            if (!this._io && typeof IntersectionObserver !== 'undefined') {
                this._io = new IntersectionObserver((entries) => {
                    for (const en of entries) {
                        if (!en.isIntersecting) continue;
                        const el = en.target;
                        const src = el.getAttribute('data-src');
                        if (src) el.style.backgroundImage = 'url("' + src + '")';
                        this._io.unobserve(el);
                    }
                }, { rootMargin: '240px' });
            }
            return this._io;
        },
        observe(el) {
            if (el.dataset.lazy) return;
            el.dataset.lazy = '1';
            if (!this.io) {
                const src = el.getAttribute('data-src');
                if (src) el.style.backgroundImage = 'url("' + src + '")';
                return;
            }
            this.io.observe(el);
        }
    };

    // 通用内联 SVG 图标（线性描边，跟随 currentColor）
    const ICONS = {
        grid: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
    };

    // ===== 主题管理（深色优先默认 · data-emh-theme 属性驱动） =====
    const THEME = {
        KEY: 'emh_ui_theme',
        ORDER: ['dark', 'light', 'system'],
        get: function() {
            let t = 'dark';
            try {
                const saved = typeof GM_getValue === 'function' ? GM_getValue(this.KEY) : null;
                if (saved === 'dark' || saved === 'light' || saved === 'system') t = saved;
            } catch (e) {}
            return t;
        },
        apply: function(theme) {
            document.documentElement.setAttribute('data-emh-theme', theme);
        },
        set: function(theme) {
            if (!['dark', 'light', 'system'].includes(theme)) theme = 'dark';
            this.apply(theme);
            try { if (typeof GM_setValue === 'function') GM_setValue(this.KEY, theme); } catch (e) {}
        },
        next: function() {
            const cur = this.get();
            return this.ORDER[(this.ORDER.indexOf(cur) + 1) % this.ORDER.length];
        }
    };

    // ===== standalone 独立页：后台加载同源真实网址（原生 GM 能力，不依赖父页） =====
    const STANDALONE = {
        // 同源真实网址 + #emh-standalone 标记；该页脚本原生运行 → GM 数据/网络齐全，父页可关闭
        standaloneUrl: function() {
            return location.href.split('#')[0] + '#emh-standalone';
        },

        open: function() {
            const url = this.standaloneUrl();
            // 后台加载（不抢焦点）；GM_openInTab 不可用时回退 window.open
            try {
                if (typeof GM_openInTab === 'function') {
                    GM_openInTab(url, { active: false, insert: true });
                    UTILS.showToast('已在后台加载番号库独立页', 'success');
                    return;
                }
            } catch (e) {}
            const w = window.open(url, '_blank');
            if (w) UTILS.showToast('已在新标签页打开番号库', 'success');
            else UTILS.showToast('浏览器拦截了新窗口，请允许弹窗后重试', 'warning');
        }
    };

    // whatslink 磁力截图预览（灯箱 + API 解析）
    const MAGNET_PREVIEW = {
        API: 'https://whatslink.info/api/v1/link',
        TIMEOUT: 20000,
        _ready: false,
        _urls: [],
        _index: 0,
        _open: false,
        _touchX: null,
        _els: null,
        _requestSeq: 0,
        _inflight: {},
        _lastErrorIdx: -1,

        _isCacheFresh: function(preview) {
            if (!preview || !preview.fetchedAt) return false;
            const t = new Date(preview.fetchedAt).getTime();
            if (!Number.isFinite(t)) return false;
            const ttl = preview.error ? CONFIG.magnetPreview.errorTtlMs : CONFIG.magnetPreview.cacheTtlMs;
            return (Date.now() - t) < ttl;
        },

        _errPreview: function(err) {
            return CODE_LIBRARY.sanitizeMagnetPreview({
                error: err || '预览失败',
                screenshots: [],
                fetchedAt: new Date().toISOString()
            });
        },

        ensureUi: function() {
            if (this._ready) return;
            if (!document.getElementById('emh-magnet-lb-style')) {
                const st = document.createElement('style');
                st.id = 'emh-magnet-lb-style';
                st.textContent = `
                    #emh-magnet-lightbox {
                        position: fixed; inset: 0; z-index: 10050; display: none;
                        align-items: center; justify-content: center;
                        background: rgba(0,0,0,0.88);
                        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
                        user-select: none;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    }
                    #emh-magnet-lightbox.open { display: flex; }
                    #emh-magnet-lb-stage {
                        position: relative; width: 100%; height: 100%;
                        display: flex; align-items: center; justify-content: center;
                        padding: 48px 64px 56px; box-sizing: border-box;
                    }
                    #emh-magnet-lb-img {
                        max-width: 100%; max-height: 100%; object-fit: contain;
                        border-radius: 4px; box-shadow: 0 8px 32px rgba(0,0,0,0.45); background: #111;
                        transition: opacity 0.25s ease;
                    }
                    #emh-magnet-lb-img.is-loading { opacity: 0.35; }
                    .emh-lb-btn {
                        position: absolute; top: 50%; transform: translateY(-50%);
                        width: 44px; height: 44px; border: none; border-radius: 50%;
                        background: rgba(255,255,255,0.12); color: #fff; font-size: 28px;
                        line-height: 1; cursor: pointer; display: flex; align-items: center;
                        justify-content: center; z-index: 2; transition: background 0.15s, opacity 0.15s;
                    }
                    .emh-lb-btn:hover { background: rgba(255,255,255,0.22); }
                    .emh-lb-btn:disabled { opacity: 0.25; cursor: default; }
                    #emh-magnet-lb-close:focus-visible,
                    .emh-lb-btn:focus-visible { outline: 2px solid rgba(255,255,255,0.7); outline-offset: 2px; }
                    #emh-magnet-lb-prev { left: 12px; }
                    #emh-magnet-lb-next { right: 12px; }
                    #emh-magnet-lb-close {
                        position: absolute; top: 12px; right: 12px; width: 40px; height: 40px;
                        border: none; border-radius: 50%; background: rgba(255,255,255,0.12);
                        color: #fff; font-size: 24px; cursor: pointer; z-index: 3; line-height: 1;
                        transition: background 0.15s;
                    }
                    #emh-magnet-lb-close:hover { background: rgba(255,255,255,0.22); }
                    #emh-magnet-lb-counter {
                        position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
                        color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600;
                        padding: 6px 12px; border-radius: 999px; background: rgba(0,0,0,0.45);
                        z-index: 2; pointer-events: none;
                    }
                    #emh-magnet-lb-meta {
                        position: absolute; top: 14px; left: 16px; right: 64px;
                        color: rgba(255,255,255,0.85); font-size: 12px; line-height: 1.4;
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                        z-index: 2; pointer-events: none;
                    }
                    #emh-magnet-lb-hint {
                        position: absolute; bottom: 14px; right: 16px;
                        color: rgba(255,255,255,0.45); font-size: 11px; z-index: 2; pointer-events: none;
                    }
                    #emh-magnet-lb-thumbs {
                        position: absolute; bottom: 46px; left: 50%; transform: translateX(-50%);
                        display: flex; gap: 6px; max-width: 72%; overflow-x: auto;
                        padding: 6px 8px; border-radius: 10px;
                        background: rgba(0,0,0,0.45); z-index: 2;
                        scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) transparent;
                    }
                    #emh-magnet-lb-thumbs::-webkit-scrollbar { height: 4px; }
                    #emh-magnet-lb-thumbs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 2px; }
                    .emh-lb-thumb {
                        flex-shrink: 0; width: 56px; height: 36px; padding: 0; border: none; cursor: pointer;
                        border-radius: 4px; overflow: hidden; opacity: 0.55; transition: opacity 0.15s, box-shadow 0.15s;
                        background: #111;
                    }
                    .emh-lb-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
                    .emh-lb-thumb:hover { opacity: 0.85; }
                    .emh-lb-thumb.active { opacity: 1; box-shadow: 0 0 0 2px var(--emh-primary); }
                    .emh-lb-thumb:focus-visible { outline: 2px solid rgba(255,255,255,0.7); outline-offset: 1px; }
                    @media (max-width: 640px) {
                        #emh-magnet-lb-stage { padding: 44px 52px 52px; }
                        .emh-lb-btn { width: 38px; height: 38px; font-size: 24px; }
                        #emh-magnet-lb-hint { display: none; }
                        #emh-magnet-lb-thumbs { display: none; }
                    }
                `;
                document.head.appendChild(st);
            }
            const root = document.createElement('div');
            root.id = 'emh-magnet-lightbox';
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'true');
            root.setAttribute('aria-label', '磁力截图预览');
            root.innerHTML = `
                <div id="emh-magnet-lb-stage">
                    <div id="emh-magnet-lb-meta"></div>
                    <button type="button" id="emh-magnet-lb-close" aria-label="关闭">×</button>
                    <button type="button" class="emh-lb-btn" id="emh-magnet-lb-prev" aria-label="上一张">‹</button>
                    <img id="emh-magnet-lb-img" alt="Screenshot" referrerpolicy="no-referrer" />
                    <button type="button" class="emh-lb-btn" id="emh-magnet-lb-next" aria-label="下一张">›</button>
                    <div id="emh-magnet-lb-counter"></div>
                    <div id="emh-magnet-lb-thumbs"></div>
                    <div id="emh-magnet-lb-hint">← → 切换 · Esc 关闭</div>
                </div>
            `;
            document.body.appendChild(root);
            this._els = {
                root,
                img: root.querySelector('#emh-magnet-lb-img'),
                prev: root.querySelector('#emh-magnet-lb-prev'),
                next: root.querySelector('#emh-magnet-lb-next'),
                close: root.querySelector('#emh-magnet-lb-close'),
                counter: root.querySelector('#emh-magnet-lb-counter'),
                meta: root.querySelector('#emh-magnet-lb-meta'),
                thumbs: root.querySelector('#emh-magnet-lb-thumbs')
            };
            this._els.prev.addEventListener('click', (e) => { e.stopPropagation(); this.step(-1); });
            this._els.next.addEventListener('click', (e) => { e.stopPropagation(); this.step(1); });
            this._els.close.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
            root.addEventListener('click', (e) => {
                if (e.target === root || e.target.id === 'emh-magnet-lb-stage') this.close();
            });
            root.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches[0]) this._touchX = e.touches[0].clientX;
            }, { passive: true });
            root.addEventListener('touchend', (e) => {
                if (this._touchX == null || !e.changedTouches || !e.changedTouches[0]) {
                    this._touchX = null;
                    return;
                }
                const dx = e.changedTouches[0].clientX - this._touchX;
                this._touchX = null;
                if (Math.abs(dx) < 40) return;
                this.step(dx < 0 ? 1 : -1);
            }, { passive: true });
            document.addEventListener('keydown', (e) => {
                // 灯箱打开时接管方向键：必须 preventDefault 阻止浏览器前进/后退
                const visible = this._open || (this._els && this._els.root && this._els.root.classList.contains('open'));
                if (!visible) return;
                const k = e.key;
                if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
                else if (k === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); this.step(-1); }
                else if (k === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); this.step(1); }
            }, { passive: false });
            this._ready = true;
        },

        _update: function() {
            const { img, prev, next, counter } = this._els;
            const total = this._urls.length;
            if (!total) {
                counter.textContent = '';
                prev.disabled = true;
                next.disabled = true;
                img.classList.remove('is-loading');
                img.removeAttribute('src');
                img.alt = 'Screenshot';
                if (this._els.thumbs) this._els.thumbs.innerHTML = '';
                return;
            }
            const idx = this._index;
            const url = this._urls[idx];
            counter.textContent = (idx + 1) + ' / ' + total;
            prev.disabled = total <= 1;
            next.disabled = total <= 1;
            if (img.getAttribute('src') === url) {
                img.classList.remove('is-loading');
                return;
            }
            img.classList.add('is-loading');
            img.onload = () => img.classList.remove('is-loading');
            img.onerror = () => {
                img.classList.remove('is-loading');
                if (total > 1 && idx !== this._lastErrorIdx) {
                    // 跳过失效截图自动切到下一张；同一张不重复跳过，避免坏图死循环
                    this._lastErrorIdx = idx;
                    this.step(1);
                    return;
                }
                img.removeAttribute('src');
                img.alt = '图片加载失败';
            };
            img.alt = 'Screenshot ' + (idx + 1);
            img.src = url;
            [idx - 1, idx + 1].forEach((n) => {
                if (n >= 0 && n < total) {
                    const pre = new Image();
                    pre.referrerPolicy = 'no-referrer';
                    pre.src = this._urls[n];
                }
            });
            if (this._els.thumbs) {
                const thumbs = this._els.thumbs;
                thumbs.innerHTML = '';
                this._urls.forEach((u, i) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'emh-lb-thumb' + (i === idx ? ' active' : '');
                    b.title = '跳转到截图 ' + (i + 1);
                    const im = new Image();
                    im.referrerPolicy = 'no-referrer';
                    im.alt = '';
                    im.src = u;
                    b.appendChild(im);
                    b.addEventListener('click', (e) => { e.stopPropagation(); this._index = i; this._update(); });
                    thumbs.appendChild(b);
                });
                thumbs.scrollLeft = Math.max(0, idx * 62 - thumbs.clientWidth / 2);
            }
        },

        open: function(urls, startIndex, metaText) {
            this.ensureUi();
            const list = (Array.isArray(urls) ? urls : []).filter(UTILS.isSafeHttpUrl);
            if (!list.length) {
                UTILS.showToast('暂无可用截图', 'warning');
                return;
            }
            let idx = Number(startIndex);
            if (!Number.isFinite(idx) || idx < 0) idx = 0;
            if (idx >= list.length) idx = list.length - 1;
            this._urls = list;
            this._index = idx;
            this._open = true;
            this._lastErrorIdx = -1;
            this._els.meta.textContent = metaText || '';
            this._els.root.classList.add('open');
            this._update();
        },

        close: function() {
            if (!this._open || !this._els) return;
            this._open = false;
            this._els.root.classList.remove('open');
            this._urls = [];
            this._index = 0;
            this._lastErrorIdx = -1;
            this._els.img.removeAttribute('src');
            this._els.img.alt = 'Screenshot';
            this._els.img.classList.remove('is-loading');
            this._els.counter.textContent = '';
            this._els.meta.textContent = '';
            if (this._els.thumbs) this._els.thumbs.innerHTML = '';
        },

        step: function(delta) {
            if (!this._open || !this._urls.length) return;
            const total = this._urls.length;
            this._index = (this._index + delta + total) % total;
            this._update();
        },

        parseApiResponse: function(rawText) {
            let data;
            try { data = JSON.parse(rawText); }
            catch (_) { return { ok: false, error: '接口返回非 JSON' }; }
            if (data == null || typeof data !== 'object' || Array.isArray(data)) {
                return { ok: false, error: '接口数据结构异常' };
            }
            const apiError = typeof data.error === 'string' ? data.error.trim() : '';
            if (apiError) return { ok: false, error: apiError };
            const preview = CODE_LIBRARY.sanitizeMagnetPreview({
                name: data.name || data.title || '',
                type: data.type || '',
                file_type: data.file_type || data.type || '',
                size: data.size,
                count: data.count,
                screenshots: data.screenshots,
                fetchedAt: new Date().toISOString(),
                error: ''
            });
            if (!preview) return { ok: false, error: '预览数据无效' };
            return { ok: true, preview };
        },

        fetchAndCache: function(code, magnetId, magnetValue, opts) {
            const options = opts || {};
            const force = !!options.force;
            const onStart = typeof options.onStart === 'function' ? options.onStart : null;
            const onDone = typeof options.onDone === 'function' ? options.onDone : null;

            const magnet = String(magnetValue || '').trim();
            if (!magnet || magnet.indexOf('magnet:') !== 0) {
                UTILS.showToast('无效的磁力链接', 'error');
                if (onDone) onDone(new Error('invalid magnet'));
                return;
            }
            if (typeof GM_xmlhttpRequest !== 'function') {
                UTILS.showToast('当前环境不支持跨域请求', 'error');
                if (onDone) onDone(new Error('no gm'));
                return;
            }

            // 全局递增序号：并发竞态下仅“最新一次用户请求”能打开灯箱/弹提示
            const mySeq = ++this._requestSeq;
            const key = String(code) + '::' + String(magnetId);

            // 命中缓存：优先展示旧截图；若过期则在展示的同时后台刷新
            const cached = !force ? CODE_LIBRARY.getMagnetPreview(code, magnetId) : null;
            if (cached && Array.isArray(cached.screenshots) && cached.screenshots.length) {
                const urls = cached.screenshots.map(s => s.screenshot || s.url || '').filter(Boolean);
                const metaParts = [cached.name, cached.fileType || cached.type, UTILS.formatBytes(cached.size)].filter(Boolean);
                this.open(urls, 0, metaParts.join(' · '));
                if (onDone) onDone(null, cached);
                if (this._isCacheFresh(cached)) return;
            } else if (cached && cached.error && !force && this._isCacheFresh(cached)) {
                // 错误缓存仍在有效期内：直接提示并跳过重复请求
                UTILS.showToast(cached.error || '上次预览失败', 'warning');
                if (onDone) onDone(new Error(cached.error || 'cached error'));
                return;
            }

            // 并发去重：同一磁力已有在途请求时复用结果，不重复发起 HTTP
            const existing = this._inflight[key];
            if (existing && !force) {
                existing.latestSeq = Math.max(existing.latestSeq, mySeq);
                existing.p.then((r) => {
                    if (existing.superseded) {
                        if (onDone) onDone(new Error('superseded'));
                        return;
                    }
                    if (onDone) onDone((r && r.error) ? new Error(r.error) : null, (r && r.preview) || null);
                });
                return;
            }
            if (existing && force) existing.superseded = true;

            if (onStart) onStart();
            UTILS.showToast('正在获取截图预览…', 'info');

            // 预先登记在途条目：请求回调据此判断自己是否仍是“最新且未被作废”
            const entry = this._inflight[key] = { p: null, latestSeq: mySeq, superseded: false };
            const p = new Promise((resolve) => {
                const finish = (errText, preview, noShotToast) => {
                    const isLatest = !entry.superseded && this._inflight[key] === entry && entry.latestSeq === this._requestSeq;
                    const urls = preview ? preview.screenshots.map(s => s.screenshot || s.url || '').filter(Boolean) : [];
                    if (isLatest) {
                        if (urls.length) {
                            const metaParts = [preview.name, preview.fileType || preview.type, UTILS.formatBytes(preview.size)].filter(Boolean);
                            this.open(urls, 0, metaParts.join(' · '));
                            if (!errText) UTILS.showToast('截图已缓存', 'success');
                        } else if (noShotToast) {
                            UTILS.showToast('接口未返回截图', 'warning');
                        } else if (errText) {
                            UTILS.showToast(errText, 'error');
                        }
                    }
                    // 仅在最新请求时持久化错误，避免旧请求的失败污染新结果
                    if (isLatest && errText && !preview) {
                        CODE_LIBRARY.setMagnetPreview(code, magnetId, this._errPreview(errText));
                    }
                    if (onDone) onDone(errText ? new Error(errText) : null, preview || null);
                    resolve({
                        error: errText,
                        urls,
                        meta: [preview && preview.name, preview && (preview.fileType || preview.type), UTILS.formatBytes(preview && preview.size)].filter(Boolean).join(' · '),
                        preview: preview || null
                    });
                };
                const url = this.API + '?url=' + encodeURIComponent(magnet);
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    timeout: this.TIMEOUT,
                    headers: { 'Accept': 'application/json, text/plain, */*' },
                    onload: (res) => {
                        const status = res && typeof res.status === 'number' ? res.status : 0;
                        if (status < 200 || status >= 300) { finish('预览失败：HTTP ' + status, null); return; }
                        const parsed = this.parseApiResponse(res.responseText || '');
                        if (!parsed.ok) { finish(parsed.error || '预览失败', null); return; }
                        CODE_LIBRARY.setMagnetPreview(code, magnetId, parsed.preview);
                        if (!parsed.preview || !parsed.preview.screenshots || !parsed.preview.screenshots.length) {
                            finish('', parsed.preview, true);
                            return;
                        }
                        finish('', parsed.preview, false);
                    },
                    onerror: () => finish('网络请求失败', null),
                    ontimeout: () => finish('请求超时', null)
                });
            });
            entry.p = p;
            p.then(() => { if (this._inflight[key] === entry) delete this._inflight[key]; });
        }
    };

    function waitForElement(selector, callback, timeout = 7000) {
        const startTime = Date.now();
        const intervalId = setInterval(() => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                clearInterval(intervalId);
                callback(elements[0]);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(intervalId);
                console.warn(`EMH: Element "${selector}" not found within ${timeout}ms.`);
                callback(null);
            }
        }, 200);
    }

    function createCodeStatusIndicator(container, code) {
        if (!code || !container) return null;
        if (!CODE_LIBRARY.initialized) CODE_LIBRARY.init();
        const currentStatus = CODE_LIBRARY.getStatus(code);
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'emh-code-status-indicator';
        statusIndicator.dataset.code = code;
        statusIndicator.dataset.status = currentStatus;
        const statusColors = CONFIG.codeManager.statusColors;
        statusIndicator.style.backgroundColor = statusColors[currentStatus] || statusColors.unmarked;
        let statusText = '未标记';
        if (currentStatus === 'favorite') statusText = '已关注';
        if (currentStatus === 'watched') statusText = '已看过';
        if (currentStatus === 'watched') {
            statusIndicator.title = `状态: ${statusText} (请在番号库中修改状态)`;
            statusIndicator.style.cursor = 'default';
        } else {
            statusIndicator.title = `状态: ${statusText} (点击${currentStatus === 'favorite' ? '取消' : ''}关注)`;
            statusIndicator.style.cursor = 'pointer';
        }
        statusIndicator.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const curStatus = CODE_LIBRARY.getStatus(code);
            if (curStatus === 'watched') {
                UTILS.showToast('已看状态请在番号库中修改', 'warning');
                return;
            }
            const newStatus = curStatus === 'favorite' ? 'unmarked' : 'favorite';
            CODE_LIBRARY.markItem(code, newStatus);
            updateCodeStatusIndicators();
            UTILS.showToast(`番号 ${code} ${newStatus === 'favorite' ? '已关注' : '已取消关注'}`, 'success');
        });
        container.appendChild(statusIndicator);
        return statusIndicator;
    }

    function updateCodeStatusIndicators() {
        document.querySelectorAll('.emh-code-status-indicator').forEach(indicator => {
            const code = indicator.dataset.code;
            if (!code) return;
            const currentStatus = CODE_LIBRARY.getStatus(code);
            indicator.dataset.status = currentStatus;
            const statusColors = CONFIG.codeManager.statusColors;
            indicator.style.backgroundColor = statusColors[currentStatus] || statusColors.unmarked;
            let statusText = '未标记';
            if (currentStatus === 'favorite') statusText = '已关注';
            if (currentStatus === 'watched') statusText = '已看过';
            if (currentStatus === 'watched') {
                indicator.title = `状态: ${statusText} (请在番号库中修改状态)`;
                indicator.style.cursor = 'default';
            } else {
                indicator.title = `状态: ${statusText} (点击${currentStatus === 'favorite' ? '取消' : ''}关注)`;
                indicator.style.cursor = 'pointer';
            }
        });
    }

    const SITE_HANDLERS = {
        javgg: {
            isMatch: () => document.domain.includes('javgg'),
            targetSelector: 'article.item.movies .data, h1.post-title, .videoinfo .meta',
            process: (targetElement) => {
                if (document.querySelector("article.item.movies")) {
                    const sidebar = document.querySelector("#contenedor > div > div.sidebar.right.scrolling");
                    if (sidebar) sidebar.remove();

                    const linkProviders = [
                        { code: "njav", url: CONFIG.alternateUrl.av123 + "$p", target: "_blank" },
                        { code: "jable", url: CONFIG.alternateUrl.jable + "$p/", target: "_blank" },
                        { code: "1cili", url: CONFIG.alternateUrl.cili1 + "$p", target: "_blank" }
                    ];

                    document.querySelectorAll("article.item.movies").forEach(entry => {
                        const dataElement = entry.querySelector(".data");
                        const anchorTag = dataElement ? dataElement.querySelector("h3 a") : null;
                        if (anchorTag) {
                            const videoCode = anchorTag.textContent.trim();
                            if (!videoCode) return;
                            if (dataElement.querySelector('.emh-javgg-controls')) return;

                            const statusContainer = document.createElement('div');
                            statusContainer.className = 'emh-code-status-container';
                            statusContainer.style.display = 'inline-block';
                            statusContainer.style.marginLeft = '10px';
                            createCodeStatusIndicator(statusContainer, videoCode);
                            anchorTag.parentNode.appendChild(statusContainer);

                            const controlsDiv = document.createElement('div');
                            controlsDiv.className = 'emh-javgg-controls';
                            linkProviders.forEach(provider => {
                                const newAnchorTag = document.createElement("a");
                                newAnchorTag.href = provider.url.replace("$p", videoCode);
                                newAnchorTag.target = provider.target;
                                newAnchorTag.textContent = provider.code;
                                controlsDiv.appendChild(newAnchorTag);
                            });
                            dataElement.appendChild(controlsDiv);
                        }
                    });
                }
            }
        }
    };

    // ===== Preact 依赖加载（多 CDN fallback） =====
    const DEPS = {
        preact: [
            'https://cdn.jsdelivr.net/npm/preact@10.19.6/dist/preact.umd.js',
            'https://cdnjs.cloudflare.com/ajax/libs/preact/10.19.6/preact.umd.js'
        ],
        hooks: [
            'https://cdn.jsdelivr.net/npm/preact@10.19.6/hooks/dist/hooks.umd.js',
            'https://cdnjs.cloudflare.com/ajax/libs/preact/10.19.6/hooks.umd.js'
        ],
        htm: [
            'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js',
            'https://cdnjs.cloudflare.com/ajax/libs/htm/3.1.1/htm.umd.js'
        ]
    };

    function loadScriptOnce(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-emh-src="${src}"]`);
            if (existing) { resolve(); return; }
            const script = document.createElement('script');
            script.src = src;
            script.dataset.emhSrc = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('加载失败: ' + src));
            document.head.appendChild(script);
        });
    }

    function getGlobal(name) {
        try {
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow[name]) return unsafeWindow[name];
        } catch (e) {}
        try {
            if (window[name]) return window[name];
        } catch (e) {}
        return null;
    }

    async function ensurePreact() {
        if (getGlobal('preact') && getGlobal('preactHooks') && getGlobal('htm')) return true;
        const targets = [
            { name: 'preact', check: () => !!getGlobal('preact'), urls: DEPS.preact },
            { name: 'hooks', check: () => !!getGlobal('preactHooks'), urls: DEPS.hooks },
            { name: 'htm', check: () => !!getGlobal('htm'), urls: DEPS.htm }
        ];
        for (const dep of targets) {
            if (dep.check()) continue;
            let loaded = false;
            for (const url of dep.urls) {
                try { await loadScriptOnce(url); loaded = true; break; }
                catch (e) { console.warn(`EMH: ${dep.name} ${url}`, e.message); }
            }
            if (!loaded) { console.error(`EMH: 无法加载 ${dep.name}`); return false; }
        }
        return true;
    }

    function injectCoreStyles() {
        const id = 'emh-core-styles';
        if (document.getElementById(id)) return;
        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
            :root,
            :root[data-emh-theme="dark"] {
                /* Linear 系 — 深色默认（暖黑基底） */
                --emh-primary: #5e6ad2;
                --emh-primary-hover: #6673e0;
                --emh-primary-soft: rgba(94, 106, 210, 0.14);
                --emh-primary-softer: rgba(94, 106, 210, 0.08);
                --emh-on-primary: #ffffff;
                /* 中性灰阶 */
                --emh-text: #f7f8f8;
                --emh-text-secondary: #9ca3af;
                --emh-text-muted: #6b7280;
                --emh-border: rgba(255, 255, 255, 0.06);
                --emh-border-strong: rgba(255, 255, 255, 0.12);
                --emh-bg: #08090a;
                --emh-surface: #16171c;
                --emh-surface-raised: #26272e;
                /* 极淡阴影（无发光/无彩色） */
                --emh-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
                --emh-shadow-md: 0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.25);
                --emh-shadow-lg:
                    0 0 0 1px rgba(255, 255, 255, 0.06),
                    0 24px 48px -12px rgba(0, 0, 0, 0.5),
                    0 8px 16px -8px rgba(0, 0, 0, 0.4);
                /* 语义状态色 */
                --emh-danger: #f87171;
                --emh-danger-soft: rgba(248, 113, 113, 0.14);
                --emh-success: #34d399;
                --emh-success-soft: rgba(52, 211, 153, 0.14);
                --emh-warning: #fbbf24;
                --emh-warning-soft: rgba(251, 191, 36, 0.14);
                --emh-on-solid: #18181b;
                /* 按钮灰阶 */
                --emh-btn-bg: rgba(255, 255, 255, 0.06);
                --emh-btn-hover: rgba(255, 255, 255, 0.12);
                --emh-btn-active: rgba(255, 255, 255, 0.18);
                --emh-focus-ring: rgba(94, 106, 210, 0.35);
                --emh-overlay: rgba(0, 0, 0, 0.6);
                --emh-radius: 12px;
                --emh-radius-sm: 6px;
                --emh-glass: rgba(22, 23, 28, 0.8);
                --emh-ease: cubic-bezier(0.22, 1, 0.36, 1);
                --emh-font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', Menlo, ui-monospace, monospace;
            }
            :root[data-emh-theme="light"] {
                --emh-primary: #5e6ad2;
                --emh-primary-hover: #4f5cc8;
                --emh-primary-soft: rgba(94, 106, 210, 0.1);
                --emh-primary-softer: rgba(94, 106, 210, 0.06);
                --emh-on-primary: #ffffff;
                --emh-text: #18181b;
                --emh-text-secondary: #52525b;
                --emh-text-muted: #a1a1aa;
                --emh-border: rgba(0, 0, 0, 0.08);
                --emh-border-strong: rgba(0, 0, 0, 0.14);
                --emh-bg: #fafafa;
                --emh-surface: #ffffff;
                --emh-surface-raised: #f4f4f5;
                --emh-shadow-sm: 0 1px 2px rgba(24, 24, 27, 0.04);
                --emh-shadow-md: 0 2px 8px rgba(24, 24, 27, 0.06), 0 1px 2px rgba(24, 24, 27, 0.04);
                --emh-shadow-lg:
                    0 0 0 1px rgba(24, 24, 27, 0.04),
                    0 24px 48px -12px rgba(24, 24, 27, 0.18),
                    0 8px 16px -8px rgba(24, 24, 27, 0.12);
                --emh-danger: #dc2626;
                --emh-danger-soft: rgba(220, 38, 38, 0.1);
                --emh-success: #059669;
                --emh-success-soft: rgba(5, 150, 105, 0.12);
                --emh-warning: #d97706;
                --emh-warning-soft: rgba(217, 119, 6, 0.12);
                --emh-on-solid: #ffffff;
                --emh-btn-bg: rgba(24, 24, 27, 0.05);
                --emh-btn-hover: rgba(24, 24, 27, 0.09);
                --emh-btn-active: rgba(24, 24, 27, 0.13);
                --emh-focus-ring: rgba(94, 106, 210, 0.3);
                --emh-overlay: rgba(24, 24, 27, 0.35);
                --emh-radius: 12px;
                --emh-radius-sm: 6px;
                --emh-glass: rgba(255, 255, 255, 0.72);
                --emh-ease: cubic-bezier(0.22, 1, 0.36, 1);
                --emh-font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', Menlo, ui-monospace, monospace;
            }
            /* 主题跟随系统（浅色系统）— 仅当用户选择 system 时生效，默认深色优先 */
            @media (prefers-color-scheme: light) {
                :root[data-emh-theme="system"] {
                    --emh-primary: #5e6ad2;
                    --emh-primary-hover: #4f5cc8;
                    --emh-primary-soft: rgba(94, 106, 210, 0.1);
                    --emh-primary-softer: rgba(94, 106, 210, 0.06);
                    --emh-on-primary: #ffffff;
                    --emh-text: #18181b;
                    --emh-text-secondary: #52525b;
                    --emh-text-muted: #a1a1aa;
                    --emh-border: rgba(0, 0, 0, 0.08);
                    --emh-border-strong: rgba(0, 0, 0, 0.14);
                    --emh-bg: #fafafa;
                    --emh-surface: #ffffff;
                    --emh-surface-raised: #f4f4f5;
                    --emh-shadow-sm: 0 1px 2px rgba(24, 24, 27, 0.04);
                    --emh-shadow-md: 0 2px 8px rgba(24, 24, 27, 0.06), 0 1px 2px rgba(24, 24, 27, 0.04);
                    --emh-shadow-lg:
                        0 0 0 1px rgba(24, 24, 27, 0.04),
                        0 24px 48px -12px rgba(24, 24, 27, 0.18),
                        0 8px 16px -8px rgba(24, 24, 27, 0.12);
                    --emh-danger: #dc2626;
                    --emh-danger-soft: rgba(220, 38, 38, 0.1);
                    --emh-success: #059669;
                    --emh-success-soft: rgba(5, 150, 105, 0.12);
                    --emh-warning: #d97706;
                    --emh-warning-soft: rgba(217, 119, 6, 0.12);
                    --emh-on-solid: #ffffff;
                    --emh-btn-bg: rgba(24, 24, 27, 0.05);
                    --emh-btn-hover: rgba(24, 24, 27, 0.09);
                    --emh-btn-active: rgba(24, 24, 27, 0.13);
                    --emh-focus-ring: rgba(94, 106, 210, 0.3);
                    --emh-overlay: rgba(24, 24, 27, 0.35);
                    --emh-radius: 12px;
                    --emh-radius-sm: 6px;
                    --emh-glass: rgba(255, 255, 255, 0.72);
                    --emh-ease: cubic-bezier(0.22, 1, 0.36, 1);
                    --emh-font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', Menlo, ui-monospace, monospace;
                }
            }
            .emh-code-manager-toggle {
                position: fixed; bottom: 24px; right: 24px; z-index: 10000;
                display: inline-flex; align-items: center; gap: 8px;
                padding: 10px 20px; border-radius: 999px;
                background: var(--emh-primary);
                color: var(--emh-on-primary); border: 1px solid transparent;
                cursor: pointer; font-size: 14px; font-weight: 600;
                letter-spacing: 0.1px;
                box-shadow: 0 4px 16px var(--emh-primary-soft), var(--emh-shadow-md);
                transition: background-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .emh-code-manager-toggle:hover {
                background-color: var(--emh-primary-hover);
                transform: translateY(-1px);
                box-shadow: 0 6px 20px var(--emh-primary-soft), var(--emh-shadow-md);
            }
            .emh-code-manager-toggle:active { transform: scale(0.96); }
            .emh-code-manager-toggle:focus-visible { outline: 2px solid var(--emh-on-primary); outline-offset: 2px; }
            .emh-javgg-controls {
                margin-top: 6px; display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center;
                margin-left: 10px; vertical-align: middle; padding: 4px 6px;
                background-color: var(--emh-btn-bg); border-radius: var(--emh-radius-sm);
            }
            .emh-javgg-controls a {
                padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500;
                color: var(--emh-text-secondary); text-decoration: none;
                transition: background 0.15s, color 0.15s;
            }
            .emh-javgg-controls a:hover { background: var(--emh-primary-soft); color: var(--emh-primary); }
            .btn {
                appearance: none; -webkit-appearance: none;
                display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                padding: 8px 14px; border-radius: 9px;
                text-decoration: none; font-size: 13px; font-weight: 600;
                transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out, transform 0.1s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
                cursor: pointer; border: 1px solid transparent; white-space: nowrap;
                line-height: 1.2; font-family: inherit; box-sizing: border-box;
                color: var(--emh-text);
            }
            .btn:active { transform: scale(0.92); }
            .btn:focus-visible { outline: 2px solid var(--emh-primary); outline-offset: 2px; }
            /* 图标按钮：默认仅图标，hover/焦点展开文字标签 */
            .btn.emh-expand { gap: 0; padding: 8px 10px; }
            .btn .emh-expand-label {
                display: inline-block; max-width: 0; overflow: hidden; white-space: nowrap;
                opacity: 0; vertical-align: middle;
                transition: max-width 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease, margin-left 0.22s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .btn.emh-expand:hover .emh-expand-label,
            .btn.emh-expand:focus-visible .emh-expand-label {
                max-width: 12em; opacity: 1; margin-left: 6px;
            }
            @media (prefers-reduced-motion: reduce) {
                .btn .emh-expand-label { transition: none !important; }
                .btn.emh-expand:hover .emh-expand-label,
                .btn.emh-expand:focus-visible .emh-expand-label { max-width: 12em; opacity: 1; margin-left: 6px; }
            }
            .my-btn-primary { background: var(--emh-primary-soft); color: var(--emh-primary); }
            .my-btn-primary:hover { background: var(--emh-primary); color: var(--emh-on-primary); box-shadow: 0 2px 8px var(--emh-primary-soft); }
            .my-btn-success { background: var(--emh-success-soft); color: var(--emh-success); }
            .my-btn-success:hover { background: var(--emh-success); color: var(--emh-on-solid); }
            .my-btn-danger { background: var(--emh-danger-soft); color: var(--emh-danger); }
            .my-btn-danger:hover { background: var(--emh-danger); color: var(--emh-on-solid); }
            .btn-outline { background: var(--emh-surface); color: var(--emh-text-secondary); border-color: var(--emh-border); }
            .btn-outline:hover { background: var(--emh-btn-hover); color: var(--emh-text); border-color: var(--emh-border-strong); }
            .emh-code-status-indicator {
                width: 16px; height: 16px; border-radius: 50%; cursor: pointer; margin-right: 8px;
                transition: transform 0.2s ease, box-shadow 0.2s ease; position: relative;
                border: 1px solid var(--emh-border);
                display: inline-block; vertical-align: middle;
            }
            .emh-code-status-indicator:hover { transform: scale(1.2); box-shadow: var(--emh-shadow-sm); }
            .emh-code-status-indicator[data-status="favorite"] { background-color: var(--emh-danger); }
            .emh-code-status-indicator[data-status="watched"] { background-color: var(--emh-success); }
            .emh-code-status-indicator[data-status="unmarked"] { background-color: var(--emh-text-muted); }
            #custom-toast-container { position: fixed; top: 70px; right: 20px; z-index: 10060; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; pointer-events: none; }
            .custom-toast {
                padding: 10px 16px; border-radius: 12px; color: var(--emh-on-solid);
                box-shadow: var(--emh-shadow-md); max-width: min(320px, calc(100vw - 40px));
                text-align: left; pointer-events: auto;
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 0; transform: translateX(120%);
                font-size: 13px; font-weight: 500; display: flex; align-items: center;
                line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .custom-toast.show { opacity: 1; transform: translateX(0); }
            .custom-toast.leaving { opacity: 0; transform: translateX(120%); }
            .custom-toast svg { margin-right: 8px; flex-shrink: 0; }
            .custom-toast-success { background: var(--emh-success); }
            .custom-toast-error { background: var(--emh-danger); }
            .custom-toast-info { background: var(--emh-primary); color: var(--emh-on-primary); }
            .custom-toast-warning { background: var(--emh-warning); color: var(--emh-on-solid); }
            @media (prefers-reduced-motion: reduce) {
                .emh-code-manager-toggle,
                .emh-code-manager-toggle:hover,
                .emh-code-manager-toggle:active,
                .btn,
                .btn:active,
                .emh-javgg-controls a,
                .emh-code-status-indicator,
                .custom-toast {
                    transition: none !important;
                    animation: none !important;
                    transform: none !important;
                }
                .custom-toast { opacity: 1; transform: none; }
                .custom-toast.show { opacity: 1; transform: none; }
                .custom-toast.leaving { opacity: 0; transform: none; }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // standalone 加载封面：document-start 起隐藏站点内容，面板就绪前显示"加载中"
    function injectStandaloneCover() {
        if (document.getElementById('emh-standalone-cover-style')) return;
        const st = document.createElement('style');
        st.id = 'emh-standalone-cover-style';
        st.textContent = `
            html { background: #08090a !important; }
            body { visibility: hidden !important; }
            #emh-standalone-loading {
                position: fixed; inset: 0; z-index: 2147483646;
                display: flex; align-items: center; justify-content: center; gap: 12px;
                background: #08090a; color: #9ca3af;
                font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .emh-loading-spinner {
                width: 16px; height: 16px; border-radius: 50%;
                border: 2px solid rgba(255,255,255,0.12); border-top-color: #5e6ad2;
                animation: emh-loading-spin 0.8s linear infinite;
            }
            @keyframes emh-loading-spin { to { transform: rotate(360deg); } }
        `;
        (document.head || document.documentElement).appendChild(st);
        const ov = document.createElement('div');
        ov.id = 'emh-standalone-loading';
        ov.innerHTML = '<span class="emh-loading-spinner"></span>正在加载番号库…';
        document.documentElement.appendChild(ov);
    }

    function removeStandaloneCover() {
        const st = document.getElementById('emh-standalone-cover-style');
        if (st) st.remove();
        const ov = document.getElementById('emh-standalone-loading');
        if (ov) ov.remove();
    }

    // standalone 独立页布局：全屏面板 + 左列表右详情双栏
    function injectStandaloneStyles() {
        if (document.getElementById('emh-standalone-style')) return;
        const style = document.createElement('style');
        style.id = 'emh-standalone-style';
        style.textContent = `
            html, body { margin: 0; height: 100%; background: var(--emh-bg); }
            #emh-code-manager-toggle, .emh-panel-backdrop { display: none !important; }
            #emh-code-manager-panel .emh-panel-resize { display: none !important; }
            #emh-code-manager-panel {
                position: fixed; inset: 0; width: auto; height: 100vh;
                border-radius: 0; border-left: none;
                padding-right: min(580px, 47vw);
                background: var(--emh-bg);
            }
            /* 顶栏协调：左右栏等高等同背景，消除玻璃毛玻璃割裂 */
            /* 注：以下 padding/font-size 与 createStyles 同优先级且晚注入，
               必须 !important 才能覆盖（与 background/backdrop 同理） */
            .emh-panel-header, .emh-detail-header {
                height: 52px; padding: 0 16px !important; box-sizing: border-box;
                background: var(--emh-bg) !important;
                border-bottom: 1px solid var(--emh-border) !important;
                -webkit-backdrop-filter: none !important;
                backdrop-filter: none !important;
            }
            .emh-panel-header h2 { font-size: 14px !important; }
            .emh-detail-code { font-size: 15px !important; }
            .emh-panel-header .emh-panel-close { display: none !important; }
            .emh-detail-backdrop { display: none !important; }
            /* 组件样式（CodeManagerPanel.createStyles）在 bootPanel 中晚于本样式注入，
               同优先级时后注入者胜出，故对冲突属性加 !important 保证双栏覆盖生效 */
            /* 右栏：与左栏同基底，hairline 边框 + 阴影作分隔 */
            .emh-detail-drawer {
                position: fixed !important; top: 0; right: 0; bottom: 0;
                width: min(580px, 47vw) !important;
                background: var(--emh-bg) !important;
                border-radius: 0 !important;
                border-left: 1px solid var(--emh-border) !important;
                box-shadow: -16px 0 40px rgba(0, 0, 0, 0.35) !important;
                animation: none !important;
            }
            /* 详情 Hero/卡片层次已迁移至 createStyles（.emh-detail-body.unified），
               standalone 仅保留双栏面板覆盖，不再重复定义 */
        `;
        (document.head || document.documentElement).appendChild(style);
    }
    function createFallbackToggle(clickHandler) {
        const existing = document.getElementById('emh-code-manager-toggle');
        if (existing) existing.remove();
        const btn = document.createElement('button');
        btn.id = 'emh-code-manager-toggle';
        btn.className = 'emh-code-manager-toggle';
        btn.innerHTML = ICONS.grid + '<span>番号库</span>';
        btn.title = '管理番号库';
        btn.addEventListener('click', clickHandler);
        document.body.appendChild(btn);
        return btn;
    }

    // ===== 面板工厂：依赖就绪后构建 Preact 组件 =====
    function buildPanel() {
        const { h, render, Fragment } = getGlobal('preact');
        const { useEffect, useRef, useReducer, useState, useCallback } = getGlobal('preactHooks');
        const html = getGlobal('htm').bind(h);

        // 注意：preact.umd.js 不导出 memo（核心包才有），用 Component.shouldComponentUpdate 实现浅比较 memo
        const Memorize = (Comp) => class extends getGlobal('preact').Component {
            shouldComponentUpdate(nextProps) {
                const cur = this.props;
                for (const k in nextProps) {
                    if (Object.prototype.hasOwnProperty.call(nextProps, k) && nextProps[k] !== cur[k]) return true;
                }
                return false;
            }
            render() { return h(Comp, this.props); }
        };

        // 通用按钮图标（VNode，可直接插值到 htm JSX）
        const ICON = {
            heart: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
            check: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
            checkCircle: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            trash: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
            restore: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
            edit: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
            search: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
            copy: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
            unfav: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            plus: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
            list: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
            import: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
            export: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
            checkSquare: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
            refresh: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
            x: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        };

        // 状态存储
        const PanelStore = {
            state: {
                visible: false,
                currentFilter: 'all',
                searchQuery: '',
                timeFilter: '',
                magnetFilter: '',
                selectedItems: [],
                multiSelectMode: false,
                confirm: null,
                prompt: null,
                detail: null,
                magnetSearch: null,
                batchProgress: null,
                toasts: [],
                selectedIndex: -1,
                helpOpen: false,
                menuOpen: false,
                lastSyncTimestamp: null,
                revision: 0
            },
            listeners: new Set(),
            set(patch) {
                this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
                this.notify();
            },
            get() { return this.state; },
            refresh() { this.set({}); },
            notify() { this.listeners.forEach(fn => fn()); },
            subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
        };

        const STATUS_TEXT = { favorite: '关注', watched: '已看', unmarked: '未标记' };

        const ICON_TOAST = {
            success: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
            error: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
            warning: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            info: html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
        };

        const EMPTY_ICONS = {
            library: html`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
            favorite: html`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
            watched: html`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            trash: html`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
            time: html`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
            has: html`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
            none: html`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
            search: html`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
        };

        // 监听外部 toast 事件，桥接到组件状态
        window.addEventListener('emh_toast', function handler(e) {
            const { message, type } = e.detail || {};
            if (!message) return;
            const id = Date.now() + Math.random().toString(36).slice(2, 7);
            const toasts = [...PanelStore.state.toasts, { id, message, type: type || 'info' }].slice(-5);
            PanelStore.set({ toasts });
            // 两阶段退场：先进入 leaving 过渡，再移除
            setTimeout(() => {
                PanelStore.set({ toasts: PanelStore.state.toasts.map(t => t.id === id ? { ...t, leaving: true } : t) });
            }, 3000);
            setTimeout(() => {
                PanelStore.set({ toasts: PanelStore.state.toasts.filter(t => t.id !== id) });
            }, 3300);
        });

        function ToastContainer() {
            const st = PanelStore.get();
            if (!st.toasts.length) return null;
            return html`
                <div id="custom-toast-container">
                    ${st.toasts.map(t => html`
                        <div key=${t.id} class="custom-toast custom-toast-${t.type} show ${t.leaving ? 'leaving' : ''}" role="status">
                            ${ICON_TOAST[t.type] || ICON_TOAST.info}
                            <span>${t.message}</span>
                        </div>
                    `)}
                </div>
            `;
        }

        function PromptModal({ promptState, onSubmit, onCancel }) {
            if (!promptState) return null;
            const inputRef = useRef(null);
            useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
            const submit = (e) => {
                e.preventDefault();
                onSubmit(inputRef.current ? inputRef.current.value : '');
            };
            return html`
                <div class="emh-panel-modal" style="display:flex;">
                    <div class="emh-panel-modal-content">
                        <h3>${promptState.title}</h3>
                        <form onSubmit=${submit}>
                            <input ref=${inputRef} class="emh-prompt-input" type="text"
                                   defaultValue=${promptState.initial || ''} placeholder=${promptState.placeholder || ''} />
                            <div class="emh-panel-modal-buttons">
                                <button type="submit" class="btn my-btn-primary emh-panel-modal-confirm">确定</button>
                                <button type="button" class="btn btn-outline emh-panel-modal-cancel" onClick=${onCancel}>取消</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        }

        function StatusTag({ status }) {
            return html`<span class="emh-status-tag ${status}">${STATUS_TEXT[status] || '未标记'}</span>`;
        }

        function MagnetListModal({ magnetSearch, onPick, onClose }) {
            if (!magnetSearch) return null;
            return html`
                <div class="emh-panel-modal" style="display:flex;">
                    <div class="emh-panel-modal-content emh-magnet-modal-content">
                        <h3><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> 磁力搜索结果：${magnetSearch.code}</h3>
                        ${magnetSearch.loading ? html`
                            <div class="emh-magnet-loading">加载中...</div>
                        ` : magnetSearch.error ? html`
                            <div class="emh-magnet-error">${magnetSearch.error}</div>
                        ` : magnetSearch.results.length ? html`
                            <ul class="emh-magnet-list">
                                ${magnetSearch.results.map(r => html`
                                    <li key=${r.href} class="emh-magnet-item" onClick=${() => onPick(magnetSearch.code, r.href)}>
                                        <span class="emh-magnet-item-title" title="${r.title}">${r.title}</span>
                                        ${r.size ? html`<span class="emh-magnet-item-size">${r.size}</span>` : ''}
                                    </li>
                                `)}
                            </ul>
                            <div class="emh-magnet-hint">点击条目获取磁力链接并保存</div>
                        ` : html`
                            <div class="emh-magnet-error">暂无结果</div>
                        `}
                        <div class="emh-panel-modal-buttons">
                            <button class="btn btn-outline emh-panel-modal-cancel" onClick=${onClose}>关闭</button>
                        </div>
                    </div>
                </div>
            `;
        }

        function BatchProgressModal({ progress }) {
            if (!progress || !progress.running) return null;
            const total = progress.total || 0;
            const done = progress.done || 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return html`
                <div class="emh-panel-modal" style="display:flex;">
                    <div class="emh-panel-modal-content emh-batch-modal-content">
                        <h3><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 批量获取磁力</h3>
                        <div class="emh-batch-progress">
                            <div class="emh-batch-progress-track">
                                <div class="emh-batch-progress-bar" style="width:${pct}%"></div>
                            </div>
                            <div class="emh-batch-progress-info">
                                <span class="emh-batch-progress-pct">${pct}%</span>
                                <span class="emh-batch-progress-text">${done}/${total}</span>
                            </div>
                        </div>
                        ${progress.current ? html`
                            <div class="emh-batch-current">正在处理：${progress.current}</div>
                        ` : ''}
                        ${progress.skipped || progress.failed ? html`
                            <div class="emh-batch-stats">
                                ${progress.skipped ? html`<span class="emh-batch-stat">跳过 ${progress.skipped}</span>` : ''}
                                ${progress.failed ? html`<span class="emh-batch-stat emh-batch-stat-fail">失败 ${progress.failed}</span>` : ''}
                            </div>
                        ` : ''}
                        <div class="emh-panel-modal-buttons">
                            <button class="btn btn-outline emh-panel-modal-cancel" disabled>处理中…</button>
                        </div>
                    </div>
                </div>
            `;
        }

        function HeaderMenu({ onClose, onClear, onOpenStandalone, stats }) {
            return html`
                <div class="emh-header-menu-backdrop" onClick=${onClose}></div>
                <div class="emh-header-menu">
                    <div class="emh-header-menu-title">预览缓存</div>
                    ${stats ? html`
                        <div class="emh-header-menu-stat">已缓存 ${stats.magnets} 条磁力 · ${stats.screenshots} 张截图 · ${UTILS.formatBytes(stats.bytes)}</div>
                    ` : ''}
                    ${onOpenStandalone ? html`
                        <button type="button" class="emh-header-menu-item emh-header-menu-item-plain" onClick=${onOpenStandalone}>在新标签页打开</button>
                    ` : ''}
                    <button type="button" class="emh-header-menu-item" onClick=${onClear}>清除全部预览缓存</button>
                </div>
            `;
        }

        function HelpModal({ onClose }) {
            const shortcuts = [
                ['↑ ↓ · Home · End', '在列表中选择番号'],
                ['Enter', '打开选中番号详情'],
                ['Esc', '关闭 / 逐层返回'],
                ['/', '聚焦搜索'],
                ['n', '新建番号'],
                ['Del', '移入回收站'],
                ['⌘C / Ctrl+C', '复制磁力'],
                ['r', '刷新预览（详情内）'],
                ['?', '本帮助']
            ];
            return html`
                <div class="emh-panel-modal" style="display:flex;" onClick=${onClose}>
                    <div class="emh-panel-modal-content emh-help-modal-content" onClick=${e => e.stopPropagation()}>
                        <h3><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="10" y1="12" x2="10.01" y2="12"/><line x1="14" y1="12" x2="14.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/><line x1="6" y1="16" x2="18" y2="16"/></svg> 键盘快捷键</h3>
                        <ul class="emh-help-list">
                            ${shortcuts.map(s => html`
                                <li key=${s[0]}><span class="emh-kbd-chip">${s[0]}</span><span class="emh-help-desc">${s[1]}</span></li>
                            `)}
                        </ul>
                        <div class="emh-panel-modal-buttons">
                            <button class="btn btn-outline emh-panel-modal-cancel" onClick=${onClose}>关闭</button>
                        </div>
                    </div>
                </div>
            `;
        }

        function ItemRow({ item, view, multi, selected, kbdSel, onToggle, onOpenDetail, onFav, onWatch, onUnfav, onDelete, onRestore, onPurge }) {
            return html`
                <div class="emh-item ${item.status} ${selected ? 'selected' : ''} ${kbdSel ? 'kbd-sel' : ''}" data-code="${item.code}"
                     aria-selected=${kbdSel || undefined}
                     onClick=${multi ? () => onToggle(item.code) : null}>
                    <label class="emh-checkbox-wrap" style=${multi ? '' : 'visibility:hidden;'}>
                        <input type="checkbox" checked=${selected}
                               onClick=${e => e.stopPropagation()}
                               onChange=${() => onToggle(item.code)} />
                    </label>
                    <div class="emh-col-code" onClick=${multi ? null : e => { e.stopPropagation(); onOpenDetail(item.code); }}
                         style=${multi ? '' : 'cursor:pointer;'} title="查看详情">
                        <div class="emh-item-code" title="${item.code}">${item.code}</div>
                        ${typeof item.remarks === 'string' && item.remarks ? html`<div class="emh-item-remarks" title="${item.remarks.length > 80 ? item.remarks.slice(0, 80) + '…' : item.remarks}">${item.remarks}</div>` : null}
                    </div>
                    <span class="emh-col-status"><${StatusTag} status=${item.status} /></span>
                    <span class="emh-col-actions">
                        ${!multi ? html`
                            <span class="emh-item-actions" role="group" aria-label="操作">
                                ${view === 'trash' ? html`
                                    <button class="emh-act-restore" title="恢复" onClick=${e => { e.stopPropagation(); onRestore(item.code); }} aria-label="恢复">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                                    </button>
                                    <button class="emh-act-purge" title="彻底删除" onClick=${e => { e.stopPropagation(); onPurge(item.code); }} aria-label="彻底删除">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                ` : item.status === 'watched' ? html`
                                    <button class="emh-act-delete" title="删除到回收站" onClick=${e => { e.stopPropagation(); onDelete(item.code); }} aria-label="删除到回收站">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                ` : item.status === 'favorite' ? html`
                                    <button class="emh-act-watched" title="标记已看" onClick=${e => { e.stopPropagation(); onWatch(item.code); }} aria-label="标记已看">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>
                                    <button class="emh-act-unfav" title="取消关注" onClick=${e => { e.stopPropagation(); onUnfav(item.code); }} aria-label="取消关注">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                                    </button>
                                ` : html`
                                    <button class="emh-act-favorite" title="标记关注" onClick=${e => { e.stopPropagation(); onFav(item.code); }} aria-label="标记关注">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                    </button>
                                    <button class="emh-act-watched" title="标记已看" onClick=${e => { e.stopPropagation(); onWatch(item.code); }} aria-label="标记已看">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>
                                `}
                            </span>
                        ` : null}
                    </span>
                </div>
            `;
        }

        // memo 化：仅当 item/selected/kbdSel/view/multi 或稳定回调变化时重建行
        const ItemRowMemo = Memorize(ItemRow);

        function ConfirmModal({ confirm, onConfirm, onCancel }) {
            if (!confirm) return null;
            const confirmBtnClass = confirm.danger === 'soft'
                ? 'btn btn-outline emh-panel-modal-confirm'
                : 'btn my-btn-danger emh-panel-modal-confirm';
            return html`
                <div class="emh-panel-modal" style="display:flex;">
                    <div class="emh-panel-modal-content">
                        <h3>${confirm.message}</h3>
                        <div class="emh-panel-modal-buttons">
                            <button class="${confirmBtnClass}" onClick=${onConfirm}>确定</button>
                            <button class="btn btn-outline emh-panel-modal-cancel" onClick=${onCancel}>取消</button>
                        </div>
                    </div>
                </div>
            `;
        }

        function DetailDrawer({ item, inTrash, onClose, onEdit, onEditTags, onEditMagnet, onEditMagnetItem, onRemoveMagnet, onCopyMagnet, onCopyMagnetItem, onPreviewMagnet, onPreviewMagnetAt, onSearchMagnet, onFav, onWatch, onUnfav, onDelete, onRestore, onPurge }) {
            const drawerBodyRef = useRef(null);
            // 宫格缩略图懒加载
            useEffect(() => {
                if (!drawerBodyRef.current) return;
                drawerBodyRef.current.querySelectorAll('.emh-preview-thumb[data-src]').forEach(el => LAZY.observe(el));
            });
            if (!item) return null;
            const created = item.createdDate ? new Date(item.createdDate).toLocaleString() : '';
            const modified = item.modifiedDate ? new Date(item.modifiedDate).toLocaleString() : '';
            const deleted = item.deleteDate ? new Date(item.deleteDate).toLocaleString() : '';
            const magnets = CODE_LIBRARY.normMagnets(item.magnet);
            const metaParts = [created ? `创建 ${created}` : '', modified ? `更新 ${modified}` : ''].filter(Boolean);
            const tagList = [];
            (function extract(input) {
                if (input == null) return;
                if (Array.isArray(input)) return input.forEach(extract);
                if (typeof input === 'string') { if (input.trim()) tagList.push(input.trim()); return; }
                if (typeof input === 'number') { tagList.push(String(input)); return; }
                if (typeof input === 'object' && input.value != null) extract(input.value);
            })(item.tags);

            // 详情层次统一（侧栏/新页签一致）：Hero 标题 → meta 行 → 信息/磁力卡片
            const metaLine = html`<div class="emh-detail-meta-line">${metaParts.join(' · ')}</div>`;
            const titleBlock = (item.title && typeof item.title === 'string' && item.title !== item.code) ? html`
                <div class="emh-detail-field emh-detail-hero">
                    <span class="emh-detail-label">标题</span>
                    <span class="emh-detail-value">${item.title}</span>
                </div>
            ` : null;
            const remarksBlock = html`
                <div class="emh-detail-field">
                    <span class="emh-detail-label">备注</span>
                    <span class="emh-detail-value ${item.remarks ? '' : 'emh-detail-empty'}">${typeof item.remarks === 'string' && item.remarks ? item.remarks : '暂无备注'}</span>
                </div>
            `;
            const tagsBlock = html`
                <div class="emh-detail-field">
                    <span class="emh-detail-label">标签</span>
                    <div class="emh-detail-tags">
                        ${tagList.length ? tagList.map(t => html`<span class="emh-detail-tag">#${t}</span>`) : html`<span class="emh-detail-value emh-detail-empty">暂无标签</span>`}
                        ${!inTrash ? html`
                            <button class="emh-magnet-op emh-tag-edit" title="编辑标签" aria-label="编辑标签" onClick=${() => onEditTags(item.code)}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            const infoBlock = html`${remarksBlock}${tagsBlock}`;
            const magnetBlock = html`
                <div class="emh-detail-field">
                    <span class="emh-detail-label">磁力链接 ${magnets.length ? `(${magnets.length})` : ''}</span>
                    ${magnets.length ? html`
                        <ul class="emh-magnet-list">
                            ${magnets.map((m, idx) => {
                                const mid = CODE_LIBRARY.magnetId(m) || ('idx-' + idx);
                                const mvalue = CODE_LIBRARY.magnetValue(m);
                                const displayM = CODE_LIBRARY.magnetName(m);
                                const pv = CODE_LIBRARY.sanitizeMagnetPreview(m.preview);
                                const hasCache = !!(pv && Array.isArray(pv.screenshots) && pv.screenshots.length);
                                const shotCount = hasCache ? pv.screenshots.length : 0;
                                return html`
                                    <li key=${mid} class="emh-magnet-item-static" title="${mvalue}">
                                        <span class="emh-magnet-item-idx">#${idx + 1}</span>
                                        <span class="emh-magnet-item-text">${displayM.length > 60 ? displayM.slice(0, 60) + '…' : displayM}</span>
                                        <span class="emh-magnet-item-ops">
                                            <button class="emh-magnet-op emh-magnet-op-preview ${hasCache ? 'has-cache' : ''}"
                                                title=${hasCache ? `预览截图（已缓存 ${shotCount} 张，右键强制刷新）` : '预览截图'}
                                                onClick=${(e) => onPreviewMagnet(item.code, mid, { force: !!(e && e.shiftKey) })}
                                                onContextMenu=${(e) => { e.preventDefault(); onPreviewMagnet(item.code, mid, { force: true }); }}>
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${hasCache ? html`<span class="emh-magnet-preview-badge">${shotCount}</span>` : ''}
                                            </button>
                                            <button class="emh-magnet-op" title="复制该磁力" onClick=${() => onCopyMagnetItem(item.code, mid)}>
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                            </button>
                                            ${!inTrash ? html`
                                                <button class="emh-magnet-op" title="修改该磁力" onClick=${() => onEditMagnetItem(item.code, mid)}>
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                                </button>
                                                <button class="emh-magnet-op emh-magnet-op-del" title="删除该磁力" onClick=${() => onRemoveMagnet(item.code, mid)}>
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                </button>
                                            ` : null}
                                        </span>
                                        ${hasCache ? html`
                                            <div class="emh-preview-grid">
                                                ${pv.screenshots.slice(0, 24).map((s, si) => html`
                                                    <button type="button" class="emh-preview-cell" data-idx=${si}
                                                        title=${(s.time != null ? '跳转到 ' + UTILS.formatTime(s.time) + ' 的截图' : '查看截图')}
                                                        onClick=${() => onPreviewMagnetAt(item.code, mid, si)}>
                                                        <span class="emh-preview-thumb" data-src="${s.screenshot}"></span>
                                                        ${s.time != null ? html`<span class="emh-preview-time">${UTILS.formatTime(s.time)}</span>` : ''}
                                                    </button>
                                                `)}
                                            </div>
                                        ` : ''}
                                    </li>
                                `;
                            })}
                        </ul>
                        <span class="emh-magnet-actions">
                            <button class="btn btn-outline emh-magnet-btn emh-expand" aria-label="复制全部" onClick=${() => onCopyMagnet(item.code)}>${ICON.copy}<span class="emh-expand-label">复制全部</span></button>
                            ${!inTrash ? html`
                                <button class="btn btn-outline emh-magnet-btn emh-expand" aria-label="搜索" onClick=${() => onSearchMagnet(item.code)}>${ICON.search}<span class="emh-expand-label">搜索</span></button>
                            ` : null}
                        </span>
                    ` : html`
                        <span class="emh-detail-value emh-detail-empty">暂无磁力链接</span>
                        ${!inTrash ? html`
                            <span class="emh-magnet-actions">
                                <button class="btn btn-outline emh-magnet-btn emh-expand" aria-label="搜索磁力" onClick=${() => onSearchMagnet(item.code)}>${ICON.search}<span class="emh-expand-label">搜索磁力</span></button>
                                <button class="btn btn-outline emh-magnet-btn emh-expand" aria-label="手动添加" onClick=${() => onEditMagnet(item.code)}>${ICON.edit}<span class="emh-expand-label">手动添加</span></button>
                            </span>
                        ` : null}
                    `}
                </div>
            `;
            const deletedBlock = deleted ? html`
                <div class="emh-detail-field">
                    <span class="emh-detail-label">删除时间</span>
                    <span class="emh-detail-value">${deleted}</span>
                </div>
            ` : null;
            return html`
                <div class="emh-detail-backdrop" onClick=${onClose}></div>
                <div class="emh-detail-drawer">
                    <div class="emh-detail-header">
                        <div class="emh-detail-title">
                            <span class="emh-detail-code" title="${item.code}">${item.code}</span>
                            <${StatusTag} status=${item.status} />
                        </div>
                        <button class="emh-panel-close" title="关闭 (Esc)" onClick=${onClose}>×</button>
                    </div>
                    <div class="emh-detail-body unified" ref=${drawerBodyRef}>
                        ${titleBlock}
                        ${metaParts.length ? metaLine : ''}
                        <div class="emh-detail-section">${infoBlock}</div>
                        <div class="emh-detail-section">${magnetBlock}</div>
                        ${deletedBlock}
                    </div>
                    <div class="emh-detail-actions">
                        ${!inTrash ? html`
                            <button class="btn btn-outline emh-expand" aria-label="编辑备注" onClick=${() => onEdit(item.code)}>${ICON.edit}<span class="emh-expand-label">编辑备注</span></button>
                        ` : null}
                        ${inTrash ? html`
                            <button class="btn btn-outline emh-expand" aria-label="恢复" onClick=${() => onRestore(item.code)}>${ICON.restore}<span class="emh-expand-label">恢复</span></button>
                            <button class="btn my-btn-danger emh-expand" aria-label="彻底删除" onClick=${() => onPurge(item.code)}>${ICON.trash}<span class="emh-expand-label">彻底删除</span></button>
                        ` : item.status === 'unmarked' ? html`
                            <button class="btn btn-outline emh-expand" aria-label="关注" onClick=${() => onFav(item.code)}>${ICON.heart}<span class="emh-expand-label">关注</span></button>
                            <button class="btn btn-outline emh-expand" aria-label="标记已看" onClick=${() => onWatch(item.code)}>${ICON.checkCircle}<span class="emh-expand-label">标记已看</span></button>
                        ` : item.status === 'favorite' ? html`
                            <button class="btn btn-outline emh-expand" aria-label="标记已看" onClick=${() => onWatch(item.code)}>${ICON.checkCircle}<span class="emh-expand-label">标记已看</span></button>
                            <button class="btn btn-outline emh-expand" aria-label="取消关注" onClick=${() => onUnfav(item.code)}>${ICON.unfav}<span class="emh-expand-label">取消关注</span></button>
                        ` : html`
                            <button class="btn my-btn-danger emh-expand" aria-label="删除到回收站" onClick=${() => onDelete(item.code)}>${ICON.trash}<span class="emh-expand-label">删除到回收站</span></button>
                        `}
                    </div>
                    ${!inTrash && item.status !== 'watched' ? html`
                        <div class="emh-detail-danger">
                            <button class="btn btn-outline" onClick=${() => onDelete(item.code)}>${ICON.trash} 删除到回收站</button>
                        </div>
                    ` : null}
                </div>
            `;
        }

        function CodeManagerApp() {
            const [, forceUpdate] = useReducer(x => x + 1, 0);
            const headRef = useRef(null);
            const searchRef = useRef(null);
            const contentRef = useRef(null);
            const resizeRef = useRef(null);
            const actionsRef = useRef(null);
            const debounceRef = useRef(null);
            const [searchDraft, setSearchDraft] = useState('');

            // 搜索防抖：200ms 后才写 store，避免逐字符全量重渲染
            const onSearchInput = (e) => {
                const v = e.target.value;
                setSearchDraft(v);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => {
                    debounceRef.current = null;
                    PanelStore.set({ searchQuery: v });
                }, 200);
            };
            const clearSearch = () => {
                if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
                setSearchDraft('');
                PanelStore.set({ searchQuery: '' });
                if (searchRef.current) searchRef.current.focus();
            };
            useEffect(() => {
                return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
            }, []);

            useEffect(() => {
                const unsub = PanelStore.subscribe(() => forceUpdate());
                return unsub;
            }, []);

            const st = PanelStore.get();

            // store 的 searchQuery 外部变化（清空/同步）时回写草稿
            useEffect(() => {
                setSearchDraft(st.searchQuery);
            }, [st.searchQuery]);

            const actions = {
                hidePanel: () => PanelStore.set({ visible: false, multiSelectMode: false, selectedItems: [], helpOpen: false, menuOpen: false }),
                setFilter: (f) => PanelStore.set({ currentFilter: f, timeFilter: f === 'all' ? st.timeFilter : '', multiSelectMode: false, selectedItems: [], selectedIndex: -1 }),
                toggleMulti: () => PanelStore.set({ multiSelectMode: !st.multiSelectMode, selectedItems: [], selectedIndex: -1 }),
                toggleItem: (code) => {
                    const sel = st.selectedItems.includes(code)
                        ? st.selectedItems.filter(c => c !== code)
                        : [...st.selectedItems, code];
                    PanelStore.set({ selectedItems: sel });
                },
                selectAll: () => {
                    if (st.selectedItems.length === items.length) PanelStore.set({ selectedItems: [] });
                    else PanelStore.set({ selectedItems: items.map(i => i.code) });
                },
                markFav: (code) => { CODE_LIBRARY.markItem(code, 'favorite'); UTILS.showToast(`番号 ${code} 已标记为关注`, 'success'); },
                markWatched: (code) => { CODE_LIBRARY.markItem(code, 'watched'); UTILS.showToast(`番号 ${code} 已标记为已看`, 'success'); },
                unfavorite: (code) => { CODE_LIBRARY.markItem(code, 'unmarked'); UTILS.showToast(`番号 ${code} 已取消关注`, 'success'); },
                editRemark: (code) => {
                    const cur = CODE_LIBRARY.getItem(code);
                    if (!cur) { UTILS.showToast('回收站条目请先恢复再编辑', 'warning'); return; }
                    PanelStore.set({ prompt: {
                        title: `编辑备注 (${code})`,
                        initial: (cur.remarks || cur.remark) || '',
                        placeholder: '输入备注内容',
                        onSubmit: (remark) => {
                            if (remark !== null) {
                                CODE_LIBRARY.markItem(code, cur.status || 'unmarked', undefined, remark);
                                UTILS.showToast('备注已更新', 'success');
                            }
                        }
                    } });
                },
                editTags: (code) => {
                    const cur = CODE_LIBRARY.getItem(code);
                    if (!cur) { UTILS.showToast('回收站条目请先恢复再编辑标签', 'warning'); return; }
                    const list = [];
                    (function extract(input) {
                        if (input == null) return;
                        if (Array.isArray(input)) return input.forEach(extract);
                        if (typeof input === 'string') { if (input.trim()) list.push(input.trim()); return; }
                        if (typeof input === 'number') { list.push(String(input)); return; }
                        if (typeof input === 'object' && input.value != null) extract(input.value);
                    })(cur.tags);
                    PanelStore.set({ prompt: {
                        title: `编辑标签 (${code})`,
                        initial: list.join(', '),
                        placeholder: '多个标签用逗号分隔',
                        onSubmit: (val) => {
                            if (val !== null) {
                                const arr = String(val).split(/[,，、]/).map(s => s.trim()).filter(Boolean);
                                CODE_LIBRARY.setTags(code, arr);
                                UTILS.showToast('标签已更新', 'success');
                            }
                        }
                    } });
                },
                editMagnet: (code) => {
                    const cur = CODE_LIBRARY.getItem(code);
                    if (!cur) { UTILS.showToast('回收站条目请先恢复再编辑', 'warning'); return; }
                    const curMag = CODE_LIBRARY.normMagnets(cur.magnet);
                    PanelStore.set({ prompt: {
                        title: `编辑磁力链接 (${code})`,
                        initial: curMag.map(e => CODE_LIBRARY.magnetValue(e)).join('\n'),
                        placeholder: '每行一个磁力链接，可多行',
                        onSubmit: (magnet) => {
                            if (magnet !== null) {
                                const arr = CODE_LIBRARY.normMagnets(String(magnet).split('\n'));
                                CODE_LIBRARY.markItem(code, cur.status || 'unmarked', undefined, undefined, arr);
                                UTILS.showToast('磁力链接已保存', 'success');
                            }
                        }
                    } });
                },
                editMagnetItem: (code, idOrIdx) => {
                    const cur = CODE_LIBRARY.getItem(code);
                    if (!cur) { UTILS.showToast('回收站条目请先恢复再编辑', 'warning'); return; }
                    const arr = CODE_LIBRARY.normMagnets(cur.magnet);
                    // 按 id 定位；若无 id（旧数据）回退按索引
                    const findIdx = (target) => {
                        const t = String(target);
                        return arr.findIndex(e => {
                            const eid = CODE_LIBRARY.magnetId(e);
                            return (eid && String(eid) === t) || (!eid && (typeof target === 'number' ? true : false));
                        });
                    };
                    const idx = findIdx(idOrIdx);
                    if (idx === -1 || !arr[idx]) return;
                    const target = arr[idx];
                    PanelStore.set({ prompt: {
                        title: `修改磁力 #${idx + 1} (${code})`,
                        initial: CODE_LIBRARY.magnetValue(target),
                        placeholder: '粘贴新磁力链接',
                        onSubmit: (magnet) => {
                            if (magnet !== null && magnet.trim()) {
                                const nextVal = magnet.trim();
                                const newArr = arr.map((e, i) => {
                                    if (i !== idx) return e;
                                    const next = { id: e.id, value: nextVal };
                                    // 磁力变更后清除旧预览缓存
                                    return next;
                                });
                                CODE_LIBRARY.markItem(code, cur.status || 'unmarked', undefined, undefined, newArr);
                                UTILS.showToast('磁力已修改', 'success');
                            }
                        }
                    } });
                },
                removeMagnet: (code, idOrIdx) => {
                    const cur = CODE_LIBRARY.getItem(code);
                    if (!cur) { UTILS.showToast('回收站条目请先恢复再编辑', 'warning'); return; }
                    const arr = CODE_LIBRARY.normMagnets(cur.magnet);
                    const t = String(idOrIdx);
                    const idx = arr.findIndex(e => {
                        const eid = CODE_LIBRARY.magnetId(e);
                        return (eid && String(eid) === t) || (!eid && typeof idOrIdx === 'number' && arr.indexOf(e) === idOrIdx);
                    });
                    if (idx === -1 || !arr[idx]) return;
                    PanelStore.set({ confirm: { message: `确定删除磁力 #${idx + 1} 吗？`, danger: 'soft', onConfirm: () => {
                        const newArr = arr.filter((_, i) => i !== idx);
                        CODE_LIBRARY.markItem(code, cur.status || 'unmarked', undefined, undefined, newArr);
                        UTILS.showToast('磁力已删除', 'success');
                    } } });
                },
                searchMagnet: (code) => {
                    // 从 1cili 拉取磁力搜索结果列表；回收站条目禁止写入
                    if (!CODE_LIBRARY.getItem(code)) { UTILS.showToast('回收站条目请先恢复再搜索磁力', 'warning'); return; }
                    PanelStore.set({ magnetSearch: { code, loading: true, results: [], error: '' } });
                    const url = `https://1cili.com/search?q=${encodeURIComponent(code)}`;
                    const done = (results, error) => {
                        if (error) PanelStore.set({ magnetSearch: { code, loading: false, results: [], error } });
                        else PanelStore.set({ magnetSearch: { code, loading: false, results, error: '' } });
                    };
                    const onload = (resp) => {
                        try {
                            const htmlText = resp.responseText || '';
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(htmlText, 'text/html');
                            const rows = [];
                            doc.querySelectorAll('table.file-list tbody tr').forEach(tr => {
                                const a = tr.querySelector('td a[href^="/!"]');
                                if (!a) return;
                                const title = (a.textContent || '').trim().replace(/\s+/g, ' ');
                                const sizeEl = tr.querySelector('.td-size');
                                const size = sizeEl ? sizeEl.textContent.trim() : '';
                                rows.push({ title, size, href: a.getAttribute('href') });
                            });
                            done(rows, rows.length ? '' : '未找到相关磁力资源');
                        } catch (e) { done([], '解析搜索结果失败'); }
                    };
                    if (typeof GM_xmlhttpRequest !== 'undefined') {
                        GM_xmlhttpRequest({ method: 'GET', url, onload, onerror: (e) => done([], '网络请求失败'), timeout: 15000, ontimeout: () => done([], '请求超时') });
                    } else {
                        fetch(url).then(r => r.text()).then(t => onload({ responseText: t })).catch(() => done([], '网络请求失败'));
                    }
                },
                fetchMagnetDetail: (code, href) => {
                    const base = 'https://1cili.com';
                    const url = base + href;
                    const onload = (resp) => {
                        try {
                            const htmlText = resp.responseText || '';
                            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                            const input = doc.querySelector('#input-magnet');
                            const magnet = input ? (input.value || '').trim() : '';
                            if (magnet) {
                                const cur = CODE_LIBRARY.getItem(code);
                                // 回收站条目禁止 markItem，避免静默重建主库条目
                                if (!cur) { UTILS.showToast('回收站条目请先恢复再添加磁力', 'warning'); return; }
                                // 提取影片信息（标题）填入备注
                                let remark = (cur.remarks || cur.remark) || '';
                                const infoDd = Array.prototype.slice.call(doc.querySelectorAll('.torrent-info dt') || [])
                                    .find(dt => (dt.textContent || '').includes('影片信息'));
                                const titleText = infoDd && infoDd.nextElementSibling
                                    ? (infoDd.nextElementSibling.textContent || '').replace(/\s+/g, ' ').trim()
                                    : '';
                                if (titleText && !remark) {
                                    remark = titleText;
                                } else if (titleText && !remark.includes(titleText)) {
                                    remark = remark ? `${remark} | ${titleText}` : titleText;
                                }
                                // 追加到现有磁力数组（去重），不覆盖已有磁力
                                const existingMagnets = CODE_LIBRARY.normMagnets(cur && cur.magnet);
                                const existingVals = existingMagnets.map(e => CODE_LIBRARY.magnetValue(e));
                                if (existingVals.includes(magnet)) {
                                    UTILS.showToast('该磁力已存在', 'info');
                                } else {
                                    const newArr = [...existingMagnets, magnet]; // normMagnets 在 markItem 内统一转对象数组
                                    CODE_LIBRARY.markItem(code, cur.status || 'unmarked', undefined, remark, newArr);
                                    UTILS.showToast('磁力链接已添加' + (titleText ? '，并填入影片信息' : ''), 'success');
                                }
                                PanelStore.set({ magnetSearch: null });
                            } else {
                                UTILS.showToast('详情页未找到磁力链接', 'error');
                            }
                        } catch (e) { UTILS.showToast('解析详情失败', 'error'); }
                    };
                    if (typeof GM_xmlhttpRequest !== 'undefined') {
                        GM_xmlhttpRequest({ method: 'GET', url, onload, onerror: () => UTILS.showToast('请求失败', 'error'), timeout: 15000, ontimeout: () => UTILS.showToast('请求超时', 'error') });
                    } else {
                        fetch(url).then(r => r.text()).then(t => onload({ responseText: t })).catch(() => UTILS.showToast('请求失败', 'error'));
                    }
                },
                closeMagnetSearch: () => PanelStore.set({ magnetSearch: null }),
                batchFetchMagnets: () => {
                    // 深拷贝选中番号，避免处理过程中 selectedItems 变化导致循环无限追加
                    const codes = (st.selectedItems || []).slice();
                    const totalCount = codes.length;
                    if (!totalCount) { UTILS.showToast('请先勾选番号', 'warning'); return; }
                    // 立即清空选中项（副本已捕获），防止处理中任何追加/重渲染干扰循环
                    PanelStore.set({ multiSelectMode: false, selectedItems: [] });
                    // 初始化进度
                    PanelStore.set({ batchProgress: { running: true, total: totalCount, done: 0, skipped: 0, failed: 0, current: '' } });
                    // 串行处理，避免并发请求过多
                    (async () => {
                        const doGet = (url) => new Promise((resolve) => {
                            const cb = (resp) => resolve(resp.responseText || '');
                            if (typeof GM_xmlhttpRequest !== 'undefined') {
                                GM_xmlhttpRequest({ method: 'GET', url, onload: cb, onerror: () => resolve(''), timeout: 15000, ontimeout: () => resolve('') });
                            } else {
                                fetch(url).then(r => r.text()).then(cb).catch(() => resolve(''));
                            }
                        });
                        const extractMagnetFromDetail = (htmlText) => {
                            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                            const input = doc.querySelector('#input-magnet');
                            // 用 .value 而非 getAttribute('value')，HTML 实体（&amp;）会正确解码为 &
                            return input ? (input.value || '').trim() : '';
                        };
                        const extractTitleFromDetail = (htmlText) => {
                            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
                            const infoDd = Array.prototype.slice.call(doc.querySelectorAll('.torrent-info dt') || [])
                                .find(dt => (dt.textContent || '').includes('影片信息'));
                            return infoDd && infoDd.nextElementSibling
                                ? (infoDd.nextElementSibling.textContent || '').replace(/\s+/g, ' ').trim()
                                : '';
                        };
                        const isVariantMatch = (title, code) => {
                            // 匹配 番号 的 C/UC/CH 变体（如 番号-C、番号_C、764ch、_HD_CH、-UC 等）
                            if (!title) return false;
                            const t = String(title).toUpperCase().replace(/\s+/g, '');
                            const c = String(code).toUpperCase().replace(/\s+/g, '');
                            if (!t.startsWith(c)) return false;
                            const rest = t.slice(c.length);
                            if (!rest) return false;
                            // 变体 C/UC/CH 前允许 - _ . 分隔，后跟非字母数字或结束
                            return /[-_.]?(C|UC|CH)([^A-Z0-9]|$)/.test(rest);
                        };
                        let okCount = 0;
                        let skipCount = 0;
                        let failCount = 0;
                        const upd = (partial) => PanelStore.set({ batchProgress: { ...PanelStore.state.batchProgress, ...partial } });
                        for (let i = 0; i < codes.length; i++) {
                            const code = codes[i];
                            upd({ current: code });
                            // 已有磁力的番号直接跳过，避免重复获取/覆盖
                            const existing = CODE_LIBRARY.getItem(code);
                            if (existing && CODE_LIBRARY.normMagnets(existing.magnet).length) {
                                skipCount++;
                                upd({ done: i + 1, skipped: skipCount });
                                continue;
                            }
                            const searchHtml = await doGet(`https://1cili.com/search?q=${encodeURIComponent(code)}`);
                            if (!searchHtml) { failCount++; upd({ done: i + 1, failed: failCount }); continue; }
                            const doc = new DOMParser().parseFromString(searchHtml, 'text/html');
                            const rows = [];
                            doc.querySelectorAll('table.file-list tbody tr').forEach(tr => {
                                const a = tr.querySelector('td a[href^="/!"]');
                                if (a && a.getAttribute('href')) {
                                    rows.push({ href: a.getAttribute('href'), title: (a.textContent || '').trim().replace(/\s+/g, ' ') });
                                }
                            });
                            const filteredRows = rows.filter(r => isVariantMatch(r.title, code));
                            if (!filteredRows.length) { failCount++; upd({ done: i + 1, failed: failCount }); continue; }
                            const magnets = [];
                            let firstTitle = '';
                            for (const row of filteredRows) {
                                const detailHtml = await doGet('https://1cili.com' + row.href);
                                if (!detailHtml) continue;
                                const m = extractMagnetFromDetail(detailHtml);
                                if (m && !magnets.includes(m)) {
                                    magnets.push(m);
                                    if (!firstTitle) firstTitle = extractTitleFromDetail(detailHtml);
                                }
                            }
                            if (!magnets.length) { failCount++; upd({ done: i + 1, failed: failCount }); continue; }
                            const cur = CODE_LIBRARY.getItem(code);
                            const remark = firstTitle || (cur && (cur.remarks || cur.remark)) || '';
                            CODE_LIBRARY.markItem(code, (cur && cur.status) || 'unmarked', undefined, remark, magnets);
                            okCount++;
                            upd({ done: i + 1 });
                        }
                        PanelStore.set({ multiSelectMode: false, selectedItems: [] });
                        const processed = codes.length - skipCount;
                        PanelStore.set({ batchProgress: null });
                        UTILS.showToast(`批量完成：${okCount}/${processed} 个番号${skipCount ? `，${skipCount} 个已有磁力已跳过` : ''}${failCount ? `，${failCount} 个失败` : ''}`, okCount === processed ? 'success' : 'warning');
                    })();
                },
                resolveItem: (code) => CODE_LIBRARY.getItem(code) || CODE_LIBRARY.trash.items.find(i => i.code.toUpperCase() === String(code).toUpperCase()) || null,
                previewMagnet: (code, idOrIdx, opts) => {
                    const item = actions.resolveItem(code);
                    if (!item) { UTILS.showToast('未找到该番号', 'warning'); return; }
                    const magnets = CODE_LIBRARY.normMagnets(item.magnet);
                    const t = String(idOrIdx);
                    let idx = magnets.findIndex((e, i) => {
                        const eid = CODE_LIBRARY.magnetId(e);
                        return (eid && String(eid) === t) || String(i) === t;
                    });
                    if (idx < 0 && /^\d+$/.test(t)) idx = Number(t);
                    if (idx < 0 || idx >= magnets.length) { UTILS.showToast('磁力不存在', 'warning'); return; }
                    const entry = magnets[idx];
                    const mid = CODE_LIBRARY.magnetId(entry) || String(idx);
                    const mval = CODE_LIBRARY.magnetValue(entry);
                    MAGNET_PREVIEW.fetchAndCache(code, mid, mval, opts || {});
                },
                previewMagnetAt: (code, idOrIdx, shotIdx) => {
                    // 宫格点击：直接打开已缓存截图的灯箱（指定起始索引），不触发新请求
                    const item = actions.resolveItem(code);
                    if (!item) return;
                    const magnets = CODE_LIBRARY.normMagnets(item.magnet);
                    const t = String(idOrIdx);
                    let idx = magnets.findIndex((e, i) => {
                        const eid = CODE_LIBRARY.magnetId(e);
                        return (eid && String(eid) === t) || String(i) === t;
                    });
                    if (idx < 0 && /^\d+$/.test(t)) idx = Number(t);
                    if (idx < 0 || idx >= magnets.length) return;
                    const pv = CODE_LIBRARY.sanitizeMagnetPreview(magnets[idx].preview);
                    if (!pv || !Array.isArray(pv.screenshots) || !pv.screenshots.length) return;
                    const urls = pv.screenshots.map(s => s.screenshot || s.url || '').filter(Boolean);
                    const meta = [pv.name, pv.fileType || pv.type, UTILS.formatBytes(pv.size)].filter(Boolean).join(' · ');
                    MAGNET_PREVIEW.open(urls, Number.isFinite(Number(shotIdx)) ? Number(shotIdx) : 0, meta);
                },
                copyMagnetItem: (code, idOrIdx) => {
                    const item = actions.resolveItem(code);
                    const magnets = CODE_LIBRARY.normMagnets(item && item.magnet);
                    const t = String(idOrIdx);
                    const entry = magnets.find(e => {
                        const eid = CODE_LIBRARY.magnetId(e);
                        return (eid && String(eid) === t) || (!eid && typeof idOrIdx === 'number' && magnets.indexOf(e) === idOrIdx);
                    }) || magnets[Number(idOrIdx)];
                    if (!entry) { UTILS.showToast('磁力不存在', 'warning'); return; }
                    const mval = CODE_LIBRARY.magnetValue(entry);
                    const text = CODE_LIBRARY.cleanMagnet(entry) || mval;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(() => UTILS.showToast('磁力已复制', 'success')).catch(() => UTILS.showToast('复制失败', 'error'));
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = text; document.body.appendChild(ta); ta.select();
                        try { document.execCommand('copy'); UTILS.showToast('磁力已复制', 'success'); }
                        catch (e) { UTILS.showToast('复制失败', 'error'); }
                        document.body.removeChild(ta);
                    }
                },
                copyMagnet: (code) => {
                    const item = actions.resolveItem(code);
                    const magnets = CODE_LIBRARY.normMagnets(item && item.magnet);
                    if (!magnets.length) { UTILS.showToast('该番号暂无磁力链接', 'warning'); return; }
                    const text = magnets.map(e => CODE_LIBRARY.magnetValue(e)).join('\n');
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(() => UTILS.showToast(`已复制 ${magnets.length} 条磁力`, 'success')).catch(() => UTILS.showToast('复制失败', 'error'));
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = text; document.body.appendChild(ta); ta.select();
                        try { document.execCommand('copy'); UTILS.showToast(`已复制 ${magnets.length} 条磁力`, 'success'); }
                        catch (e) { UTILS.showToast('复制失败', 'error'); }
                        document.body.removeChild(ta);
                    }
                },
                deleteToTrash: (code) => PanelStore.set({ confirm: { message: '将从列表移除，可在回收站恢复', danger: 'soft', onConfirm: () => { CODE_LIBRARY.delete(code); if (st.detail === code) PanelStore.set({ detail: null }); UTILS.showToast(`番号 ${code} 已移至回收站`, 'success'); } } }),
                restoreFromTrash: (code) => {
                    const trashItems = CODE_LIBRARY.trash.items;
                    const idx = trashItems.findIndex(i => i.code.toUpperCase() === code.toUpperCase());
                    if (idx === -1) { UTILS.showToast('未找到该记录', 'error'); return; }
                    if (CODE_LIBRARY.getItem(code)) { UTILS.showToast('番号库中已存在该番号', 'warning'); return; }
                    const item = trashItems.splice(idx, 1)[0];
                    delete item.deleteDate;
                    CODE_LIBRARY.data.items.unshift(item);
                    CODE_LIBRARY.save();
                    if (st.detail === code) PanelStore.set({ detail: null });
                    UTILS.showToast(`番号 ${code} 已恢复`, 'success');
                },
                permanentDelete: (code) => PanelStore.set({ confirm: { message: `将永久删除 ${code}，无法恢复`, danger: 'hard', onConfirm: () => {
                    CODE_LIBRARY.trash.items = CODE_LIBRARY.trash.items.filter(i => i.code.toUpperCase() !== code.toUpperCase());
                    CODE_LIBRARY.save();
                    if (st.detail === code) PanelStore.set({ detail: null });
                    UTILS.showToast(`番号 ${code} 已永久删除`, 'success');
                } } }),
                addCode: () => {
                    PanelStore.set({ prompt: {
                        title: '添加番号',
                        initial: '',
                        placeholder: '输入番号，如 ABC-123',
                        onSubmit: (code) => {
                            if (code && code.trim()) { CODE_LIBRARY.add(code.trim()); UTILS.showToast(`番号 ${code.trim()} 已添加`, 'success'); }
                        }
                    } });
                },
                exportData: () => {
                    const data = CODE_LIBRARY.exportData(st.currentFilter);
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'emh_code_library.json'; a.click();
                    URL.revokeObjectURL(url);
                    UTILS.showToast('数据导出成功', 'success');
                },
                importData: () => {
                    const input = document.createElement('input');
                    input.type = 'file'; input.accept = '.json';
                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                try {
                                    CODE_LIBRARY.importData(JSON.parse(e.target.result));
                                    UTILS.showToast('数据导入成功', 'success');
                                } catch (err) { UTILS.showToast('数据导入失败', 'error'); }
                            };
                            reader.readAsText(file);
                        }
                    };
                    input.click();
                },
                batchMark: (status) => {
                    const count = st.selectedItems.length;
                    st.selectedItems.forEach(code => CODE_LIBRARY.markItem(code, status));
                    PanelStore.set({ multiSelectMode: false, selectedItems: [] });
                    UTILS.showToast(`已批量标记 ${count} 个番号`, 'success');
                },
                batchDelete: () => PanelStore.set({ confirm: { message: `将从列表移除选中的 ${st.selectedItems.length} 项，可在回收站恢复`, danger: 'soft', onConfirm: () => { const count = st.selectedItems.length; st.selectedItems.forEach(code => CODE_LIBRARY.delete(code)); PanelStore.set({ multiSelectMode: false, selectedItems: [] }); UTILS.showToast(`已将 ${count} 个番号移至回收站`, 'success'); } } }),
                clearTrash: () => {
                    if (!CODE_LIBRARY.trash.items.length) { UTILS.showToast('回收站已经是空的', 'info'); return; }
                    PanelStore.set({ confirm: { message: '确定要清空回收站吗？此操作不可撤销！', danger: 'hard', onConfirm: () => { CODE_LIBRARY.trash.items = []; CODE_LIBRARY.save(); UTILS.showToast('回收站已清空', 'success'); } } });
                },
                doConfirm: () => {
                    if (st.confirm) {
                        const cb = st.confirm.onConfirm;
                        PanelStore.set({ confirm: null });
                        if (cb) cb();
                    }
                },
                cancelConfirm: () => PanelStore.set({ confirm: null }),
                doPromptSubmit: (value) => {
                    if (st.prompt) {
                        const cb = st.prompt.onSubmit;
                        PanelStore.set({ prompt: null });
                        if (cb) cb(value);
                    }
                },
                cancelPrompt: () => PanelStore.set({ prompt: null }),
                openDetail: (code) => {
                    const item = CODE_LIBRARY.getItem(code) || CODE_LIBRARY.trash.items.find(i => i.code.toUpperCase() === code.toUpperCase());
                    if (item) PanelStore.set({ detail: code });
                },
                closeDetail: () => PanelStore.set({ detail: null }),
                toggleTheme: () => { THEME.set(THEME.next()); PanelStore.set({}); },
                toggleHelp: () => PanelStore.set({ helpOpen: !PanelStore.state.helpOpen }),
                toggleMenu: () => PanelStore.set({ menuOpen: !PanelStore.state.menuOpen }),
                openStandalone: () => { PanelStore.set({ menuOpen: false }); STANDALONE.open(); },
                clearPreviewCaches: () => {
                    const s = CODE_LIBRARY.previewCacheStats();
                    PanelStore.set({ menuOpen: false, confirm: {
                        message: `确定清除全部预览缓存（${s.magnets} 条磁力 / ${s.screenshots} 张截图）？之后可重新拉取。`,
                        danger: 'soft',
                        onConfirm: () => {
                            const n = CODE_LIBRARY.clearAllPreviewCaches();
                            UTILS.showToast(`已清除 ${n} 条磁力的预览缓存`, 'success');
                        }
                    } });
                },
                kbdStep: (delta) => {
                    const len = items.length;
                    if (!len) return;
                    const cur = st.selectedIndex < 0 ? (delta > 0 ? -1 : 0) : st.selectedIndex;
                    PanelStore.set({ selectedIndex: Math.max(0, Math.min(len - 1, cur + delta)) });
                },
                kbdJump: (i) => {
                    if (!items.length) return;
                    PanelStore.set({ selectedIndex: Math.max(0, Math.min(items.length - 1, i)) });
                },
                kbdOpen: () => {
                    const it = items[st.selectedIndex];
                    if (it) actions.openDetail(it.code);
                },
                kbdDelete: () => {
                    if (st.currentFilter === 'trash') return;
                    const it = items[st.selectedIndex];
                    if (it) actions.deleteToTrash(it.code);
                },
                kbdCopy: () => {
                    const it = items[st.selectedIndex];
                    if (it) actions.copyMagnet(it.code);
                },
                kbdRefreshPreview: () => {
                    const code = st.detail;
                    if (!code) return;
                    const item = actions.resolveItem(code);
                    if (!item) return;
                    const magnets = CODE_LIBRARY.normMagnets(item.magnet);
                    if (!magnets.length) return;
                    const entry = magnets[0];
                    const mid = CODE_LIBRARY.magnetId(entry) || '0';
                    actions.previewMagnet(code, mid, { force: true });
                }
            };

            // actions 每次渲染重建；经 ref 转发给稳定回调，保证 memo(ItemRow) 生效且无过期闭包
            actionsRef.current = actions;
            const stableOnToggle = useCallback((code) => actionsRef.current.toggleItem(code), []);
            const stableOnOpenDetail = useCallback((code) => actionsRef.current.openDetail(code), []);
            const stableOnFav = useCallback((code) => actionsRef.current.markFav(code), []);
            const stableOnWatch = useCallback((code) => actionsRef.current.markWatched(code), []);
            const stableOnUnfav = useCallback((code) => actionsRef.current.unfavorite(code), []);
            const stableOnDelete = useCallback((code) => actionsRef.current.deleteToTrash(code), []);
            const stableOnRestore = useCallback((code) => actionsRef.current.restoreFromTrash(code), []);
            const stableOnPurge = useCallback((code) => actionsRef.current.permanentDelete(code), []);

            const kbdRef = useRef(null);
            kbdRef.current = (e) => {
                if (!st.visible) return;
                // 灯箱打开时由 MAGNET_PREVIEW 处理键盘；方向键兜底 preventDefault 防止浏览器历史导航
                if (MAGNET_PREVIEW._open) {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
                    return;
                }
                const key = e.key;
                if (key === 'Escape') {
                    if (st.menuOpen) { e.preventDefault(); actions.toggleMenu(); return; }
                    if (st.helpOpen) { e.preventDefault(); actions.toggleHelp(); return; }
                    if (st.prompt) { e.preventDefault(); actions.cancelPrompt(); return; }
                    if (st.confirm) { e.preventDefault(); actions.cancelConfirm(); return; }
                    if (st.magnetSearch) { e.preventDefault(); actions.closeMagnetSearch(); return; }
                    if (st.detail) { e.preventDefault(); actions.closeDetail(); return; }
                    e.preventDefault(); actions.hidePanel(); return;
                }
                // 文本输入焦点时不劫持快捷键
                const ae = document.activeElement;
                if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
                if (key === '?') { e.preventDefault(); actions.toggleHelp(); return; }
                if (st.helpOpen || st.menuOpen || st.prompt || st.confirm || st.magnetSearch || st.batchProgress) return;
                if (st.detail) {
                    if (key === 'r' || key === 'R') { e.preventDefault(); actions.kbdRefreshPreview(); }
                    return;
                }
                if (key === '/') { e.preventDefault(); if (searchRef.current) searchRef.current.focus(); return; }
                if (key === 'n' || key === 'N') { e.preventDefault(); actions.addCode(); return; }
                if (key === 'ArrowDown') { e.preventDefault(); actions.kbdStep(1); return; }
                if (key === 'ArrowUp') { e.preventDefault(); actions.kbdStep(-1); return; }
                if (key === 'Home') { e.preventDefault(); actions.kbdJump(0); return; }
                if (key === 'End') { e.preventDefault(); actions.kbdJump(items.length - 1); return; }
                if (key === 'Enter') {
                    // 面板内交互控件（按钮/链接/下拉）聚焦时，Enter 交由原生激活，避免劫持导致按钮失效
                    if (ae && (ae.tagName === 'BUTTON' || ae.tagName === 'A' || ae.tagName === 'SELECT') && ae.closest && ae.closest('.emh-code-manager-panel')) return;
                    e.preventDefault(); actions.kbdOpen(); return;
                }
                if (key === 'Delete' || key === 'Backspace') {
                    // 仅在确有选中行（且非回收站视图）时劫持，避免无谓吞掉浏览器默认行为
                    if (st.selectedIndex >= 0 && st.currentFilter !== 'trash' && items[st.selectedIndex]) { e.preventDefault(); actions.kbdDelete(); }
                    return;
                }
                if ((e.metaKey || e.ctrlKey) && (key === 'c' || key === 'C')) {
                    // 仅在确有选中行时劫持复制
                    if (st.selectedIndex >= 0 && items[st.selectedIndex]) { e.preventDefault(); actions.kbdCopy(); }
                    return;
                }
            };
            useEffect(() => {
                const onKey = (e) => { if (kbdRef.current) kbdRef.current(e); };
                document.addEventListener('keydown', onKey);
                return () => document.removeEventListener('keydown', onKey);
            }, []);

            useEffect(() => {
                document.body.style.overflow = st.visible ? 'hidden' : '';
                return () => { document.body.style.overflow = ''; };
            }, [st.visible]);

            // 面板宽度可调：左缘拖拽 320-900px，持久化 GM
            useEffect(() => {
                const panel = document.getElementById('emh-code-manager-panel');
                const handle = resizeRef.current;
                if (!panel || !handle) return;
                let w = 520;
                try {
                    const saved = typeof GM_getValue === 'function' ? GM_getValue('emh_panel_size') : null;
                    if (saved) { const n = Number(saved); if (Number.isFinite(n) && n >= 320 && n <= 900) w = n; }
                } catch (e) {}
                panel.style.setProperty('--emh-panel-w', w + 'px');
                let startX = 0, startW = w, active = false;
                const onMove = (e) => {
                    if (!active) return;
                    const nw = Math.max(320, Math.min(900, startW + (startX - e.clientX)));
                    panel.style.setProperty('--emh-panel-w', nw + 'px');
                };
                const onUp = () => {
                    if (!active) return;
                    active = false;
                    panel.style.transition = '';
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    const cur = parseFloat(panel.style.getPropertyValue('--emh-panel-w')) || 520;
                    try { if (typeof GM_setValue === 'function') GM_setValue('emh_panel_size', String(Math.round(cur))); } catch (err) {}
                };
                const onDown = (e) => {
                    e.preventDefault();
                    active = true;
                    startX = e.clientX;
                    startW = parseFloat(panel.style.getPropertyValue('--emh-panel-w')) || 520;
                    panel.style.transition = 'none';
                    document.addEventListener('pointermove', onMove);
                    document.addEventListener('pointerup', onUp);
                };
                handle.addEventListener('pointerdown', onDown);
                return () => {
                    handle.removeEventListener('pointerdown', onDown);
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                };
            }, [st.visible]);

            const all = CODE_LIBRARY.getAll();
            const favList = CODE_LIBRARY.getFavorites();
            const watchedList = CODE_LIBRARY.getWatched();
            const trashList = CODE_LIBRARY.getTrash();

            let items = st.currentFilter === 'favorite' ? favList
                : st.currentFilter === 'watched' ? watchedList
                : st.currentFilter === 'trash' ? trashList : all;

            if (st.timeFilter) {
                const now = Date.now(); const day = 86400000;
                let cutoff = now;
                if (st.timeFilter === 'today') cutoff = new Date().setHours(0, 0, 0, 0);
                else if (st.timeFilter === '7d') cutoff = now - 7 * day;
                else if (st.timeFilter === '30d') cutoff = now - 30 * day;
                items = items.filter(i => i.createdDate && new Date(i.createdDate).getTime() >= cutoff);
            }
            if (st.magnetFilter === 'has') {
                items = items.filter(i => CODE_LIBRARY.normMagnets(i.magnet).length > 0);
            } else if (st.magnetFilter === 'none') {
                items = items.filter(i => CODE_LIBRARY.normMagnets(i.magnet).length === 0);
            }
            const q = st.searchQuery.toLowerCase();
            if (q) items = items.filter(i => i.code.toLowerCase().includes(q) || (typeof i.remarks === 'string' && i.remarks.toLowerCase().includes(q)));

            // 键盘选中索引随列表变化收敛到有效范围（须在 items 计算之后）
            useEffect(() => {
                if (items.length === 0) {
                    if (st.selectedIndex !== -1) PanelStore.set({ selectedIndex: -1 });
                } else if (st.selectedIndex >= items.length) {
                    PanelStore.set({ selectedIndex: items.length - 1 });
                }
            }, [items.length, st.selectedIndex]);

            // 键盘选中项滚动到可视区（用 scrollTop，不用 scrollIntoView）
            useEffect(() => {
                if (st.selectedIndex < 0 || !contentRef.current) return;
                const el = contentRef.current.querySelectorAll('.emh-item[data-code]')[st.selectedIndex];
                if (!el) return;
                const cont = contentRef.current;
                cont.scrollTop = Math.max(0, el.offsetTop - cont.clientHeight / 2);
            }, [st.selectedIndex]);

            // standalone 双栏：选中行 → 右侧详情联动
            useEffect(() => {
                if (window.__EMH_STANDALONE && st.selectedIndex >= 0) {
                    const it = items[st.selectedIndex];
                    if (it && st.detail !== it.code) actions.openDetail(it.code);
                }
            }, [st.selectedIndex]);

            let emptyMsg = '番号库为空，点击"添加"开始';
            let emptyIcon = 'library';
            if (st.currentFilter === 'favorite') { emptyMsg = '暂无关注番号'; emptyIcon = 'favorite'; }
            else if (st.currentFilter === 'watched') { emptyMsg = '暂无已看记录'; emptyIcon = 'watched'; }
            else if (st.currentFilter === 'trash') { emptyMsg = '回收站为空'; emptyIcon = 'trash'; }
            if (st.timeFilter) { emptyMsg = st.timeFilter === 'today' ? '今天暂无新增' : '该时间段内无记录'; emptyIcon = 'time'; }
            if (st.magnetFilter === 'has') { emptyMsg = '没有有磁力的番号'; emptyIcon = 'has'; }
            else if (st.magnetFilter === 'none') { emptyMsg = '没有无磁力的番号'; emptyIcon = 'none'; }
            if (q) { emptyMsg = `未找到匹配 "${st.searchQuery}" 的番号`; emptyIcon = 'search'; }

            useEffect(() => {
                if (!headRef.current) return;
                const total = items.length;
                const selCount = st.selectedItems.length;
                headRef.current.checked = total > 0 && selCount === total;
                headRef.current.indeterminate = selCount > 0 && selCount < total;
            }, [items, st.selectedItems]);

            const isTrash = st.currentFilter === 'trash';
            const rowView = st.currentFilter === 'favorite' ? 'favorite'
                : st.currentFilter === 'watched' ? 'watched'
                : st.currentFilter === 'trash' ? 'trash' : 'unmarked';
            const tabDefs = [
                { f: 'all', label: '全部', n: all.length },
                { f: 'favorite', label: '关注', n: favList.length },
                { f: 'watched', label: '已看', n: watchedList.length },
                { f: 'trash', label: '回收站', n: trashList.length }
            ];

            const headChange = (e) => {
                if (isTrash) return;
                if (e.target.checked) PanelStore.set({ multiSelectMode: true, selectedItems: items.map(i => i.code) });
                else PanelStore.set({ multiSelectMode: false, selectedItems: [] });
            };

            return html`
                <${Fragment}>
                    ${st.visible ? html`
                        <div class="emh-panel-backdrop" onClick=${actions.hidePanel}></div>
                        <div id="emh-code-manager-panel" class="emh-code-manager-panel visible">
                        <div ref=${resizeRef} class="emh-panel-resize" title="拖动调整宽度"></div>
                        <div class="emh-panel-header">
                            <h2><span class="emh-panel-logo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span> ${window.__EMH_STANDALONE ? '番号库' : '管理中心'} <span class="emh-header-count">${items.length > 0 ? `(${items.length})` : ''}</span></h2>
                            <div class="emh-panel-controls">
                                <button class="emh-theme-toggle" title="更多选项" onClick=${actions.toggleMenu}>
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
                                </button>
                                <button class="emh-theme-toggle" title="快捷键帮助 (? )" onClick=${actions.toggleHelp}>
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                </button>
                                <button class="emh-theme-toggle" title="切换主题（当前：${THEME.get() === 'dark' ? '深色' : THEME.get() === 'light' ? '浅色' : '跟随系统'}）" onClick=${actions.toggleTheme}>
                                    ${THEME.get() === 'dark' ? html`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>` : THEME.get() === 'light' ? html`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>` : html`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`}
                                </button>
                                <button class="emh-panel-close" title="关闭 (Esc)" onClick=${actions.hidePanel}>×</button>
                            </div>
                        </div>
                            <div class="emh-panel-tabs">
                                ${tabDefs.map(t => html`
                                    <button data-filter="${t.f}" class="${st.currentFilter === t.f ? 'active' : ''}"
                                            onClick=${() => actions.setFilter(t.f)}>${t.label} ${t.n > 0 ? html`<span class="emh-tab-count">${t.n}</span>` : ''}</button>
                                `)}
                            </div>
                            <div class="emh-panel-search">
                                <div class="emh-search-wrapper">
                                    <input ref=${searchRef} type="text" placeholder="搜索番号或备注…"
                                           value=${searchDraft}
                                           onInput=${onSearchInput} />
                                    <button class="emh-search-clear ${searchDraft ? 'visible' : ''}" title="清除"
                                            onClick=${clearSearch}>×</button>
                                </div>
                                <div class="emh-filter-row">
                                    <span class="emh-filter-tag ${st.timeFilter === '' ? 'active' : ''}"
                                          onClick=${() => PanelStore.set({ timeFilter: '' })}>全部</span>
                                    <span class="emh-filter-tag ${st.timeFilter === 'today' ? 'active' : ''}"
                                          onClick=${() => PanelStore.set({ timeFilter: 'today' })}>今天</span>
                                    <span class="emh-filter-tag ${st.timeFilter === '7d' ? 'active' : ''}"
                                          onClick=${() => PanelStore.set({ timeFilter: '7d' })}>7天</span>
                                    <span class="emh-filter-tag ${st.timeFilter === '30d' ? 'active' : ''}"
                                          onClick=${() => PanelStore.set({ timeFilter: '30d' })}>30天</span>
                                    <span class="emh-filter-divider"></span>
                                    <span class="emh-filter-tag ${st.magnetFilter === '' ? 'active' : ''}"
                                          onClick=${() => PanelStore.set({ magnetFilter: '' })}>磁力不限</span>
                                    <span class="emh-filter-tag ${st.magnetFilter === 'has' ? 'active' : ''}"
                                          onClick=${() => PanelStore.set({ magnetFilter: 'has' })}>有磁力</span>
                                    <span class="emh-filter-tag ${st.magnetFilter === 'none' ? 'active' : ''}"
                                          onClick=${() => PanelStore.set({ magnetFilter: 'none' })}>无磁力</span>
                                </div>
                            </div>
                            <div class="emh-list-header">
                                <label class="emh-checkbox-wrap" style=${isTrash ? 'visibility:hidden;' : ''}><input type="checkbox" ref=${headRef}
                                       onClick=${e => e.stopPropagation()} onChange=${headChange} /></label>
                                <span class="emh-col-code">番号</span>
                                <span class="emh-col-status">状态</span>
                                <span class="emh-col-actions">操作</span>
                            </div>
                            <div class="emh-panel-content ${st.multiSelectMode ? 'multi-select' : ''}" ref=${contentRef}>
                                ${items.length > 0 ? items.map((item, idx) => html`
                                    <${ItemRowMemo} key=${item.code} item=${item} view=${rowView} multi=${st.multiSelectMode}
                                        selected=${st.selectedItems.includes(item.code)}
                                        kbdSel=${!st.multiSelectMode && st.selectedIndex === idx}
                                        onToggle=${stableOnToggle} onOpenDetail=${stableOnOpenDetail}
                                        onFav=${stableOnFav} onWatch=${stableOnWatch}
                                        onUnfav=${stableOnUnfav}
                                        onDelete=${stableOnDelete}
                                        onRestore=${stableOnRestore} onPurge=${stableOnPurge} />
                                `) : html`
                                    <div class="emh-empty-state"><div class="emh-empty-state-icon">${EMPTY_ICONS[emptyIcon] || EMPTY_ICONS.library}</div><div>${emptyMsg}</div></div>
                                `}
                            </div>
                            ${st.multiSelectMode ? html`
                                <div class="emh-panel-multi-actions" style="display:flex;">
                                    <span class="emh-selected-count">已选 ${st.selectedItems.length} 项</span>
                                    <button class="btn btn-outline emh-expand" aria-label="全选" onClick=${actions.selectAll}>${ICON.checkSquare}<span class="emh-expand-label">全选</span></button>
                                    <button class="btn my-btn-primary emh-expand" aria-label="磁力" onClick=${actions.batchFetchMagnets}>${ICON.refresh}<span class="emh-expand-label">磁力</span></button>
                                    <button class="btn my-btn-success emh-expand" aria-label="关注" onClick=${() => actions.batchMark('favorite')}>${ICON.heart}<span class="emh-expand-label">关注</span></button>
                                    <button class="btn my-btn-success emh-expand" aria-label="已看" onClick=${() => actions.batchMark('watched')}>${ICON.checkCircle}<span class="emh-expand-label">已看</span></button>
                                    <button class="btn my-btn-danger emh-expand" aria-label="删除" onClick=${actions.batchDelete}>${ICON.trash}<span class="emh-expand-label">删除</span></button>
                                    <button class="btn btn-outline emh-expand" aria-label="取消" onClick=${actions.toggleMulti}>${ICON.x}<span class="emh-expand-label">取消</span></button>
                                </div>
                            ` : html`
                                <div class="emh-panel-actions">
                                    <button class="btn my-btn-primary emh-btn-add emh-expand" aria-label="添加" onClick=${actions.addCode} style=${isTrash ? 'display:none;' : ''}>${ICON.plus}<span class="emh-expand-label">添加</span></button>
                                    <button class="btn btn-outline emh-expand" aria-label="批量" onClick=${actions.toggleMulti} style=${isTrash ? 'display:none;' : ''}>${ICON.list}<span class="emh-expand-label">批量</span></button>
                                    <button class="btn btn-outline emh-expand" aria-label="导入" onClick=${actions.importData}>${ICON.import}<span class="emh-expand-label">导入</span></button>
                                    <button class="btn btn-outline emh-expand" aria-label="导出" onClick=${actions.exportData}>${ICON.export}<span class="emh-expand-label">导出</span></button>
                                    <button class="btn my-btn-danger emh-expand" aria-label="清空" onClick=${actions.clearTrash} style=${isTrash && trashList.length > 0 ? '' : 'display:none;'}>${ICON.trash}<span class="emh-expand-label">清空</span></button>
                                </div>
                            `}
                            <${ConfirmModal} confirm=${st.confirm} onConfirm=${actions.doConfirm} onCancel=${actions.cancelConfirm} />
                            <${PromptModal} promptState=${st.prompt} onSubmit=${actions.doPromptSubmit} onCancel=${actions.cancelPrompt} />
                            <${MagnetListModal} magnetSearch=${st.magnetSearch} onPick=${actions.fetchMagnetDetail} onClose=${actions.closeMagnetSearch} />
                            <${BatchProgressModal} progress=${st.batchProgress} />
                            ${st.helpOpen ? html`<${HelpModal} onClose=${actions.toggleHelp} />` : ''}
                            ${st.menuOpen ? html`<${HeaderMenu} onClose=${actions.toggleMenu} onClear=${actions.clearPreviewCaches} onOpenStandalone=${window.__EMH_STANDALONE ? null : actions.openStandalone} stats=${CODE_LIBRARY.previewCacheStats()} />` : ''}
                            ${st.detail ? (() => {
                                const detailItem = CODE_LIBRARY.getItem(st.detail) || (trashList.find(i => i.code.toUpperCase() === st.detail.toUpperCase())) || null;
                                const detailInTrash = detailItem ? trashList.some(i => i.code.toUpperCase() === detailItem.code.toUpperCase()) : false;
                                return detailItem ? html`
                                    <${DetailDrawer} item=${detailItem} inTrash=${detailInTrash} onClose=${actions.closeDetail}
                                        onEdit=${actions.editRemark} onEditTags=${actions.editTags}
                                        onEditMagnet=${actions.editMagnet}
                                        onEditMagnetItem=${actions.editMagnetItem} onRemoveMagnet=${actions.removeMagnet}
                                        onCopyMagnetItem=${actions.copyMagnetItem}
                                        onCopyMagnet=${actions.copyMagnet} onPreviewMagnet=${actions.previewMagnet}
                                        onPreviewMagnetAt=${actions.previewMagnetAt}
                                        onSearchMagnet=${actions.searchMagnet}
                                        onFav=${actions.markFav}
                                        onWatch=${actions.markWatched} onUnfav=${actions.unfavorite}
                                        onDelete=${actions.deleteToTrash}
                                        onRestore=${actions.restoreFromTrash} onPurge=${actions.permanentDelete} />
                                ` : null;
                            })() : null}
                        </div>
                    ` : null}
                    <${ToastContainer} />
                </${Fragment}>
            `;
        }

        const CodeManagerPanel = {
            get isVisible() { return PanelStore.state.visible; },
            get lastSyncTimestamp() { return PanelStore.state.lastSyncTimestamp; },
            set lastSyncTimestamp(v) { PanelStore.set({ lastSyncTimestamp: v }); },
            initialized: false,
            mountEl: null,

            init: function() {
                if (this.initialized) return;
                this.initialized = true;
                // standalone：首帧即展开（render 前设 visible），避免 showPanel 在
                // useEffect 订阅注册前丢失更新（preact useEffect 延迟执行）
                if (window.__EMH_STANDALONE) PanelStore.set({ visible: true });
                this.createStyles();
                this.createToggleButton();
                this.mountEl = document.createElement('div');
                this.mountEl.id = 'emh-code-manager-mount';
                document.body.appendChild(this.mountEl);
                render(h(CodeManagerApp), this.mountEl);
            },

            createToggleButton: function() {
                const existing = document.getElementById('emh-code-manager-toggle');
                if (existing) existing.remove();
                const btn = document.createElement('button');
                btn.id = 'emh-code-manager-toggle';
                btn.className = 'emh-code-manager-toggle';
                btn.innerHTML = ICONS.grid + '<span>番号库</span>';
                btn.title = '管理番号库';
                btn.addEventListener('click', () => this.togglePanel());
                document.body.appendChild(btn);
            },

            togglePanel: function() {
                PanelStore.state.visible ? PanelStore.set({ visible: false, multiSelectMode: false, selectedItems: [], helpOpen: false }) : PanelStore.set({ visible: true });
            },

            showPanel: function() { PanelStore.set({ visible: true }); },

            hidePanel: function() { PanelStore.set({ visible: false, multiSelectMode: false, selectedItems: [], helpOpen: false }); },

            refreshPanelContent: function() { PanelStore.refresh(); },

            createStyles: function() {
                const styleElement = document.createElement('style');
                styleElement.textContent = `
                    .emh-code-manager-panel {
                        position: fixed; top: 0;
                        right: calc(-1 * (min(var(--emh-panel-w, 520px), calc(100vw - 24px)) + 40px));
                        width: min(var(--emh-panel-w, 520px), calc(100vw - 24px)); height: 100vh;
                        background: var(--emh-bg);
                        box-shadow: var(--emh-shadow-lg); z-index: 10010;
                        border-left: 1px solid var(--emh-border);
                        transition: right 0.3s cubic-bezier(0.25,0.8,0.25,1);
                        display: flex; flex-direction: column;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        font-size: 13px; color: var(--emh-text);
                        border-radius: 16px 0 0 16px;
                        overflow: hidden;
                    }
                    .emh-code-manager-panel.visible { right: 0; }
                    .emh-panel-resize {
                        position: absolute; left: 0; top: 0; bottom: 0; width: 12px;
                        cursor: ew-resize; z-index: 5; touch-action: none;
                    }
                    .emh-panel-resize::after {
                        content: ''; position: absolute; left: 4px; top: 50%; transform: translateY(-50%);
                        width: 4px; height: 44px; border-radius: 999px;
                        background: var(--emh-border-strong); opacity: 0; transition: opacity 0.15s;
                    }
                    .emh-panel-resize:hover::after, .emh-panel-resize:active::after { opacity: 1; }
                    .emh-panel-backdrop {
                        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                        background: var(--emh-overlay); z-index: 10009;
                        animation: emh-fade-in 0.2s ease;
                        -webkit-backdrop-filter: blur(4px);
                        backdrop-filter: blur(4px);
                    }
                    @keyframes emh-fade-in { from { opacity: 0; } to { opacity: 1; } }
                    .emh-panel-header {
                        display: flex; justify-content: space-between; align-items: center;
                        height: 52px; padding: 0 16px; box-sizing: border-box;
                        background: var(--emh-bg);
                        border-bottom: 1px solid var(--emh-border);
                        position: relative; z-index: 1; flex-shrink: 0;
                    }
                    .emh-panel-header h2 { margin: 0; font-size: 14px; font-weight: 700; color: var(--emh-text); letter-spacing: 0.1px; display: flex; align-items: center; gap: 8px; }
                    .emh-panel-logo { font-size: 18px; line-height: 1; color: var(--emh-primary); display: inline-flex; align-items: center; }
                    .emh-panel-close {
                        background: var(--emh-btn-bg); border: none; font-size: 18px; cursor: pointer; color: var(--emh-text-secondary);
                        width: 30px; height: 30px; border-radius: var(--emh-radius-sm); transition: background 0.15s, color 0.15s; line-height: 1;
                        display: inline-flex; align-items: center; justify-content: center;
                    }
                    .emh-panel-close:hover { background: var(--emh-danger-soft); color: var(--emh-danger); }
                    .emh-panel-controls { display: inline-flex; align-items: center; gap: 6px; }
                    .emh-theme-toggle {
                        background: var(--emh-btn-bg); border: none; cursor: pointer; color: var(--emh-text-secondary);
                        width: 30px; height: 30px; border-radius: var(--emh-radius-sm); transition: background 0.15s, color 0.15s; line-height: 1;
                        display: inline-flex; align-items: center; justify-content: center;
                    }
                    .emh-theme-toggle:hover { background: var(--emh-primary-soft); color: var(--emh-primary); }
                    .emh-theme-toggle:focus-visible { outline: 2px solid var(--emh-primary); outline-offset: 2px; }
                    .emh-header-menu-backdrop { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10011; background: transparent; }
                    .emh-header-menu {
                        position: absolute; top: 48px; right: 12px; z-index: 10012;
                        min-width: 224px; padding: 8px; border-radius: var(--emh-radius);
                        background: var(--emh-surface-raised); border: 1px solid var(--emh-border);
                        box-shadow: var(--emh-shadow-lg);
                        animation: emh-modal-in 0.16s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                    .emh-header-menu-title { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--emh-text-muted); padding: 4px 8px 6px; }
                    .emh-header-menu-stat { font-size: 12px; color: var(--emh-text-secondary); padding: 2px 8px 8px; line-height: 1.5; }
                    .emh-header-menu-item {
                        display: block; width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px;
                        border: none; background: none; cursor: pointer; font-size: 13px; color: var(--emh-text);
                        transition: background 0.15s, color 0.15s;
                    }
                    .emh-header-menu-item:hover { background: var(--emh-danger-soft); color: var(--emh-danger); }
                    .emh-header-menu-item:focus-visible { outline: 2px solid var(--emh-primary); outline-offset: -2px; }
                    .emh-header-menu-item-plain:hover { background: var(--emh-primary-soft); color: var(--emh-primary); }
                    .emh-panel-close:focus-visible,
                    .emh-search-clear:focus-visible,
                    .emh-magnet-op:focus-visible { outline: 2px solid var(--emh-primary); outline-offset: 2px; }
                    .emh-header-count { font-size: 12px; font-weight: 500; color: var(--emh-text-muted); margin-left: 6px; }
                    .emh-tab-count { font-size: 11px; background: var(--emh-btn-bg); color: var(--emh-text-secondary); padding: 1px 7px; border-radius: 999px; margin-left: 5px; font-weight: 600; }
                    .emh-panel-tabs button.active .emh-tab-count { background: var(--emh-primary-soft); color: var(--emh-primary); }
                    .emh-panel-tabs { display: flex; background: var(--emh-surface); border-bottom: 1px solid var(--emh-border); padding: 0 12px; flex-shrink: 0; }
                    .emh-panel-tabs button {
                        background: none; border: none; padding: 11px 14px; font-size: 13px; font-weight: 500;
                        cursor: pointer; color: var(--emh-text-secondary); position: relative; transition: color 0.15s, background-color 0.15s;
                        letter-spacing: 0.1px; border-radius: 8px;
                    }
                    .emh-panel-tabs button:hover { color: var(--emh-primary); background: var(--emh-primary-softer); }
                    .emh-panel-tabs button:focus-visible { outline: 2px solid var(--emh-primary); outline-offset: -2px; }
                    .emh-panel-tabs button.active { color: var(--emh-primary); font-weight: 600; background: none; }
                    .emh-panel-tabs button.active::after {
                        content: ''; position: absolute; bottom: 0; left: 12px; right: 12px;
                        height: 2.5px; background: var(--emh-primary); border-radius: 2px;
                    }
                    .emh-panel-search { padding: 14px 20px 12px; background: var(--emh-surface); border-bottom: 1px solid var(--emh-border); flex-shrink: 0; }
                    .emh-search-wrapper { position: relative; display: flex; }
                    .emh-search-wrapper input {
                        flex: 1; width: 100%; box-sizing: border-box; padding: 9px 36px 9px 14px; border: 1px solid var(--emh-border);
                        border-radius: 10px; outline: none; font-size: 13px; letter-spacing: 0.1px;
                        transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; background: var(--emh-bg);
                        font-family: inherit; box-shadow: inset 0 1px 2px rgba(0,0,0,0.03); color: var(--emh-text);
                    }
                    .emh-search-wrapper input:hover { border-color: var(--emh-border-strong); }
                    .emh-search-wrapper input:focus { border-color: var(--emh-primary); box-shadow: 0 0 0 3px var(--emh-focus-ring); background: var(--emh-surface); }
                    .emh-search-wrapper input::placeholder { color: var(--emh-text-muted); }
                    .emh-search-clear {
                        position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
                        background: var(--emh-btn-bg); border: none; color: var(--emh-text-muted); font-size: 14px;
                        cursor: pointer; width: 22px; height: 22px; border-radius: 50%; line-height: 1;
                        display: none; transition: background 0.15s, color 0.15s; align-items: center; justify-content: center;
                    }
                    .emh-search-clear:hover { background: var(--emh-btn-hover); color: var(--emh-text); }
                    .emh-search-clear.visible { display: inline-flex; }
                    .emh-filter-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
                    .emh-filter-divider { width: 1px; height: 16px; background: var(--emh-border-strong); margin: 0 2px; flex-shrink: 0; }
                    .emh-filter-tag {
                        display: inline-flex; align-items: center; justify-content: center;
                        padding: 4px 12px; border-radius: 999px; cursor: pointer;
                        font-size: 12px; font-weight: 500; color: var(--emh-text-secondary);
                        background: var(--emh-surface); border: 1px solid var(--emh-border);
                        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
                        user-select: none;
                    }
                    .emh-filter-tag:hover { border-color: var(--emh-primary); color: var(--emh-primary); background: var(--emh-primary-softer); }
                    .emh-filter-tag.active {
                        background: var(--emh-primary); color: var(--emh-on-primary);
                        border-color: var(--emh-primary); box-shadow: 0 2px 8px var(--emh-primary-soft);
                    }
                    .emh-list-header {
                        display: flex; align-items: center; padding: 8px 20px;
                        background: var(--emh-bg); border-bottom: 1px solid var(--emh-border);
                        font-size: 11px; font-weight: 600; color: var(--emh-text-muted);
                        text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0;
                    }
                    .emh-col-code { flex: 1; padding-left: 8px; }
                    .emh-col-status { width: 64px; text-align: center; }
                    .emh-col-actions { width: 80px; text-align: right; }
                    .emh-checkbox-wrap { display: inline-flex; align-items: center; }
                    .emh-checkbox-wrap input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--emh-primary); }
                    .emh-panel-content {
                        flex: 1; overflow-y: auto; padding: 10px 14px;
                        background: var(--emh-bg); scrollbar-width: thin;
                        scrollbar-color: var(--emh-border-strong) transparent;
                        position: relative;
                    }
                    .emh-panel-content::-webkit-scrollbar { width: 6px; }
                    .emh-panel-content::-webkit-scrollbar-thumb { background: var(--emh-border-strong); border-radius: 3px; }
                    .emh-panel-content::-webkit-scrollbar-track { background: transparent; }
                    .emh-panel-actions, .emh-panel-multi-actions {
                        padding: 12px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: stretch;
                        border-top: 1px solid var(--emh-border); flex-shrink: 0;
                        background: var(--emh-bg);
                    }
                    .emh-panel-actions .btn, .emh-panel-multi-actions .btn {
                        flex: 0 0 auto; margin-left: 0; justify-content: center;
                        padding: 9px 12px; min-height: 36px;
                    }
                    .emh-panel-actions .emh-btn-add { font-size: 13px; box-shadow: 0 2px 8px var(--emh-primary-soft); }
                    .emh-panel-multi-actions { align-items: center; flex-wrap: wrap; gap: 8px; }
                    .emh-panel-multi-actions .btn { flex: 0 0 auto; padding: 8px 10px; min-height: 34px; }
                    .emh-panel-multi-actions .emh-selected-count { flex: 1 1 100%; text-align: center; margin-bottom: 2px; }
                    .emh-item {
                        display: flex; align-items: center; gap: 6px; padding: 10px 14px;
                        border: 1px solid var(--emh-border); border-radius: 10px; margin-bottom: 6px;
                        background: var(--emh-surface); box-shadow: var(--emh-shadow-sm);
                        transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
                    }
                    .emh-item:hover { border-color: var(--emh-border-strong); box-shadow: var(--emh-shadow-md); transform: translateY(-1px); }
                    .emh-item.favorite { border-left: 3px solid var(--emh-danger); }
                    .emh-item.watched { border-left: 3px solid var(--emh-success); }
                    .emh-item.selected { background: var(--emh-primary-soft); border-color: var(--emh-primary); box-shadow: 0 0 0 1px var(--emh-focus-ring); }
                    .emh-item.kbd-sel { border-color: var(--emh-primary); box-shadow: 0 0 0 2px var(--emh-focus-ring); }
                    .emh-item-code {
                        font-weight: 600; color: var(--emh-text); font-size: 13px;
                        font-family: var(--emh-font-mono); letter-spacing: 0.1px;
                        font-variant-numeric: tabular-nums;
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
                    }
                    .emh-item-remarks {
                        font-size: 12px; color: var(--emh-text-muted);
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                        margin-top: 2px; letter-spacing: 0.1px; max-width: 100%;
                    }
                    .emh-item-actions {
                        display: inline-flex; align-items: center; gap: 2px;
                        padding: 2px; border-radius: var(--emh-radius-sm);
                        background: var(--emh-surface-raised); border: 1px solid var(--emh-border);
                        opacity: 0; transform: translateX(6px);
                        transition: opacity 0.18s ease, transform 0.18s ease;
                        box-shadow: var(--emh-shadow-sm);
                    }
                    .emh-item:hover .emh-item-actions { opacity: 1; transform: translateX(0); }
                    .emh-item-actions button {
                        background: none; border: none; cursor: pointer; padding: 0;
                        width: 28px; height: 28px; min-width: 28px; min-height: 28px; border-radius: 6px;
                        font-size: 13px; opacity: 0.75; transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
                        line-height: 1;
                        display: inline-flex; align-items: center; justify-content: center;
                        color: var(--emh-text-secondary);
                    }
                    .emh-item-actions button:hover { opacity: 1; background: var(--emh-btn-hover); transform: scale(1.06); box-shadow: var(--emh-shadow-sm); }
                    .emh-item-actions button.emh-act-favorite:hover { background: var(--emh-danger-soft); color: var(--emh-danger); }
                    .emh-item-actions button.emh-act-watched:hover { background: var(--emh-success-soft); color: var(--emh-success); }
                    .emh-item-actions button.emh-act-delete:hover { background: var(--emh-danger-soft); color: var(--emh-danger); }
                    .emh-item-actions button.emh-act-unfav:hover { background: var(--emh-warning-soft); color: var(--emh-warning); }
                    .emh-item-actions button.emh-act-restore:hover { background: var(--emh-primary-soft); color: var(--emh-primary); }
                    .emh-item-actions button.emh-act-purge:hover { background: var(--emh-danger-soft); color: var(--emh-danger); }
                    .emh-item > .emh-checkbox-wrap { width: 22px; flex-shrink: 0; }
                    .emh-item > .emh-col-code { flex: 1; min-width: 0; padding-left: 2px; overflow: hidden; }
                    .emh-item > .emh-col-status { width: 64px; text-align: center; flex-shrink: 0; }
                    .emh-item > .emh-col-actions { width: 80px; text-align: right; flex-shrink: 0; display: flex; justify-content: flex-end; }
                    .emh-panel-content.multi-select .emh-item > .emh-col-actions { width: 0; overflow: hidden; }
                    .emh-panel-content.multi-select .emh-list-header .emh-col-actions { display: none; }
                    .emh-status-tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 9px; border-radius: 999px; line-height: 1.7; white-space: nowrap; letter-spacing: 0.1px; border: 1px solid transparent; }
                    .emh-status-tag.unmarked { background: var(--emh-btn-bg); color: var(--emh-text-secondary); border-color: var(--emh-border); }
                    .emh-status-tag.favorite { background: var(--emh-danger-soft); color: var(--emh-danger); border-color: var(--emh-danger-soft); }
                    .emh-status-tag.watched { background: var(--emh-success-soft); color: var(--emh-success); border-color: var(--emh-success-soft); }
                    .emh-empty-state { text-align: center; color: var(--emh-text-muted); padding: 48px 0; font-size: 13px; letter-spacing: 0.2px; }
                    .emh-empty-state-icon { font-size: 36px; margin-bottom: 10px; opacity: 0.45; }
                    .emh-panel-content .emh-item { animation: emh-item-in 0.18s ease both; }
                    .emh-panel-content .emh-item:nth-child(1) { animation-delay: 0s; }
                    .emh-panel-content .emh-item:nth-child(2) { animation-delay: 0.02s; }
                    .emh-panel-content .emh-item:nth-child(3) { animation-delay: 0.04s; }
                    .emh-panel-content .emh-item:nth-child(4) { animation-delay: 0.06s; }
                    .emh-panel-content .emh-item:nth-child(5) { animation-delay: 0.08s; }
                    @keyframes emh-item-in { from { opacity: 0; } to { opacity: 1; } }
                    .emh-panel-modal {
                        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                        background: var(--emh-overlay); display: none; justify-content: center; align-items: center;
                        z-index: 10014; backdrop-filter: blur(2px);
                    }
                    .emh-panel-modal-content {
                        background: var(--emh-surface-raised); padding: 24px; border-radius: var(--emh-radius);
                        width: 80%; max-width: 320px; text-align: center;
                        box-shadow: var(--emh-shadow-lg); border: 1px solid var(--emh-border);
                        animation: emh-modal-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                    @keyframes emh-modal-in { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                    .emh-panel-modal-content h3 { margin: 0 0 18px 0; color: var(--emh-text); font-size: 15px; font-weight: 600; line-height: 1.5; }
                    .emh-prompt-input {
                        width: 100%; box-sizing: border-box; padding: 9px 12px;
                        border: 1px solid var(--emh-border); border-radius: var(--emh-radius-sm); font-size: 13px;
                        outline: none; transition: border-color 0.15s, box-shadow 0.15s;
                        font-family: inherit; color: var(--emh-text); background: var(--emh-bg);
                    }
                    .emh-prompt-input:focus { border-color: var(--emh-primary); box-shadow: 0 0 0 3px var(--emh-focus-ring); background: var(--emh-surface); }
                    .emh-panel-modal-buttons { display: flex; justify-content: center; gap: 12px; margin-top: 18px; }
                    .emh-panel-modal-buttons .btn { margin-left: 0; min-height: 36px; }
                    .emh-help-modal-content { max-width: 360px; text-align: left; }
                    .emh-help-list { list-style: none; margin: 0 0 4px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
                    .emh-help-list li { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--emh-text); }
                    .emh-kbd-chip {
                        display: inline-flex; align-items: center; justify-content: center;
                        min-width: 36px; padding: 2px 8px; border-radius: 6px;
                        font-family: var(--emh-font-mono); font-size: 11px; font-weight: 600;
                        color: var(--emh-primary); background: var(--emh-btn-bg); border: 1px solid var(--emh-border);
                        white-space: nowrap; flex-shrink: 0;
                    }
                    .emh-help-desc { color: var(--emh-text-secondary); }
                    .emh-selected-count { align-self: center; font-size: 12px; font-weight: 600; color: var(--emh-primary); letter-spacing: 0.2px; white-space: nowrap; }
                    .emh-detail-backdrop {
                        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                        background: var(--emh-overlay); z-index: 10012;
                        animation: emh-fade-in 0.2s ease; backdrop-filter: blur(2px);
                    }
                    .emh-detail-drawer {
                        position: absolute; top: 0; right: 0; width: clamp(320px, 42%, 460px); height: 100%;
                        background: var(--emh-bg); z-index: 10013;
                        box-shadow: var(--emh-shadow-lg);
                        animation: emh-detail-in 0.3s cubic-bezier(0.25,0.8,0.25,1);
                        display: flex; flex-direction: column;
                        border-radius: 16px 0 0 16px;
                        border-left: 1px solid var(--emh-border);
                        overflow: hidden;
                        font-family: inherit;
                    }
                    @keyframes emh-detail-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
                    .emh-detail-header {
                        display: flex; justify-content: space-between; align-items: center;
                        height: 52px; padding: 0 16px; box-sizing: border-box;
                        border-bottom: 1px solid var(--emh-border);
                        background: var(--emh-bg); flex-shrink: 0;
                    }
                    .emh-detail-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
                    .emh-detail-code {
                        font-weight: 700; color: var(--emh-text); font-size: 15px;
                        font-family: var(--emh-font-mono); letter-spacing: 0.1px;
                        font-variant-numeric: tabular-nums;
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                    }
                    .emh-detail-body { flex: 1; overflow-y: auto; padding: 16px 20px; background: var(--emh-bg); scrollbar-width: thin; scrollbar-color: var(--emh-border-strong) transparent; }
                    .emh-detail-body::-webkit-scrollbar { width: 6px; }
                    .emh-detail-body::-webkit-scrollbar-thumb { background: var(--emh-border-strong); border-radius: 3px; }
                    .emh-detail-body::-webkit-scrollbar-track { background: transparent; }
                    /* 详情层次（侧栏/新页签统一）：Hero 标题 → meta 行 → 信息/磁力卡片 */
                    .emh-detail-body.unified { padding: 14px 16px 20px; }
                    .emh-detail-body.unified .emh-detail-hero {
                        padding: 0 0 12px; margin: 2px 0 10px;
                        border-bottom: 1px solid var(--emh-border);
                    }
                    .emh-detail-body.unified .emh-detail-hero .emh-detail-label { display: none; }
                    .emh-detail-body.unified .emh-detail-hero .emh-detail-value {
                        font-size: 18px; font-weight: 700; color: var(--emh-text); line-height: 1.35;
                    }
                    .emh-detail-body.unified .emh-detail-section {
                        background: var(--emh-surface); border: 1px solid var(--emh-border);
                        border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;
                    }
                    .emh-detail-body.unified .emh-detail-section .emh-detail-field {
                        padding: 9px 0; border-bottom: 1px solid var(--emh-border);
                    }
                    .emh-detail-body.unified .emh-detail-section .emh-detail-field:last-child { border-bottom: none; }
                    .emh-detail-body.unified .emh-detail-meta-line {
                        display: flex; flex-wrap: wrap; gap: 14px;
                        font-size: 11px; color: var(--emh-text-muted);
                        padding: 0 2px 12px; margin-bottom: 12px;
                        border-bottom: 1px dashed var(--emh-border);
                    }
                    .emh-detail-field {
                        display: flex; flex-direction: column; gap: 4px; padding: 10px 0;
                        border-bottom: 1px solid var(--emh-border);
                    }
                    .emh-detail-field:last-child { border-bottom: none; }
                    .emh-detail-label {
                        font-size: 11px; font-weight: 600; color: var(--emh-text-muted);
                        text-transform: uppercase; letter-spacing: 0.5px;
                    }
                    .emh-detail-value { font-size: 13px; color: var(--emh-text); line-height: 1.5; word-break: break-all; }
                    .emh-detail-empty { color: var(--emh-text-muted); }
                    .emh-magnet-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
                    .emh-magnet-btn { padding: 4px 10px; font-size: 12px; margin-left: 0; }
                    .emh-magnet-btn.emh-expand { padding: 4px 10px; }
                    .emh-magnet-modal-content { max-width: 420px; max-height: 70vh; display: flex; flex-direction: column; text-align: left; }
                    .emh-batch-modal-content { max-width: 380px; }
                    .emh-batch-progress { margin: 4px 0 14px; }
                    .emh-batch-progress-track {
                        height: 8px; border-radius: 4px; background: var(--emh-btn-bg);
                        overflow: hidden;
                    }
                    .emh-batch-progress-bar {
                        height: 100%; border-radius: 4px;
                        background: linear-gradient(90deg, var(--emh-primary), var(--emh-primary-hover));
                        transition: width 0.3s ease;
                    }
                    .emh-batch-progress-info { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: var(--emh-text-muted); }
                    .emh-batch-progress-pct { font-weight: 700; color: var(--emh-primary); }
                    .emh-batch-current { margin: 8px 0; padding: 8px 10px; border-radius: var(--emh-radius-sm); background: var(--emh-bg); border: 1px solid var(--emh-border); font-size: 13px; color: var(--emh-text); word-break: break-all; }
                    .emh-batch-stats { display: flex; gap: 12px; justify-content: center; margin-top: 4px; font-size: 12px; color: var(--emh-text-muted); }
                    .emh-batch-stat-fail { color: var(--emh-danger); }
                    .emh-magnet-loading { padding: 24px 0; text-align: center; color: var(--emh-text-muted); font-size: 13px; }
                    .emh-magnet-error { padding: 24px 0; text-align: center; color: var(--emh-danger); font-size: 13px; }
                    .emh-magnet-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; max-height: 45vh; scrollbar-width: thin; scrollbar-color: var(--emh-border-strong) transparent; }
                    .emh-magnet-list::-webkit-scrollbar { width: 6px; }
                    .emh-magnet-list::-webkit-scrollbar-thumb { background: var(--emh-border-strong); border-radius: 3px; }
                    .emh-magnet-list::-webkit-scrollbar-track { background: transparent; }
                    .emh-magnet-item {
                        display: flex; align-items: center; justify-content: space-between; gap: 10px;
                        padding: 9px 12px; margin-bottom: 4px; border-radius: var(--emh-radius-sm);
                        background: var(--emh-bg); border: 1px solid var(--emh-border);
                        cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
                    }
                    .emh-magnet-item:hover { border-color: var(--emh-primary); background: var(--emh-primary-soft); }
                    .emh-magnet-item-title {
                        flex: 1; font-size: 13px; color: var(--emh-text); line-height: 1.4;
                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                    }
                    .emh-magnet-item-size { font-size: 12px; color: var(--emh-text-muted); white-space: nowrap; }
                    .emh-magnet-hint { margin-top: 10px; text-align: center; font-size: 12px; color: var(--emh-text-muted); }
                    .emh-magnet-item-static {
                        display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap;
                        padding: 6px 8px; margin-bottom: 3px; border-radius: 6px;
                        background: var(--emh-bg); border: 1px solid var(--emh-border);
                    }
                    .emh-magnet-item-idx {
                        flex-shrink: 0; font-size: 11px; color: var(--emh-text-muted);
                        background: var(--emh-btn-bg); border-radius: 4px; padding: 1px 5px; margin-top: 1px;
                    }
                    .emh-magnet-item-text {
                        flex: 1; min-width: 0; font-size: 11px; color: var(--emh-text);
                        word-break: break-all; line-height: 1.5;
                        font-family: var(--emh-font-mono);
                    }
                    .emh-magnet-item-ops { flex-shrink: 0; display: inline-flex; gap: 2px; align-items: center; }
                    .emh-magnet-op {
                        background: none; border: none; cursor: pointer; padding: 0;
                        width: 24px; height: 24px; min-width: 24px; min-height: 24px;
                        border-radius: 6px; font-size: 12px; line-height: 1;
                        display: inline-flex; align-items: center; justify-content: center;
                        color: var(--emh-text-muted); transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease; opacity: 0.7;
                    }
                    .emh-magnet-op:hover { opacity: 1; background: var(--emh-btn-hover); color: var(--emh-primary); }
                    .emh-magnet-op-del:hover { background: var(--emh-danger-soft); color: var(--emh-danger); }
                    .emh-magnet-op-preview {
                        position: relative;
                    }
                    .emh-magnet-op-preview.has-cache { color: var(--emh-primary); opacity: 0.95; }
                    .emh-magnet-op-preview:hover { color: var(--emh-primary); }
                    .emh-magnet-preview-badge {
                        position: absolute; top: -4px; right: -5px;
                        min-width: 12px; height: 12px; padding: 0 3px;
                        border-radius: 999px; font-size: 9px; font-weight: 700; line-height: 12px;
                        background: var(--emh-primary); color: var(--emh-on-primary);
                        text-align: center; pointer-events: none;
                    }
                    .emh-preview-grid {
                        flex: 1 1 100%; display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
                        gap: 6px; margin-top: 8px; padding-top: 8px;
                        border-top: 1px dashed var(--emh-border);
                    }
                    .emh-preview-cell {
                        position: relative; padding: 0; border: none; cursor: pointer;
                        border-radius: 6px; overflow: hidden; background: var(--emh-surface-raised);
                        aspect-ratio: 16 / 9; display: block; width: 100%;
                        transition: opacity 0.15s ease, transform 0.15s ease;
                    }
                    .emh-preview-cell:hover { transform: translateY(-1px); }
                    .emh-preview-cell:focus-visible { outline: 2px solid var(--emh-primary); outline-offset: 2px; }
                    .emh-preview-thumb {
                        position: absolute; inset: 0;
                        background-position: center; background-size: cover; background-repeat: no-repeat;
                        background-color: var(--emh-surface-raised);
                    }
                    .emh-preview-time {
                        position: absolute; right: 3px; top: 3px;
                        font-family: var(--emh-font-mono); font-size: 9px; font-weight: 600; line-height: 1;
                        padding: 2px 4px; border-radius: 4px;
                        background: rgba(0, 0, 0, 0.6); color: #fff;
                        pointer-events: none;
                    }
                    .emh-detail-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
                    .emh-tag-edit { opacity: 0.7; }
                    .emh-detail-tag {
                        font-size: 11px; padding: 1px 7px; border-radius: 999px;
                        background: var(--emh-btn-bg); color: var(--emh-text-secondary);
                    }
                    .emh-detail-actions {
                        padding: 12px 16px; border-top: 1px solid var(--emh-border);
                        display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
                        background: var(--emh-bg);
                    }
                    .emh-detail-actions .btn { margin-left: 0; justify-content: center; min-height: 34px; }
                    .emh-detail-danger {
                        padding: 12px 20px 16px; border-top: 1px solid var(--emh-danger-soft);
                        display: flex; gap: 8px; background: var(--emh-danger-soft); flex-shrink: 0;
                    }
                    .emh-detail-danger .btn { margin-left: 0; justify-content: center; width: 100%; color: var(--emh-danger); min-height: 36px; }
                    @media (max-width: 576px) { .emh-code-manager-panel { width: 100%; right: -100%; border-radius: 0; } .emh-panel-resize { display: none; } }
                    @media (prefers-reduced-motion: reduce) {
                        .emh-code-manager-panel,
                        .emh-panel-backdrop,
                        .emh-item,
                        .emh-item:hover,
                        .emh-item-actions,
                        .emh-item:hover .emh-item-actions,
                        .emh-item-actions button,
                        .emh-item-actions button:hover,
                        .emh-filter-tag,
                        .emh-panel-tabs button,
                        .emh-search-wrapper input,
                        .emh-detail-drawer,
                        .emh-detail-backdrop,
                        .emh-magnet-item,
                        .emh-batch-progress-bar,
                        .emh-panel-modal-content,
                        .emh-header-menu {
                            transition: none !important;
                            animation: none !important;
                        }
                        .emh-item:hover { transform: none; }
                        .emh-item-actions { opacity: 1; transform: none; }
                        .emh-item-actions button:hover { transform: none; }
                        .emh-panel-content .emh-item { animation: none; }
                    }
                `;
                document.head.appendChild(styleElement);
            }
        };

        return CodeManagerPanel;
    }

    function main() {
        for (const [name, handler] of Object.entries(SITE_HANDLERS)) {
            if (handler.isMatch()) {
                if (handler.targetSelector) {
                    waitForElement(handler.targetSelector, (targetElement) => {
                        if (targetElement || name === 'javgg') {
                            try {
                                setTimeout(() => handler.process(targetElement), 50);
                            } catch (e) { console.error(`EMH: Error processing handler ${name}:`, e); }
                        }
                    });
                } else {
                    try { setTimeout(() => handler.process(null), 150); }
                    catch (e) { console.error(`EMH: Error processing handler ${name}:`, e); }
                }
                break;
            }
        }
    }

    function setupSyncListeners() {
        window.addEventListener('emh_library_updated', function(e) {
            if (e.detail.type === 'library_update') {
                updateCodeStatusIndicators();
                if (window.CodeManagerPanel && window.CodeManagerPanel.isVisible) window.CodeManagerPanel.refreshPanelContent();
            }
        });

        if (typeof GM_addValueChangeListener !== 'undefined') {
            GM_addValueChangeListener('emh_sync_timestamp', function(name, old_value, new_value, remote) {
                if (remote) {
                    CODE_LIBRARY.init(true);
                    updateCodeStatusIndicators();
                    if (window.CodeManagerPanel && window.CodeManagerPanel.isVisible) window.CodeManagerPanel.refreshPanelContent();
                }
            });
        }

        setInterval(function() {
            if (typeof GM_getValue !== 'undefined' && window.CodeManagerPanel) {
                const lastUpdate = GM_getValue('emh_sync_timestamp');
                if (lastUpdate && lastUpdate !== window.CodeManagerPanel.lastSyncTimestamp) {
                    window.CodeManagerPanel.lastSyncTimestamp = lastUpdate;
                    CODE_LIBRARY.init(true);
                    updateCodeStatusIndicators();
                    if (window.CodeManagerPanel.isVisible) window.CodeManagerPanel.refreshPanelContent();
                }
            }
        }, 2000);
    }

    async function bootPanel() {
        injectCoreStyles();
        if (window.__EMH_STANDALONE) injectStandaloneStyles();
        // @run-at document-start：body 可能尚未解析，等待其出现再挂载面板
        if (!document.body) {
            await new Promise((resolve) => {
                const iv = setInterval(() => { if (document.body) { clearInterval(iv); resolve(); } }, 15);
            });
        }
        try {
            if (await ensurePreact()) {
                window.CodeManagerPanel = buildPanel();
                window.CodeManagerPanel.init(); // init 内部 createToggleButton 创建按钮
                if (window.__EMH_STANDALONE) {
                    window.CodeManagerPanel.showPanel();
                    removeStandaloneCover();
                }
            } else {
                console.error('EMH: Preact 依赖加载失败，使用降级按钮');
                if (window.__EMH_STANDALONE) removeStandaloneCover();
                createFallbackToggle(() => UTILS.showToast('面板组件依赖加载失败，请检查网络后刷新页面', 'error'));
            }
        } catch (e) {
            console.error('EMH: 面板初始化失败', e);
            // 初始化异常时也保证按钮可见
            if (window.__EMH_STANDALONE) removeStandaloneCover();
            createFallbackToggle(() => UTILS.showToast('面板初始化失败，请刷新页面重试', 'error'));
        }
    }

    function initialize() {
        // standalone 独立页：同源真实网址 + #emh-standalone 标记 → 原生 GM 能力，无需父页桥
        if (location.hash.indexOf('emh-standalone') >= 0 || location.search.indexOf('emh-standalone') >= 0) {
            window.__EMH_STANDALONE = true;
            try { document.title = '番号库 · 独立页'; } catch (e) {}
            // document-start 起隐藏站点、显示加载中
            injectStandaloneCover();
        }
        THEME.apply(THEME.get());
        CODE_LIBRARY.init();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => main());
        } else {
            main();
        }
        setupSyncListeners();
        bootPanel();
    }

    initialize();
})();
