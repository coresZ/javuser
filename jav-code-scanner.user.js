// ==UserScript==
// @name         通用番号扫描 & 多源搜索
// @namespace    http://tampermonkey.net/
// @version      1.5.47
// @description  扫描页面番号、多源搜索；字幕/原名下载；页面高亮可配置；新标签/本页预览；iframe 白名单；CBox 轻量高亮；DMM CID；快捷键/主题；全站备份(WebDAV可加密)；window.JavCodeKit
// @author       You
// @include      *://*jav*/*
// @include      https://btnets.net/*
// @include      *://*av*/*
// @include      *://*fc2*/*
// @include      *://*missav*/*
// @include      *://*javdb*/*
// @include      *://*javlibrary*/*
// @include      *://*dmm.co.jp/*
// @include      *://*dmm.com/*
// @include      *://*heyzo*/*
// @include      *://*caribbeancom*/*
// @include      *://*1pondo*/*
// @include      *://*pacopaco*/*
// @include      *://*xvideos*/*
// @include      *://*pornhub*/*
// @include      *://*xhamster*/*
// @include      *://*reddit.com/*
// @include      *://*redditmedia.com/*
// @include      *://*t66y.com/*
// @include      *://*sis001.com/*
// @include      *://*cl*forum*/*
// @include      *://*91porn*/*
// @include      *://*jable*/*
// @include      *://*avple*/*
// @include      *://*.cbox.ws/*
// @include      *://cbox.ws/*
// @include      *://my.cbox.ws/*
// @exclude      *://localhost/*
// @exclude      *://127.0.0.1/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        unsafeWindow
// @connect      api-shoulei-ssl.xunlei.com
// @connect      subtitle.v.geilijiasu.com
// @connect      *
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const _pageWin = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
    if (_pageWin.JavCodeKit && _pageWin.JavCodeKit.__ready) return;

    const NS = 'jcs';
    const STYLE_VER = '1.5.47';
    const SCRIPT_VER = '1.5.47';
    const IS_CBOX = /(^|\.)cbox\.ws$/i.test(location.hostname || '');
    const CBOX_MSG_SOURCE = 'jcs-cbox';
    const ENC_MARK = 'jcs-aes-gcm-v1';
    const CONFIG_BUNDLE_VER = 3;
    const PROVIDERS_KEY = 'jcs_providers_v1';
    const PROVIDER_KEY = 'jcs_provider_active_v1';
    const HIST_KEY = 'jcs_hist_v1';
    const PANEL_KEY = 'jcs_panel_layout_v1';
    const FAB_POS_KEY = 'jcs_fab_pos_v1';
    const THEME_KEY = 'jcs_theme_v1';
    const FRAME_BLOCK_KEY = 'jcs_frame_block_hosts_v1';
    const FRAME_ALLOW_KEY = 'jcs_frame_allow_hosts_v1';
    const EXT_MODE_KEY = 'jcs_prefer_ext_hosts_v1';
    const HL_OPT_KEY = 'jcs_hl_opts_v1';
    const SUB_OPT_KEY = 'jcs_sub_filename_v1';
    const SUB_HIST_KEY = 'jcs_sub_hist_v1';
    /** 各站点专属设置总表（hostname → 规则），与全局设置一起导出 */
    const SITES_KEY = 'jcs_sites_map_v1';
    /** WebDAV 备份（账号密码仅存脚本级存储，不写入导出 JSON） */
    const WEBDAV_KEY = 'jcs_webdav_v1';
    const WEBDAV_DEFAULT_FILE = 'jcs-config.json';
    /** 脚本级配置键（跨站点共享；优先 GM 存储） */
    const STORE_KEYS = [
        PROVIDERS_KEY, PROVIDER_KEY, HIST_KEY, PANEL_KEY, FAB_POS_KEY, THEME_KEY,
        FRAME_BLOCK_KEY, FRAME_ALLOW_KEY, EXT_MODE_KEY, HL_OPT_KEY, SUB_OPT_KEY, SUB_HIST_KEY,
        SITES_KEY, WEBDAV_KEY
    ];

    /**
     * 跨站脚本存储：GM_* 全脚本共享；无 GM 时回退 localStorage
     * 读取时若 GM 空而本站 localStorage 有值 → 自动迁入 GM
     */
    const _gmGet = (typeof GM_getValue === 'function') ? GM_getValue : null;
    const _gmSet = (typeof GM_setValue === 'function') ? GM_setValue : null;
    const _gmDel = (typeof GM_deleteValue === 'function') ? GM_deleteValue : null;
    const HAS_GM_STORE = !!( _gmGet && _gmSet );

    function storeGetRaw(key) {
        if (HAS_GM_STORE) {
            try {
                const v = _gmGet(key, undefined);
                if (v !== undefined && v !== null && v !== '') {
                    return typeof v === 'string' ? v : String(v);
                }
            } catch (e) { /* ignore */ }
        }
        try {
            const ls = localStorage.getItem(key);
            if (ls != null && ls !== '') {
                if (HAS_GM_STORE) {
                    try { _gmSet(key, ls); } catch (e2) { /* ignore */ }
                }
                return ls;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function storeSetRaw(key, value) {
        const s = value == null ? '' : String(value);
        if (HAS_GM_STORE) {
            try { _gmSet(key, s); } catch (e) { /* ignore */ }
        }
        try {
            if (s === '') localStorage.removeItem(key);
            else localStorage.setItem(key, s);
        } catch (e) { /* ignore */ }
    }

    function storeRemove(key) {
        if (_gmDel) {
            try { _gmDel(key); } catch (e) { /* ignore */ }
        } else if (HAS_GM_STORE) {
            try { _gmSet(key, ''); } catch (e) { /* ignore */ }
        }
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }

    function storeGetJson(key, fallback) {
        const raw = storeGetRaw(key);
        if (raw == null || raw === '') return fallback;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function storeSetJson(key, value) {
        try {
            storeSetRaw(key, JSON.stringify(value));
        } catch (e) { /* ignore */ }
    }

    function storeGetStr(key, fallback) {
        const raw = storeGetRaw(key);
        return raw == null || raw === '' ? fallback : raw;
    }

    /** 只读本站 localStorage（不触发迁入），用于合并遗留数据 */
    function lsPeekRaw(key) {
        try {
            const v = localStorage.getItem(key);
            return v == null || v === '' ? null : v;
        } catch (e) {
            return null;
        }
    }

    function lsPeekJson(key, fallback) {
        const raw = lsPeekRaw(key);
        if (raw == null) return fallback;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function normalizeHostList(arr) {
        if (!Array.isArray(arr)) return [];
        const seen = Object.create(null);
        const out = [];
        arr.forEach((h) => {
            const k = String(h || '').toLowerCase().trim();
            if (!k || seen[k]) return;
            seen[k] = 1;
            out.push(k);
        });
        return out;
    }

    function mergeHostLists(cur, incoming, replace) {
        const a = normalizeHostList(cur);
        const b = normalizeHostList(incoming);
        if (replace) return b;
        const seen = Object.create(null);
        const out = [];
        a.concat(b).forEach((h) => {
            if (seen[h]) return;
            seen[h] = 1;
            out.push(h);
        });
        return out;
    }

    /**
     * 把「本站 localStorage 遗留」合并进脚本级 GM 存储
     * 这样曾在各站分别改过的打开方式/框架名单，会在浏览时逐步汇入总表
     */
    function mergeLegacyLocalIntoGlobalStore() {
        if (!HAS_GM_STORE) return;
        const hostKeys = [FRAME_ALLOW_KEY, FRAME_BLOCK_KEY, EXT_MODE_KEY];
        hostKeys.forEach((key) => {
            const fromLs = normalizeHostList(lsPeekJson(key, []));
            if (!fromLs.length) return;
            const fromGm = normalizeHostList(storeGetJson(key, []));
            const merged = mergeHostLists(fromGm, fromLs, false);
            if (merged.length !== fromGm.length || merged.some((h, i) => h !== fromGm[i])) {
                storeSetJson(key, merged);
            }
        });
        // 本站若有自定义搜索源而 GM 尚无 → 迁入
        try {
            const gmP = storeGetJson(PROVIDERS_KEY, null);
            const lsP = lsPeekJson(PROVIDERS_KEY, null);
            if ((!gmP || !Array.isArray(gmP) || !gmP.length) && Array.isArray(lsP) && lsP.length) {
                storeSetJson(PROVIDERS_KEY, lsP);
            }
        } catch (e) { /* ignore */ }
        // 其它全局键：GM 空则用本站 LS 填充
        [THEME_KEY, PROVIDER_KEY, HL_OPT_KEY, SUB_OPT_KEY, HIST_KEY, SUB_HIST_KEY, PANEL_KEY, FAB_POS_KEY].forEach((key) => {
            try {
                let gmHas = false;
                if (_gmGet) {
                    const v = _gmGet(key, undefined);
                    gmHas = v !== undefined && v !== null && v !== '';
                }
                if (gmHas) return;
                const ls = lsPeekRaw(key);
                if (ls != null) storeSetRaw(key, ls);
            } catch (e) { /* ignore */ }
        });
    }

    function loadSitesMap() {
        const raw = storeGetJson(SITES_KEY, null);
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
        return Object.create(null);
    }

    function saveSitesMap(map) {
        const clean = Object.create(null);
        Object.keys(map || {}).forEach((h) => {
            const k = String(h || '').toLowerCase().trim();
            if (!k || !map[h] || typeof map[h] !== 'object') return;
            clean[k] = map[h];
        });
        if (Object.keys(clean).length) storeSetJson(SITES_KEY, clean);
        else storeRemove(SITES_KEY);
        return clean;
    }

    /** 从三类域名名单 + sites 表重建「全部站点」视图 */
    function buildAllSitesSnapshot() {
        const sites = loadSitesMap();
        const ensure = (host) => {
            const h = String(host || '').toLowerCase().trim();
            if (!h) return null;
            if (!sites[h] || typeof sites[h] !== 'object') {
                sites[h] = { host: h };
            } else {
                sites[h].host = h;
            }
            return sites[h];
        };
        normalizeHostList(storeGetJson(EXT_MODE_KEY, [])).forEach((h) => {
            const s = ensure(h);
            if (s) s.preferExternal = true;
        });
        normalizeHostList(storeGetJson(FRAME_ALLOW_KEY, [])).forEach((h) => {
            const s = ensure(h);
            if (s) s.frameAllow = true;
        });
        normalizeHostList(storeGetJson(FRAME_BLOCK_KEY, [])).forEach((h) => {
            const s = ensure(h);
            if (s) s.frameBlock = true;
        });
        // 当前站也记一笔，方便备份里能看到「刚改过的站」
        const cur = String(location.hostname || '').toLowerCase();
        if (cur) {
            const s = ensure(cur);
            if (s) {
                s.preferExternal = !!s.preferExternal ||
                    normalizeHostList(storeGetJson(EXT_MODE_KEY, [])).indexOf(cur) >= 0;
                s.frameAllow = !!s.frameAllow ||
                    normalizeHostList(storeGetJson(FRAME_ALLOW_KEY, [])).indexOf(cur) >= 0;
                s.frameBlock = !!s.frameBlock ||
                    normalizeHostList(storeGetJson(FRAME_BLOCK_KEY, [])).indexOf(cur) >= 0;
                // 自定义选择器按站导出
                if (Object.prototype.hasOwnProperty.call(s, 'hlSelectors')) {
                    s.hlSelectors = String(s.hlSelectors || '');
                } else {
                    try {
                        const eff = String((state.hl && state.hl.nativeSelectors) || '');
                        if (eff) s.hlSelectors = eff;
                    } catch (e) { /* ignore */ }
                }
                s.lastSeenAt = new Date().toISOString();
            }
        }
        saveSitesMap(sites);
        return sites;
    }

    function currentHostname() {
        return String(location.hostname || '').toLowerCase().trim();
    }

    /** 读某站自定义选择器；无键则 null（可回落旧全局） */
    function getSiteHlSelectors(host) {
        const h = String(host || currentHostname() || '').toLowerCase().trim();
        if (!h) return null;
        try {
            const map = loadSitesMap();
            const row = map[h];
            if (row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, 'hlSelectors')) {
                return String(row.hlSelectors || '');
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    /** 写入当前（或指定）站的自定义选择器；仅影响该 hostname */
    function setSiteHlSelectors(text, host) {
        const h = String(host || currentHostname() || '').toLowerCase().trim();
        if (!h) return '';
        const val = String(text || '');
        try {
            const map = loadSitesMap();
            const row = map[h] && typeof map[h] === 'object' ? map[h] : { host: h };
            row.host = h;
            row.hlSelectors = val;
            row.updatedAt = new Date().toISOString();
            map[h] = row;
            saveSitesMap(map);
        } catch (e) { /* ignore */ }
        return val;
    }

    function clearSiteHlSelectors(host) {
        const h = String(host || currentHostname() || '').toLowerCase().trim();
        if (!h) return;
        try {
            const map = loadSitesMap();
            if (!map[h] || typeof map[h] !== 'object') return;
            delete map[h].hlSelectors;
            map[h].updatedAt = new Date().toISOString();
            saveSitesMap(map);
        } catch (e) { /* ignore */ }
    }

    function applySitesSnapshot(sitesObj, replace) {
        if (!sitesObj || typeof sitesObj !== 'object') return;
        const curMap = replace ? Object.create(null) : loadSitesMap();
        const ext = replace ? [] : normalizeHostList(storeGetJson(EXT_MODE_KEY, []));
        const fa = replace ? [] : normalizeHostList(storeGetJson(FRAME_ALLOW_KEY, []));
        const fb = replace ? [] : normalizeHostList(storeGetJson(FRAME_BLOCK_KEY, []));
        const extSet = Object.create(null);
        const faSet = Object.create(null);
        const fbSet = Object.create(null);
        ext.forEach((h) => { extSet[h] = 1; });
        fa.forEach((h) => { faSet[h] = 1; });
        fb.forEach((h) => { fbSet[h] = 1; });

        Object.keys(sitesObj).forEach((host) => {
            const h = String(host || '').toLowerCase().trim();
            const row = sitesObj[host];
            if (!h || !row || typeof row !== 'object') return;
            curMap[h] = Object.assign({}, curMap[h] || { host: h }, row, { host: h });
            if (row.preferExternal) extSet[h] = 1;
            else if (replace && row.preferExternal === false) delete extSet[h];
            if (row.frameAllow) faSet[h] = 1;
            else if (replace && row.frameAllow === false) delete faSet[h];
            if (row.frameBlock) fbSet[h] = 1;
            else if (replace && row.frameBlock === false) delete fbSet[h];
        });

        saveSitesMap(curMap);
        const extList = Object.keys(extSet);
        const faList = Object.keys(faSet);
        const fbList = Object.keys(fbSet);
        if (extList.length) storeSetJson(EXT_MODE_KEY, extList);
        else if (replace) storeRemove(EXT_MODE_KEY);
        if (faList.length) storeSetJson(FRAME_ALLOW_KEY, faList);
        else if (replace) storeRemove(FRAME_ALLOW_KEY);
        if (fbList.length) storeSetJson(FRAME_BLOCK_KEY, fbList);
        else if (replace) storeRemove(FRAME_BLOCK_KEY);
    }

    function countSitesInSnapshot(sites) {
        if (!sites || typeof sites !== 'object') return 0;
        return Object.keys(sites).filter((k) => k && sites[k]).length;
    }
    const SUBTITLE_API = 'https://api-shoulei-ssl.xunlei.com/oracle/subtitle';

    /** 内置「链接/卡片」增强选择器（用户自定义另走 scoped 扫文字逻辑） */
    const DEFAULT_NATIVE_LINK_SELS = [
        '.data h3 a[href]',
        'article.item .data a[href], article.movies .data a[href], article.item h3 a[href]',
        'h3 a[href*="/jav/"], a[href*="/jav/"], a[href*="/video/"], a[href*="/movie/"]',
        'h3 a[href*="htm_data"], h3 a[href*="read.php"], h3 a[id^="t"]',
        'a.movie-box'
    ].join(', ');

    const DEFAULT_HL_OPTS = {
        enabled: true,
        textNodes: true,
        nativeLinks: true,
        autoOnScan: true,
        nativeSelectors: ''
    };

    /**
     * 允许在 iframe 内运行的默认域名（不含 @noframes 后的白名单）
     * 仅匹配 hostname；子域可用父域（如 dmm.co.jp 含 www.dmm.co.jp）
     * 更多站点可在配置里勾选「允许本站在 iframe 内运行」写入本地
     */
    const DEFAULT_FRAME_ALLOW_HOSTS = [
        // 'video.dmm.co.jp',
        // 'www.javlibrary.com',
    ];

    function isInIframe() {
        try {
            return window.top !== window.self;
        } catch (e) {
            return true; // 跨域 iframe 访问 top 会抛错
        }
    }

    function hostMatchesPattern(host, pattern) {
        const h = String(host || '').toLowerCase();
        const p = String(pattern || '').toLowerCase().replace(/^\*\./, '').replace(/^\./, '');
        if (!h || !p) return false;
        return h === p || h.endsWith('.' + p);
    }

    // 启动时把本站遗留配置并入脚本总库（不覆盖其它站已有数据）
    try { mergeLegacyLocalIntoGlobalStore(); } catch (e) { /* ignore */ }

    function loadFrameAllowHosts() {
        let extra = [];
        try {
            const arr = storeGetJson(FRAME_ALLOW_KEY, []);
            if (Array.isArray(arr)) extra = arr.filter((x) => typeof x === 'string' && x);
        } catch (e) { /* ignore */ }
        const seen = Object.create(null);
        const out = [];
        DEFAULT_FRAME_ALLOW_HOSTS.concat(extra).forEach((h) => {
            const k = String(h || '').toLowerCase();
            if (!k || seen[k]) return;
            seen[k] = 1;
            out.push(k);
        });
        return out;
    }

    function isFrameAllowHost(host) {
        const h = String(host || location.hostname || '').toLowerCase();
        if (!h) return false;
        return loadFrameAllowHosts().some((p) => hostMatchesPattern(h, p));
    }

    function setFrameAllowHost(on, host) {
        const h = String(host || location.hostname || '').toLowerCase();
        if (!h) return;
        let list = [];
        try {
            const arr = storeGetJson(FRAME_ALLOW_KEY, []);
            if (Array.isArray(arr)) list = arr.filter((x) => typeof x === 'string' && x);
        } catch (e) { /* ignore */ }
        const has = list.some((p) => p.toLowerCase() === h);
        if (on && !has) list.push(h);
        if (!on && has) list = list.filter((p) => p.toLowerCase() !== h);
        if (list.length) storeSetJson(FRAME_ALLOW_KEY, list);
        else storeRemove(FRAME_ALLOW_KEY);
        try {
            const map = loadSitesMap();
            const row = map[h] || { host: h };
            row.host = h;
            row.frameAllow = !!on;
            row.updatedAt = new Date().toISOString();
            map[h] = row;
            saveSitesMap(map);
        } catch (e) { /* ignore */ }
    }

    // 非白名单站点：仍不在 iframe 内运行（等价于按站开放的 @noframes）
    // CBox 走独立轻量路径，不依赖 frame 白名单
    const _inFrame = isInIframe();
    if (_inFrame && !IS_CBOX && !isFrameAllowHost()) return;

    const CODE_BLACKLIST = [
        'PAGE', 'PART', 'VOL', 'EP', 'EPISODE', 'VIDEO', 'CHAPTER', 'ACT', 'NO', 'NUM', 'ITEM',
        'HTTP', 'HTTPS', 'WWW', 'HTML', 'COM', 'CBOX', 'MSG', 'SEC', 'BOX', 'PHP', 'IDX', 'UTC',
        'GMT', 'CSS', 'PNG', 'JPG', 'JPEG', 'WEBP', 'JSON', 'XML', 'API', 'CDN', 'APP', 'IOS',
        'DMCA', 'AIS', 'NJAV', 'REF', 'ORD', 'PST', 'LIST', 'BEST', 'SORT', 'VIEW',
        // 画质 / 容器 / 网页常见伪前缀（HD 720、FHD 1080 等）
        // 注意：START/TOP/HOT 等是真实厂牌前缀，不可进黑名单（t66y 常见 START-614）
        'HD', 'FHD', 'UHD', 'QHD', 'SD', 'HQ', 'LQ', 'HDR', 'SDR', 'FPS', 'BIT', 'KBPS', 'MBPS',
        'RES', 'RESX', 'SIZE', 'WIDTH', 'HEIGHT', 'RATE', 'HREF', 'SRC', 'URL', 'URI', 'PATH',
        'ID', 'OK', 'NG', 'YES', 'TRUE', 'FALSE', 'NULL', 'VAR', 'LET', 'GET', 'SET', 'PUT',
        'POST', 'HEAD', 'PATCH', 'AUTH', 'TOKEN', 'KEY', 'TYPE', 'MODE', 'LANG', 'LOCALE',
        'YEAR', 'DATE', 'TIME', 'WEEK', 'DAY', 'HOUR', 'MIN', 'MAX', 'MINI', 'FULL', 'FREE',
        'OLD', 'VIP', 'VIPD', 'ALL', 'END', 'OPEN', 'CLOSE', 'SHOW',
        'HIDE', 'NEXT', 'PREV', 'BACK', 'HOME', 'MENU', 'NAV', 'TAB', 'TAG', 'CAT', 'ROW',
        'COL', 'IMG', 'PIC', 'ICON', 'LOGO', 'BANNER', 'THUMB', 'COVER', 'POSTER', 'TRAILER',
        'SAMPLE', 'DEMO', 'TEST', 'DEBUG', 'ERROR', 'WARN', 'INFO', 'LOG', 'VER', 'VERSION',
        'BUILD', 'RELEASE', 'BETA', 'ALPHA', 'RC', 'GA', 'OS', 'WIN', 'MAC', 'AND', 'LINUX',
        'CHROME', 'FIREFOX', 'SAFARI', 'EDGE', 'IE', 'TV', 'CM', 'AD', 'ADS', 'ED',
        'OP', 'PV', 'MV', 'BV', 'AM', 'PM', 'AMPM', 'KB', 'MB', 'GB', 'TB', 'PX', 'EM', 'REM',
        'PT', 'PC', 'DPI', 'P', 'K', 'X', 'H', 'W', 'VR',
        // 论坛/草榴常见噪声
        'FID', 'TID', 'PID', 'UID', 'RID', 'SID', 'WWG', 'VONDER', 'READ', 'THREAD', 'NOTICE',
        'CLICK', 'REPLY', 'FLOOR', 'ADMIN', 'GUEST', 'USER', 'LOGIN', 'REG', 'SEARCH'
    ];
    // 分辨率 / 常见伪编号：与画质前缀组合时一律丢弃；单独出现也不当番号数字
    const CODE_NUM_BLACKLIST = {
        '144': 1, '240': 1, '360': 1, '480': 1, '720': 1, '1080': 1, '1440': 1,
        '2160': 1, '4320': 1, '160': 1, '180': 1, '270': 1, '540': 1, '900': 1,
        '1200': 1, '1600': 1, '1920': 1, '2560': 1, '3840': 1, '4096': 1, '7680': 1
    };
    // 仅当 maker 为画质类时，再按分辨率数字拦截（避免误杀 IPX-720 等真番号）
    const QUALITY_MAKERS = {
        HD: 1, FHD: 1, UHD: 1, QHD: 1, SD: 1, HQ: 1, LQ: 1, HDR: 1, SDR: 1,
        FPS: 1, VR: 1, P: 1, K: 1, X: 1, RES: 1, BIT: 1
    };
    // 含连字符 / 空格，以及 DMM 紧凑 CID：SSIS00123、ssis00123；数字最多 6 位（NHDTC-22701 等）
    const CODE_FIND_RE = /\b(FC2[-_\s]?(?:PPV[-_\s]?)?\d{5,7}|HEYZO[-_\s]?\d{4,5}|[A-Z]{2,10}[-_\s]?\d{2,6}|[A-Z]{2,10}0+\d{2,6}|\d{0,3}[A-Z]{2,10}0+\d{2,6})\b/gi;

    const DEFAULT_PROVIDERS = [
        { id: 'cili', name: '1cili', hint: '磁力搜索', url: 'https://1cili.com/search?q={code}' },
        { id: 'av123', name: '123AV', hint: '在线播放', url: 'https://123av.com/cn/v/{code_lower}' },
        { id: 'jable', name: 'Jable', hint: '在线播放', url: 'https://jable.tv/search/{code}/' },
        { id: 'javdb', name: 'JavDB', hint: '数据库搜索', url: 'https://javdb.com/search?q={code}', mode: 'fetch' }
    ];

    const SKIP_SEL = '#' + NS + '-host,#' + NS + '-panel,#' + NS + '-popup,#' + NS + '-pick,#' + NS + '-sub,script,style,noscript,textarea,input,select,option,code,pre,[contenteditable="true"]';

    let providersCache = null;
    let toastTimer = null;
    let subBusy = false;
    let subReqSeq = 0;
    let subLastData = null;
    let subLastTerm = '';
    const state = {
        codes: [],
        active: '',
        provider: '',
        theme: 'dark',
        viewed: Object.create(null),
        linkifyBusy: false,
        scrollLocked: false,
        scrollY: 0,
        frameUrl: '',
        frameWatch: 0,
        pickAnchor: null,
        pickRect: null,
        pickCloseTimer: 0,
        pickPosRaf: 0,
        subUseOriginalName: true,
        inFrame: !!_inFrame,
        // 顶层已有完整 UI 时，iframe 内只做高亮，避免双浮钮
        embedLite: false,
        hl: Object.assign({}, DEFAULT_HL_OPTS),
        cfgTab: 'general',
        cfgEditId: '',
        cfgDeleteId: '',
        cfgFlashId: '',
        cfgFrameDirty: false,
        cfgFramePrev: null
    };
    if (state.inFrame && !IS_CBOX) {
        try {
            if (window.top && window.top.JavCodeKit && window.top.JavCodeKit.__ready) {
                state.embedLite = true;
            }
        } catch (e) { /* 跨域：完整 UI 跑在本 frame */ }
    }

    function isMobile() {
        return window.matchMedia('(max-width: 820px), (pointer: coarse) and (max-width: 1024px)').matches
            || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    }

    function loadTheme() {
        try {
            const t = storeGetStr(THEME_KEY, '');
            if (t === 'light' || t === 'dark') return t;
        } catch (e) { /* ignore */ }
        try {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
        } catch (e) { /* ignore */ }
        return 'dark';
    }

    function applyTheme(theme) {
        const t = theme === 'light' ? 'light' : 'dark';
        state.theme = t;
        const host = document.getElementById(NS + '-host');
        if (host) {
            host.setAttribute('data-theme', t);
            host.style.colorScheme = t;
        }
        // 页面内 jcs-link 跟随主题；面板以 host[data-theme] 为准
        document.documentElement.setAttribute('data-jcs-theme', t);
        const btns = document.querySelectorAll(
            '#' + NS + '-theme-btn, #' + NS + '-ptheme, #' + NS + '-sub-theme'
        );
        btns.forEach((btn) => {
            btn.textContent = t === 'light' ? '☾' : '☀';
            btn.title = t === 'light' ? '切换深色' : '切换浅色';
            btn.setAttribute('aria-label', btn.title);
        });
    }

    function setTheme(theme) {
        const t = theme === 'light' ? 'light' : 'dark';
        storeSetRaw(THEME_KEY, t);
        applyTheme(t);
    }

    function toggleTheme() {
        setTheme(state.theme === 'light' ? 'dark' : 'light');
    }

    function isTypingTarget(el) {
        if (!el || el === document.body) return false;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (el.isContentEditable) return true;
        return !!(el.closest && el.closest('input,textarea,select,[contenteditable="true"]'));
    }

    function showToast(msg) {
        injectStyles();
        let el = document.getElementById(NS + '-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = NS + '-toast';
            el.setAttribute('role', 'status');
            mountUI(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
    }

    function copyText(text) {
        const str = String(text || '').trim();
        if (!str) return Promise.resolve(false);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(str).then(() => true).catch(() => copyTextFallback(str));
        }
        return Promise.resolve(copyTextFallback(str));
    }

    function copyTextFallback(str) {
        try {
            const ta = document.createElement('textarea');
            ta.value = str;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return !!ok;
        } catch (e) {
            return false;
        }
    }

    function copyCode(code) {
        const c = String(code || '').trim().toUpperCase();
        if (!c) return;
        copyText(c).then((ok) => {
            showToast(ok ? ('已复制 ' + c) : ('复制失败 ' + c));
        });
    }

    function chipTitleText(opts) {
        const o = opts || {};
        if (o.title) return o.title;
        return preferExternalSearch()
            ? '点击：选搜索网站（新标签打开）· Alt+点击：复制'
            : '点击：复制 · 双击：在本页打开搜索';
    }

    function bindChipCopy(btn, opts) {
        if (!btn || btn.dataset.jcsChipBound === '1') return;
        btn.dataset.jcsChipBound = '1';
        const o = opts || {};
        btn.title = chipTitleText(o);
        btn.addEventListener('click', (e) => {
            const code = btn.getAttribute('data-code') || '';
            if (!code) return;
            const ext = preferExternalSearch();
            if (e.altKey || e.metaKey || e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                if (ext) copyCode(code);
                else openSearch(code, { anchor: btn, forceFull: true });
                return;
            }
            if (ext) {
                e.preventDefault();
                e.stopPropagation();
                if (e.detail > 1) return;
                openSearch(code, { anchor: btn });
                return;
            }
            // 双击的第二次 click 跳过，避免连弹两次 toast
            if (e.detail > 1) return;
            e.preventDefault();
            copyCode(code);
        });
        btn.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const code = btn.getAttribute('data-code') || '';
            if (!code) return;
            if (preferExternalSearch()) copyCode(code);
            else openSearch(code, { anchor: btn, forceFull: true });
        });
    }

    function openPanelAndFocusSearch() {
        ensurePanel();
        applyTheme(state.theme || loadTheme());
        const panel = document.getElementById(NS + '-panel');
        if (!panel) return;
        panel.classList.add('show');
        if (isMobile()) {
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = '';
            panel.style.bottom = '';
            panel.style.width = '';
            panel.style.height = '';
        }
        refreshScan();
        const q = document.getElementById(NS + '-q');
        if (q) {
            q.focus();
            q.select && q.select();
        }
    }

    /** 恢复搜索大窗居中（清掉拖拽留下的 fixed/left/top 与 flex 左上对齐） */
    function resetSearchWinLayout() {
        const root = document.getElementById(NS + '-popup');
        if (!root) return;
        const win = root.querySelector('#' + NS + '-win');
        if (win) {
            win.style.left = '';
            win.style.top = '';
            win.style.right = '';
            win.style.bottom = '';
            win.style.width = '';
            win.style.height = '';
            win.style.position = '';
            win.style.margin = '';
        }
        root.style.alignItems = '';
        root.style.justifyContent = '';
    }

    function closeSearchPopup() {
        const root = document.getElementById(NS + '-popup');
        if (!root || !root.classList.contains('show')) return;
        root.classList.remove('show');
        document.documentElement.classList.remove(NS + '-popup-open');
        resetSearchWinLayout();
        // 字幕层仍开着时保持锁滚
        if (!isSubtitleOpen()) lockBodyScroll(false);
        const frame = root.querySelector('#' + NS + '-frame');
        try { if (frame) frame.src = 'about:blank'; } catch (e) { /* ignore */ }
        const fetchBox = root.querySelector('#' + NS + '-fetch');
        if (fetchBox) fetchBox.hidden = true;
    }

    function bindGlobalHotkeys() {
        if (bindGlobalHotkeys._bound) return;
        bindGlobalHotkeys._bound = true;
        document.addEventListener('keydown', (e) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;

            // Esc：由上到下关层（输入框内也可用）
            if (e.key === 'Escape') {
                if (isSelectorPickActive()) {
                    e.preventDefault();
                    e.stopPropagation();
                    stopSelectorPick({ restore: true, toast: '已取消点选' });
                    return;
                }
                if (isSubtitleOpen()) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeSubtitleModal();
                    return;
                }
                if (isPickerOpen()) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeProviderPicker();
                    return;
                }
                const popup = document.getElementById(NS + '-popup');
                const popupOpen = !!(popup && popup.classList.contains('show'));
                if (popupOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    const cfg = document.getElementById(NS + '-cfg');
                    if (cfg && cfg.classList.contains('show')) {
                        // 编辑/删除确认中：Esc 先取消操作，不直接关设置
                        if (state.cfgEditId) {
                            clearConfigForm({ focus: false, toast: '已取消编辑' });
                            return;
                        }
                        if (state.cfgDeleteId) {
                            state.cfgDeleteId = '';
                            renderConfigList();
                            showToast('已取消删除');
                            return;
                        }
                        toggleConfig(false);
                    } else closeSearchPopup();
                    return;
                }
                if (isTypingTarget(e.target)) return;
                const panel = document.getElementById(NS + '-panel');
                if (panel && panel.classList.contains('show')) {
                    e.preventDefault();
                    panel.classList.remove('show');
                }
                return;
            }

            if (isTypingTarget(e.target)) return;

            const popup = document.getElementById(NS + '-popup');
            const popupOpen = !!(popup && popup.classList.contains('show'));

            if (e.key === '/' || e.key === 'j' || e.key === 'J') {
                e.preventDefault();
                if (popupOpen) {
                    const pin = document.getElementById(NS + '-pinput');
                    if (pin) {
                        pin.focus();
                        pin.select && pin.select();
                    }
                } else {
                    openPanelAndFocusSearch();
                }
            }
        }, true);
    }

    /** 挂到 html 下的视口层，避免被 body transform/滚动带走 */
    function ensureHost() {
        let host = document.getElementById(NS + '-host');
        if (host) {
            host.setAttribute('data-theme', state.theme || loadTheme());
            return host;
        }
        host = document.createElement('div');
        host.id = NS + '-host';
        host.setAttribute('data-jcs-host', '1');
        host.setAttribute('data-theme', state.theme || loadTheme());
        (document.documentElement || document.body).appendChild(host);
        syncHostToViewport();
        if (!ensureHost._bound) {
            ensureHost._bound = true;
            const sync = () => syncHostToViewport();
            window.addEventListener('resize', sync, { passive: true });
            window.addEventListener('scroll', sync, { passive: true });
            window.addEventListener('orientationchange', () => setTimeout(sync, 120), { passive: true });
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', sync, { passive: true });
                window.visualViewport.addEventListener('scroll', sync, { passive: true });
            }
        }
        return host;
    }

    function syncHostToViewport() {
        const host = document.getElementById(NS + '-host');
        if (!host) return;
        const vv = window.visualViewport;
        // 始终贴靠「当前可见屏幕」而非文档流
        host.style.position = 'fixed';
        host.style.zIndex = '2147483000';
        host.style.margin = '0';
        host.style.padding = '0';
        host.style.border = '0';
        host.style.pointerEvents = 'none';
        host.style.overflow = 'visible';
        host.style.transform = 'none';
        host.style.contain = 'none';
        if (vv && isMobile()) {
            host.style.top = Math.round(vv.offsetTop) + 'px';
            host.style.left = Math.round(vv.offsetLeft) + 'px';
            host.style.width = Math.round(vv.width) + 'px';
            host.style.height = Math.round(vv.height) + 'px';
            host.style.right = 'auto';
            host.style.bottom = 'auto';
        } else {
            host.style.top = '0';
            host.style.left = '0';
            host.style.right = '0';
            host.style.bottom = '0';
            host.style.width = '100%';
            host.style.height = '100%';
        }
    }

    function mountUI(el) {
        if (!el) return el;
        const host = ensureHost();
        if (el.parentNode !== host) host.appendChild(el);
        el.style.pointerEvents = 'auto';
        return el;
    }

    /** 挂在 host 下，避免进入设置页滚动容器（站点样式 + file 控件易撑坏 overflow） */
    function ensureImportFileInput() {
        let input = document.getElementById(NS + '-cfg-import-input');
        if (input && input.parentNode) {
            const host = ensureHost();
            if (input.parentNode !== host) host.appendChild(input);
            return input;
        }
        input = document.createElement('input');
        input.type = 'file';
        input.id = NS + '-cfg-import-input';
        input.className = 'jcs-file-hide';
        input.accept = 'application/json,.json,text/plain,.txt';
        input.tabIndex = -1;
        input.setAttribute('aria-hidden', 'true');
        input.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;opacity:0;overflow:hidden;pointer-events:none;border:0;padding:0;margin:0';
        ensureHost().appendChild(input);
        return input;
    }

    function lockBodyScroll(lock) {
        if (lock) {
            if (state.scrollLocked) return;
            state.scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = '-' + state.scrollY + 'px';
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';
            state.scrollLocked = true;
        } else if (state.scrollLocked) {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.width = '';
            window.scrollTo(0, state.scrollY || 0);
            state.scrollLocked = false;
        }
    }

    function bindDrag(el, handle, opts) {
        if (!el || !handle) return;
        const o = opts || {};
        let drag = false, sx, sy, ox, oy, moved = false;
        const onStart = (e) => {
            if (e.type === 'mousedown' && e.button) return;
            if (e.target.closest('button,input,a,select,textarea')) return;
            if (o.disableOnMobile && isMobile()) return;
            const pt = e.touches ? e.touches[0] : e;
            const r = el.getBoundingClientRect();
            if (o.fixedMode) {
                el.style.position = 'fixed';
                el.style.left = r.left + 'px';
                el.style.top = r.top + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
                el.style.margin = '0';
                if (o.setSize) {
                    el.style.width = r.width + 'px';
                    el.style.height = r.height + 'px';
                }
            }
            drag = true; moved = false;
            sx = pt.clientX; sy = pt.clientY; ox = r.left; oy = r.top;
            if (e.cancelable) e.preventDefault();
        };
        const onMove = (e) => {
            if (!drag) return;
            const pt = e.touches ? e.touches[0] : e;
            if (Math.abs(pt.clientX - sx) > 4 || Math.abs(pt.clientY - sy) > 4) moved = true;
            const w = el.offsetWidth || 48;
            const h = el.offsetHeight || 48;
            el.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, ox + pt.clientX - sx)) + 'px';
            el.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, oy + pt.clientY - sy)) + 'px';
            if (e.cancelable && e.touches) e.preventDefault();
        };
        const onEnd = () => {
            if (!drag) return;
            drag = false;
            // 只点了一下没拖：撤销 fixedMode 临时定位，避免窗口粘在错误坐标
            if (!moved && o.fixedMode) {
                el.style.position = '';
                el.style.left = '';
                el.style.top = '';
                el.style.right = '';
                el.style.bottom = '';
                el.style.margin = '';
                if (o.setSize) {
                    el.style.width = '';
                    el.style.height = '';
                }
            }
            if (o.onEnd) o.onEnd(moved);
        };
        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }

    // ─── 番号识别 ───────────────────────────────────────────

    /** 数字段规范化：去前导 0，至少 3 位（074） */
    function formatCodeNum(numStr) {
        let n = String(numStr || '').replace(/\D/g, '');
        if (!n) return '';
        n = String(parseInt(n, 10));
        if (!n || n === 'NaN') return '';
        if (n.length < 3) n = ('000' + n).slice(-3);
        return n;
    }

    /** 厂牌 + 数字是否像真番号（过滤 HD 720 / FHD 1080 / VR 180 等） */
    function isPlausibleCode(maker, numStr) {
        const mk = String(maker || '').toUpperCase();
        if (!mk || mk.length < 2 || mk.length > 10) return false;
        if (CODE_BLACKLIST.indexOf(mk) >= 0) return false;
        const rawNum = String(numStr || '').replace(/\D/g, '');
        if (!rawNum) return false;
        if (rawNum.length > 6) return false;
        const n = String(parseInt(rawNum, 10));
        if (!n || n === 'NaN' || n === '0') return false;
        const nInt = parseInt(n, 10);
        // 画质前缀 + 分辨率数字
        if (QUALITY_MAKERS[mk] && (CODE_NUM_BLACKLIST[n] || CODE_NUM_BLACKLIST[rawNum])) return false;
        // 画质前缀配过小序号基本是噪声（[HD/3.6G] 等）
        if (QUALITY_MAKERS[mk] && nInt < 100) return false;
        // 年份误伤：START 2024 / TOP 2020（真番号 START-614 为三位数）
        if (nInt >= 1900 && nInt <= 2099 && (mk === 'START' || mk === 'TOP' || mk === 'HOT' || mk === 'NEW')) {
            return false;
        }
        // 纯分辨率当数字且厂牌极短可疑：H-720 / P-1080
        if (mk.length <= 1) return false;
        // 无连字符短码过宽：BY555 / WWG101 类（厂牌≤3 且数字≤3 且无前导 0 语境）在 extract 层再收
        return true;
    }

    function makeCode(maker, numStr) {
        if (!isPlausibleCode(maker, numStr)) return '';
        const num = formatCodeNum(numStr);
        if (!num) return '';
        return String(maker).toUpperCase() + '-' + num;
    }

    /**
     * DMM content id → 标准番号
     * 例：ssis00123 → SSIS-123；1sods00074 → SODS-074；h_068mxgs00015 → MXGS-015
     * 参考 dmm列表.user.js 的 id 截取思路，并覆盖更多 CID 形态
     */
    function fromDmmCid(raw) {
        if (!raw) return '';
        let s = String(raw).trim();
        try { s = decodeURIComponent(s); } catch (e) { /* ignore */ }
        s = s.split(/[?#&]/)[0].toLowerCase().replace(/\.html?$/i, '');
        if (!s) return '';

        // 已是标准番号
        const direct = String(raw).toUpperCase().match(/\b([A-Z]{2,10})[-_\s](\d{2,6})\b/);
        if (direct) {
            const code = makeCode(direct[1], direct[2]);
            if (code) return code;
        }

        // 去包装前缀
        s = s.replace(/^h_\d+/i, '');
        s = s.replace(/^(?:cid|content|product)[=_]/i, '');
        // 去常见尺寸/后缀
        s = s.replace(/(?:_s|_m|_l|_w|_sm|_ms|_me|_sc|_bk|_jp)$/i, '');

        // 紧凑：可选店前缀数字 + 厂牌 + 0*数字
        // 1sods00074 / ssis00123 / 118abp00012 / 1start00614（t66y DMM 链）
        let m = s.match(/^(?:\d{1,4})?([a-z]{2,10})0+(\d{2,6})$/i);
        if (m) {
            const code = makeCode(m[1], m[2]);
            if (code) return code;
        }

        // 下划线：ssis_00123
        m = s.match(/^(?:\d{1,4})?([a-z]{2,10})[_-]+0*(\d{2,6})$/i);
        if (m) {
            const code = makeCode(m[1], m[2]);
            if (code) return code;
        }

        // 与 dmm列表脚本一致：末 5 位中前 2 位为 00 时插入 -
        // ssis00123 → ssis-123；1sods00074 → 1sods-074 → 再清前导数字
        if (s.length >= 6) {
            const prefix = s.slice(0, -5);
            const middle = s.slice(-5, -3);
            const suffix = s.slice(-3);
            if (middle === '00' && /^[a-z0-9]+$/i.test(prefix)) {
                const cleaned = (prefix + suffix).replace(/^\d+/, '');
                m = cleaned.match(/^([a-z]{2,10})(\d{2,6})$/i);
                if (m) {
                    const code = makeCode(m[1], m[2]);
                    if (code) return code;
                }
                // prefix 已是厂牌
                m = prefix.match(/^(?:\d{1,4})?([a-z]{2,10})$/i);
                if (m) {
                    const code = makeCode(m[1], suffix);
                    if (code) return code;
                }
            }
        }

        return '';
    }

    function extractJavCode(text) {
        if (!text) return '';
        const raw = String(text).replace(/&amp;/g, '&').trim();
        const clean = raw.toUpperCase();

        let m = clean.match(/\bFC2[-_\s]?(?:PPV[-_\s]?)?(\d{5,7})\b/);
        if (m) return 'FC2-PPV-' + m[1];
        m = clean.match(/\bHEYZO[-_\s]?(\d{4,5})\b/);
        if (m) return 'HEYZO-' + m[1];

        // 标准：SSIS-123 / SSIS 123 / SSIS_123 / START-614（t66y 标题常见）
        m = clean.match(/\b([A-Z]{2,10})[-_\s](\d{2,6})\b/);
        if (m) {
            const code = makeCode(m[1], m[2]);
            if (code) return code;
        }

        // 无分隔：SSIS123（要求数字≥3，降低 BY555 类误报）
        m = clean.match(/\b([A-Z]{2,10})(\d{3,6})\b/);
        if (m) {
            // 极短厂牌+短数字易误报，需厂牌≥3 或数字≥4
            if (m[1].length >= 3 || m[2].length >= 4) {
                const code = makeCode(m[1], m[2]);
                if (code) return code;
            }
        }

        // DMM 紧凑 CID（含前导店码）
        const dmm = fromDmmCid(raw);
        if (dmm) return dmm;

        return '';
    }

    function extractAllJavCodes(text) {
        if (!text) return [];
        const clean = String(text)
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/g, '&')
            .toUpperCase();
        const out = [];
        const seen = Object.create(null);
        CODE_FIND_RE.lastIndex = 0;
        let m;
        while ((m = CODE_FIND_RE.exec(clean))) {
            const code = extractJavCode(m[0]);
            if (code && !seen[code]) {
                seen[code] = 1;
                out.push(code);
            }
        }
        // 再扫一遍原始串里的 dmm cid（小写路径）
        const raw = String(text);
        const cidRe = /(?:^|[^\w])((?:\d{1,4})?[a-z]{2,10}0+\d{2,5})(?=[^\w]|$)/gi;
        let cm;
        while ((cm = cidRe.exec(raw))) {
            const code = fromDmmCid(cm[1]);
            if (code && !seen[code]) {
                seen[code] = 1;
                out.push(code);
            }
        }
        return out;
    }

    function uniqCodes(list) {
        const out = [];
        const seen = Object.create(null);
        (list || []).forEach((raw) => {
            const c = extractJavCode(raw) || fromDmmCid(raw) || '';
            if (!c || seen[c]) return;
            seen[c] = 1;
            out.push(c);
        });
        return out;
    }

    /** 从 href / data-* / 图片路径提取 DMM id 与番号（列表页核心） */
    function scanAttrCodes() {
        if (!document.body) return [];
        const out = [];
        const seen = Object.create(null);
        const add = (code) => {
            if (!code || seen[code]) return;
            seen[code] = 1;
            out.push(code);
        };
        const addRaw = (raw) => {
            if (!raw) return;
            add(extractJavCode(raw) || fromDmmCid(raw));
        };
        const pickIdFromUrl = (url) => {
            if (!url) return;
            let u = String(url);
            try { u = decodeURIComponent(u); } catch (e) { /* ignore */ }
            let m = u.match(/[?&#](?:id|cid|content_id|product_id)=([a-z0-9_-]+)/i);
            if (m) addRaw(m[1]);
            m = u.match(/\/(?:content|cid)\/([a-z0-9_-]+)/i);
            if (m) addRaw(m[1]);
            // javgg /jav/fns-227/ · 123av /v/ssis-001 等详情路径
            m = u.match(/\/(?:jav|javid|video|videos|movie|movies|watch|detail|item|av|v)\/([a-z0-9][a-z0-9_-]{2,24})(?:\/|$|[?#])/i);
            if (m) addRaw(m[1]);
            m = u.match(/\/([a-z]{2,10}0+\d{2,5})(?:\/|[.?#]|$)/i);
            if (m) addRaw(m[1]);
            m = u.match(/\/((?:\d{1,4})[a-z]{2,10}0+\d{2,5})(?:\/|[.?#]|$)/i);
            if (m) addRaw(m[1]);
            // 整段 href 再兜底（含 SQTE-703 文本路径）
            add(extractJavCode(u) || fromDmmCid(u));
        };

        try {
            // 当前页 URL（详情页）
            pickIdFromUrl(location.href);

            const nodes = document.querySelectorAll(
                'a[href], area[href], [data-id], [data-cid], [data-content-id], [data-product-id], ' +
                '[data-content_id], [data-product_id], img[src], img[data-src], img[data-original], source[srcset]'
            );
            const limit = Math.min(nodes.length, 4000);
            for (let i = 0; i < limit; i++) {
                const el = nodes[i];
                if (el.closest && el.closest('#' + NS + '-host')) continue;
                const href = el.getAttribute('href');
                if (href) pickIdFromUrl(href);
                addRaw(el.getAttribute('data-id'));
                addRaw(el.getAttribute('data-cid'));
                addRaw(el.getAttribute('data-content-id') || el.getAttribute('data-content_id'));
                addRaw(el.getAttribute('data-product-id') || el.getAttribute('data-product_id'));
                const src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original') || '';
                if (src) pickIdFromUrl(src);
                const srcset = el.getAttribute('srcset') || '';
                if (srcset) pickIdFromUrl(srcset);
            }
        } catch (e) { /* ignore */ }
        return out;
    }

    /** 列表站结构化节点优先（javgg .data>h3>a、t66y h3 a、article.item 等） */
    function scanStructuredCodes() {
        if (!document.body) return [];
        const out = [];
        const seen = Object.create(null);
        const add = (raw) => {
            const code = extractJavCode(raw) || fromDmmCid(raw) || '';
            if (!code || seen[code]) return;
            seen[code] = 1;
            out.push(code);
        };
        try {
            const nodes = document.body.querySelectorAll(
                // javgg / 通用卡片
                '.data h3 a[href], .data h3, article.item .data a[href], article.movies .data a[href], ' +
                'article.item h3 a[href], h3 a[href*="/jav/"], a[href*="/jav/"], ' +
                '.poster a[title], a[title], ' +
                // 草榴 t66y：板块列表 h3>a、主题标题、只看该作者等
                'h3 a[href*="htm_data"], h3 a[href*="read.php"], h3 a[id^="t"], ' +
                '#main h3 a, .tpc_content, .tpc_content a[href], ' +
                'tr.tr3 h3 a, tr.tr2 h3 a, span.s3 a, a.bl, ' +
                // 标题里的 DMM 链
                'a[href*="dmm.co.jp"], a[href*="content/?id="], a[href*="cid="]'
            );
            const limit = Math.min(nodes.length, 4000);
            for (let i = 0; i < limit; i++) {
                const el = nodes[i];
                if (el.closest && el.closest('#' + NS + '-host')) continue;
                add(el.textContent || '');
                add(el.getAttribute('title') || '');
                add(el.getAttribute('href') || '');
                // t66y 外链跳转：redircdn.com/?https://video.dmm.co.jp/...id=1start00614
                let href = '';
                try { href = el.getAttribute('href') || el.href || ''; } catch (e) { href = ''; }
                if (href && href.indexOf('http') >= 0) {
                    try {
                        const dec = decodeURIComponent(href);
                        add(dec);
                        const idm = dec.match(/[?&]id=([a-z0-9_]+)/i);
                        if (idm) add(idm[1]);
                    } catch (e) { /* ignore */ }
                }
            }
            // 主题页 document.title：[HD/3.6G] START-614 ...
            add(document.title || '');
        } catch (e) { /* ignore */ }
        return out;
    }

    function scanPageCodes() {
        if (!document.body) return [];
        // 结构化列表优先，保证 javgg featured 等页角标与列表同源
        const structured = scanStructuredCodes();
        let text = (document.title || '') + ' ' + (location.pathname || '') + ' ' + (location.search || '') + ' ' + (location.href || '');
        try {
            const og = document.querySelector('meta[property="og:title"], meta[name="twitter:title"], meta[property="og:url"]');
            if (og) text += ' ' + (og.getAttribute('content') || '');
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    const p = node.parentElement;
                    if (!p) return NodeFilter.FILTER_REJECT;
                    if (p.closest(SKIP_SEL + ',a.' + NS + '-link')) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            let n = 0;
            while (walker.nextNode() && n < 5000) {
                text += ' ' + walker.currentNode.nodeValue;
                n++;
            }
        } catch (e) { /* ignore */ }
        return uniqCodes(structured.concat(extractAllJavCodes(text), scanAttrCodes()));
    }

    // ─── 可配置搜索源 ───────────────────────────────────────

    function normalizeProvider(p, idx) {
        if (!p || typeof p !== 'object') return null;
        const url = String(p.url || p.template || '').trim();
        if (!url) return null;
        const id = String(p.id || '').trim() || ('p' + (idx != null ? idx : Date.now()));
        return {
            id: id,
            name: String(p.name || '').trim() || id,
            hint: String(p.hint || '').trim(),
            url: url,
            mode: p.mode === 'fetch' ? 'fetch' : 'iframe'
        };
    }

    function loadProviders() {
        try {
            const arr = storeGetJson(PROVIDERS_KEY, null);
            if (Array.isArray(arr)) {
                const list = arr.map(normalizeProvider).filter(Boolean);
                if (list.length) return list;
            }
        } catch (e) { /* ignore */ }
        return DEFAULT_PROVIDERS.map((p) => Object.assign({}, p));
    }

    function getProviders() {
        if (!providersCache) providersCache = loadProviders();
        return providersCache;
    }

    function saveProviders(list) {
        const clean = (list || []).map(normalizeProvider).filter(Boolean);
        if (!clean.length) {
            providersCache = DEFAULT_PROVIDERS.map((p) => Object.assign({}, p));
            storeRemove(PROVIDERS_KEY);
            return providersCache;
        }
        providersCache = clean;
        storeSetJson(PROVIDERS_KEY, clean);
        return providersCache;
    }

    function resetProviders() {
        storeRemove(PROVIDERS_KEY);
        providersCache = null;
        return getProviders();
    }

    function getProvider(id) {
        const list = getProviders();
        return list.find((p) => p.id === id) || list[0];
    }

    function loadProviderId() {
        const list = getProviders();
        try {
            const id = storeGetStr(PROVIDER_KEY, '');
            if (id && list.some((p) => p.id === id)) return id;
        } catch (e) { /* ignore */ }
        return list[0] ? list[0].id : 'cili';
    }

    function saveProviderId(id) {
        storeSetRaw(PROVIDER_KEY, id);
    }

    function buildProviderUrl(code, providerId) {
        const p = getProvider(providerId || loadProviderId());
        const raw = String(code || '').trim();
        const upper = raw.toUpperCase();
        const lower = raw.toLowerCase();
        return String(p.url || '')
            .replace(/\{code_lower\}/gi, encodeURIComponent(lower))
            .replace(/\{CODE\}/g, encodeURIComponent(upper))
            .replace(/\{code\}/gi, encodeURIComponent(raw));
    }

    // ─── 历史 ───────────────────────────────────────────────

    function loadHist() {
        try {
            const arr = storeGetJson(HIST_KEY, []);
            return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
        } catch (e) {
            return [];
        }
    }

    function saveHist(code) {
        const c = String(code || '').trim().toUpperCase();
        if (!c) return loadHist();
        let list = loadHist().filter((x) => x.toUpperCase() !== c);
        list.unshift(c);
        if (list.length > 40) list = list.slice(0, 40);
        storeSetJson(HIST_KEY, list);
        return list;
    }

    function clearHist() {
        storeRemove(HIST_KEY);
    }

    // ─── 页面高亮选项（用户可配） ─────────────────────────────

    function normalizeHlOpts(raw) {
        const o = raw && typeof raw === 'object' ? raw : {};
        const sel = typeof o.nativeSelectors === 'string' ? o.nativeSelectors : '';
        return {
            enabled: o.enabled !== false,
            textNodes: o.textNodes !== false,
            nativeLinks: o.nativeLinks !== false,
            autoOnScan: o.autoOnScan !== false,
            nativeSelectors: sel
        };
    }

    /** 全局高亮开关等；nativeSelectors 已改为按站，全局里恒为空串 */
    function hlOptsForGlobalStore(hl) {
        const o = normalizeHlOpts(hl);
        o.nativeSelectors = '';
        return o;
    }

    function loadHlOpts() {
        let base = Object.assign({}, DEFAULT_HL_OPTS);
        try {
            const raw = storeGetJson(HL_OPT_KEY, null);
            if (raw && typeof raw === 'object') {
                base = normalizeHlOpts(raw);
            }
        } catch (e) { /* ignore */ }

        // 自定义选择器：仅当前站。站点无记录时，把旧版全局选择器迁到本站一次
        const host = currentHostname();
        let siteSel = getSiteHlSelectors(host);
        if (siteSel == null && base.nativeSelectors) {
            siteSel = String(base.nativeSelectors || '');
            if (host) setSiteHlSelectors(siteSel, host);
            try {
                storeSetJson(HL_OPT_KEY, hlOptsForGlobalStore(base));
            } catch (e2) { /* ignore */ }
        }
        base.nativeSelectors = siteSel != null ? siteSel : '';
        state.hl = base;
        return state.hl;
    }

    function saveHlOpts() {
        const full = normalizeHlOpts(state.hl);
        const siteSel = String(full.nativeSelectors || '');
        // 开关等仍全局；选择器只写当前站
        storeSetJson(HL_OPT_KEY, hlOptsForGlobalStore(full));
        setSiteHlSelectors(siteSel);
        state.hl = normalizeHlOpts(Object.assign({}, full, { nativeSelectors: siteSel }));
    }

    function setHlOpts(partial, opts) {
        const o = opts || {};
        state.hl = normalizeHlOpts(Object.assign({}, state.hl, partial || {}));
        saveHlOpts();
        if (!o.silent) {
            try { syncHlOptsUi(); } catch (e) { /* ignore */ }
        }
        if (o.reapply) {
            try {
                clearPageHighlight();
                if (state.hl.enabled) linkifyPage();
            } catch (e) { /* ignore */ }
        }
        return state.hl;
    }

    /**
     * 解析用户自定义选择器
     * 互补原则：默认与内置规则合并；首行写 only 或 ! 则仅用自定义
     */
    function parseNativeSelectorInput(raw) {
        const lines = String(raw || '')
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        let mode = 'merge'; // merge | replace
        const parts = [];
        lines.forEach((line, idx) => {
            const low = line.toLowerCase();
            if (idx === 0 && (low === 'only' || low === '!' || low === 'replace')) {
                mode = 'replace';
                return;
            }
            if (/^(only|!|replace)$/i.test(line)) {
                mode = 'replace';
                return;
            }
            parts.push(line);
        });
        return { mode: mode, parts: parts };
    }

    function getCustomSelectorParts() {
        const custom = String((state.hl && state.hl.nativeSelectors) || '').trim();
        if (!custom) return { mode: 'merge', parts: [] };
        return parseNativeSelectorInput(custom);
    }

    function stripCodeMark(el) {
        if (!el) return;
        if (el.tagName === 'SPAN' && el.getAttribute('data-jcs-wrap') === '1') {
            const t = document.createTextNode(el.textContent || '');
            if (el.parentNode) el.parentNode.replaceChild(t, el);
            return;
        }
        el.classList.remove(NS + '-code-mark');
        el.removeAttribute('data-jcs-code');
        el.removeAttribute('data-jcs-mark-bound');
        try { delete el.dataset.jcsMarkBound; } catch (e) { /* ignore */ }
        el.removeAttribute('role');
        el.removeAttribute('tabindex');
        const tip = el.getAttribute('title') || '';
        if (/点击选搜索网站|点击在本页搜索|Alt\+复制|点卡片其他区域/.test(tip)) {
            el.removeAttribute('title');
        }
    }

    /** 清除本页高亮 */
    function clearPageHighlight() {
        if (!document.body) return 0;
        let n = 0;
        try {
            document.body.querySelectorAll('.' + NS + '-code-mark').forEach((el) => {
                stripCodeMark(el);
                n++;
            });
        } catch (e) { /* ignore */ }

        const list = document.body.querySelectorAll('a.' + NS + '-link, a[data-jcs-bound="1"]');
        for (let i = 0; i < list.length; i++) {
            const a = list[i];
            if (!a || !a.parentNode || (a.closest && a.closest('#' + NS + '-host'))) continue;
            try {
                const isScriptNative = a.classList.contains('is-native')
                    || a.getAttribute('data-jcs-card') === '1'
                    || (a.dataset.jcsBound === '1' && !a.classList.contains(NS + '-link'));
                if (isScriptNative) {
                    const neu = a.cloneNode(true);
                    neu.classList.remove(NS + '-link', 'is-native', 'is-native-card', 'is-pick-on');
                    ['jcsBound', 'code', 'jcsCard', 'jcsCardMark'].forEach((k) => {
                        try { delete neu.dataset[k]; } catch (e) { /* ignore */ }
                    });
                    neu.removeAttribute('data-jcs-bound');
                    neu.removeAttribute('data-code');
                    neu.removeAttribute('data-jcs-card');
                    neu.removeAttribute('data-jcs-card-mark');
                    if (neu.getAttribute('aria-label') && /番号/.test(neu.getAttribute('aria-label') || '')) {
                        neu.removeAttribute('aria-label');
                    }
                    const tip = neu.getAttribute('title') || '';
                    if (/点击选搜索网站|点击在本页搜索|Alt\+复制/.test(tip)) neu.removeAttribute('title');
                    try {
                        neu.querySelectorAll('.' + NS + '-code-mark').forEach(stripCodeMark);
                    } catch (e) { /* ignore */ }
                    a.parentNode.replaceChild(neu, a);
                } else if (a.classList.contains(NS + '-link')) {
                    a.parentNode.replaceChild(document.createTextNode(a.textContent || ''), a);
                }
                n++;
            } catch (e) { /* ignore */ }
        }
        return n;
    }

    function syncHlOptsUi() {
        const root = document.getElementById(NS + '-cfg');
        if (!root) return;
        const hl = normalizeHlOpts(state.hl);
        const on = root.querySelector('#' + NS + '-hl-on');
        const text = root.querySelector('#' + NS + '-hl-text');
        const native = root.querySelector('#' + NS + '-hl-native');
        const auto = root.querySelector('#' + NS + '-hl-auto');
        const sel = root.querySelector('#' + NS + '-hl-sel');
        const scope = root.querySelector('#' + NS + '-hl-sel-scope');
        const host = currentHostname() || '当前站点';
        if (on) on.checked = !!hl.enabled;
        if (text) text.checked = !!hl.textNodes;
        if (native) native.checked = !!hl.nativeLinks;
        if (auto) auto.checked = !!hl.autoOnScan;
        if (sel && document.activeElement !== sel) sel.value = hl.nativeSelectors || '';
        if (scope) {
            scope.innerHTML = '仅对 <b>' + escapeHtml(host) + '</b> 生效，其它网站互不影响。';
        }
        const disabled = !hl.enabled;
        [text, native, auto, sel].forEach((el) => {
            if (el) el.disabled = disabled && el !== on;
        });
    }

    function readHlOptsFromUi() {
        const root = document.getElementById(NS + '-cfg');
        if (!root) return normalizeHlOpts(state.hl);
        const on = root.querySelector('#' + NS + '-hl-on');
        const text = root.querySelector('#' + NS + '-hl-text');
        const native = root.querySelector('#' + NS + '-hl-native');
        const auto = root.querySelector('#' + NS + '-hl-auto');
        const sel = root.querySelector('#' + NS + '-hl-sel');
        return normalizeHlOpts({
            enabled: on ? !!on.checked : true,
            textNodes: text ? !!text.checked : true,
            nativeLinks: native ? !!native.checked : true,
            autoOnScan: auto ? !!auto.checked : true,
            nativeSelectors: sel ? String(sel.value || '') : ''
        });
    }

    function applyHlOptsFromUi(reapply) {
        state.hl = readHlOptsFromUi();
        saveHlOpts();
        syncHlOptsUi();
        if (reapply) {
            clearPageHighlight();
            if (state.hl.enabled) {
                linkifyPage();
                const host = currentHostname() || '本站';
                showToast('已应用高亮（选择器仅 ' + host + '）');
            } else {
                showToast('已关闭页面高亮');
            }
        }
    }

    // ─── 自定义选择器：鼠标点选拾取 ─────────────────────────
    let _selPick = null;

    function isSelectorPickActive() {
        return !!_selPick;
    }

    function cssEscapeIdent(s) {
        const t = String(s || '');
        try {
            if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(t);
        } catch (e) { /* ignore */ }
        return t.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    }

    function isStableClassName(c) {
        const s = String(c || '');
        if (!s || s.length < 2 || s.length > 48) return false;
        if (s.indexOf(NS) === 0 || /^jcs[-_]/i.test(s)) return false;
        if (/^(is-|has-|js-|ng-|v-|css-|sc-|sx-|emotion|svelte-|cssmodule)/i.test(s)) return false;
        if (/^(active|hover|focus|selected|current|open|show|hide|hidden|visible|disabled|checked|on|off)$/i.test(s)) return false;
        if (/^[a-f0-9]{8,}$/i.test(s)) return false;
        if (/\d{5,}/.test(s)) return false;
        return /^[a-zA-Z_:-][\w:-]*$/.test(s);
    }

    function isStableId(id) {
        const s = String(id || '');
        if (!s || s.length > 64) return false;
        if (/^(ember|react|vue|ng|app)-/i.test(s)) return false;
        if (/^[a-f0-9-]{12,}$/i.test(s)) return false;
        if (/\d{6,}/.test(s)) return false;
        return /^[a-zA-Z][\w:-]*$/.test(s);
    }

    function countSelectorMatches(sel) {
        try {
            return document.body ? document.body.querySelectorAll(sel).length : 0;
        } catch (e) {
            return -1;
        }
    }

    function pushSelCandidate(list, seen, sel, note) {
        const s = String(sel || '').trim();
        if (!s || seen[s]) return;
        const n = countSelectorMatches(s);
        if (n < 1) return;
        seen[s] = 1;
        list.push({ sel: s, count: n, note: note || '' });
    }

    /** 从元素生成若干可用 CSS 选择器候选（偏列表类，便于扫番号） */
    function buildSelectorCandidates(el) {
        const list = [];
        const seen = Object.create(null);
        if (!el || el.nodeType !== 1 || !el.tagName) return list;
        if (el.closest && el.closest('#' + NS + '-host')) return list;

        const tag = el.tagName.toLowerCase();
        const id = el.id ? String(el.id) : '';
        const classes = Array.prototype.slice.call(el.classList || [])
            .filter(isStableClassName)
            .slice(0, 4);

        if (id && isStableId(id)) {
            pushSelCandidate(list, seen, '#' + cssEscapeIdent(id), 'id');
        }
        if (classes.length) {
            pushSelCandidate(list, seen, '.' + classes.map(cssEscapeIdent).join('.'), 'class');
            pushSelCandidate(list, seen, tag + '.' + classes.map(cssEscapeIdent).join('.'), 'tag+class');
            if (classes[0]) {
                pushSelCandidate(list, seen, '.' + cssEscapeIdent(classes[0]), '主 class');
                pushSelCandidate(list, seen, tag + '.' + cssEscapeIdent(classes[0]), 'tag+主 class');
            }
        } else if (tag && tag !== 'div' && tag !== 'span') {
            pushSelCandidate(list, seen, tag, '标签');
        }

        // 父级 + 自身（适合卡片内标题/番号）
        let p = el.parentElement;
        let depth = 0;
        while (p && p !== document.body && depth < 4) {
            if (p.closest && p.closest('#' + NS + '-host')) break;
            const pTag = p.tagName.toLowerCase();
            const pClasses = Array.prototype.slice.call(p.classList || [])
                .filter(isStableClassName)
                .slice(0, 2);
            if (pClasses.length) {
                const pSel = pTag + '.' + pClasses.map(cssEscapeIdent).join('.');
                if (classes[0]) {
                    pushSelCandidate(list, seen, pSel + ' ' + tag + '.' + cssEscapeIdent(classes[0]), '父级范围');
                    pushSelCandidate(list, seen, pSel + ' .' + cssEscapeIdent(classes[0]), '父级+class');
                }
                pushSelCandidate(list, seen, pSel + ' ' + tag, '父级+标签');
                if (depth === 0 && pClasses[0]) {
                    pushSelCandidate(list, seen, '.' + cssEscapeIdent(pClasses[0]), '父 class（整块）');
                }
            }
            p = p.parentElement;
            depth++;
        }

        // 短路径 nth-child（兜底，匹配数常为 1）
        try {
            const parts = [];
            let node = el;
            let guard = 0;
            while (node && node.nodeType === 1 && node !== document.body && guard < 5) {
                if (node.id && isStableId(node.id)) {
                    parts.unshift('#' + cssEscapeIdent(node.id));
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
                parts.unshift(same > 1 ? (t + ':nth-of-type(' + idx + ')') : t);
                node = parent;
                guard++;
            }
            if (parts.length) pushSelCandidate(list, seen, parts.join(' > '), '路径');
        } catch (e) { /* ignore */ }

        // 匹配适中的优先（列表页 2~200），过多/过少靠后
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

    function ensureSelPickUi() {
        injectStyles();
        let root = document.getElementById(NS + '-selpick');
        if (root && root.getAttribute('data-ver') !== SCRIPT_VER) {
            try {
                if (root.parentNode) root.parentNode.removeChild(root);
            } catch (e) { /* ignore */ }
            root = null;
        }
        if (root) return root;
        root = document.createElement('div');
        root.id = NS + '-selpick';
        root.setAttribute('data-ver', SCRIPT_VER);
        root.innerHTML =
            '<div class="' + NS + '-selpick-mask" id="' + NS + '-selpick-mask" hidden></div>' +
            '<div class="' + NS + '-selpick-box" id="' + NS + '-selpick-box" hidden></div>' +
            '<div class="' + NS + '-selpick-bar" id="' + NS + '-selpick-bar" hidden>' +
            '  <div class="' + NS + '-selpick-bar-hd">' +
            '    <strong id="' + NS + '-selpick-title">点选页面元素</strong>' +
            '    <span id="' + NS + '-selpick-hint">移动鼠标高亮 · 单击选定 · Esc 取消</span>' +
            '  </div>' +
            '  <div class="' + NS + '-selpick-confirm" id="' + NS + '-selpick-confirm" hidden>' +
            '    <label class="' + NS + '-selpick-label">选择器' +
            '      <input type="text" id="' + NS + '-selpick-input" spellcheck="false" autocomplete="off" />' +
            '    </label>' +
            '    <div class="' + NS + '-selpick-cands" id="' + NS + '-selpick-cands"></div>' +
            '    <p class="' + NS + '-selpick-meta" id="' + NS + '-selpick-meta"></p>' +
            '    <div class="' + NS + '-selpick-actions">' +
            '      <button type="button" class="jcs-btn" id="' + NS + '-selpick-retry">重新点选</button>' +
            '      <button type="button" class="jcs-btn" id="' + NS + '-selpick-cancel">取消</button>' +
            '      <button type="button" class="jcs-btn" id="' + NS + '-selpick-replace">替换写入</button>' +
            '      <button type="button" class="jcs-btn solid" id="' + NS + '-selpick-append">追加到本站</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        mountUI(root);
        root.style.pointerEvents = 'none';

        const onCancel = () => stopSelectorPick({ restore: true, toast: '已取消点选' });
        const cancelBtn = root.querySelector('#' + NS + '-selpick-cancel');
        if (cancelBtn) cancelBtn.onclick = onCancel;
        const retryBtn = root.querySelector('#' + NS + '-selpick-retry');
        if (retryBtn) {
            retryBtn.onclick = () => {
                if (!_selPick) return;
                _selPick.phase = 'hover';
                _selPick.el = null;
                _selPick.cands = [];
                const conf = root.querySelector('#' + NS + '-selpick-confirm');
                if (conf) conf.setAttribute('hidden', '');
                const title = root.querySelector('#' + NS + '-selpick-title');
                const hint = root.querySelector('#' + NS + '-selpick-hint');
                if (title) title.textContent = '点选页面元素';
                if (hint) hint.textContent = '移动鼠标高亮 · 单击选定 · Esc 取消';
                const box = root.querySelector('#' + NS + '-selpick-box');
                if (box) box.setAttribute('hidden', '');
                showToast('请重新点选');
            };
        }
        const input = root.querySelector('#' + NS + '-selpick-input');
        if (input) {
            input.addEventListener('input', () => {
                const sel = String(input.value || '').trim();
                const meta = root.querySelector('#' + NS + '-selpick-meta');
                if (!meta) return;
                if (!sel) {
                    meta.textContent = '请填写选择器';
                    return;
                }
                const n = countSelectorMatches(sel);
                meta.innerHTML = n < 0
                    ? '<span class="is-err">选择器语法无效</span>'
                    : ('本页匹配 <b>' + n + '</b> 个元素' + (n === 0 ? '（可能选错）' : ''));
                try {
                    const hit = n > 0 ? document.body.querySelector(sel) : null;
                    if (hit) paintSelPickBox(hit);
                } catch (e) { /* ignore */ }
            });
        }
        const appendBtn = root.querySelector('#' + NS + '-selpick-append');
        if (appendBtn) appendBtn.onclick = () => commitSelectorPick('append');
        const replaceBtn = root.querySelector('#' + NS + '-selpick-replace');
        if (replaceBtn) replaceBtn.onclick = () => commitSelectorPick('replace');
        return root;
    }

    function paintSelPickBox(el) {
        const box = document.getElementById(NS + '-selpick-box');
        if (!box || !el || !el.getBoundingClientRect) {
            if (box) box.setAttribute('hidden', '');
            return;
        }
        const r = el.getBoundingClientRect();
        if (r.width < 1 && r.height < 1) {
            box.setAttribute('hidden', '');
            return;
        }
        // fixed 相对 visualViewport；部分移动浏览器 offset 非 0
        let ox = 0;
        let oy = 0;
        try {
            const vv = window.visualViewport;
            if (vv) {
                ox = vv.offsetLeft || 0;
                oy = vv.offsetTop || 0;
            }
        } catch (e) { /* ignore */ }
        box.style.left = Math.max(0, r.left + ox) + 'px';
        box.style.top = Math.max(0, r.top + oy) + 'px';
        box.style.width = Math.max(0, r.width) + 'px';
        box.style.height = Math.max(0, r.height) + 'px';
        box.removeAttribute('hidden');
    }

    function setSelPickChromeHidden(hide) {
        ['popup', 'panel', 'fab', 'sub'].forEach((id) => {
            const el = document.getElementById(NS + '-' + id);
            if (!el) return;
            if (hide) el.classList.add('jcs-selpick-dim');
            else el.classList.remove('jcs-selpick-dim');
        });
    }

    function unbindSelectorPickListeners() {
        try {
            document.removeEventListener('mousemove', onSelPickMove, true);
            document.removeEventListener('mouseover', onSelPickMove, true);
            document.removeEventListener('click', onSelPickClick, true);
            document.removeEventListener('auxclick', onSelPickClick, true);
            document.removeEventListener('touchend', onSelPickTouchEnd, true);
            window.removeEventListener('scroll', onSelPickScroll, true);
            window.removeEventListener('resize', onSelPickScroll, true);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', onSelPickScroll);
                window.visualViewport.removeEventListener('scroll', onSelPickScroll);
            }
        } catch (e) { /* ignore */ }
    }

    function stopSelectorPick(opts) {
        const o = opts || {};
        const snap = _selPick;
        _selPick = null;
        unbindSelectorPickListeners();
        setSelPickChromeHidden(false);
        const root = document.getElementById(NS + '-selpick');
        if (root) {
            root.classList.remove('is-on');
            root.style.pointerEvents = 'none';
            ['selpick-box', 'selpick-bar', 'selpick-mask', 'selpick-confirm'].forEach((id) => {
                const el = document.getElementById(NS + '-' + id);
                if (el) {
                    el.setAttribute('hidden', '');
                    try { el.style.pointerEvents = ''; } catch (e) { /* ignore */ }
                }
            });
        }
        try { document.documentElement.classList.remove(NS + '-selpicking'); } catch (e2) { /* ignore */ }
        // 未恢复弹层时务必解锁页面滚动，避免点选异常退出后页面卡死
        try {
            const popup = document.getElementById(NS + '-popup');
            const popupOpen = !!(popup && popup.classList.contains('show'));
            if (!popupOpen && !isSubtitleOpen()) lockBodyScroll(false);
        } catch (e3) { /* ignore */ }
        if (o.restore && snap && snap.restore) {
            restoreAfterSelectorPick(snap.restore);
        }
        if (o.toast) showToast(o.toast);
    }

    function restoreAfterSelectorPick(restore) {
        if (!restore) return;
        try {
            if (restore.popup) {
                ensurePopup();
                const popup = document.getElementById(NS + '-popup');
                if (popup) {
                    popup.classList.add('show');
                    try { document.documentElement.classList.add(NS + '-popup-open'); } catch (e) { /* ignore */ }
                    lockBodyScroll(true);
                }
                if (restore.cfg) {
                    setTimeout(() => {
                        toggleConfig(true);
                        setConfigTab('highlight');
                        syncHlOptsUi();
                        const ta = document.getElementById(NS + '-hl-sel');
                        if (ta) {
                            try { ta.focus(); } catch (e) { /* ignore */ }
                        }
                    }, 30);
                }
            } else if (restore.panel) {
                const panel = document.getElementById(NS + '-panel');
                if (panel) panel.classList.add('show');
            }
        } catch (e) { /* ignore */ }
    }

    function onSelPickScroll() {
        if (!_selPick) return;
        if (_selPick.el) paintSelPickBox(_selPick.el);
        else if (_selPick.hover) paintSelPickBox(_selPick.hover);
    }

    function resolvePickTarget(raw) {
        let el = raw;
        if (!el || el.nodeType !== 1) {
            el = el && el.parentElement;
        }
        if (!el || el.nodeType !== 1) return null;
        // 脚本 UI / 点选条
        if (el.closest && el.closest('#' + NS + '-host')) return null;
        if (el.id === NS + '-selpick' || (el.closest && el.closest('#' + NS + '-selpick'))) return null;
        // 略上提：点到番号高亮/纯文本包装时，抬到更有意义的容器
        if (el.classList && el.classList.contains(NS + '-code-mark') && el.parentElement) {
            el = el.parentElement;
        }
        if (el.tagName === 'SPAN' && el.parentElement) {
            const firstCls = String((el.className || '').toString().split(/\s+/).filter(Boolean)[0] || '');
            if (!firstCls || !isStableClassName(firstCls)) {
                const p = el.parentElement;
                if (p && p !== document.body && p.tagName !== 'BODY') el = p;
            }
        }
        return el;
    }

    function onSelPickMove(e) {
        if (!_selPick || _selPick.phase !== 'hover') return;
        if (e.target && e.target.closest && e.target.closest('#' + NS + '-host')) {
            paintSelPickBox(null);
            _selPick.hover = null;
            return;
        }
        const el = resolvePickTarget(e.target);
        if (!el) {
            paintSelPickBox(null);
            _selPick.hover = null;
            return;
        }
        _selPick.hover = el;
        paintSelPickBox(el);
        const hint = document.getElementById(NS + '-selpick-hint');
        if (hint) {
            const tag = el.tagName.toLowerCase();
            const cls = Array.prototype.slice.call(el.classList || []).filter(isStableClassName).slice(0, 2).join('.');
            hint.textContent = tag + (cls ? '.' + cls : '') + (el.id ? '#' + el.id : '') + ' · 单击选定';
        }
    }

    function finishSelPickAt(el) {
        if (!_selPick || _selPick.phase !== 'hover') return;
        if (!el) {
            showToast('未点到有效元素');
            return;
        }
        const cands = buildSelectorCandidates(el);
        if (!cands.length) {
            showToast('无法生成选择器，请换一个节点');
            return;
        }
        _selPick.phase = 'confirm';
        _selPick.el = el;
        _selPick.cands = cands;
        paintSelPickBox(el);
        showSelPickConfirm(cands);
    }

    function onSelPickClick(e) {
        if (!_selPick) return;
        const t = e.target;
        // 底部确认条内点击放行（按钮 / 输入框）
        if (t && t.closest && t.closest('#' + NS + '-selpick-bar')) return;
        if (t && t.closest && t.closest('#' + NS + '-selpick') && !t.closest('#' + NS + '-selpick-box')) {
            // mask 等
            if (_selPick.phase === 'confirm') {
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }
        // 仅拦截页面点击，不再拦截 mousedown（否则滚动条/拖拽失效且可能点选失败）
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (_selPick.phase !== 'hover') return;
        if (e.button != null && e.button !== 0) return;

        const el = resolvePickTarget(e.target) || _selPick.hover;
        finishSelPickAt(el);
    }

    function onSelPickTouchEnd(e) {
        if (!_selPick || _selPick.phase !== 'hover') return;
        const t = e.target;
        if (t && t.closest && t.closest('#' + NS + '-selpick-bar')) return;
        if (t && t.closest && t.closest('#' + NS + '-host')) return;
        // 避免随后的合成 click 再触发一次
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        let el = null;
        try {
            const touch = e.changedTouches && e.changedTouches[0];
            if (touch) {
                el = document.elementFromPoint(touch.clientX, touch.clientY);
            }
        } catch (err) { /* ignore */ }
        el = resolvePickTarget(el) || resolvePickTarget(e.target) || _selPick.hover;
        finishSelPickAt(el);
    }

    function showSelPickConfirm(cands) {
        const root = ensureSelPickUi();
        const conf = root.querySelector('#' + NS + '-selpick-confirm');
        const title = root.querySelector('#' + NS + '-selpick-title');
        const hint = root.querySelector('#' + NS + '-selpick-hint');
        const input = root.querySelector('#' + NS + '-selpick-input');
        const box = root.querySelector('#' + NS + '-selpick-cands');
        const meta = root.querySelector('#' + NS + '-selpick-meta');
        if (title) title.textContent = '确认选择器';
        if (hint) hint.textContent = '可改写 · 点候选切换 · 追加/替换写入本站';
        if (conf) conf.removeAttribute('hidden');
        const best = cands[0];
        if (input) {
            input.value = best.sel;
            try { input.focus(); input.select(); } catch (e) { /* ignore */ }
        }
        if (box) {
            box.innerHTML = cands.map((c, i) => {
                return '<button type="button" class="' + NS + '-selpick-cand' + (i === 0 ? ' is-on' : '') +
                    '" data-sel="' + encodeURIComponent(c.sel) + '" title="' + escapeHtml(c.note || '') + '">' +
                    '<code>' + escapeHtml(c.sel) + '</code>' +
                    '<em>' + c.count + ' 个' + (c.note ? ' · ' + escapeHtml(c.note) : '') + '</em>' +
                    '</button>';
            }).join('');
            box.querySelectorAll('.' + NS + '-selpick-cand').forEach((btn) => {
                btn.onclick = () => {
                    box.querySelectorAll('.' + NS + '-selpick-cand').forEach((b) => b.classList.remove('is-on'));
                    btn.classList.add('is-on');
                    let sel = '';
                    try { sel = decodeURIComponent(btn.getAttribute('data-sel') || ''); } catch (e) {
                        sel = btn.getAttribute('data-sel') || '';
                    }
                    if (input) input.value = sel;
                    if (meta) {
                        const n = countSelectorMatches(sel);
                        meta.innerHTML = '本页匹配 <b>' + n + '</b> 个元素';
                    }
                    try {
                        const hit = document.body.querySelector(sel);
                        if (hit) {
                            if (_selPick) _selPick.el = hit;
                            paintSelPickBox(hit);
                        }
                    } catch (e) { /* ignore */ }
                };
            });
        }
        if (meta && best) {
            meta.innerHTML = '本页匹配 <b>' + best.count + '</b> 个元素' +
                (best.note ? ' · ' + escapeHtml(best.note) : '');
        }
    }

    function commitSelectorPick(mode) {
        if (!_selPick) return;
        const input = document.getElementById(NS + '-selpick-input');
        let sel = input ? String(input.value || '').trim() : '';
        if (!sel) {
            showToast('选择器为空');
            return;
        }
        const n = countSelectorMatches(sel);
        if (n < 0) {
            showToast('选择器语法无效');
            return;
        }
        if (n === 0 && !window.confirm('本页匹配 0 个元素，仍要写入？')) return;

        // 以当前内存/输入框为准，勿 loadHlOpts 覆盖尚未写回的编辑
        const ta = document.getElementById(NS + '-hl-sel');
        const curUi = ta
            ? String(ta.value || '')
            : String((state.hl && state.hl.nativeSelectors) || '');
        const lines = curUi.split(/\r?\n/).map((s) => s.trimEnd());
        const keptHead = [];
        const body = [];
        lines.forEach((line) => {
            const t = line.trim();
            if (!t) return;
            if (/^(only|!|replace)$/i.test(t)) {
                if (!keptHead.length) keptHead.push('only');
                return;
            }
            if (t !== sel) body.push(t);
        });
        let next;
        if (mode === 'replace') {
            next = (keptHead.length ? keptHead.concat([sel]) : [sel]).join('\n');
        } else {
            const parts = keptHead.concat(body);
            if (parts.indexOf(sel) < 0) parts.push(sel);
            next = parts.join('\n');
        }

        state.hl = normalizeHlOpts(Object.assign({}, state.hl || {}, {
            enabled: true,
            nativeSelectors: next
        }));
        saveHlOpts();

        const restore = _selPick.restore;
        stopSelectorPick({ restore: false });
        if (restore) restoreAfterSelectorPick(restore);

        setTimeout(() => {
            const ta2 = document.getElementById(NS + '-hl-sel');
            if (ta2) ta2.value = next;
            syncHlOptsUi();
            try {
                clearPageHighlight();
                if (state.hl.enabled) linkifyPage();
            } catch (e) { /* ignore */ }
            const host = currentHostname() || '本站';
            showToast((mode === 'replace' ? '已替换' : '已追加') +
                '选择器（' + host + ' · 匹配 ' + n + '）');
        }, 50);
    }

    function startSelectorPick() {
        // 先彻底清理，防止上次监听残留导致页面点击/滚动失效
        if (_selPick) stopSelectorPick({ restore: false });
        else unbindSelectorPickListeners();
        injectStyles();
        ensureSelPickUi();

        const popup = document.getElementById(NS + '-popup');
        const cfg = document.getElementById(NS + '-cfg');
        const panel = document.getElementById(NS + '-panel');
        const restore = {
            popup: !!(popup && popup.classList.contains('show')),
            cfg: !!(cfg && cfg.classList.contains('show')),
            panel: !!(panel && panel.classList.contains('show'))
        };

        // 先收起脚本 UI，露出页面供点选
        if (restore.cfg) toggleConfig(false);
        if (restore.popup) {
            const p = document.getElementById(NS + '-popup');
            if (p) p.classList.remove('show');
            try { document.documentElement.classList.remove(NS + '-popup-open'); } catch (e) { /* ignore */ }
            if (!isSubtitleOpen()) lockBodyScroll(false);
        }
        if (restore.panel) {
            const pn = document.getElementById(NS + '-panel');
            if (pn) pn.classList.remove('show');
        }

        const root = ensureSelPickUi();
        root.classList.add('is-on');
        root.style.pointerEvents = 'none';
        const bar = root.querySelector('#' + NS + '-selpick-bar');
        if (bar) {
            bar.removeAttribute('hidden');
            bar.style.pointerEvents = 'auto';
        }
        const conf = root.querySelector('#' + NS + '-selpick-confirm');
        if (conf) conf.setAttribute('hidden', '');
        const box = root.querySelector('#' + NS + '-selpick-box');
        if (box) box.setAttribute('hidden', '');
        const title = root.querySelector('#' + NS + '-selpick-title');
        const hint = root.querySelector('#' + NS + '-selpick-hint');
        if (title) title.textContent = '点选页面元素';
        if (hint) hint.textContent = '移动鼠标高亮 · 单击选定 · Esc 取消';

        setSelPickChromeHidden(true);
        try { document.documentElement.classList.add(NS + '-selpicking'); } catch (e) { /* ignore */ }

        _selPick = { phase: 'hover', hover: null, el: null, cands: [], restore: restore };

        // 只拦 click/touchend，不拦 mousedown——否则滚动条拖不动、部分站点点选无响应
        document.addEventListener('mousemove', onSelPickMove, true);
        document.addEventListener('mouseover', onSelPickMove, true);
        document.addEventListener('click', onSelPickClick, true);
        document.addEventListener('touchend', onSelPickTouchEnd, true);
        window.addEventListener('scroll', onSelPickScroll, true);
        window.addEventListener('resize', onSelPickScroll, true);
        try {
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', onSelPickScroll, { passive: true });
                window.visualViewport.addEventListener('scroll', onSelPickScroll, { passive: true });
            }
        } catch (e2) { /* ignore */ }

        showToast('移动到目标区域后单击 · Esc 取消');
    }

    // ─── 字幕搜索 ───────────────────────────────────────────

    function loadSubOpts() {
        try {
            const o = storeGetJson(SUB_OPT_KEY, null);
            if (o && typeof o.useOriginalName === 'boolean') {
                state.subUseOriginalName = o.useOriginalName;
                return;
            }
        } catch (e) { /* ignore */ }
        state.subUseOriginalName = true;
    }

    function saveSubOpts() {
        storeSetJson(SUB_OPT_KEY, {
            useOriginalName: !!state.subUseOriginalName
        });
    }

    function loadSubHist() {
        try {
            const arr = storeGetJson(SUB_HIST_KEY, []);
            return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
        } catch (e) {
            return [];
        }
    }

    function saveSubHist(term) {
        const t = String(term || '').trim();
        if (!t) return loadSubHist();
        let list = loadSubHist().filter((x) => x.toLowerCase() !== t.toLowerCase());
        list.unshift(t);
        if (list.length > 12) list = list.slice(0, 12);
        storeSetJson(SUB_HIST_KEY, list);
        return list;
    }

    function sanitizeFilename(name) {
        let s = String(name || '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
        s = s.replace(/\s+/g, ' ').trim();
        if (s.length > 120) {
            const m = s.match(/(\.[a-z0-9]{2,5})$/i);
            const ext = m ? m[1] : '';
            s = s.slice(0, Math.max(1, 120 - ext.length)).trim() + ext;
        }
        return s || 'subtitle.srt';
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function subtitleLangs(sub) {
        if (!sub || !Array.isArray(sub.languages)) return [];
        return sub.languages.map((x) => String(x || '').trim()).filter(Boolean);
    }

    function buildSubtitleFilename(sub, code) {
        const ext = String((sub && sub.ext) || 'srt').replace(/^\./, '') || 'srt';
        if (state.subUseOriginalName) {
            let name = String((sub && sub.name) || '').trim();
            if (name && !name.toLowerCase().endsWith('.' + ext.toLowerCase())) {
                name = name + '.' + ext;
            }
            if (!name) name = (code || 'subtitle') + '.' + ext;
            return sanitizeFilename(name);
        }
        const base = String(code || 'subtitle').trim() || 'subtitle';
        const langs = subtitleLangs(sub);
        const lang = langs.length
            ? String(langs[0]).replace(/[^\w\u4e00-\u9fff-]+/g, '')
            : '';
        return sanitizeFilename(lang ? (base + '_' + lang + '.' + ext) : (base + '.' + ext));
    }

    function gmRequest(opts) {
        const o = opts || {};
        const gm = (typeof GM_xmlhttpRequest === 'function' && GM_xmlhttpRequest)
            || (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function' && GM.xmlHttpRequest)
            || null;
        if (!gm) return Promise.reject(new Error('no GM'));
        return new Promise((resolve, reject) => {
            let done = false;
            const finish = (fn, arg) => {
                if (done) return;
                done = true;
                fn(arg);
            };
            try {
                const req = {
                    method: o.method || 'GET',
                    url: o.url,
                    timeout: o.timeout || 20000,
                    responseType: o.responseType || '',
                    headers: o.headers || {},
                    onload: (res) => {
                        const st = res && typeof res.status === 'number' ? res.status : 0;
                        const okList = Array.isArray(o.acceptStatuses) ? o.acceptStatuses : null;
                        // 部分环境成功时 status 为 0；WebDAV PUT 常见 201/204
                        const ok = okList
                            ? (st === 0 || okList.indexOf(st) >= 0)
                            : (st === 0 || (st >= 200 && st < 300));
                        if (ok) finish(resolve, res);
                        else finish(reject, new Error('HTTP ' + st + (res && res.statusText ? ' ' + res.statusText : '')));
                    },
                    onerror: () => finish(reject, new Error('network')),
                    ontimeout: () => finish(reject, new Error('timeout')),
                    onabort: () => finish(reject, new Error('abort'))
                };
                if (o.data != null) req.data = o.data;
                if (o.binary != null) req.binary = o.binary;
                if (o.overrideMimeType) req.overrideMimeType = o.overrideMimeType;
                gm(req);
            } catch (e) {
                finish(reject, e || new Error('gm fail'));
            }
        });
    }

    function b64EncodeUtf8(str) {
        try {
            return btoa(unescape(encodeURIComponent(String(str || ''))));
        } catch (e) {
            try { return btoa(String(str || '')); } catch (e2) { return ''; }
        }
    }

    function bytesToB64(bytes) {
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        let s = '';
        const chunk = 0x8000;
        for (let i = 0; i < u8.length; i += chunk) {
            s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
        }
        return btoa(s);
    }

    function b64ToBytes(b64) {
        const bin = atob(String(b64 || ''));
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function hasSubtleCrypto() {
        try {
            return !!(window.crypto && window.crypto.subtle && typeof window.crypto.getRandomValues === 'function');
        } catch (e) {
            return false;
        }
    }

    function deriveAesKey(password, saltBytes) {
        const enc = new TextEncoder();
        return crypto.subtle.importKey('raw', enc.encode(String(password || '')), 'PBKDF2', false, ['deriveKey'])
            .then((base) => crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: saltBytes,
                    iterations: 120000,
                    hash: 'SHA-256'
                },
                base,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            ));
    }

    /** 明文 → 加密 JSON 包（AES-256-GCM + PBKDF2） */
    function encryptConfigPayload(plainText, password) {
        if (!hasSubtleCrypto()) return Promise.reject(new Error('当前浏览器不支持 WebCrypto 加密'));
        const pwd = String(password || '');
        if (pwd.length < 4) return Promise.reject(new Error('加密密码至少 4 位'));
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = new TextEncoder().encode(String(plainText || ''));
        return deriveAesKey(pwd, salt).then((key) => crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        )).then((cipherBuf) => JSON.stringify({
            app: 'jav-code-scanner',
            enc: ENC_MARK,
            v: 1,
            kdf: 'PBKDF2-SHA256',
            iter: 120000,
            salt: bytesToB64(salt),
            iv: bytesToB64(iv),
            ct: bytesToB64(new Uint8Array(cipherBuf)),
            createdAt: new Date().toISOString()
        }, null, 2));
    }

    function isEncryptedConfigPayload(text) {
        try {
            const o = typeof text === 'string' ? JSON.parse(text) : text;
            return !!(o && typeof o === 'object' && o.enc === ENC_MARK && o.ct && o.salt && o.iv);
        } catch (e) {
            return false;
        }
    }

    /** 加密包 → 明文 JSON 字符串 */
    function decryptConfigPayload(encText, password) {
        if (!hasSubtleCrypto()) return Promise.reject(new Error('当前浏览器不支持 WebCrypto 解密'));
        let o;
        try {
            o = typeof encText === 'string' ? JSON.parse(encText) : encText;
        } catch (e) {
            return Promise.reject(new Error('加密包无法解析'));
        }
        if (!o || o.enc !== ENC_MARK || !o.ct || !o.salt || !o.iv) {
            return Promise.reject(new Error('不是本脚本的加密备份'));
        }
        const pwd = String(password || '');
        if (!pwd) return Promise.reject(new Error('请填写加密密码'));
        let salt; let iv; let ct;
        try {
            salt = b64ToBytes(o.salt);
            iv = b64ToBytes(o.iv);
            ct = b64ToBytes(o.ct);
        } catch (e) {
            return Promise.reject(new Error('加密包数据损坏'));
        }
        return deriveAesKey(pwd, salt).then((key) => crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ct
        )).then((buf) => new TextDecoder().decode(buf)).catch(() => {
            throw new Error('解密失败，请检查加密密码');
        });
    }

    /** 若是加密包则解密，否则原样返回 */
    function maybeDecryptConfigText(text, password) {
        if (!isEncryptedConfigPayload(text)) return Promise.resolve(String(text || ''));
        return decryptConfigPayload(text, password);
    }

    function normalizeWebdavOpts(raw) {
        const o = raw && typeof raw === 'object' ? raw : {};
        return {
            url: String(o.url || '').trim(),
            user: String(o.user || '').trim(),
            pass: String(o.pass || ''),
            file: String(o.file || WEBDAV_DEFAULT_FILE).trim() || WEBDAV_DEFAULT_FILE,
            encrypt: o.encrypt === true || o.encrypt === '1' || o.encrypt === 1,
            secret: String(o.secret || '')
        };
    }

    function loadWebdavOpts() {
        return normalizeWebdavOpts(storeGetJson(WEBDAV_KEY, null));
    }

    function saveWebdavOpts(partial) {
        const next = normalizeWebdavOpts(Object.assign({}, loadWebdavOpts(), partial || {}));
        storeSetJson(WEBDAV_KEY, next);
        return next;
    }

    function joinWebdavUrl(base, file) {
        let b = String(base || '').trim();
        if (!b) return '';
        // 允许用户直接填完整文件 URL
        if (/\.json(\?|#|$)/i.test(b) && !file) return b;
        b = b.replace(/\/+$/, '');
        let f = String(file || WEBDAV_DEFAULT_FILE).trim().replace(/^\/+/, '') || WEBDAV_DEFAULT_FILE;
        // base 已以文件名结尾时不再追加
        if (b.toLowerCase().endsWith('/' + f.toLowerCase()) || b.toLowerCase().endsWith(f.toLowerCase())) {
            return b;
        }
        return b + '/' + f;
    }

    function webdavAuthHeader(opts) {
        const o = normalizeWebdavOpts(opts);
        if (!o.user && !o.pass) return {};
        return { Authorization: 'Basic ' + b64EncodeUtf8(o.user + ':' + o.pass) };
    }

    function webdavTargetUrl(opts) {
        const o = normalizeWebdavOpts(opts || loadWebdavOpts());
        return joinWebdavUrl(o.url, o.file);
    }

    function webdavUploadConfig(opts) {
        const o = normalizeWebdavOpts(opts || loadWebdavOpts());
        const url = joinWebdavUrl(o.url, o.file);
        if (!url) return Promise.reject(new Error('请填写 WebDAV 地址'));
        if (!/^https?:\/\//i.test(url)) return Promise.reject(new Error('WebDAV 地址需以 http(s):// 开头'));
        const plain = exportConfigJson();
        const bodyP = o.encrypt
            ? encryptConfigPayload(plain, o.secret)
            : Promise.resolve(plain);
        return bodyP.then((body) => {
            const headers = Object.assign({
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': '*/*'
            }, webdavAuthHeader(o));
            return gmRequest({
                method: 'PUT',
                url: url,
                headers: headers,
                data: body,
                timeout: 30000,
                acceptStatuses: [200, 201, 204, 207]
            }).then(() => ({
                url: url,
                bytes: body.length,
                encrypted: !!o.encrypt
            }));
        });
    }

    function webdavDownloadConfig(opts) {
        const o = normalizeWebdavOpts(opts || loadWebdavOpts());
        const url = joinWebdavUrl(o.url, o.file);
        if (!url) return Promise.reject(new Error('请填写 WebDAV 地址'));
        if (!/^https?:\/\//i.test(url)) return Promise.reject(new Error('WebDAV 地址需以 http(s):// 开头'));
        const headers = Object.assign({
            'Accept': 'application/json, text/plain, */*'
        }, webdavAuthHeader(o));
        return gmRequest({
            method: 'GET',
            url: url,
            headers: headers,
            timeout: 30000,
            acceptStatuses: [200]
        }).then((res) => {
            const text = res && (res.responseText != null ? res.responseText : res.response);
            if (text == null || String(text).trim() === '') throw new Error('远端文件为空');
            const raw = String(text);
            // 加密包必须解密；明文直接返回
            if (isEncryptedConfigPayload(raw)) {
                if (!o.secret) return Promise.reject(new Error('远端是加密备份，请填写加密密码'));
                return decryptConfigPayload(raw, o.secret).then((plain) => ({
                    text: plain,
                    encrypted: true
                }));
            }
            return { text: raw, encrypted: false };
        });
    }

    function webdavTestConnection(opts) {
        const o = normalizeWebdavOpts(opts || loadWebdavOpts());
        const url = joinWebdavUrl(o.url, o.file);
        if (!url) return Promise.reject(new Error('请填写 WebDAV 地址'));
        const headers = Object.assign({ 'Accept': '*/*', Depth: '0' }, webdavAuthHeader(o));
        // 先 PROPFIND，失败再 GET（部分盘只开了文件读写）
        return gmRequest({
            method: 'PROPFIND',
            url: url,
            headers: headers,
            timeout: 15000,
            acceptStatuses: [200, 207, 404]
        }).then((res) => {
            const st = res && res.status;
            return { ok: true, status: st, url: url, mode: 'PROPFIND' };
        }).catch(() => gmRequest({
            method: 'GET',
            url: url,
            headers: Object.assign({ Accept: '*/*' }, webdavAuthHeader(o)),
            timeout: 15000,
            acceptStatuses: [200, 404]
        }).then((res) => ({
            ok: true,
            status: res && res.status,
            url: url,
            mode: 'GET',
            exists: !!(res && res.status === 200)
        })));
    }

    function withTimeout(promise, ms, label) {
        let timer = 0;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(label || 'timeout')), ms || 15000);
        });
        return Promise.race([promise, timeout]).then(
            (v) => { clearTimeout(timer); return v; },
            (e) => { clearTimeout(timer); throw e; }
        );
    }

    function fetchTextOnce(url, ms) {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => {
            try { if (ctrl) ctrl.abort(); } catch (e) { /* ignore */ }
        }, ms || 12000);
        return fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json, text/plain, */*' },
            signal: ctrl ? ctrl.signal : undefined
        }).then((r) => {
            clearTimeout(timer);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).catch((e) => {
            clearTimeout(timer);
            throw e;
        });
    }

    function fetchBlobOnce(url, ms) {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => {
            try { if (ctrl) ctrl.abort(); } catch (e) { /* ignore */ }
        }, ms || 15000);
        return fetch(url, {
            method: 'GET',
            headers: { Accept: 'text/plain, application/octet-stream, */*' },
            signal: ctrl ? ctrl.signal : undefined
        }).then((r) => {
            clearTimeout(timer);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.blob();
        }).catch((e) => {
            clearTimeout(timer);
            throw e;
        });
    }

    function fetchTextViaProxies(url) {
        const proxies = [
            url,
            'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
            'https://corsproxy.io/?' + encodeURIComponent(url)
        ];
        let chain = Promise.reject(new Error('start'));
        proxies.forEach((u) => {
            chain = chain.catch(() => fetchTextOnce(u, 12000));
        });
        return withTimeout(chain, 20000, 'proxy-timeout');
    }

    function fetchBlobViaProxies(url) {
        const attempts = [
            url,
            'https://corsproxy.io/?' + encodeURIComponent(url),
            'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)
        ];
        let chain = Promise.reject(new Error('start'));
        attempts.forEach((u) => {
            chain = chain.catch(() => fetchBlobOnce(u, 15000));
        });
        return withTimeout(chain, 25000, 'proxy-timeout');
    }

    function gmResponseToText(res) {
        if (!res) return '';
        if (typeof res.responseText === 'string' && res.responseText) return res.responseText;
        const r = res.response;
        if (typeof r === 'string') return r;
        if (r && typeof r === 'object') {
            try { return JSON.stringify(r); } catch (e) { /* ignore */ }
        }
        return res.responseText || '';
    }

    function gmResponseToBlob(res) {
        if (!res) return null;
        const r = res.response;
        if (typeof Blob !== 'undefined' && r instanceof Blob) return r;
        if (r && typeof ArrayBuffer !== 'undefined' && r instanceof ArrayBuffer) {
            return new Blob([r]);
        }
        if (typeof r === 'string') {
            return new Blob([r], { type: 'text/plain;charset=utf-8' });
        }
        if (typeof res.responseText === 'string' && res.responseText) {
            return new Blob([res.responseText], { type: 'text/plain;charset=utf-8' });
        }
        return null;
    }

    function fetchSubtitleJson(term) {
        const apiUrl = SUBTITLE_API + '?name=' + encodeURIComponent(term);
        return gmRequest({ url: apiUrl, responseType: '', timeout: 15000 })
            .then((res) => gmResponseToText(res))
            .catch(() => fetchTextViaProxies(apiUrl));
    }

    function triggerBlobDownload(blob, filename) {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename || 'subtitle.srt';
        a.rel = 'noopener';
        a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        (document.body || document.documentElement).appendChild(a);
        a.click();
        setTimeout(() => {
            try { if (a.parentNode) a.parentNode.removeChild(a); } catch (e) { /* ignore */ }
            URL.revokeObjectURL(objectUrl);
        }, 200);
    }

    function downloadSubtitleFile(url, filename) {
        if (!url) return;
        const name = sanitizeFilename(filename || 'subtitle.srt');
        showToast('正在获取字幕…');
        const viaGm = gmRequest({ url: url, responseType: 'blob', timeout: 20000 })
            .then((res) => {
                const blob = gmResponseToBlob(res);
                if (!blob) throw new Error('empty blob');
                return blob;
            });
        const run = viaGm.catch(() => fetchBlobViaProxies(url));
        run.then((blob) => {
            if (!blob) throw new Error('empty');
            triggerBlobDownload(blob, name);
            showToast('已开始下载 ' + name);
        }).catch(() => {
            showToast('缓存下载失败，尝试直链');
            try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { /* ignore */ }
        });
    }

    function getSubtitleRoot() {
        const el = document.getElementById(NS + '-sub');
        // 必须是字幕层根节点（勿与面板 #jcs-panel-sub 混淆）
        if (el && el.querySelector && el.querySelector('#' + NS + '-sub-win')) return el;
        return null;
    }

    function isSubtitleOpen() {
        const el = getSubtitleRoot();
        return !!(el && el.classList.contains('show'));
    }

    function closeSubtitleModal() {
        const el = getSubtitleRoot();
        if (!el) return;
        el.classList.remove('show');
        el.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove(NS + '-sub-open');
        // 仅当搜索大窗未开时解锁滚动
        const popup = document.getElementById(NS + '-popup');
        if (!(popup && popup.classList.contains('show'))) {
            lockBodyScroll(false);
        }
    }

    function setSubBusy(busy) {
        subBusy = !!busy;
        const go = document.getElementById(NS + '-sub-go');
        if (go) {
            go.disabled = subBusy;
            go.textContent = subBusy ? '搜索中…' : '搜索';
        }
        // 搜索中仍允许改关键字，避免卡死输入
    }

    function renderSubHist(box) {
        if (!box) return;
        const hist = loadSubHist();
        if (!hist.length) {
            box.innerHTML = '';
            box.hidden = true;
            return;
        }
        box.hidden = false;
        box.innerHTML = hist.map((t) =>
            '<button type="button" class="jcs-chip" data-term="' + escapeHtml(t) + '">' +
            escapeHtml(t) + '</button>'
        ).join('');
        box.querySelectorAll('.jcs-chip').forEach((btn) => {
            btn.onclick = () => {
                const term = btn.getAttribute('data-term') || btn.textContent || '';
                const input = document.getElementById(NS + '-sub-q');
                if (input) input.value = term;
                searchSubtitles(term);
            };
        });
    }

    function refreshSubtitleListView() {
        const list = document.getElementById(NS + '-sub-list');
        if (!list || !subLastData) return;
        renderSubtitleList(list, subLastData, subLastTerm || '');
    }

    function renderSubtitleList(listEl, data, term) {
        if (!listEl) return;
        const rows = (data && Array.isArray(data.data)) ? data.data : [];
        if (!rows.length) {
            listEl.innerHTML =
                '<div class="jcs-empty jcs-sub-empty">' +
                '<em aria-hidden="true">∅</em>' +
                '<b>未找到字幕</b>' +
                '<span>没有与「' + escapeHtml(term) + '」匹配的结果</span></div>';
            return;
        }
        listEl.innerHTML = rows.map((sub, idx) => {
            const name = String(sub.name || '未命名字幕');
            const ext = String(sub.ext || 'srt').replace(/^\./, '');
            const langs = subtitleLangs(sub);
            const langText = langs.length ? langs.join(' · ') : '';
            const src = sub.extra_name ? String(sub.extra_name) : '';
            const filename = buildSubtitleFilename(sub, term);
            const url = sub.url ? String(sub.url) : '';
            const acts = url
                ? ('<div class="jcs-sub-acts">' +
                    '<button type="button" class="jcs-btn solid jcs-sub-dl" data-i="' + idx + '">缓存下载</button>' +
                    '<a class="jcs-btn jcs-sub-direct" href="' + escapeHtml(url) +
                    '" target="_blank" rel="noopener noreferrer" title="在新标签打开直链">直链</a></div>')
                : '<div class="jcs-sub-acts"><span class="jcs-sub-na">无下载链接</span></div>';
            return '<article class="jcs-sub-item" data-i="' + idx + '">' +
                '<div class="jcs-sub-main">' +
                '<strong class="jcs-sub-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</strong>' +
                '<div class="jcs-sub-meta">' +
                '<i class="jcs-sub-tag is-ext">' + escapeHtml(ext.toUpperCase()) + '</i>' +
                (langText
                    ? '<i class="jcs-sub-tag is-lang">' + escapeHtml(langText) + '</i>'
                    : '<i class="jcs-sub-tag is-muted">未知语言</i>') +
                (src ? '<i class="jcs-sub-tag is-src" title="' + escapeHtml(src) + '">' + escapeHtml(src) + '</i>' : '') +
                '</div>' +
                '<div class="jcs-sub-file" title="下载为：' + escapeHtml(filename) + '">' +
                '<span aria-hidden="true">↓</span><code>' + escapeHtml(filename) + '</code></div>' +
                '</div>' + acts + '</article>';
        }).join('');

        listEl.querySelectorAll('.jcs-sub-dl').forEach((btn) => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const i = Number(btn.getAttribute('data-i'));
                const sub = rows[i];
                if (!sub || !sub.url) return;
                downloadSubtitleFile(String(sub.url), buildSubtitleFilename(sub, term));
            };
        });
    }

    function ensureSubtitleModal() {
        injectStyles();
        loadSubOpts();
        let root = getSubtitleRoot();
        if (root) return root;

        root = document.createElement('div');
        root.id = NS + '-sub';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML =
            '<div id="' + NS + '-sub-win" role="dialog" aria-modal="true" aria-labelledby="' + NS + '-sub-title" aria-label="字幕搜索">' +
            '<div class="jcs-head">' +
            '<div class="jcs-brand">' +
            '<div class="jcs-mark" aria-hidden="true">字</div>' +
            '<div class="jcs-brand-txt">' +
            '<strong id="' + NS + '-sub-title">字幕搜索</strong>' +
            '<span id="' + NS + '-sub-sub">迅雷字幕库</span></div>' +
            '</div>' +
            '<div class="jcs-actions">' +
            '<button type="button" class="jcs-icon" id="' + NS + '-sub-theme" title="切换主题" aria-label="切换主题">☀</button>' +
            '<button type="button" class="jcs-icon" id="' + NS + '-sub-close" title="关闭" aria-label="关闭">×</button>' +
            '</div></div>' +
            '<div class="jcs-sub-toolbar">' +
            '<div class="jcs-sub-search">' +
            '<input id="' + NS + '-sub-q" type="search" inputmode="search" enterkeyhint="search" ' +
            'placeholder="输入番号或关键词" autocomplete="off" spellcheck="false" />' +
            '<button type="button" class="jcs-btn solid" id="' + NS + '-sub-go">搜索</button>' +
            '</div>' +
            '<label class="jcs-sub-opt" title="关闭后按「番号_语言.ext」生成文件名">' +
            '<input type="checkbox" id="' + NS + '-sub-orig" />' +
            '<span>使用原始文件名</span></label>' +
            '<div id="' + NS + '-sub-hist" class="jcs-sub-hist" hidden></div>' +
            '</div>' +
            '<div id="' + NS + '-sub-list" class="jcs-sub-list" role="list">' +
            '<div class="jcs-empty jcs-sub-empty">' +
            '<em aria-hidden="true">字</em><b>搜索字幕</b>' +
            '<span>输入番号或关键词后开始</span></div></div></div>';
        mountUI(root);
        syncHostToViewport();

        const win = root.querySelector('#' + NS + '-sub-win');
        const close = () => closeSubtitleModal();
        // 与搜索大窗一致：仅桌面点遮罩关闭；移动端全屏不误触关闭
        root.querySelector('#' + NS + '-sub-close').onclick = close;
        const subTheme = root.querySelector('#' + NS + '-sub-theme');
        if (subTheme) subTheme.onclick = () => toggleTheme();
        root.addEventListener('click', (e) => {
            if (e.target === root && !isMobile()) close();
        });
        root.querySelector('#' + NS + '-sub-go').onclick = () => {
            const q = (root.querySelector('#' + NS + '-sub-q').value || '').trim();
            if (q) searchSubtitles(q);
            else showToast('请输入字幕关键字');
        };
        root.querySelector('#' + NS + '-sub-q').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = (e.target.value || '').trim();
                if (q) searchSubtitles(q);
            }
        });
        const orig = root.querySelector('#' + NS + '-sub-orig');
        if (orig) {
            orig.checked = !!state.subUseOriginalName;
            orig.addEventListener('change', () => {
                state.subUseOriginalName = !!orig.checked;
                saveSubOpts();
                showToast(state.subUseOriginalName ? '已启用原始文件名' : '已改用番号文件名');
                refreshSubtitleListView();
            });
        }
        // 桌面可拖窗口；移动端全屏固定（与搜索大窗一致）
        bindDrag(win, root.querySelector('.jcs-head'), {
            fixedMode: true,
            setSize: true,
            disableOnMobile: true,
            onEnd: (moved) => {
                if (!isMobile() && moved) {
                    root.style.alignItems = 'flex-start';
                    root.style.justifyContent = 'flex-start';
                }
            }
        });
        // Esc 统一由 bindGlobalHotkeys 处理
        return root;
    }

    function resetSubtitleWinLayout(root) {
        if (!root) return;
        const win = root.querySelector('#' + NS + '-sub-win');
        if (isMobile()) {
            if (win) {
                win.style.left = '';
                win.style.top = '';
                win.style.right = '';
                win.style.bottom = '';
                win.style.width = '';
                win.style.height = '';
                win.style.position = '';
                win.style.margin = '';
            }
            root.style.alignItems = '';
            root.style.justifyContent = '';
        }
    }

    function openSubtitleSearch(code) {
        closeProviderPicker();
        const root = ensureSubtitleModal();
        syncHostToViewport();
        applyTheme(state.theme || loadTheme());
        loadSubOpts();
        resetSubtitleWinLayout(root);
        const term = String(code || state.active || '').trim();
        const input = root.querySelector('#' + NS + '-sub-q');
        const orig = root.querySelector('#' + NS + '-sub-orig');
        const sub = root.querySelector('#' + NS + '-sub-sub');
        if (orig) orig.checked = !!state.subUseOriginalName;
        if (input) input.value = term;
        if (sub) sub.textContent = term ? ('关键字 · ' + term) : '迅雷字幕库';
        renderSubHist(root.querySelector('#' + NS + '-sub-hist'));
        root.classList.add('show');
        root.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add(NS + '-sub-open');
        lockBodyScroll(true);
        if (input) {
            setTimeout(() => {
                try {
                    if (!subBusy) {
                        input.focus();
                        if (input.select) input.select();
                    }
                } catch (e) { /* ignore */ }
            }, 30);
        }
        if (term) searchSubtitles(term);
    }

    function parseSubtitlePayload(text) {
        let data = null;
        try { data = JSON.parse(text || '{}'); } catch (e) { data = null; }
        if (!data || typeof data !== 'object') return { data: [] };
        if (Array.isArray(data.data)) return data;
        if (Array.isArray(data)) return { data: data };
        return { data: [] };
    }

    function searchSubtitles(term) {
        const q = String(term || '').trim();
        if (!q) {
            showToast('请输入字幕关键字');
            return;
        }
        const root = ensureSubtitleModal();
        if (!root.classList.contains('show')) {
            syncHostToViewport();
            resetSubtitleWinLayout(root);
            applyTheme(state.theme || loadTheme());
            root.classList.add('show');
            root.setAttribute('aria-hidden', 'false');
            document.documentElement.classList.add(NS + '-sub-open');
            lockBodyScroll(true);
        }
        const list = root.querySelector('#' + NS + '-sub-list');
        const sub = root.querySelector('#' + NS + '-sub-sub');
        const input = root.querySelector('#' + NS + '-sub-q');
        if (input && input.value.trim() !== q) input.value = q;
        if (sub) sub.textContent = '搜索中 · ' + q;
            if (list) {
                list.innerHTML =
                    '<div class="jcs-empty jcs-sub-loading" role="status">' +
                    '<i class="jcs-sub-spin" aria-hidden="true"></i>' +
                    '<b>搜索中</b>' +
                    '<span>正在获取「' + escapeHtml(q) + '」字幕…</span></div>';
            }
            saveSubHist(q);
            renderSubHist(root.querySelector('#' + NS + '-sub-hist'));

            const reqId = ++subReqSeq;
            setSubBusy(true);
            showToast('正在搜索字幕…');

            withTimeout(fetchSubtitleJson(q), 22000, 'search-timeout').then((text) => {
                if (reqId !== subReqSeq) return;
                const data = parseSubtitlePayload(text);
                subLastData = data;
                subLastTerm = q;
                if (list) renderSubtitleList(list, data, q);
                const n = data.data.length;
                if (sub) sub.textContent = n ? ('找到 ' + n + ' 条 · ' + q) : ('无结果 · ' + q);
                showToast(n ? ('找到 ' + n + ' 条字幕') : ('未找到「' + q + '」字幕'));
            }).catch(() => {
                if (reqId !== subReqSeq) return;
                subLastData = null;
                subLastTerm = q;
                if (list) {
                    list.innerHTML =
                        '<div class="jcs-empty jcs-sub-empty jcs-sub-fail">' +
                        '<em aria-hidden="true">!</em><b>获取失败</b>' +
                        '<span>网络异常或接口超时，请稍后重试</span>' +
                        '<button type="button" class="jcs-btn solid jcs-sub-retry">重新搜索</button></div>';
                    const retry = list.querySelector('.jcs-sub-retry');
                    if (retry) retry.onclick = () => searchSubtitles(q);
                }
                if (sub) sub.textContent = '失败 · ' + q;
                showToast('字幕搜索失败');
            }).then(() => {
                if (reqId === subReqSeq) setSubBusy(false);
            });
        }

    // ─── 页面高亮 ───────────────────────────────────────────

    function codeLinkTitle(code, native) {
        const c = String(code || '').trim();
        if (!c) return '';
        if (preferExternalSearch()) {
            return c + ' · 点击选搜索网站（新标签打开）· Alt+复制' + (native ? ' · Ctrl+点击打开原网页' : '');
        }
        return c + ' · 点击在本页搜索 · Alt+复制' + (native ? ' · Ctrl+点击打开原网页' : '');
    }

    /** 是否为整卡链接（含图/多块结构）——不可套用行内高亮样式，否则布局错乱 */
    function isCardLikeAnchor(a) {
        if (!a) return false;
        const cls = String(a.className || '');
        if (/\bmovie-box\b|\bvideo-box\b|\bthumb\b|\bcard\b/i.test(cls)) return true;
        if (a.querySelector('img, video, picture, .photo-frame, .photo-info, .item-tag')) return true;
        let n = 0;
        for (let c = a.firstElementChild; c && n < 3; c = c.nextElementSibling) n++;
        return n >= 2;
    }

    /** 只在「高亮块」上拦截点击；不挡父级 a 其余区域的原站跳转 */
    function bindCodeMarkClick(el, code) {
        if (!el || !code) return;
        el.classList.add(NS + '-code-mark');
        el.setAttribute('data-jcs-code', code);
        el.setAttribute('title', codeLinkTitle(code, true).replace('Ctrl+点击打开原网页', '点卡片其他区域进详情'));
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        if (el.dataset.jcsMarkBound === '1') return;
        el.dataset.jcsMarkBound = '1';
        const onAct = (e) => {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            if (e.ctrlKey || e.metaKey || e.shiftKey || (e.button != null && e.button === 1)) return;
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (e.altKey) copyCode(code);
            else openSearch(code, { anchor: el });
        };
        el.addEventListener('click', onAct, true);
        el.addEventListener('keydown', onAct, true);
    }

    /**
     * 给卡片/链接内短节点加色标（date 等），只在色标上绑搜索
     * 不改外层 a 布局类
     */
    function markInnerCodeNodes(root, code) {
        if (!root || !code) return 0;
        let marked = 0;
        try {
            root.querySelectorAll('date, time, .date, .uid, .code, .id').forEach((el) => {
                if (!el || (el.closest && el.closest('#' + NS + '-host'))) return;
                if (el.classList && el.classList.contains(NS + '-code-mark')) {
                    marked++;
                    return;
                }
                if (el.querySelector && el.querySelector('img, video, .item-tag, button')) return;
                const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
                if (!t || t.length > 24) return;
                if (extractJavCode(t) !== code && !textLooksLikeCode(t, code)) return;
                bindCodeMarkClick(el, code);
                marked++;
            });
        } catch (e) { /* ignore */ }
        return marked;
    }

    /** 在根节点内扫文本，只给番号加 span 色标（insideAnchor=true 时不挡外层 a） */
    function markTextCodesInRoot(root, insideAnchor) {
        if (!root) return 0;
        let hit = 0;
        try {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    const p = node.parentElement;
                    if (!p) return NodeFilter.FILTER_REJECT;
                    if (p.closest(SKIP_SEL + ',.' + NS + '-code-mark, a.' + NS + '-link')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const before = node.parentNode;
                processTextNode(node, !!insideAnchor);
                if (before && (!node.parentNode || node.parentNode !== before)) hit++;
            }
        } catch (e) { /* ignore */ }
        return hit;
    }

    /**
     * 内置链接/卡片：只高亮番号，不整链/整卡套样式
     * 点番号 → 搜索；点其余区域 → 原站
     */
    function enhanceNativeAnchorCodes(a, code) {
        if (!a || !code) return;
        // 去掉旧版「整链 is-native」样式与劫持（clone 清 listener）
        if (a.classList.contains(NS + '-link') || a.classList.contains('is-native')) {
            const neu = a.cloneNode(true);
            neu.classList.remove(NS + '-link', 'is-native', 'is-native-card', 'is-pick-on');
            const tip = neu.getAttribute('title') || '';
            if (/点击选搜索网站|点击在本页搜索|Alt\+复制/.test(tip)) neu.removeAttribute('title');
            if (neu.getAttribute('aria-label') && /番号/.test(neu.getAttribute('aria-label') || '')) {
                neu.removeAttribute('aria-label');
            }
            if (a.parentNode) a.parentNode.replaceChild(neu, a);
            a = neu;
        }
        if (a._jcsCardClick) {
            try { a.removeEventListener('click', a._jcsCardClick, true); } catch (e) { /* ignore */ }
            a._jcsCardClick = null;
        }
        a.dataset.jcsBound = '1';
        a.dataset.code = code;
        const card = isCardLikeAnchor(a);
        if (card) a.dataset.jcsCard = '1';
        else {
            try { delete a.dataset.jcsCard; } catch (e) { /* ignore */ }
            a.removeAttribute('data-jcs-card');
        }

        // 短叶子本身就是番号
        const own = String(a.textContent || '').replace(/\s+/g, ' ').trim();
        if (own && own.length <= 24 && !a.firstElementChild) {
            const only = extractJavCode(own);
            if (only && textLooksLikeCode(own, only)) {
                // 纯文本 a：包一层 span，外层 a 仍可进详情
                const span = document.createElement('span');
                span.setAttribute('data-jcs-wrap', '1');
                span.textContent = a.textContent;
                a.textContent = '';
                a.appendChild(span);
                bindCodeMarkClick(span, only || code);
                a.dataset.jcsCardMark = '1';
                return;
            }
        }

        let n = markInnerCodeNodes(a, code);
        n += markTextCodesInRoot(a, true);
        a.dataset.jcsCardMark = n ? '1' : '0';
    }

    function bindCodeLinkEl(el, code, opts) {
        if (!el || !code) return;
        const o = opts || {};
        // 站内原链/卡片：只标番号，不劫持整链
        if (o.native) {
            enhanceNativeAnchorCodes(el, code);
            return;
        }
        el.classList.add(NS + '-link');
        el.dataset.code = code;
        el.title = codeLinkTitle(code, false);
        if (el.dataset.jcsBound === '1') return;
        el.dataset.jcsBound = '1';
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.altKey || e.metaKey) copyCode(code);
            else openSearch(code, { anchor: el });
        }, true);
    }

    function createCodeLink(raw, code) {
        const a = document.createElement('a');
        a.href = buildProviderUrl(code, loadProviderId());
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = raw;
        bindCodeLinkEl(a, code, { native: false });
        return a;
    }

    /** 文本是否几乎就是番号本身（列表标题链常见） */
    function textLooksLikeCode(text, code) {
        const t = String(text || '').trim();
        const c = String(code || '').trim();
        if (!t || !c || t.length > 48) return false;
        const compact = (s) => String(s).toUpperCase().replace(/[\s_\-·.]+/g, '');
        const tc = compact(t);
        const cc = compact(c);
        if (!tc || !cc) return false;
        if (tc === cc) return true;
        // 「SQTE-703 高清」等短标题
        if (tc.indexOf(cc) === 0 && tc.length <= cc.length + 12) return true;
        return false;
    }

    function textContainsCode(text, code) {
        const t = String(text || '').toUpperCase();
        const c = String(code || '').toUpperCase();
        if (!t || !c) return false;
        if (t.indexOf(c) >= 0) return true;
        const compact = (s) => String(s).toUpperCase().replace(/[\s_\-·.]+/g, '');
        return compact(t).indexOf(compact(c)) >= 0;
    }

    /** href / 路径末段是否像番号详情（javbus.com/PXVR-413） */
    function codeFromHrefPath(href) {
        if (!href) return '';
        let path = String(href);
        try {
            const u = new URL(href, location.href);
            path = u.pathname || path;
            const keys = ['id', 'cid', 'code', 'v', 'video', 'movie'];
            for (let i = 0; i < keys.length; i++) {
                const v = u.searchParams.get(keys[i]);
                if (!v) continue;
                const c = extractJavCode(v) || fromDmmCid(v);
                if (c) return c;
            }
        } catch (e) { /* ignore */ }

        // /jav/sqte-703/ · /v/ssis-001/
        let m = String(path).match(
            /\/(?:jav|javid|video|videos|movie|movies|watch|detail|item|av|v)\/([a-z0-9][a-z0-9_-]{2,24})(?:\/|$|[?#])/i
        );
        if (m) {
            const c = extractJavCode(m[1]) || fromDmmCid(m[1]);
            if (c) return c;
        }
        // javbus：/PXVR-413 或 /PXVR-413/ 路径末段即番号
        m = String(path).match(/\/([A-Za-z]{2,10}[-_]?[0-9]{2,6})(?:\/)?(?:[?#]|$)/);
        if (m) {
            const c = extractJavCode(m[1]) || fromDmmCid(m[1]);
            if (c) return c;
        }
        // 整段 href 兜底
        return extractJavCode(href) || fromDmmCid(href) || '';
    }

    /** 从 a[href] 解析番号：子节点 date / 正文 / 路径 / 查询参数 */
    function codeFromAnchor(a) {
        if (!a) return '';

        // javbus：<date>PXVR-413</date>
        try {
            const dateNodes = a.querySelectorAll('date, .date, [class*="uid"], [class*="code"], .id');
            for (let i = 0; i < dateNodes.length; i++) {
                const c = extractJavCode(dateNodes[i].textContent || '');
                if (c) return c;
            }
        } catch (e) { /* ignore */ }

        // img title / alt 常含番号
        try {
            const img = a.querySelector('img[title], img[alt]');
            if (img) {
                const c = extractJavCode(img.getAttribute('title') || '') ||
                    extractJavCode(img.getAttribute('alt') || '');
                if (c) return c;
            }
        } catch (e) { /* ignore */ }

        const text = String(a.textContent || '').replace(/\s+/g, ' ').trim();
        let code = extractJavCode(text);
        if (code && textLooksLikeCode(text, code)) return code;

        let href = '';
        try { href = a.href || a.getAttribute('href') || ''; } catch (e) { href = a.getAttribute('href') || ''; }
        if (!href || href === '#' || href.indexOf('javascript:') === 0) {
            // 长标题里仍可能扫到番号（卡片链）
            return code || '';
        }

        const fromPath = codeFromHrefPath(href);
        if (fromPath) return fromPath;

        // 长标题正文里扫到的番号也可信（javbus 卡片）
        if (code) return code;
        return '';
    }

    /** 是否把该 a 纳入内置链接增强 */
    function shouldEnhanceAnchor(a, code) {
        if (!a || !code) return false;
        const text = String(a.textContent || '').replace(/\s+/g, ' ').trim();
        if (textLooksLikeCode(text, code) || textContainsCode(text, code)) return true;
        let href = '';
        try { href = a.getAttribute('href') || a.href || ''; } catch (e) { href = ''; }
        if (href && (codeFromHrefPath(href) === code || textContainsCode(href, code))) return true;
        if (/\bmovie-box\b/i.test(String(a.className || ''))) return true;
        if (a.closest && a.closest('.item.masonry-brick, .masonry-brick, .item')) return true;
        return false;
    }

    /** 内置链接/卡片：只在番号上色标，不整链/整卡高亮 */
    function enhanceExistingCodeLinks() {
        if (!document.body) return;
        if (state.hl && state.hl.nativeLinks === false) return;
        let nodes;
        try {
            nodes = document.body.querySelectorAll(DEFAULT_NATIVE_LINK_SELS);
        } catch (e) {
            return;
        }
        const limit = Math.min(nodes.length, 4000);
        const seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
        for (let i = 0; i < limit; i++) {
            let a = nodes[i];
            if (!a) continue;
            if (a.tagName !== 'A') a = a.closest && a.closest('a[href]');
            if (!a || a.tagName !== 'A') continue;
            if (a.closest && a.closest('#' + NS + '-host')) continue;
            if (seen) {
                if (seen.has(a)) continue;
                seen.add(a);
            }
            // 脚本自己插入的全文番号链：跳过
            if (a.classList.contains(NS + '-link') && !a.classList.contains('is-native')
                && a.dataset.jcsBound === '1' && !a.dataset.jcsCard) {
                continue;
            }
            // 已处理：补扫色标；旧版 is-native 整链 → 迁移为仅番号
            if (a.dataset.jcsBound === '1') {
                const code = a.dataset.code || codeFromAnchor(a);
                if (!code) continue;
                if (a.classList.contains('is-native') || a.classList.contains(NS + '-link')) {
                    enhanceNativeAnchorCodes(a, code);
                } else if (!a.querySelector('.' + NS + '-code-mark')) {
                    enhanceNativeAnchorCodes(a, code);
                } else {
                    markInnerCodeNodes(a, code);
                }
                continue;
            }

            let href = '';
            try { href = a.getAttribute('href') || ''; } catch (e) { href = ''; }
            const text = String(a.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text && !href) continue;
            if (text.length > 500 && !codeFromHrefPath(href)) continue;

            const code = codeFromAnchor(a);
            if (!code || !shouldEnhanceAnchor(a, code)) continue;
            enhanceNativeAnchorCodes(a, code);
        }
    }

    /**
     * 在文本节点里找出番号并包一层可点高亮
     * @param {boolean} insideAnchor 若在 <a> 内：用 span 色标（只点番号搜索，不挡整链）；否则用 a.jcs-link
     */
    function processTextNode(textNode, insideAnchor) {
        const text = textNode.nodeValue;
        if (!text || !/[A-Za-z]/.test(text)) return;
        // 已在色标内：互补，不再拆
        if (textNode.parentElement && textNode.parentElement.closest('.' + NS + '-code-mark, a.' + NS + '-link')) return;
        CODE_FIND_RE.lastIndex = 0;
        if (!CODE_FIND_RE.test(text)) return;
        CODE_FIND_RE.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let last = 0;
        let m;
        let hit = false;
        while ((m = CODE_FIND_RE.exec(text))) {
            const raw = m[0];
            const code = extractJavCode(raw);
            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            if (!code) {
                frag.appendChild(document.createTextNode(raw));
            } else {
                hit = true;
                if (insideAnchor) {
                    const span = document.createElement('span');
                    span.setAttribute('data-jcs-wrap', '1');
                    span.textContent = raw;
                    bindCodeMarkClick(span, code);
                    frag.appendChild(span);
                } else {
                    frag.appendChild(createCodeLink(raw, code));
                }
            }
            last = m.index + raw.length;
        }
        if (!hit) return;
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
    }

    /**
     * 自定义选择器核心：
     * 1) query 用户选择器
     * 2) 在匹配节点内扫描文字
     * 3) 只给识别到的番号加高亮 + 点击（不劫持整卡/整链）
     */
    function applyCustomSelectorHighlight() {
        if (!document.body) return 0;
        const parsed = getCustomSelectorParts();
        if (!parsed.parts.length) return 0;
        let roots;
        try {
            roots = document.body.querySelectorAll(parsed.parts.join(', '));
        } catch (e) {
            showToast('自定义选择器无效，请检查 CSS');
            return 0;
        }
        if (!roots || !roots.length) return 0;

        const seenText = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
        let hitCount = 0;
        const limit = Math.min(roots.length, 3000);

        for (let i = 0; i < limit; i++) {
            const root = roots[i];
            if (!root || root.nodeType !== 1) continue;
            if (root.closest && root.closest('#' + NS + '-host')) continue;

            // 根节点本身就是短番号（如 <date>PXVR-413</date>）
            const ownText = String(root.textContent || '').replace(/\s+/g, ' ').trim();
            if (ownText && ownText.length <= 24 && !root.firstElementChild) {
                const onlyCode = extractJavCode(ownText);
                if (onlyCode && textLooksLikeCode(ownText, onlyCode)) {
                    bindCodeMarkClick(root, onlyCode);
                    hitCount++;
                    continue;
                }
            }

            // 在根节点子树内扫文本（含 a 内部）
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    const p = node.parentElement;
                    if (!p) return NodeFilter.FILTER_REJECT;
                    if (p.closest(SKIP_SEL + ',.' + NS + '-code-mark, a.' + NS + '-link')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            const textNodes = [];
            while (walker.nextNode()) {
                const n = walker.currentNode;
                if (seenText && seenText.has(n)) continue;
                textNodes.push(n);
            }
            for (let t = 0; t < textNodes.length; t++) {
                const node = textNodes[t];
                if (seenText) seenText.add(node);
                const parent = node.parentElement;
                const inA = !!(parent && parent.closest('a[href]'));
                const parentBefore = node.parentNode;
                processTextNode(node, inA);
                if (parentBefore && (!node.parentNode || node.parentNode !== parentBefore)) hitCount++;
            }
        }
        return hitCount;
    }

    /**
     * 页面高亮
     * - 自定义选择器：在选定范围内扫文字 → 番号高亮（可点搜索，不挡其余点击）
     * - 内置链接/卡片：只标番号（与自定义相同策略）/ 全文正文：互补（only 则只跑自定义）
     */
    function linkifyPage() {
        if (!document.body || state.linkifyBusy) return;
        if (state.hl && state.hl.enabled === false) return;
        state.linkifyBusy = true;
        try {
            const custom = getCustomSelectorParts();
            const onlyCustom = custom.mode === 'replace' && custom.parts.length > 0;
            const hasCustom = custom.parts.length > 0;

            // ① 用户自定义范围：扫文字 → 标番号
            if (hasCustom) {
                applyCustomSelectorHighlight();
            }

            // only 模式：不再跑内置全文/内置链接
            if (onlyCustom) return;

            // ② 内置：站内 a/卡片增强
            if (!state.hl || state.hl.nativeLinks !== false) {
                enhanceExistingCodeLinks();
            }
            // ③ 内置：全文纯文本（不在 a 内）
            if (!state.hl || state.hl.textNodes !== false) {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                    acceptNode(node) {
                        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                        const p = node.parentElement;
                        if (!p) return NodeFilter.FILTER_REJECT;
                        if (p.closest(SKIP_SEL + ',a,.' + NS + '-link,.' + NS + '-code-mark')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                });
                const nodes = [];
                while (walker.nextNode()) nodes.push(walker.currentNode);
                for (let i = 0; i < nodes.length; i++) processTextNode(nodes[i], false);
            }
        } finally {
            state.linkifyBusy = false;
        }
    }

    // ─── UI ─────────────────────────────────────────────────

    function injectStyles() {
        let css = document.getElementById(NS + '-styles');
        if (css && css.getAttribute('data-ver') === STYLE_VER) return;
        if (css && css.parentNode) css.parentNode.removeChild(css);
        css = document.createElement('style');
        css.id = NS + '-styles';
        css.setAttribute('data-ver', STYLE_VER);
        css.textContent = `
/* 设计 token：深色默认；浅色由 theme 覆盖 */
:root{
  --jcs-bg:#0e1014;--jcs-panel:#151922;--jcs-panel2:#161a22;--jcs-surface:#0a0c10;
  --jcs-line:rgba(255,255,255,.1);--jcs-text:#e8eaef;--jcs-muted:#8b93a7;--jcs-soft:#d7dbe6;
  --jcs-accent:#d4534a;--jcs-accent2:#ff8a7a;
  --jcs-accent-dim:rgba(212,83,74,.16);--jcs-accent-line:rgba(212,83,74,.4);
  --jcs-fill:rgba(255,255,255,.05);--jcs-fill-hover:rgba(255,255,255,.12);
  --jcs-fill-2:rgba(255,255,255,.04);--jcs-chip-line:rgba(255,255,255,.12);
  --jcs-side:rgba(0,0,0,.22);--jcs-overlay:rgba(0,0,0,.58);--jcs-cfg:rgba(14,16,20,.98);
  --jcs-empty:#6b7280;--jcs-tip-fade:rgba(0,0,0,.72);
  --jcs-ok:#34d399;--jcs-danger:#f43f5e;--jcs-warn:#fbbf24;
  --jcs-radius:14px;--jcs-radius-md:10px;--jcs-radius-sm:8px;--jcs-radius-xs:6px;
  --jcs-font:12px/1.45 "Segoe UI",system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  --jcs-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --jcs-shadow:0 18px 48px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.03) inset;
  --jcs-shadow-sm:0 4px 14px rgba(0,0,0,.22);
  --jcs-toast-bg:rgba(20,22,28,.94);--jcs-toast-fg:#fff;
  --jcs-ease:cubic-bezier(.2,.8,.2,1);--jcs-fast:.12s;--jcs-med:.18s;
  --jcs-focus:0 0 0 3px var(--jcs-accent-dim)
}
html[data-jcs-theme="light"],
#${NS}-host[data-theme="light"]{
  --jcs-bg:#f0f2f5;--jcs-panel:#ffffff;--jcs-panel2:#f7f8fa;--jcs-surface:#eef1f5;
  --jcs-line:rgba(15,23,42,.1);--jcs-text:#1a1d26;--jcs-muted:#667085;--jcs-soft:#2d3340;
  --jcs-accent:#c9443c;--jcs-accent2:#a8322b;
  --jcs-accent-dim:rgba(201,68,60,.1);--jcs-accent-line:rgba(201,68,60,.35);
  --jcs-fill:rgba(15,23,42,.04);--jcs-fill-hover:rgba(15,23,42,.08);
  --jcs-fill-2:rgba(15,23,42,.03);--jcs-chip-line:rgba(15,23,42,.1);
  --jcs-side:rgba(15,23,42,.03);--jcs-overlay:rgba(15,23,42,.42);--jcs-cfg:rgba(255,255,255,.99);
  --jcs-empty:#98a2b3;--jcs-tip-fade:rgba(15,23,42,.5);
  --jcs-ok:#059669;--jcs-danger:#e11d48;--jcs-warn:#d97706;
  --jcs-shadow:0 18px 48px rgba(15,23,42,.12),0 0 0 1px rgba(15,23,42,.04) inset;
  --jcs-shadow-sm:0 4px 14px rgba(15,23,42,.08);
  --jcs-toast-bg:rgba(26,29,38,.92);--jcs-toast-fg:#fff
}
html[data-jcs-theme="dark"],
#${NS}-host[data-theme="dark"]{
  --jcs-bg:#0e1014;--jcs-panel:#151922;--jcs-panel2:#161a22;--jcs-surface:#0a0c10;
  --jcs-line:rgba(255,255,255,.1);--jcs-text:#e8eaef;--jcs-muted:#8b93a7;--jcs-soft:#d7dbe6;
  --jcs-accent:#d4534a;--jcs-accent2:#ff8a7a;
  --jcs-accent-dim:rgba(212,83,74,.16);--jcs-accent-line:rgba(212,83,74,.4);
  --jcs-fill:rgba(255,255,255,.05);--jcs-fill-hover:rgba(255,255,255,.12);
  --jcs-fill-2:rgba(255,255,255,.04);--jcs-chip-line:rgba(255,255,255,.12);
  --jcs-side:rgba(0,0,0,.22);--jcs-overlay:rgba(0,0,0,.58);--jcs-cfg:rgba(14,16,20,.98);
  --jcs-empty:#6b7280;--jcs-tip-fade:rgba(0,0,0,.72);
  --jcs-ok:#34d399;--jcs-danger:#f43f5e;--jcs-warn:#fbbf24;
  --jcs-shadow:0 18px 48px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.03) inset;
  --jcs-shadow-sm:0 4px 14px rgba(0,0,0,.22);
  --jcs-toast-bg:rgba(20,22,28,.94);--jcs-toast-fg:#fff
}
#${NS}-host, #${NS}-host *{box-sizing:border-box}
#${NS}-host button,#${NS}-host input,#${NS}-host textarea{
  font-family:inherit;-webkit-tap-highlight-color:transparent
}
#${NS}-toast{
  position:absolute;left:50%;bottom:max(24px,env(safe-area-inset-bottom));
  transform:translateX(-50%) translateY(12px);z-index:20;
  max-width:min(90vw,340px);padding:10px 18px;border-radius:999px;
  background:var(--jcs-toast-bg);color:var(--jcs-toast-fg);
  font:var(--jcs-font);font-size:13px;font-weight:700;
  box-shadow:var(--jcs-shadow-sm),0 0 0 1px rgba(255,255,255,.06) inset;
  opacity:0;pointer-events:none;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  transition:opacity var(--jcs-med) var(--jcs-ease),transform var(--jcs-med) var(--jcs-ease);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
#${NS}-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
/* 行内插入的番号链 / 短文字原链 */
a.${NS}-link{
  color:var(--jcs-accent)!important;font-weight:700!important;cursor:pointer!important;
  text-decoration:underline dotted!important;background:var(--jcs-accent-dim)!important;
  border-radius:4px;padding:0 3px;-webkit-tap-highlight-color:transparent;
  transition:background .12s ease,color .12s ease,box-shadow .12s ease
}
a.${NS}-link:hover,a.${NS}-link:active{
  background:var(--jcs-accent)!important;color:#fff!important;text-decoration:none!important
}
/* 站内短链（h3 标题等，非整卡） */
a.${NS}-link.is-native{
  text-decoration:none!important;
  box-shadow:inset 0 0 0 1px var(--jcs-accent-line);
  border-radius:6px!important;padding:1px 6px!important;
  box-decoration-break:clone;-webkit-box-decoration-break:clone
}
a.${NS}-link.is-native:hover,a.${NS}-link.is-native:active{
  box-shadow:inset 0 0 0 1px transparent,0 2px 10px rgba(212,83,74,.35)
}
.data h3 a.${NS}-link.is-native,
h3 a.${NS}-link.is-native,
.post a.${NS}-link.is-native{
  display:inline!important;line-height:1.35
}
/*
 * 整卡内番号色标：只点这里触发搜索；点封面/标题仍走原站链接
 */
.${NS}-code-mark,
date.${NS}-code-mark,
time.${NS}-code-mark{
  color:var(--jcs-accent)!important;
  font-weight:700!important;
  background:var(--jcs-accent-dim)!important;
  border-radius:3px;
  padding:0 2px;
  cursor:pointer!important;
  -webkit-box-decoration-break:clone;box-decoration-break:clone;
  position:relative;z-index:2;
  transition:background .12s ease,color .12s ease,box-shadow .12s ease
}
.${NS}-code-mark:hover,
date.${NS}-code-mark:hover,
time.${NS}-code-mark:hover{
  background:var(--jcs-accent)!important;
  color:#fff!important;
  box-shadow:0 1px 6px rgba(212,83,74,.35)
}
#${NS}-host{
  position:fixed;inset:0;z-index:2147483000;pointer-events:none;margin:0;padding:0;border:0;
  overflow:visible;transform:none!important;contain:none!important;
  color:var(--jcs-text);font:var(--jcs-font);color-scheme:dark
}
#${NS}-host[data-theme="light"]{color-scheme:light}
#${NS}-host[data-theme="dark"]{color-scheme:dark}
/* 点选选择器时收起脚本浮层，露出页面 */
#${NS}-host .jcs-selpick-dim,
#${NS}-popup.jcs-selpick-dim,#${NS}-panel.jcs-selpick-dim,#${NS}-fab.jcs-selpick-dim,#${NS}-sub.jcs-selpick-dim{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important
}
#${NS}-selpick{
  position:absolute;inset:0;z-index:50;display:none;pointer-events:none;
  font:var(--jcs-font);color:var(--jcs-text)
}
#${NS}-selpick.is-on{display:block}
#${NS}-selpick-box{
  position:fixed;z-index:51;pointer-events:none;box-sizing:border-box;
  border:2px solid var(--jcs-accent);border-radius:6px;
  background:color-mix(in srgb,var(--jcs-accent) 14%,transparent);
  box-shadow:0 0 0 1px rgba(255,255,255,.35) inset,0 8px 28px rgba(212,83,74,.35);
  transition:left .04s linear,top .04s linear,width .04s linear,height .04s linear
}
#${NS}-selpick-box[hidden]{display:none!important}
#${NS}-selpick-bar{
  position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));
  transform:translateX(-50%);z-index:52;pointer-events:auto;
  width:min(560px,calc(100vw - 24px));
  padding:12px 14px;border-radius:14px;box-sizing:border-box;
  background:var(--jcs-cfg);color:var(--jcs-text);
  border:1px solid var(--jcs-line);box-shadow:var(--jcs-shadow);
  display:flex;flex-direction:column;gap:10px
}
#${NS}-selpick-bar[hidden]{display:none!important}
#${NS}-selpick .${NS}-selpick-bar-hd{
  display:flex;flex-direction:column;gap:2px;min-width:0
}
#${NS}-selpick .${NS}-selpick-bar-hd strong{
  font-size:13.5px;font-weight:800
}
#${NS}-selpick .${NS}-selpick-bar-hd span{
  font-size:11.5px;color:var(--jcs-muted);line-height:1.4
}
#${NS}-selpick .${NS}-selpick-confirm{
  display:flex;flex-direction:column;gap:8px;min-width:0
}
#${NS}-selpick .${NS}-selpick-confirm[hidden]{display:none!important}
#${NS}-selpick .${NS}-selpick-label{
  display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:var(--jcs-muted)
}
#${NS}-selpick .${NS}-selpick-label input{
  width:100%;height:38px;box-sizing:border-box;padding:0 12px;border-radius:10px;
  border:1px solid var(--jcs-line);background:var(--jcs-surface);color:var(--jcs-text);
  font:12px/1.4 var(--jcs-mono);outline:none
}
#${NS}-selpick .${NS}-selpick-label input:focus{border-color:var(--jcs-accent-line);box-shadow:var(--jcs-focus)}
#${NS}-selpick .${NS}-selpick-cands{
  display:flex;flex-direction:column;gap:6px;max-height:148px;overflow:auto;
  scrollbar-width:thin
}
#${NS}-selpick .${NS}-selpick-cand{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  width:100%;text-align:left;padding:8px 10px;border-radius:10px;cursor:pointer;
  border:1px solid var(--jcs-line);background:var(--jcs-fill);color:var(--jcs-text);
  font:inherit
}
#${NS}-selpick .${NS}-selpick-cand:hover{background:var(--jcs-fill-hover);border-color:var(--jcs-chip-line)}
#${NS}-selpick .${NS}-selpick-cand.is-on{
  background:var(--jcs-accent-dim);border-color:var(--jcs-accent-line);color:var(--jcs-accent2)
}
#${NS}-selpick .${NS}-selpick-cand code{
  font:11.5px/1.35 var(--jcs-mono);word-break:break-all;min-width:0
}
#${NS}-selpick .${NS}-selpick-cand em{
  flex:0 0 auto;font-style:normal;font-size:10.5px;color:var(--jcs-muted);white-space:nowrap
}
#${NS}-selpick .${NS}-selpick-cand.is-on em{color:var(--jcs-accent2)}
#${NS}-selpick .${NS}-selpick-meta{
  margin:0;font-size:11.5px;color:var(--jcs-muted);line-height:1.4
}
#${NS}-selpick .${NS}-selpick-meta b{color:var(--jcs-accent2)}
#${NS}-selpick .${NS}-selpick-meta .is-err{color:var(--jcs-danger);font-weight:700}
#${NS}-selpick .${NS}-selpick-actions{
  display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end
}
#${NS}-selpick .jcs-btn{
  height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill);color:var(--jcs-text);cursor:pointer;font:inherit;
  font-size:12px;font-weight:700;line-height:1;
  display:inline-flex;align-items:center;justify-content:center
}
#${NS}-selpick .jcs-btn:hover{background:var(--jcs-fill-hover)}
#${NS}-selpick .jcs-btn.solid{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent));border-color:transparent;color:#fff
}
html.${NS}-selpicking,html.${NS}-selpicking body{cursor:crosshair!important}
#${NS}-fab{
  position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));
  z-index:3;min-width:52px;height:52px;padding:0 14px;border:0;border-radius:16px;cursor:pointer;
  font:var(--jcs-font);font-weight:800;font-size:12px;letter-spacing:.02em;color:#fff;
  background:linear-gradient(145deg,#e05a50 0%,var(--jcs-accent) 48%,#b53a33 100%);
  box-shadow:0 10px 28px rgba(212,83,74,.38),0 0 0 1px rgba(255,255,255,.12) inset;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;
  transition:transform var(--jcs-med) var(--jcs-ease),box-shadow var(--jcs-med) ease,filter var(--jcs-fast) ease
}
#${NS}-fab:hover{filter:brightness(1.05);box-shadow:0 12px 32px rgba(212,83,74,.44),0 0 0 1px rgba(255,255,255,.14) inset}
#${NS}-fab:active{transform:scale(.96);filter:brightness(.96)}
#${NS}-fab:focus-visible{outline:none;box-shadow:0 10px 28px rgba(212,83,74,.38),var(--jcs-focus)}
#${NS}-fab .jcs-fab-ico{
  width:18px;height:18px;border-radius:6px;flex:0 0 auto;
  display:grid;place-items:center;background:rgba(255,255,255,.18);
  font-size:11px;font-weight:900;line-height:1
}
#${NS}-fab .jcs-fab-txt{font-size:12px;font-weight:800;line-height:1}
#${NS}-fab .jcs-badge{
  position:absolute;top:-5px;right:-5px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;
  background:#fff;color:var(--jcs-accent);font-size:10px;font-weight:800;
  display:inline-flex;align-items:center;justify-content:center;
  box-shadow:0 2px 8px rgba(0,0,0,.25);border:1.5px solid rgba(212,83,74,.25);
  font-variant-numeric:tabular-nums
}
#${NS}-fab .jcs-badge.is-zero{opacity:.55;background:rgba(255,255,255,.92)}
html.${NS}-popup-open #${NS}-fab,html.${NS}-popup-open #${NS}-panel{display:none!important}
html.${NS}-sub-open #${NS}-fab{display:none!important}
#${NS}-host:has(#${NS}-panel.show) #${NS}-fab{display:none!important}
#${NS}-host:has(#${NS}-sub.show) #${NS}-fab{display:none!important}
#${NS}-panel{
  position:absolute;right:max(12px,env(safe-area-inset-right));bottom:calc(72px + env(safe-area-inset-bottom));
  z-index:4;width:320px;min-height:min(320px,60dvh);max-height:min(520px,70dvh);
  display:none;flex-direction:column;color:var(--jcs-text);font:var(--jcs-font);
  background:linear-gradient(180deg,var(--jcs-panel2) 0%,var(--jcs-bg) 42%);
  border:1px solid var(--jcs-line);border-radius:var(--jcs-radius);box-shadow:var(--jcs-shadow);overflow:hidden
}
#${NS}-panel.show{display:flex;animation:jcs-panel-in .18s var(--jcs-ease)}
@keyframes jcs-panel-in{from{opacity:.55;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
#${NS}-panel .jcs-sheet-bar{display:none}
#${NS}-panel .jcs-head{
  display:flex;align-items:center;gap:8px;padding:12px 12px 10px;cursor:move;user-select:none;
  border-bottom:1px solid var(--jcs-line);flex-shrink:0;touch-action:none;
  background:linear-gradient(180deg,var(--jcs-fill-2),transparent)
}
#${NS}-panel .jcs-brand{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
#${NS}-panel .jcs-mark{
  width:24px;height:24px;border-radius:8px;flex:0 0 auto;display:grid;place-items:center;
  background:linear-gradient(145deg,var(--jcs-accent),#9b2f2a);color:#fff;font-size:10px;font-weight:800;
  box-shadow:0 2px 8px rgba(212,83,74,.28)
}
#${NS}-panel .jcs-brand strong{display:block;font-size:13px;font-weight:800}
#${NS}-panel .jcs-brand span{display:block;font-size:10.5px;color:var(--jcs-muted);margin-top:1px}
#${NS}-panel .jcs-icon{
  border:1px solid var(--jcs-line);background:var(--jcs-fill);color:var(--jcs-text);
  border-radius:10px;width:36px;height:36px;padding:0;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;
  transition:background var(--jcs-fast) ease,border-color var(--jcs-fast) ease,transform var(--jcs-fast) ease
}
#${NS}-panel .jcs-icon:hover{background:var(--jcs-fill-hover);border-color:var(--jcs-chip-line)}
#${NS}-panel .jcs-icon:active{transform:scale(.94)}
#${NS}-panel .jcs-icon:focus-visible{outline:none;box-shadow:var(--jcs-focus)}
#${NS}-panel .jcs-icon.is-on,
#${NS}-win .jcs-actions .jcs-btn.is-on,#${NS}-win .jcs-actions .jcs-icon.is-on{
  background:var(--jcs-accent-dim)!important;border-color:var(--jcs-accent-line)!important;color:var(--jcs-accent2)!important
}
/* ── 设置页 ── */
#${NS}-cfg{
  position:absolute!important;inset:0!important;z-index:5;display:none;flex-direction:column!important;
  background:var(--jcs-cfg);color:var(--jcs-text);padding:0!important;margin:0!important;
  min-width:0!important;min-height:0!important;max-height:100%!important;height:auto!important;
  overflow:hidden!important;box-sizing:border-box!important;
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)
}
#${NS}-cfg.show{display:flex!important;animation:jcs-cfg-in .2s var(--jcs-ease)}
@keyframes jcs-cfg-in{from{opacity:.6;transform:translateY(6px)}to{opacity:1;transform:none}}
#${NS}-cfg .jcs-cfg-top{
  display:flex;align-items:center;gap:10px;padding:14px 16px 12px;flex:0 0 auto!important;
  border-bottom:1px solid var(--jcs-line);
  background:linear-gradient(180deg,var(--jcs-fill-2) 0%,transparent 100%)
}
#${NS}-cfg .jcs-cfg-brand{flex:1;min-width:0}
#${NS}-cfg .jcs-cfg-brand strong{
  display:block;font-size:15px;font-weight:800;letter-spacing:.01em;color:var(--jcs-text)
}
#${NS}-cfg .jcs-cfg-host{
  display:block;margin-top:3px;font-size:11px;color:var(--jcs-muted);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
#${NS}-cfg .jcs-cfg-top .jcs-icon{
  width:36px;height:36px;border-radius:10px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill);color:var(--jcs-text);cursor:pointer;font:inherit;font-size:18px;
  display:inline-flex;align-items:center;justify-content:center;
  transition:background var(--jcs-fast) ease,border-color var(--jcs-fast) ease,transform var(--jcs-fast) ease
}
#${NS}-cfg .jcs-cfg-top .jcs-icon:hover{background:var(--jcs-fill-hover);border-color:var(--jcs-chip-line)}
#${NS}-cfg .jcs-cfg-top .jcs-icon:active{transform:scale(.94)}
#${NS}-cfg .jcs-cfg-tabs{
  display:flex;gap:6px;padding:10px 14px;flex:0 0 auto!important;border-bottom:1px solid var(--jcs-line);
  background:var(--jcs-fill-2);overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none
}
#${NS}-cfg .jcs-cfg-tabs::-webkit-scrollbar{display:none}
#${NS}-cfg .jcs-cfg-tab{
  flex:0 0 auto;height:36px;padding:0 16px;border:0;border-radius:999px;cursor:pointer;
  background:transparent;color:var(--jcs-muted);font:inherit;font-size:12.5px;font-weight:750;
  transition:background var(--jcs-fast) var(--jcs-ease),color var(--jcs-fast) ease,box-shadow var(--jcs-fast) ease
}
#${NS}-cfg .jcs-cfg-tab:hover{color:var(--jcs-soft);background:var(--jcs-fill)}
#${NS}-cfg .jcs-cfg-tab:focus-visible{outline:none;box-shadow:var(--jcs-focus)}
#${NS}-cfg .jcs-cfg-tab.is-on{
  background:var(--jcs-accent-dim);color:var(--jcs-accent2);
  box-shadow:0 0 0 1px var(--jcs-accent-line) inset
}
/* 站点常把 div{overflow:visible!important}，必须 !important 才能出滚动条 */
#${NS}-cfg .jcs-cfg-body{
  flex:1 1 auto!important;min-height:0!important;max-height:none!important;height:auto!important;
  overflow-x:hidden!important;overflow-y:auto!important;overflow:auto!important;
  padding:14px 16px 20px;box-sizing:border-box!important;
  -webkit-overflow-scrolling:touch;overscroll-behavior:contain;
  scrollbar-width:thin;scrollbar-color:var(--jcs-chip-line) transparent;
  touch-action:pan-y
}
#${NS}-cfg .jcs-cfg-body::-webkit-scrollbar{width:6px;height:6px}
#${NS}-cfg .jcs-cfg-body::-webkit-scrollbar-thumb{
  background:var(--jcs-chip-line);border-radius:99px
}
#${NS}-cfg .jcs-cfg-body::-webkit-scrollbar-thumb:hover{background:var(--jcs-muted)}
/* 不用 [hidden]：UA 的 display:none!important 会压过 .is-on */
#${NS}-cfg .jcs-cfg-pane{
  display:none!important;flex-direction:column;gap:12px;min-width:0;min-height:0;
  flex:0 0 auto!important;height:auto!important;max-height:none!important;overflow:visible!important
}
#${NS}-cfg .jcs-cfg-pane.is-on{display:flex!important}
#${NS}-cfg .jcs-card{
  border:1px solid var(--jcs-line);border-radius:14px;
  background:linear-gradient(180deg,var(--jcs-fill-2),var(--jcs-surface));
  padding:14px 16px;display:flex;flex-direction:column;gap:12px;min-width:0;
  box-shadow:0 1px 0 rgba(255,255,255,.03) inset;
  transition:border-color var(--jcs-fast) ease,box-shadow var(--jcs-med) ease
}
#${NS}-cfg .jcs-card:hover{border-color:var(--jcs-chip-line)}
#${NS}-cfg .jcs-card-hd{
  display:flex;align-items:flex-start;justify-content:space-between;gap:10px
}
#${NS}-cfg .jcs-card-hd strong{
  display:block;font-size:13.5px;font-weight:800;color:var(--jcs-text);letter-spacing:.01em
}
#${NS}-cfg .jcs-card-hd p,#${NS}-cfg .jcs-card-desc{
  margin:4px 0 0;font-size:11.5px;line-height:1.5;color:var(--jcs-muted);font-weight:500
}
/* 统一设置内按钮 */
#${NS}-cfg .jcs-btn{
  height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill);color:var(--jcs-text);cursor:pointer;font:inherit;
  font-size:12px;font-weight:700;line-height:1;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  transition:background var(--jcs-fast) ease,border-color var(--jcs-fast) ease,
    filter var(--jcs-fast) ease,transform var(--jcs-fast) ease,box-shadow var(--jcs-fast) ease
}
#${NS}-cfg .jcs-btn:hover{background:var(--jcs-fill-hover);border-color:var(--jcs-chip-line)}
#${NS}-cfg .jcs-btn:active{transform:scale(.97)}
#${NS}-cfg .jcs-btn:focus-visible{outline:none;box-shadow:var(--jcs-focus)}
#${NS}-cfg .jcs-btn.solid{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent));
  border-color:transparent;color:#fff;box-shadow:0 4px 12px rgba(212,83,74,.28)
}
#${NS}-cfg .jcs-btn.solid:hover{filter:brightness(1.06);background:linear-gradient(145deg,#e05a50,var(--jcs-accent))}
#${NS}-cfg .jcs-btn:disabled{opacity:.45;cursor:not-allowed;transform:none;filter:none}
#${NS}-cfg .jcs-switch{
  position:relative;display:inline-flex;align-items:center;width:44px;height:26px;flex:0 0 auto;
  cursor:pointer;user-select:none
}
#${NS}-cfg .jcs-switch input{
  position:absolute;inset:0;z-index:2;width:100%;height:100%;margin:0;opacity:0;cursor:pointer
}
#${NS}-cfg .jcs-switch i{pointer-events:none}
#${NS}-cfg .jcs-switch i{
  position:absolute;inset:0;border-radius:999px;background:var(--jcs-fill-hover);
  border:1px solid var(--jcs-chip-line);
  transition:background var(--jcs-med) var(--jcs-ease),border-color var(--jcs-med) ease,box-shadow var(--jcs-fast) ease
}
#${NS}-cfg .jcs-switch i::after{
  content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;
  background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.22);
  transition:transform var(--jcs-med) var(--jcs-ease)
}
#${NS}-cfg .jcs-switch input:checked + i{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent));border-color:transparent;
  box-shadow:0 0 0 1px rgba(212,83,74,.2) inset
}
#${NS}-cfg .jcs-switch input:checked + i::after{transform:translateX(18px)}
#${NS}-cfg .jcs-switch input:focus-visible + i{box-shadow:var(--jcs-focus)}
#${NS}-cfg .jcs-switch input:disabled + i{opacity:.45}
#${NS}-cfg .jcs-switch-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:8px 0;border-top:1px solid var(--jcs-line)
}
#${NS}-cfg .jcs-switch-row:first-of-type{border-top:0;padding-top:0}
#${NS}-cfg .jcs-switch-row > div{min-width:0;flex:1}
#${NS}-cfg .jcs-switch-row b{display:block;font-size:12.5px;font-weight:700;color:var(--jcs-soft)}
#${NS}-cfg .jcs-switch-row em{
  display:block;margin-top:2px;font-style:normal;font-size:11px;line-height:1.4;color:var(--jcs-muted);font-weight:500
}
#${NS}-cfg .jcs-badge-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
#${NS}-cfg .jcs-pill{
  display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:999px;
  font-size:10.5px;font-weight:700;border:1px solid var(--jcs-chip-line);
  background:var(--jcs-fill);color:var(--jcs-muted)
}
#${NS}-cfg .jcs-pill.is-on{
  background:var(--jcs-accent-dim);border-color:var(--jcs-accent-line);color:var(--jcs-accent2)
}
#${NS}-cfg .jcs-hl-label{
  display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:700;color:var(--jcs-muted)
}
#${NS}-cfg .jcs-hl-label textarea{
  width:100%;min-height:88px;resize:vertical;box-sizing:border-box;padding:10px 12px;
  border-radius:10px;border:1px solid var(--jcs-line);background:var(--jcs-surface);color:var(--jcs-text);
  font:12px/1.45 var(--jcs-mono);outline:none;
  transition:border-color var(--jcs-fast) ease,box-shadow var(--jcs-fast) ease
}
#${NS}-cfg .jcs-hl-label textarea:focus{border-color:var(--jcs-accent-line);box-shadow:var(--jcs-focus)}
#${NS}-cfg .jcs-hl-label textarea:disabled{opacity:.5}
#${NS}-cfg .jcs-cfg-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
#${NS}-cfg .jcs-src-toolbar{
  display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap
}
#${NS}-cfg .jcs-src-toolbar p{
  margin:0;font-size:11px;color:var(--jcs-muted);line-height:1.45;flex:1 1 160px;min-width:0
}
#${NS}-cfg .jcs-src-toolbar code{color:var(--jcs-accent2);font-size:10.5px}
#${NS}-cfg .jcs-src-toolbar-btns{display:inline-flex;flex-wrap:wrap;gap:6px;flex:0 0 auto}
#${NS}-cfg .jcs-src-toolbar .jcs-btn,
#${NS}-cfg .jcs-prow-del .jcs-btn{
  flex:0 0 auto;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--jcs-line)!important;
  background:var(--jcs-fill)!important;color:var(--jcs-text)!important;cursor:pointer;
  font:inherit!important;font-size:12px!important;font-weight:700!important;line-height:1!important;
  display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box
}
#${NS}-cfg .jcs-src-toolbar .jcs-btn:hover,
#${NS}-cfg .jcs-prow-del .jcs-btn:hover{background:var(--jcs-fill-hover)!important}
#${NS}-cfg .jcs-src-toolbar .jcs-btn.solid,
#${NS}-cfg .jcs-prow-del .jcs-btn.solid,
#${NS}-cfg .jcs-prow-del .jcs-btn.is-danger{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent))!important;
  border-color:transparent!important;color:#fff!important
}
#${NS}-cfg .jcs-plist{
  display:flex;flex-direction:column;gap:8px;min-height:0;width:100%;box-sizing:border-box
}
#${NS}-cfg .jcs-prow{
  display:flex;align-items:stretch;gap:10px;padding:10px 12px;width:100%;box-sizing:border-box;
  border:1px solid var(--jcs-line);border-radius:12px;background:var(--jcs-surface);
  transition:border-color .14s ease,box-shadow .14s ease,background .14s ease,transform .12s ease
}
#${NS}-cfg .jcs-prow:hover{border-color:var(--jcs-chip-line)}
#${NS}-cfg .jcs-prow.is-active{
  border-color:var(--jcs-accent-line);box-shadow:0 0 0 1px var(--jcs-accent-line) inset;
  background:linear-gradient(180deg,var(--jcs-accent-dim),var(--jcs-surface))
}
#${NS}-cfg .jcs-prow.is-editing{
  border-color:var(--jcs-accent-line);box-shadow:0 0 0 2px var(--jcs-accent-dim)
}
#${NS}-cfg .jcs-prow.is-deleting{
  border-color:rgba(212,83,74,.55);background:rgba(212,83,74,.08);flex-wrap:wrap
}
#${NS}-cfg .jcs-prow.is-flash{
  animation:jcs-prow-flash .7s ease
}
@keyframes jcs-prow-flash{
  0%{box-shadow:0 0 0 0 var(--jcs-accent-line)}
  40%{box-shadow:0 0 0 3px var(--jcs-accent-dim)}
  100%{box-shadow:0 0 0 0 transparent}
}
#${NS}-cfg .jcs-prow-main{
  flex:1 1 auto;min-width:0;max-width:100%;cursor:pointer;text-align:left;
  border:0!important;background:transparent!important;padding:2px 0!important;margin:0!important;
  color:inherit!important;font:inherit!important;line-height:1.35!important;
  box-shadow:none!important;appearance:none!important;-webkit-appearance:none!important;
  display:block!important;width:auto!important;height:auto!important;min-height:0!important
}
#${NS}-cfg .jcs-prow-main strong{
  display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:13px;font-weight:800;color:var(--jcs-text);
  line-height:1.3
}
#${NS}-cfg .jcs-prow-main strong .jcs-dot{
  width:7px;height:7px;border-radius:50%;background:var(--jcs-empty);flex:0 0 auto
}
#${NS}-cfg .jcs-prow.is-active .jcs-dot{background:var(--jcs-accent)}
#${NS}-cfg .jcs-prow-tag{
  display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:999px;
  font-size:10px;font-weight:750;background:var(--jcs-accent-dim);color:var(--jcs-accent2);
  border:1px solid var(--jcs-accent-line)
}
#${NS}-cfg .jcs-prow-main code{
  display:block;margin-top:4px;padding:0;border:0;background:transparent;
  font-size:11px;font-weight:500;color:var(--jcs-muted);word-break:break-all;line-height:1.35;
  white-space:normal;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace
}
#${NS}-cfg .jcs-prow-main small{
  display:block;margin-top:3px;font-size:10.5px;color:var(--jcs-empty);font-weight:500
}
#${NS}-cfg .jcs-prow-ops{
  display:inline-flex;align-items:center;align-self:center;gap:4px;flex:0 0 auto
}
#${NS}-cfg .jcs-prow-ops .jcs-icon{
  width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;
  border-radius:8px!important;border:1px solid var(--jcs-line)!important;
  background:var(--jcs-fill)!important;color:var(--jcs-text)!important;cursor:pointer;
  font:inherit!important;font-size:13px!important;font-weight:700!important;line-height:1!important;
  padding:0!important;margin:0!important;box-sizing:border-box;
  display:inline-flex!important;align-items:center;justify-content:center;
  appearance:none!important;-webkit-appearance:none!important
}
#${NS}-cfg .jcs-prow-ops .jcs-icon:hover{background:var(--jcs-fill-hover)!important}
#${NS}-cfg .jcs-prow-ops .jcs-icon:disabled{opacity:.35;cursor:not-allowed}
#${NS}-cfg .jcs-prow-ops .jcs-icon.is-danger:hover{
  background:rgba(212,83,74,.16)!important;border-color:rgba(212,83,74,.4)!important;color:var(--jcs-accent2)!important
}
#${NS}-cfg .jcs-prow-del{
  flex:1 0 100%;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;
  margin-top:2px;padding-top:10px;border-top:1px dashed rgba(212,83,74,.35)
}
#${NS}-cfg .jcs-prow-del b{font-size:12px;color:var(--jcs-accent2);font-weight:750}
#${NS}-cfg .jcs-prow-del-actions{display:inline-flex;gap:6px}
#${NS}-cfg .jcs-form-card{
  border:1px solid var(--jcs-line);border-radius:12px;background:var(--jcs-fill-2);
  padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-width:0;box-sizing:border-box;
  position:sticky;bottom:0;z-index:1
}
#${NS}-cfg .jcs-form-card.is-edit{
  border-color:var(--jcs-accent-line);box-shadow:0 0 0 1px var(--jcs-accent-dim),0 -8px 24px rgba(0,0,0,.12)
}
#${NS}-cfg .jcs-form-hd{
  display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap
}
#${NS}-cfg .jcs-form-hd > div{min-width:0;flex:1}
#${NS}-cfg .jcs-form-hd strong{display:block;font-size:13px;font-weight:800;color:var(--jcs-text)}
#${NS}-cfg .jcs-form-hd span{display:block;margin-top:2px;font-size:11px;color:var(--jcs-muted);line-height:1.4}
#${NS}-cfg .jcs-form{
  display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;box-sizing:border-box;min-width:0
}
#${NS}-cfg .jcs-form .full{grid-column:1/-1;min-width:0}
#${NS}-cfg .jcs-form label{
  display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--jcs-muted);font-weight:700;min-width:0
}
#${NS}-cfg .jcs-form input{
  width:100%;max-width:100%;height:38px;box-sizing:border-box;
  border-radius:10px;border:1px solid var(--jcs-line)!important;background:var(--jcs-surface)!important;
  color:var(--jcs-text)!important;padding:0 12px!important;margin:0!important;
  font:inherit!important;font-size:13px!important;outline:none;min-width:0;
  transition:border-color .12s ease,box-shadow .12s ease
}
#${NS}-cfg .jcs-form input:focus{
  border-color:var(--jcs-accent-line)!important;box-shadow:0 0 0 3px var(--jcs-accent-dim)
}
#${NS}-cfg .jcs-form input.is-invalid{
  border-color:rgba(212,83,74,.65)!important;box-shadow:0 0 0 3px rgba(212,83,74,.12)
}
#${NS}-cfg .jcs-form-tip{
  margin:0;font-size:11px;color:var(--jcs-muted);line-height:1.4
}
#${NS}-cfg .jcs-form-tip code{color:var(--jcs-accent2)}
#${NS}-cfg .jcs-form-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding-top:2px}
#${NS}-cfg .jcs-form-foot .jcs-btn{
  height:38px!important;padding:0 16px!important;border-radius:10px!important;
  border:1px solid var(--jcs-line)!important;background:var(--jcs-fill)!important;
  color:var(--jcs-text)!important;cursor:pointer;font:inherit!important;font-size:12px!important;
  font-weight:700!important;line-height:1!important;
  display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box
}
#${NS}-cfg .jcs-form-foot .jcs-btn.solid{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent))!important;
  border-color:transparent!important;color:#fff!important
}
#${NS}-cfg .jcs-form-foot .jcs-btn:hover{filter:brightness(1.03)}
#${NS}-cfg .jcs-form-foot .jcs-btn:disabled{opacity:.45;cursor:not-allowed;filter:none}
#${NS}-cfg .jcs-empty-src{
  padding:28px 12px;text-align:center;color:var(--jcs-empty);font-size:12px;
  border:1px dashed var(--jcs-line);border-radius:12px;box-sizing:border-box
}
#${NS}-cfg-backup .jcs-hl-label{margin-top:8px}
#${NS}-cfg-backup textarea{
  min-height:88px;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace
}
#${NS}-cfg-backup .jcs-hl-row input{width:15px;height:15px;accent-color:var(--jcs-accent)}
#${NS}-cfg-backup .jcs-backup-section{
  display:flex;flex-direction:column;gap:10px;padding-top:12px;margin-top:4px;
  border-top:1px solid var(--jcs-line)
}
#${NS}-cfg-backup .jcs-backup-section:first-of-type{border-top:0;padding-top:4px;margin-top:0}
#${NS}-cfg-backup .jcs-backup-kicker{
  font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  color:var(--jcs-muted)
}
#${NS}-cfg-backup .jcs-backup-section .jcs-switch-row{
  border-top:0;padding:2px 0 0;margin:0
}
#${NS}-cfg-backup .jcs-dropzone{
  position:relative;display:flex;flex-direction:column;align-items:stretch;gap:8px;
  min-height:92px;padding:16px 14px;border-radius:12px;box-sizing:border-box;
  border:1.5px dashed var(--jcs-chip-line);background:var(--jcs-fill-2);
  cursor:pointer;user-select:none;outline:none;
  transition:border-color var(--jcs-fast) ease,background var(--jcs-fast) ease,
    box-shadow var(--jcs-fast) ease,transform var(--jcs-fast) ease
}
#${NS}-cfg-backup .jcs-dropzone:hover{
  border-color:var(--jcs-accent-line);background:var(--jcs-accent-dim)
}
#${NS}-cfg-backup .jcs-dropzone:focus-visible{box-shadow:var(--jcs-focus);border-color:var(--jcs-accent-line)}
#${NS}-cfg-backup .jcs-dropzone.is-drag{
  border-color:var(--jcs-accent);border-style:solid;background:var(--jcs-accent-dim);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--jcs-accent) 18%,transparent);
  transform:scale(1.01)
}
#${NS}-cfg-backup .jcs-dropzone.is-busy{opacity:.6;pointer-events:none;cursor:wait}
#${NS}-cfg-backup .jcs-dropzone-inner{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center
}
#${NS}-cfg-backup .jcs-dropzone-inner strong{
  font-size:13px;font-weight:800;color:var(--jcs-text)
}
#${NS}-cfg-backup .jcs-dropzone-inner span{
  font-size:11px;line-height:1.45;color:var(--jcs-muted);font-weight:500
}
#${NS}-cfg-backup .jcs-dropzone-meta{
  margin:0;padding:8px 10px;border-radius:10px;font-size:11px;line-height:1.45;
  border:1px solid var(--jcs-line);background:var(--jcs-surface);color:var(--jcs-soft);
  word-break:break-all
}
#${NS}-cfg-backup .jcs-dropzone-meta[hidden]{display:none!important}
#${NS}-cfg-backup .jcs-dropzone-meta b{color:var(--jcs-accent2);font-weight:750}
/* file input 挂在 #jcs-host 下，避免进入 cfg-body 滚动上下文。
   不用 display:none（部分浏览器无法 .click()）；不用 fixed 偏移（backdrop-filter 下会撑滚动）。 */
#${NS}-host > input#${NS}-cfg-import-input.jcs-file-hide,
#${NS}-host > input.jcs-file-hide[type="file"]{
  position:absolute!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;
  width:0!important;height:0!important;max-width:0!important;max-height:0!important;
  margin:0!important;padding:0!important;border:0!important;outline:0!important;
  opacity:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;clip-path:inset(50%)!important;
  pointer-events:none!important;visibility:hidden!important;z-index:0!important;
  appearance:none!important;-webkit-appearance:none!important;
  font-size:0!important;line-height:0!important
}
#${NS}-cfg .jcs-dav-form{
  display:grid;grid-template-columns:1fr 1fr;gap:10px;min-width:0
}
#${NS}-cfg .jcs-dav-form .full{grid-column:1/-1;min-width:0}
#${NS}-cfg .jcs-dav-form label{
  display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:var(--jcs-muted);min-width:0
}
#${NS}-cfg .jcs-dav-form label.jcs-switch-row{
  flex-direction:row;align-items:center;justify-content:space-between;gap:12px;
  font-weight:inherit;cursor:pointer;user-select:none;padding:8px 0
}
#${NS}-cfg .jcs-dav-form .jcs-switch{flex:0 0 auto}
#${NS}-cfg .jcs-dav-form input{
  width:100%;height:38px;box-sizing:border-box;padding:0 12px;border-radius:10px;
  border:1px solid var(--jcs-line);background:var(--jcs-surface);color:var(--jcs-text);
  font:inherit;font-size:13px;outline:none;min-width:0;
  transition:border-color var(--jcs-fast) ease,box-shadow var(--jcs-fast) ease
}
#${NS}-cfg .jcs-dav-form input:focus{border-color:var(--jcs-accent-line);box-shadow:var(--jcs-focus)}
#${NS}-cfg .jcs-dav-form input[type="password"]{-webkit-text-security:disc}
@media (max-width:520px){
  #${NS}-cfg .jcs-dav-form{grid-template-columns:1fr}
}
/* 常规页 */
#${NS}-cfg .jcs-site-card{
  background:linear-gradient(145deg,var(--jcs-accent-dim),var(--jcs-fill-2));
  border-color:var(--jcs-accent-line)
}
#${NS}-cfg .jcs-site-row{
  display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap
}
#${NS}-cfg .jcs-site-row strong{
  display:block;font-size:14px;font-weight:800;color:var(--jcs-text);word-break:break-all
}
#${NS}-cfg .jcs-site-row p{
  margin:4px 0 0;font-size:11.5px;line-height:1.45;color:var(--jcs-muted)
}
#${NS}-cfg .jcs-seg-mode{
  display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;
  border-radius:12px;background:var(--jcs-surface);border:1px solid var(--jcs-line)
}
#${NS}-cfg .jcs-seg-mode button{
  height:40px;border:0;border-radius:10px;cursor:pointer;font:inherit;font-size:12.5px;font-weight:750;
  background:transparent;color:var(--jcs-muted);
  transition:background var(--jcs-fast) ease,color var(--jcs-fast) ease,box-shadow var(--jcs-fast) ease
}
#${NS}-cfg .jcs-seg-mode button:hover{color:var(--jcs-soft);background:var(--jcs-fill)}
#${NS}-cfg .jcs-seg-mode button:focus-visible{outline:none;box-shadow:var(--jcs-focus)}
#${NS}-cfg .jcs-seg-mode button.is-on{
  background:var(--jcs-accent-dim);color:var(--jcs-accent2);
  box-shadow:0 0 0 1px var(--jcs-accent-line) inset
}
#${NS}-cfg .jcs-seg-mode button:disabled{opacity:.45;cursor:not-allowed}
#${NS}-cfg .jcs-mode-hint{
  margin:0;font-size:11.5px;line-height:1.5;color:var(--jcs-muted)
}
#${NS}-cfg .jcs-mode-hint b{color:var(--jcs-soft);font-weight:700}
#${NS}-cfg .jcs-callout{
  display:none;margin:0;padding:10px 12px;border-radius:12px;font-size:11.5px;line-height:1.5;
  border:1px solid var(--jcs-accent-line);background:var(--jcs-accent-dim);color:var(--jcs-accent2)
}
#${NS}-cfg .jcs-callout.is-on{display:block}
#${NS}-cfg .jcs-callout.is-warn{
  border-color:color-mix(in srgb,var(--jcs-warn) 45%,transparent);
  background:color-mix(in srgb,var(--jcs-warn) 12%,transparent);color:var(--jcs-warn)
}
#${NS}-cfg .jcs-inline-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#${NS}-cfg .jcs-backup-detail[hidden]{display:none!important}
#${NS}-cfg .jcs-backup-status{
  min-height:0;margin:0;font-size:11.5px;line-height:1.45;color:var(--jcs-muted)
}
#${NS}-cfg .jcs-backup-status.is-ok{color:var(--jcs-ok)}
#${NS}-cfg .jcs-backup-status.is-err{color:var(--jcs-danger)}
#${NS}-panel .jcs-tools{
  display:flex;align-items:center;gap:8px;padding:10px 12px;flex-shrink:0;
  border-bottom:1px solid var(--jcs-line);background:var(--jcs-fill-2)
}
#${NS}-panel .jcs-tools input{
  flex:1 1 auto;min-width:0;height:40px;border-radius:10px;border:1px solid var(--jcs-line);
  background:var(--jcs-surface);color:var(--jcs-text);padding:0 12px;outline:none;
  font:inherit;font-size:16px;transition:border-color var(--jcs-fast) ease,box-shadow var(--jcs-fast) ease
}
#${NS}-panel .jcs-tools input::placeholder{color:var(--jcs-empty)}
#${NS}-panel .jcs-tools input:focus{
  border-color:var(--jcs-accent-line);box-shadow:var(--jcs-focus)
}
#${NS}-panel .jcs-tools .jcs-btn,
#${NS}-panel .jcs-btn{
  flex:0 0 auto;height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill);color:var(--jcs-text);cursor:pointer;font-weight:700;font:inherit;
  white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;
  transition:background var(--jcs-fast) ease,border-color var(--jcs-fast) ease,
    filter var(--jcs-fast) ease,transform var(--jcs-fast) ease
}
#${NS}-panel .jcs-tools .jcs-btn:hover,#${NS}-panel .jcs-btn:hover{
  background:var(--jcs-fill-hover);border-color:var(--jcs-chip-line)
}
#${NS}-panel .jcs-tools .jcs-btn:active,#${NS}-panel .jcs-btn:active{transform:scale(.97)}
#${NS}-panel .jcs-tools .jcs-btn:focus-visible,#${NS}-panel .jcs-btn:focus-visible{
  outline:none;box-shadow:var(--jcs-focus)
}
#${NS}-panel .jcs-tools .jcs-btn.solid,#${NS}-panel .jcs-btn.solid{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent));border-color:transparent;color:#fff;
  box-shadow:0 3px 10px rgba(212,83,74,.26)
}
#${NS}-panel .jcs-tools .jcs-btn.solid:hover,#${NS}-panel .jcs-btn.solid:hover{
  filter:brightness(1.05);background:linear-gradient(145deg,#e05a50,var(--jcs-accent))
}
#${NS}-panel .jcs-tools .jcs-btn:not(.solid){
  min-width:52px;color:var(--jcs-soft)
}
#${NS}-panel .jcs-list,#${NS}-panel #${NS}-list{
  /* 站点全局 button/flex 重置时仍保证列表可见（javgg 等） */
  flex:1 1 auto!important;min-height:160px!important;max-height:min(360px,54dvh)!important;
  height:auto!important;overflow:auto!important;overflow-x:hidden!important;
  padding:10px!important;margin:0!important;
  display:flex!important;flex-wrap:wrap!important;gap:7px!important;
  align-content:flex-start!important;align-items:flex-start!important;
  visibility:visible!important;opacity:1!important;
  -webkit-overflow-scrolling:touch;overscroll-behavior:contain;box-sizing:border-box!important;
  scrollbar-width:thin;scrollbar-color:var(--jcs-chip-line) transparent
}
#${NS}-panel .jcs-chip,#${NS}-panel #${NS}-list .jcs-chip{
  flex:0 0 auto!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;
  visibility:visible!important;opacity:1!important;box-sizing:border-box!important;
  width:auto!important;max-width:100%!important;height:auto!important;
  border:1px solid var(--jcs-chip-line)!important;background:var(--jcs-fill-2)!important;color:var(--jcs-soft)!important;
  border-radius:999px!important;padding:8px 12px!important;margin:0!important;
  cursor:pointer!important;font-size:12px!important;font-weight:700!important;line-height:1.2!important;
  min-height:36px!important;min-width:0!important;text-indent:0!important;letter-spacing:normal!important;
  appearance:none!important;-webkit-appearance:none!important;
  transition:background var(--jcs-fast) ease,border-color var(--jcs-fast) ease,color var(--jcs-fast) ease,transform var(--jcs-fast) ease!important
}
#${NS}-panel .jcs-chip:hover,#${NS}-panel .jcs-chip.is-active,
#${NS}-panel #${NS}-list .jcs-chip:hover,#${NS}-panel #${NS}-list .jcs-chip.is-active{
  background:var(--jcs-accent-dim)!important;border-color:var(--jcs-accent-line)!important;color:var(--jcs-accent2)!important
}
#${NS}-panel .jcs-chip:active,#${NS}-panel #${NS}-list .jcs-chip:active{transform:scale(.97)!important}
#${NS}-panel .jcs-empty,#${NS}-panel #${NS}-list .jcs-empty{
  color:var(--jcs-empty)!important;font-size:11.5px!important;padding:28px 10px!important;
  width:100%!important;text-align:center!important;flex:1 0 100%!important;
  display:block!important;visibility:visible!important;line-height:1.5!important
}
#${NS}-panel .jcs-foot{
  padding:8px 12px;border-top:1px solid var(--jcs-line);font-size:10.5px;color:var(--jcs-muted);flex-shrink:0;
  background:var(--jcs-fill-2)
}
#${NS}-popup{
  position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;
  background:var(--jcs-overlay);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  font:var(--jcs-font);color:var(--jcs-text);
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)
}
#${NS}-popup.show{display:flex;animation:jcs-fade-in .16s var(--jcs-ease)}
@keyframes jcs-fade-in{from{opacity:0}to{opacity:1}}
#${NS}-win{
  width:min(1180px,96vw);height:min(820px,92dvh);max-height:min(820px,92dvh);
  background:linear-gradient(180deg,var(--jcs-panel2) 0%,var(--jcs-bg) 28%);
  border:1px solid var(--jcs-line);border-radius:var(--jcs-radius);box-shadow:var(--jcs-shadow);
  overflow:hidden!important;display:flex!important;flex-direction:column!important;
  min-height:0!important;color:var(--jcs-text);box-sizing:border-box!important;
  animation:jcs-win-in .2s var(--jcs-ease)
}
@keyframes jcs-win-in{from{opacity:.7;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
#${NS}-win .jcs-head{
  display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--jcs-line);
  cursor:move;user-select:none;flex-shrink:0;touch-action:none;
  background:linear-gradient(180deg,var(--jcs-fill-2),transparent)
}
#${NS}-mobi-codes{
  display:none;gap:6px;padding:8px 10px;border-bottom:1px solid var(--jcs-line);
  overflow-x:auto;-webkit-overflow-scrolling:touch;flex-shrink:0
}
#${NS}-mobi-codes .jcs-chip{
  flex:0 0 auto;border:1px solid var(--jcs-chip-line);background:var(--jcs-fill-2);
  color:var(--jcs-soft);border-radius:999px;padding:8px 12px;cursor:pointer;font-size:12px;font-weight:700
}
#${NS}-mobi-codes .jcs-chip.is-active{
  background:var(--jcs-accent-dim);border-color:var(--jcs-accent-line);color:var(--jcs-accent2)
}
#${NS}-win .jcs-brand{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
#${NS}-win .jcs-mark{
  width:22px;height:22px;border-radius:7px;display:grid;place-items:center;
  background:linear-gradient(145deg,var(--jcs-accent),#9b2f2a);color:#fff;font-size:10px;font-weight:800
}
#${NS}-win .jcs-title{color:var(--jcs-accent2);font-weight:800;font-size:11px}
#${NS}-win .jcs-actions{display:flex;gap:6px;margin-left:auto;align-items:center}
/* 仅标题栏操作区，避免污染设置页 #jcs-cfg 内按钮 */
#${NS}-win > .jcs-head .jcs-icon,#${NS}-win > .jcs-head .jcs-btn,
#${NS}-win .jcs-actions .jcs-icon,#${NS}-win .jcs-actions .jcs-btn{
  border:1px solid var(--jcs-line);background:var(--jcs-fill);color:var(--jcs-text);
  border-radius:10px;cursor:pointer;font:inherit;
  transition:background var(--jcs-fast) ease,border-color var(--jcs-fast) ease,transform var(--jcs-fast) ease
}
#${NS}-win > .jcs-head .jcs-icon:hover,#${NS}-win > .jcs-head .jcs-btn:hover,
#${NS}-win .jcs-actions .jcs-icon:hover,#${NS}-win .jcs-actions .jcs-btn:hover{
  background:var(--jcs-fill-hover);border-color:var(--jcs-chip-line)
}
#${NS}-win > .jcs-head .jcs-icon:active,#${NS}-win > .jcs-head .jcs-btn:active,
#${NS}-win .jcs-actions .jcs-icon:active,#${NS}-win .jcs-actions .jcs-btn:active{transform:scale(.95)}
#${NS}-win > .jcs-head .jcs-icon:focus-visible,#${NS}-win > .jcs-head .jcs-btn:focus-visible,
#${NS}-win .jcs-actions .jcs-icon:focus-visible,#${NS}-win .jcs-actions .jcs-btn:focus-visible{
  outline:none;box-shadow:var(--jcs-focus)
}
#${NS}-win > .jcs-head .jcs-icon,#${NS}-win .jcs-actions .jcs-icon{
  width:36px;height:36px;padding:0;
  display:inline-flex;align-items:center;justify-content:center
}
#${NS}-win > .jcs-head .jcs-btn,#${NS}-win .jcs-actions .jcs-btn{
  height:36px;padding:0 12px;font-weight:700;
  display:inline-flex;align-items:center;justify-content:center
}
#${NS}-win > .jcs-head .jcs-btn.solid,#${NS}-win .jcs-actions .jcs-btn.solid{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent));border-color:transparent;color:#fff;
  box-shadow:0 3px 10px rgba(212,83,74,.24)
}
#${NS}-win .jcs-main{
  flex:1 1 auto!important;min-height:0!important;max-height:100%!important;
  display:grid!important;grid-template-columns:220px 1fr;position:relative!important;
  overflow:hidden!important
}
#${NS}-win .jcs-side{
  display:flex;flex-direction:column;min-height:0;background:var(--jcs-side);border-right:1px solid var(--jcs-line)
}
#${NS}-win .jcs-side-h{
  padding:8px 10px 6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--jcs-muted);display:flex;justify-content:space-between;align-items:center
}
#${NS}-win .jcs-side-h button{border:0;background:0;color:var(--jcs-muted);cursor:pointer;font-size:10px}
#${NS}-win .jcs-side-list{flex:1;min-height:0;overflow:auto;padding:0 8px 8px;display:flex;flex-direction:column;gap:4px}
#${NS}-win .jcs-item{
  text-align:left;border:1px solid transparent;background:var(--jcs-fill-2);color:var(--jcs-soft);
  border-radius:10px;padding:9px 10px;cursor:pointer;font-size:12px;font-weight:700;
  transition:background var(--jcs-fast) ease,border-color var(--jcs-fast) ease,color var(--jcs-fast) ease
}
#${NS}-win .jcs-item:hover{background:var(--jcs-fill-hover);border-color:var(--jcs-line)}
#${NS}-win .jcs-item.is-active{background:var(--jcs-accent-dim);border-color:var(--jcs-accent-line);color:var(--jcs-accent2)}
#${NS}-win .jcs-content{display:flex;flex-direction:column;min-width:0;min-height:0}
#${NS}-win .jcs-tools{
  display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 12px;flex-shrink:0;
  border-bottom:1px solid var(--jcs-line);background:var(--jcs-fill-2)
}
#${NS}-win .jcs-tools .jcs-tools-search{
  display:flex;align-items:center;gap:8px;flex:1 1 220px;min-width:0
}
#${NS}-win .jcs-segbox{
  display:inline-flex;flex-wrap:wrap;align-items:center;gap:3px;padding:3px;
  border-radius:999px;background:var(--jcs-surface);border:1px solid var(--jcs-line);
  flex:1 1 auto;min-width:0;max-width:100%
}
#${NS}-win .jcs-seg{
  border:0;background:transparent;color:var(--jcs-muted);border-radius:999px;height:30px;padding:0 12px;
  cursor:pointer;font:inherit;font-size:11.5px;font-weight:700;white-space:nowrap;
  -webkit-tap-highlight-color:transparent;
  transition:background .12s ease,color .12s ease,box-shadow .12s ease
}
#${NS}-win .jcs-seg:hover{color:var(--jcs-soft);background:var(--jcs-fill)}
#${NS}-win .jcs-seg.is-active{
  background:var(--jcs-accent-dim);color:var(--jcs-accent2);
  box-shadow:0 0 0 1px var(--jcs-accent-line) inset
}
#${NS}-win .jcs-tools input,
#${NS}-win .jcs-tools-search input{
  flex:1 1 auto;min-width:0;height:40px;border-radius:10px;border:1px solid var(--jcs-line);
  background:var(--jcs-surface);color:var(--jcs-text);padding:0 12px;outline:none;
  font:inherit;font-size:16px;transition:border-color .14s ease,box-shadow .14s ease
}
#${NS}-win .jcs-tools input::placeholder,
#${NS}-win .jcs-tools-search input::placeholder{color:var(--jcs-empty)}
#${NS}-win .jcs-tools input:focus,
#${NS}-win .jcs-tools-search input:focus{
  border-color:var(--jcs-accent-line);box-shadow:var(--jcs-focus)
}
#${NS}-win .jcs-tools .jcs-btn,
#${NS}-win .jcs-tools-search .jcs-btn{
  flex:0 0 auto;height:40px;padding:0 16px;border-radius:10px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill);color:var(--jcs-text);cursor:pointer;font:inherit;font-weight:700;
  white-space:nowrap;-webkit-tap-highlight-color:transparent;
  transition:background .12s ease,border-color .12s ease,filter .12s ease,transform .1s ease
}
#${NS}-win .jcs-tools .jcs-btn:hover{background:var(--jcs-fill-hover)}
#${NS}-win .jcs-tools .jcs-btn:active{transform:scale(.97)}
#${NS}-win .jcs-tools .jcs-btn.solid{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent));border-color:transparent;color:#fff;
  box-shadow:0 3px 10px rgba(212,83,74,.26)
}
#${NS}-win .jcs-tools .jcs-btn.solid:hover{
  filter:brightness(1.05);background:linear-gradient(145deg,#e05a50,var(--jcs-accent))
}
#${NS}-win .jcs-body{
  flex:1;min-height:0;position:relative;margin:0 10px 10px;border:1px solid var(--jcs-line);
  border-radius:var(--jcs-radius-md);overflow:hidden;background:var(--jcs-surface)
}
#${NS}-win iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
#${NS}-fetch{position:absolute;inset:0;z-index:1;overflow:auto;padding:14px;background:var(--jcs-surface);color:var(--jcs-text)}
#${NS}-fetch[hidden]{display:none!important}
#${NS}-fetch .jcs-fetch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}
#${NS}-fetch .jcs-fetch-card{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--jcs-line);
  border-radius:var(--jcs-radius-sm);background:var(--jcs-fill-2);color:var(--jcs-text);text-decoration:none;
  transition:border-color var(--jcs-fast) var(--jcs-ease),transform var(--jcs-fast) var(--jcs-ease)}
#${NS}-fetch .jcs-fetch-card:hover{border-color:var(--jcs-accent-line);transform:translateY(-1px)}
#${NS}-fetch .jcs-fetch-thumb{width:100%;aspect-ratio:3/4;overflow:hidden;border-radius:var(--jcs-radius-xs);background:var(--jcs-fill)}
#${NS}-fetch .jcs-fetch-thumb img{width:100%;height:100%;object-fit:cover;display:block}
#${NS}-fetch .jcs-fetch-card strong{font-size:12px;line-height:1.35;font-weight:700;color:var(--jcs-soft);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#${NS}-fetch .jcs-fetch-card code{font:var(--jcs-mono);font-size:10.5px;color:var(--jcs-accent2)}
#${NS}-fetch .jcs-fetch-loading{padding:36px 12px;text-align:center;color:var(--jcs-empty)}
#${NS}-frame-fallback{
  position:absolute;inset:0;z-index:2;display:none;flex-direction:column;align-items:center;justify-content:center;
  gap:12px;padding:24px 20px;text-align:center;background:var(--jcs-surface);color:var(--jcs-text)
}
#${NS}-frame-fallback.show{display:flex}
#${NS}-frame-fallback .jcs-fb-ico{
  width:48px;height:48px;border-radius:14px;display:grid;place-items:center;
  background:var(--jcs-accent-dim);color:var(--jcs-accent2);font-size:22px;font-weight:900
}
#${NS}-frame-fallback strong{font-size:14px;font-weight:800}
#${NS}-frame-fallback p{margin:0;max-width:360px;font-size:12px;line-height:1.55;color:var(--jcs-muted)}
#${NS}-frame-fallback .jcs-fb-url{
  max-width:min(92%,420px);padding:8px 10px;border-radius:8px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill-2);color:var(--jcs-soft);font-size:11px;word-break:break-all;text-align:left
}
#${NS}-frame-fallback .jcs-fb-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
#${NS}-frame-fallback .jcs-btn{height:40px;padding:0 16px;border-radius:8px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill);color:var(--jcs-text);cursor:pointer;font-weight:700;font:inherit}
#${NS}-frame-fallback .jcs-btn.solid{background:var(--jcs-accent);border-color:var(--jcs-accent);color:#fff}
#${NS}-pick{
  position:absolute;inset:0;z-index:12;pointer-events:none;
  font:var(--jcs-font);color:var(--jcs-text);opacity:0;visibility:hidden;
  transition:opacity .14s ease,visibility 0s linear .14s
}
#${NS}-pick.show{
  opacity:1;visibility:visible;transition:opacity .16s ease,visibility 0s
}
#${NS}-pick .jcs-pick-card{
  position:absolute;pointer-events:auto;z-index:1;
  display:flex;flex-direction:column;gap:7px;
  min-width:136px;max-width:min(92vw,320px);
  padding:9px 9px 10px;border-radius:14px;
  background:var(--jcs-panel);color:var(--jcs-text);
  border:1px solid var(--jcs-line);
  box-shadow:var(--jcs-shadow-sm),0 0 0 1px rgba(255,255,255,.04) inset;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  transform-origin:top left;
  opacity:0;transform:translateY(6px) scale(.94);
  transition:opacity var(--jcs-med) var(--jcs-ease),transform var(--jcs-med) var(--jcs-ease),
    left var(--jcs-fast) ease,top var(--jcs-fast) ease
}
#${NS}-pick.show .jcs-pick-card{
  opacity:1;transform:translateY(0) scale(1)
}
#${NS}-pick[data-place="above"] .jcs-pick-card{transform-origin:bottom left}
#${NS}-pick[data-place="above"].show .jcs-pick-card{transform:translateY(0) scale(1)}
#${NS}-pick[data-place="above"]:not(.show) .jcs-pick-card{transform:translateY(-6px) scale(.94)}
#${NS}-pick[data-place="right"] .jcs-pick-card{transform-origin:center left}
#${NS}-pick[data-place="left"] .jcs-pick-card{transform-origin:center right}
#${NS}-pick .jcs-pick-arrow{
  position:absolute;width:10px;height:10px;background:var(--jcs-panel);
  border-left:1px solid var(--jcs-line);border-top:1px solid var(--jcs-line);
  pointer-events:none;z-index:0
}
#${NS}-pick[data-place="below"] .jcs-pick-arrow{
  top:-5px;left:16px;transform:rotate(45deg)
}
#${NS}-pick[data-place="above"] .jcs-pick-arrow{
  bottom:-5px;left:16px;transform:rotate(225deg)
}
#${NS}-pick[data-place="right"] .jcs-pick-arrow{
  left:-5px;top:50%;margin-top:-5px;transform:rotate(-45deg)
}
#${NS}-pick[data-place="left"] .jcs-pick-arrow{
  right:-5px;top:50%;margin-top:-5px;transform:rotate(135deg)
}
#${NS}-pick .jcs-pick-head{
  display:flex;align-items:center;gap:6px;min-width:0;padding:0 2px 1px
}
#${NS}-pick .jcs-pick-head strong{
  flex:1;min-width:0;font-size:12px;font-weight:800;color:var(--jcs-accent2);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.01em
}
#${NS}-pick .jcs-pick-x{
  flex:0 0 auto;width:26px;height:26px;border-radius:7px;border:0;padding:0;cursor:pointer;
  background:var(--jcs-fill);color:var(--jcs-muted);font-size:14px;line-height:1;
  transition:background .12s ease,color .12s ease,transform .12s ease
}
#${NS}-pick .jcs-pick-x:hover{background:var(--jcs-fill-hover);color:var(--jcs-text)}
#${NS}-pick .jcs-pick-x:active{transform:scale(.92)}
#${NS}-pick .jcs-pick-btns{
  display:flex;flex-wrap:wrap;gap:6px;align-items:center
}
#${NS}-pick .jcs-pick-btn{
  height:30px;padding:0 11px;border-radius:999px;cursor:pointer;font:inherit;
  font-size:12px;font-weight:700;border:1px solid var(--jcs-chip-line);
  background:var(--jcs-fill-2);color:var(--jcs-soft);
  -webkit-tap-highlight-color:transparent;white-space:nowrap;
  opacity:0;transform:translateY(4px) scale(.96);
  transition:background .14s ease,border-color .14s ease,color .14s ease,
    transform .14s ease,box-shadow .14s ease,opacity .16s ease
}
#${NS}-pick.show .jcs-pick-btn{
  opacity:1;transform:none
}
#${NS}-pick.show .jcs-pick-btn:nth-child(1){transition-delay:.02s}
#${NS}-pick.show .jcs-pick-btn:nth-child(2){transition-delay:.05s}
#${NS}-pick.show .jcs-pick-btn:nth-child(3){transition-delay:.08s}
#${NS}-pick.show .jcs-pick-btn:nth-child(4){transition-delay:.11s}
#${NS}-pick.show .jcs-pick-btn:nth-child(5){transition-delay:.14s}
#${NS}-pick.show .jcs-pick-btn:nth-child(n+6){transition-delay:.16s}
#${NS}-pick .jcs-pick-btn:hover{
  background:var(--jcs-accent-dim);border-color:var(--jcs-accent-line);color:var(--jcs-accent2);
  transform:translateY(-1px)
}
#${NS}-pick .jcs-pick-btn:active{
  transform:scale(.96);box-shadow:none
}
#${NS}-pick .jcs-pick-btn.is-copy{
  border-style:dashed;color:var(--jcs-muted);font-weight:650
}
#${NS}-pick .jcs-pick-btn.is-copy:hover{color:var(--jcs-text)}
#${NS}-pick .jcs-pick-btn.is-copied{
  background:var(--jcs-accent-dim)!important;border-color:var(--jcs-accent-line)!important;
  color:var(--jcs-accent2)!important;border-style:solid!important
}
a.${NS}-link.is-pick-on,button.jcs-chip.is-pick-on,button.jcs-item.is-pick-on{
  outline:2px solid var(--jcs-accent-line)!important;outline-offset:2px;
  transition:outline-color .15s ease
}
@media (prefers-reduced-motion:reduce){
  #${NS}-pick,#${NS}-pick .jcs-pick-card,#${NS}-pick .jcs-pick-btn,#${NS}-pick .jcs-pick-x,
  #${NS}-panel,#${NS}-popup,#${NS}-win,#${NS}-cfg,#${NS}-fab,#${NS}-toast{
    transition:none!important;animation:none!important
  }
  #${NS}-pick .jcs-pick-card,#${NS}-pick .jcs-pick-btn{opacity:1;transform:none!important}
}
#${NS}-sub{
  position:absolute;inset:0;z-index:14;display:none;align-items:center;justify-content:center;
  background:var(--jcs-overlay);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  font:var(--jcs-font);color:var(--jcs-text);
  padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right))
    max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));
  opacity:0;transition:opacity .18s ease
}
#${NS}-sub.show{display:flex;opacity:1}
#${NS}-sub-win{
  width:min(560px,100%);max-height:min(760px,90dvh);
  background:linear-gradient(165deg,var(--jcs-panel2) 0%,var(--jcs-bg) 42%);
  border:1px solid var(--jcs-line);border-radius:var(--jcs-radius);box-shadow:var(--jcs-shadow);
  overflow:hidden;display:flex;flex-direction:column;color:var(--jcs-text);
  transform:translateY(10px) scale(.98);opacity:0;
  transition:transform .2s cubic-bezier(.2,.8,.2,1),opacity .18s ease
}
#${NS}-sub.show #${NS}-sub-win{transform:none;opacity:1}
#${NS}-sub-win .jcs-head{
  display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid var(--jcs-line);
  cursor:move;user-select:none;flex-shrink:0;touch-action:none;
  background:linear-gradient(180deg,var(--jcs-fill-2),transparent)
}
#${NS}-sub-win .jcs-brand{display:flex;align-items:center;gap:9px;min-width:0;flex:1}
#${NS}-sub-win .jcs-brand-txt{min-width:0;flex:1}
#${NS}-sub-win .jcs-mark{
  width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:0 0 auto;
  background:linear-gradient(145deg,var(--jcs-accent),#9b2f2a);color:#fff;
  font-size:12px;font-weight:900;box-shadow:0 4px 12px rgba(212,83,74,.28)
}
#${NS}-sub-win .jcs-brand strong{display:block;font-size:13px;font-weight:800;letter-spacing:.01em}
#${NS}-sub-win .jcs-brand span{
  display:block;font-size:10.5px;color:var(--jcs-muted);margin-top:1px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%
}
#${NS}-sub-win .jcs-actions{display:flex;gap:6px;margin-left:auto;align-items:center;flex:0 0 auto}
#${NS}-sub-win .jcs-icon{
  border:1px solid var(--jcs-line);background:var(--jcs-fill);color:var(--jcs-text);
  border-radius:9px;width:36px;height:36px;padding:0;cursor:pointer;font:inherit;font-size:15px;
  -webkit-tap-highlight-color:transparent;transition:background .12s ease,border-color .12s ease
}
#${NS}-sub-win .jcs-icon:hover,#${NS}-sub-win .jcs-icon:active{
  background:var(--jcs-fill-hover);border-color:var(--jcs-chip-line)
}
#${NS}-sub-win .jcs-sub-toolbar{
  display:flex;flex-direction:column;gap:8px;padding:10px 12px;
  border-bottom:1px solid var(--jcs-line);flex-shrink:0;background:var(--jcs-fill-2)
}
#${NS}-sub-win .jcs-sub-search{display:flex;gap:8px;align-items:center;min-width:0}
#${NS}-sub-win .jcs-sub-search input{
  flex:1;min-width:0;height:42px;border-radius:10px;border:1px solid var(--jcs-line);
  background:var(--jcs-surface);color:var(--jcs-text);padding:0 12px;outline:none;
  font:inherit;font-size:16px;transition:border-color .14s ease,box-shadow .14s ease
}
#${NS}-sub-win .jcs-sub-search input:focus{
  border-color:var(--jcs-accent-line);box-shadow:0 0 0 3px var(--jcs-accent-dim)
}
#${NS}-sub-win .jcs-sub-search input::placeholder{color:var(--jcs-empty)}
#${NS}-sub-win .jcs-btn{
  height:42px;padding:0 16px;border-radius:10px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill);color:var(--jcs-text);cursor:pointer;font-weight:700;font:inherit;
  flex:0 0 auto;-webkit-tap-highlight-color:transparent;
  transition:background .12s ease,border-color .12s ease,opacity .12s ease,transform .1s ease
}
#${NS}-sub-win .jcs-btn.solid{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent));
  border-color:transparent;color:#fff;box-shadow:0 4px 12px rgba(212,83,74,.28)
}
#${NS}-sub-win .jcs-btn.solid:hover{filter:brightness(1.05)}
#${NS}-sub-win .jcs-btn.solid:active{transform:scale(.97)}
#${NS}-sub-win .jcs-btn:disabled{opacity:.55;cursor:wait;filter:none;transform:none}
#${NS}-sub-win .jcs-sub-opt{
  display:inline-flex;align-items:center;gap:8px;align-self:flex-start;
  max-width:100%;padding:6px 10px;border-radius:999px;
  border:1px solid var(--jcs-chip-line);background:var(--jcs-surface);
  font-size:11.5px;font-weight:650;color:var(--jcs-muted);user-select:none;cursor:pointer;
  transition:border-color .12s ease,background .12s ease,color .12s ease
}
#${NS}-sub-win .jcs-sub-opt:hover{border-color:var(--jcs-accent-line);color:var(--jcs-soft)}
#${NS}-sub-win .jcs-sub-opt:has(input:checked){
  border-color:var(--jcs-accent-line);background:var(--jcs-accent-dim);color:var(--jcs-accent2)
}
#${NS}-sub-win .jcs-sub-opt input{
  width:15px;height:15px;margin:0;accent-color:var(--jcs-accent);cursor:pointer;flex:0 0 auto
}
#${NS}-sub-win .jcs-sub-opt span{line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${NS}-sub-hist,#${NS}-sub-win .jcs-sub-hist{
  display:flex;flex-wrap:nowrap;gap:6px;max-width:100%;overflow-x:auto;overflow-y:hidden;
  padding:1px 0 2px;-webkit-overflow-scrolling:touch;scrollbar-width:none
}
#${NS}-sub-hist::-webkit-scrollbar,#${NS}-sub-win .jcs-sub-hist::-webkit-scrollbar{display:none}
#${NS}-sub-hist[hidden],#${NS}-sub-win .jcs-sub-hist[hidden]{display:none!important}
#${NS}-sub-hist .jcs-chip,#${NS}-sub-win .jcs-sub-hist .jcs-chip{
  flex:0 0 auto;border:1px solid var(--jcs-chip-line);background:var(--jcs-fill);
  color:var(--jcs-soft);border-radius:999px;padding:6px 11px;cursor:pointer;
  font-size:11px;font-weight:700;line-height:1.2;-webkit-tap-highlight-color:transparent;
  transition:background .12s ease,border-color .12s ease,color .12s ease
}
#${NS}-sub-hist .jcs-chip:hover,#${NS}-sub-win .jcs-sub-hist .jcs-chip:hover,
#${NS}-sub-hist .jcs-chip:active,#${NS}-sub-win .jcs-sub-hist .jcs-chip:active{
  background:var(--jcs-accent-dim);border-color:var(--jcs-accent-line);color:var(--jcs-accent2)
}
#${NS}-sub-list,#${NS}-sub-win .jcs-sub-list{
  flex:1;min-height:140px;overflow:auto;padding:10px 12px 14px;
  display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain
}
#${NS}-sub-list .jcs-sub-item{
  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 12px;align-items:center;
  padding:12px;border:1px solid var(--jcs-line);border-radius:12px;
  background:linear-gradient(180deg,var(--jcs-fill-2),var(--jcs-surface));
  transition:border-color .14s ease,box-shadow .14s ease,transform .12s ease
}
#${NS}-sub-list .jcs-sub-item:hover{
  border-color:var(--jcs-accent-line);box-shadow:0 6px 18px rgba(0,0,0,.12)
}
#${NS}-sub-list .jcs-sub-main{min-width:0;display:flex;flex-direction:column;gap:7px}
#${NS}-sub-list .jcs-sub-name{
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;
  font-size:12.5px;font-weight:750;color:var(--jcs-text);line-height:1.4;word-break:break-word
}
#${NS}-sub-list .jcs-sub-meta{display:flex;flex-wrap:wrap;gap:5px}
#${NS}-sub-list .jcs-sub-tag{
  font-style:normal;font-size:10px;font-weight:750;padding:3px 8px;border-radius:999px;
  background:var(--jcs-fill);border:1px solid var(--jcs-chip-line);color:var(--jcs-muted);
  max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
#${NS}-sub-list .jcs-sub-tag.is-ext{
  background:var(--jcs-accent-dim);border-color:var(--jcs-accent-line);color:var(--jcs-accent2);
  text-transform:uppercase;letter-spacing:.04em
}
#${NS}-sub-list .jcs-sub-tag.is-lang{color:var(--jcs-soft)}
#${NS}-sub-list .jcs-sub-tag.is-src{max-width:12em}
#${NS}-sub-list .jcs-sub-tag.is-muted{opacity:.75;font-weight:650}
#${NS}-sub-list .jcs-sub-file{
  display:flex;align-items:center;gap:5px;min-width:0;padding:5px 8px;border-radius:7px;
  background:var(--jcs-fill);border:1px dashed var(--jcs-chip-line);color:var(--jcs-muted)
}
#${NS}-sub-list .jcs-sub-file > span{flex:0 0 auto;font-size:11px;opacity:.7}
#${NS}-sub-list .jcs-sub-file code{
  min-width:0;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color:var(--jcs-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
#${NS}-sub-list .jcs-sub-acts{
  display:flex;flex-direction:column;gap:6px;align-items:stretch;justify-content:center;flex:0 0 auto
}
#${NS}-sub-list .jcs-sub-acts .jcs-btn,
#${NS}-sub-list .jcs-btn{
  display:inline-flex;align-items:center;justify-content:center;
  height:34px;min-width:88px;padding:0 12px;border-radius:9px;border:1px solid var(--jcs-line);
  background:var(--jcs-fill);color:var(--jcs-text);cursor:pointer;font-weight:700;font:inherit;font-size:12px;
  text-decoration:none;white-space:nowrap;-webkit-tap-highlight-color:transparent;
  transition:background .12s ease,border-color .12s ease,transform .1s ease,filter .12s ease
}
#${NS}-sub-list .jcs-btn.solid{
  background:linear-gradient(145deg,#e05a50,var(--jcs-accent));border-color:transparent;color:#fff
}
#${NS}-sub-list .jcs-btn:hover{background:var(--jcs-fill-hover)}
#${NS}-sub-list .jcs-btn.solid:hover{filter:brightness(1.06);background:linear-gradient(145deg,#e05a50,var(--jcs-accent))}
#${NS}-sub-list .jcs-btn:active{transform:scale(.97)}
#${NS}-sub-list .jcs-sub-na{
  font-size:11px;color:var(--jcs-empty);font-weight:650;padding:6px 4px;text-align:center
}
#${NS}-sub-list .jcs-empty,#${NS}-sub-win .jcs-sub-list .jcs-empty{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  margin:auto;padding:36px 16px;text-align:center;color:var(--jcs-empty)
}
#${NS}-sub-list .jcs-empty em,#${NS}-sub-win .jcs-sub-list .jcs-empty em{
  width:44px;height:44px;border-radius:14px;display:grid;place-items:center;margin-bottom:4px;
  font-style:normal;font-size:18px;font-weight:900;
  background:var(--jcs-accent-dim);color:var(--jcs-accent2);border:1px solid var(--jcs-accent-line)
}
#${NS}-sub-list .jcs-empty b,#${NS}-sub-win .jcs-sub-list .jcs-empty b{
  font-size:13px;font-weight:800;color:var(--jcs-soft)
}
#${NS}-sub-list .jcs-empty span,#${NS}-sub-win .jcs-sub-list .jcs-empty span{
  font-size:12px;line-height:1.5;max-width:280px;color:var(--jcs-muted)
}
#${NS}-sub-list .jcs-sub-fail .jcs-btn{margin-top:8px;min-width:120px}
#${NS}-sub-list .jcs-sub-spin{
  width:28px;height:28px;border-radius:50%;margin-bottom:4px;
  border:2.5px solid var(--jcs-chip-line);border-top-color:var(--jcs-accent);
  animation:jcs-spin .7s linear infinite
}
@keyframes jcs-spin{to{transform:rotate(360deg)}}
#${NS}-pick .jcs-pick-btn.is-sub{
  border-style:solid;color:var(--jcs-accent2);border-color:var(--jcs-accent-line);background:var(--jcs-accent-dim)
}
#${NS}-win .jcs-tip{
  position:absolute;left:0;right:0;bottom:0;z-index:3;padding:6px 10px;font-size:10px;color:var(--jcs-muted);
  background:linear-gradient(transparent,var(--jcs-tip-fade));pointer-events:none;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}

@media (max-width:820px),(pointer:coarse) and (max-width:1024px){
  a.${NS}-link{padding:2px 5px;font-size:14px;line-height:1.6}
  /* 移动端：圆形显示数量（无则 0），可拖 */
  #${NS}-fab{
    width:52px!important;height:52px!important;min-width:52px!important;
    padding:0!important;gap:0;border-radius:50%;
    right:max(10px,env(safe-area-inset-right));
    bottom:max(18px,env(safe-area-inset-bottom),14%);
    left:auto;top:auto;
    background:linear-gradient(145deg,#ff7a6c 0%,#d4534a 55%,#a8322b 100%);
    border:1.5px solid rgba(255,255,255,.22);
    box-shadow:0 8px 22px rgba(212,83,74,.42),0 0 0 1px rgba(0,0,0,.12);
    backdrop-filter:none;-webkit-backdrop-filter:none;
    touch-action:none;cursor:grab
  }
  #${NS}-fab:active{cursor:grabbing;transform:scale(.94);filter:brightness(1.06)}
  #${NS}-fab.is-dragging{cursor:grabbing;opacity:.92;box-shadow:0 12px 28px rgba(0,0,0,.35)}
  #${NS}-fab .jcs-fab-txt,
  #${NS}-fab .jcs-fab-ico{display:none!important}
  #${NS}-fab .jcs-badge{
    position:static!important;top:auto!important;right:auto!important;left:auto!important;bottom:auto!important;
    transform:none!important;display:flex!important;align-items:center;justify-content:center;
    min-width:0;width:100%;height:100%;padding:0;border:0;border-radius:50%;
    background:transparent!important;color:#fff!important;box-shadow:none!important;
    font-size:18px;font-weight:900;font-variant-numeric:tabular-nums;
    text-shadow:0 1px 2px rgba(0,0,0,.28);line-height:1
  }
  #${NS}-fab .jcs-badge.is-zero{
    display:flex!important;opacity:.9;color:rgba(255,255,255,.92)!important
  }
  #${NS}-fab.has-codes{
    background:linear-gradient(145deg,#ff8f82 0%,#e0554c 50%,#b83a32 100%)
  }
  #${NS}-fab:not(.has-codes){
    background:linear-gradient(145deg,#6b7280 0%,#4b5563 55%,#374151 100%);
    border-color:rgba(255,255,255,.16);
    box-shadow:0 8px 20px rgba(0,0,0,.28)
  }
  a.${NS}-link{
    display:inline-flex;align-items:center;padding:3px 8px!important;
    border-radius:999px!important;font-size:13px!important;line-height:1.35!important;
    border:1px solid rgba(212,83,74,.28)!important;
    box-decoration-break:clone;-webkit-box-decoration-break:clone
  }
  #${NS}-panel{
    left:0!important;right:0!important;bottom:0!important;top:auto!important;
    width:100%!important;max-width:100%!important;
    height:min(72dvh,640px)!important;max-height:min(78dvh,720px)!important;
    border-radius:16px 16px 0 0;border-left:0;border-right:0;border-bottom:0;
    padding-bottom:env(safe-area-inset-bottom)
  }
  #${NS}-panel .jcs-list,#${NS}-panel #${NS}-list{
    flex:1 1 auto!important;min-height:0!important;max-height:none!important
  }
  #${NS}-panel .jcs-sheet-bar{
    display:flex;justify-content:center;padding:8px 0 2px;flex-shrink:0
  }
  #${NS}-panel .jcs-sheet-bar i{
    width:40px;height:4px;border-radius:99px;background:rgba(255,255,255,.2)
  }
  #${NS}-panel .jcs-head{cursor:default;padding:8px 12px 10px}
  #${NS}-popup{
    align-items:stretch;justify-content:stretch;padding:0;background:rgba(0,0,0,.72)
  }
  #${NS}-win{
    width:100%!important;height:100%!important;max-height:100dvh!important;
    border-radius:0;border:0;margin:0
  }
  #${NS}-win .jcs-main{grid-template-columns:1fr}
  #${NS}-win .jcs-side{display:none}
  #${NS}-mobi-codes{display:flex}
  #${NS}-win .jcs-head{
    cursor:default;padding:max(10px,env(safe-area-inset-top)) 10px 10px;gap:6px
  }
  #${NS}-panel .jcs-tools{padding:10px 12px;gap:8px}
  #${NS}-panel .jcs-tools input,#${NS}-panel .jcs-tools .jcs-btn{height:42px}
  #${NS}-panel .jcs-tools .jcs-btn{padding:0 12px}
  #${NS}-win .jcs-tools{padding:10px 12px;gap:8px}
  #${NS}-win .jcs-tools .jcs-tools-search{flex:1 1 100%;order:2}
  #${NS}-win .jcs-segbox{
    flex:1 1 100%;order:1;width:100%;max-width:none;
    overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none
  }
  #${NS}-win .jcs-segbox::-webkit-scrollbar{display:none}
  #${NS}-win .jcs-seg{flex:0 0 auto;height:34px;padding:0 14px}
  #${NS}-win .jcs-tools input,#${NS}-win .jcs-tools-search input,
  #${NS}-win .jcs-tools .jcs-btn,#${NS}-win .jcs-tools-search .jcs-btn{height:42px}
  #${NS}-win .jcs-body{margin:0;border-radius:0;border-left:0;border-right:0;border-bottom:0}
  #${NS}-cfg .jcs-cfg-top{padding:max(12px,env(safe-area-inset-top)) 12px 10px}
  #${NS}-cfg .jcs-cfg-body{padding:12px 12px max(16px,env(safe-area-inset-bottom))}
  #${NS}-cfg .jcs-form{grid-template-columns:1fr}
  #${NS}-cfg .jcs-prow{flex-wrap:wrap}
  #${NS}-cfg .jcs-prow-ops{width:100%;justify-content:flex-end}
  #${NS}-sub{
    align-items:stretch;justify-content:stretch;padding:0;background:rgba(0,0,0,.72);
    backdrop-filter:none;-webkit-backdrop-filter:none
  }
  #${NS}-sub-win{
    width:100%!important;max-height:100dvh!important;height:100%!important;
    border-radius:0;border:0;margin:0;transform:none!important
  }
  #${NS}-sub-win .jcs-head{
    cursor:default;padding:max(10px,env(safe-area-inset-top)) 12px 10px;gap:6px
  }
  #${NS}-sub-win .jcs-sub-toolbar{padding:10px 12px 12px}
  #${NS}-sub-win .jcs-sub-search input,#${NS}-sub-win .jcs-btn{height:44px}
  #${NS}-sub-list,#${NS}-sub-win .jcs-sub-list{
    padding:10px 12px max(16px,env(safe-area-inset-bottom))
  }
  #${NS}-sub-list .jcs-sub-item{
    grid-template-columns:1fr;gap:10px;padding:12px
  }
  #${NS}-sub-list .jcs-sub-acts{
    flex-direction:row;width:100%
  }
  #${NS}-sub-list .jcs-sub-acts .jcs-btn{
    flex:1;min-width:0;height:40px
  }
  #${NS}-sub-list .jcs-sub-name{-webkit-line-clamp:3}
}
@media (prefers-reduced-motion:reduce){
  #${NS}-panel,#${NS}-popup,#${NS}-win,#${NS}-cfg,#${NS}-fab,#${NS}-toast,#${NS}-sub,#${NS}-sub-win{
    transition:none!important;animation:none!important
  }
  #${NS}-sub-win{transform:none!important;opacity:1!important}
  #${NS}-sub-list .jcs-sub-spin{animation:none!important;border-top-color:var(--jcs-accent)}
}
`;
        (document.head || document.documentElement).appendChild(css);
    }

    function ensurePanel() {
        // iframe 精简模式：不挂浮钮/面板（顶层已有）
        if (state.embedLite) return null;
        injectStyles();
        let fab = document.getElementById(NS + '-fab');
        let panel = document.getElementById(NS + '-panel');
        if (fab && panel) return panel;

        fab = document.createElement('button');
        fab.id = NS + '-fab';
        fab.type = 'button';
        fab.title = '番号扫描（可拖动）';
        fab.setAttribute('aria-label', '番号扫描');
        fab.innerHTML =
            '<span class="jcs-fab-ico" aria-hidden="true">#</span>' +
            '<span class="jcs-fab-txt">番号</span>' +
            '<span class="jcs-badge is-zero" id="' + NS + '-badge">0</span>';
        mountUI(fab);

        panel = document.createElement('div');
        panel.id = NS + '-panel';
        panel.innerHTML = `
  <div class="jcs-sheet-bar" aria-hidden="true"><i></i></div>
  <div class="jcs-head">
    <div class="jcs-brand">
      <div class="jcs-mark">#</div>
      <div><strong>番号扫描</strong><span id="${NS}-panel-sub">扫描中…</span></div>
    </div>
    <button type="button" class="jcs-icon" id="${NS}-ext-mode-btn" title="打开方式：新标签 / 本页预览" aria-label="打开方式">外</button>
    <button type="button" class="jcs-icon" id="${NS}-theme-btn" title="切换主题" aria-label="切换主题">☀</button>
    <button type="button" class="jcs-icon" id="${NS}-cfg-btn" title="设置" aria-label="设置">⚙</button>
    <button type="button" class="jcs-icon" id="${NS}-rescan" title="重新扫描" aria-label="重新扫描">↻</button>
    <button type="button" class="jcs-icon" id="${NS}-hide" title="关闭" aria-label="关闭">×</button>
  </div>
  <div class="jcs-tools">
    <input id="${NS}-q" type="search" inputmode="search" enterkeyhint="search" placeholder="输入番号 · / 聚焦" autocomplete="off" spellcheck="false" />
    <button type="button" class="jcs-btn solid" id="${NS}-go">搜索</button>
    <button type="button" class="jcs-btn" id="${NS}-sub-btn" title="字幕搜索">字幕</button>
  </div>
  <div class="jcs-list" id="${NS}-list"></div>
  <div class="jcs-foot" id="${NS}-foot">点番号复制 · 再点搜索 · 外/内切换打开方式</div>`;
        mountUI(panel);
        syncHostToViewport();
        applyTheme(state.theme || loadTheme());

        // 浮钮：点击打开；拖动改位置（移动端/桌面均可）
         setupFabDrag(fab, () => {
             const open = !panel.classList.contains('show');
             panel.classList.toggle('show', open);
             if (open) {
                 if (isMobile()) {
                     panel.style.left = '';
                     panel.style.top = '';
                     panel.style.right = '';
                     panel.style.bottom = '';
                     panel.style.width = '';
                     panel.style.height = '';
                 }
                 // 先刷列表再高亮，避免 featured 大页 linkify 卡住导致「有数字无列表」
                 refreshScan(true);
                 renderPanelList({ force: true });
             }
         });
        restoreFabPos(fab);

        panel.querySelector('#' + NS + '-hide').onclick = () => panel.classList.remove('show');
        panel.querySelector('#' + NS + '-rescan').onclick = () => refreshScan(true);
        panel.querySelector('#' + NS + '-ext-mode-btn').onclick = () => togglePreferExternal();
        panel.querySelector('#' + NS + '-theme-btn').onclick = () => toggleTheme();
        // 设置入口（设置页挂在搜索窗内）
        panel.querySelector('#' + NS + '-cfg-btn').onclick = () => {
            const code = state.active || state.codes[0] || '';
            if (code) openSearch(code, { forceFull: true });
            else {
                ensurePopup();
                const popup = document.getElementById(NS + '-popup');
                if (popup) {
                    popup.classList.add('show');
                    try { document.documentElement.classList.add(NS + '-popup-open'); } catch (e) { /* ignore */ }
                    lockBodyScroll(true);
                }
            }
            setTimeout(() => toggleConfig(true), 40);
        };
        panel.querySelector('#' + NS + '-go').onclick = (e) => {
            const q = (panel.querySelector('#' + NS + '-q').value || '').trim();
            if (q) openSearch(q, { anchor: e.currentTarget });
        };
        panel.querySelector('#' + NS + '-sub-btn').onclick = () => {
            const q = (panel.querySelector('#' + NS + '-q').value || '').trim();
            openSubtitleSearch(q || state.active || state.codes[0] || '');
        };
        panel.querySelector('#' + NS + '-q').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = (e.target.value || '').trim();
                if (q) openSearch(q, { anchor: e.target });
            }
        });

        // 桌面可拖面板；移动端底部抽屉固定
        bindDrag(panel, panel.querySelector('.jcs-head'), {
            fixedMode: true,
            disableOnMobile: true,
            onEnd: (moved) => {
                if (isMobile() || !moved) return;
                storeSetJson(PANEL_KEY, {
                    left: parseInt(panel.style.left, 10) || null,
                    top: parseInt(panel.style.top, 10) || null
                });
            }
        });

        if (!isMobile()) {
            try {
                const lay = storeGetJson(PANEL_KEY, {}) || {};
                if (lay.left != null && lay.top != null) {
                    panel.style.left = lay.left + 'px';
                    panel.style.top = lay.top + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                }
            } catch (e) { /* ignore */ }
        }

        return panel;
    }

    function clampFab(el, left, top) {
        const host = document.getElementById(NS + '-host');
        const hw = (host && host.clientWidth) || window.innerWidth;
        const hh = (host && host.clientHeight) || window.innerHeight;
        const w = el.offsetWidth || 52;
        const h = el.offsetHeight || 52;
        const pad = 6;
        return {
            left: Math.max(pad, Math.min(hw - w - pad, left)),
            top: Math.max(pad, Math.min(hh - h - pad, top))
        };
    }

    function saveFabPos(el) {
        try {
            const left = parseFloat(el.style.left);
            const top = parseFloat(el.style.top);
            if (!isFinite(left) || !isFinite(top)) return;
            storeSetJson(FAB_POS_KEY, { left: Math.round(left), top: Math.round(top) });
        } catch (e) { /* ignore */ }
    }

    function restoreFabPos(el) {
        try {
            const o = storeGetJson(FAB_POS_KEY, null);
            if (o == null || o.left == null || o.top == null) return;
            const p = clampFab(el, Number(o.left), Number(o.top));
            el.style.left = p.left + 'px';
            el.style.top = p.top + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        } catch (e) { /* ignore */ }
    }

    function setupFabDrag(fab, onTap) {
        let active = false;
        let moved = false;
        let ignoreClick = false;
        let sx = 0, sy = 0, ox = 0, oy = 0;
        const THRESH = 8;
        const point = (e) => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;

        const start = (e) => {
            if (e.type === 'mousedown' && e.button) return;
            const pt = point(e);
            if (!pt) return;
            const r = fab.getBoundingClientRect();
            const host = document.getElementById(NS + '-host');
            const hr = host ? host.getBoundingClientRect() : { left: 0, top: 0 };
            active = true;
            moved = false;
            sx = pt.clientX;
            sy = pt.clientY;
            ox = r.left - hr.left;
            oy = r.top - hr.top;
            // 先不 preventDefault，否则移动端 click 永不触发
        };

        const move = (e) => {
            if (!active) return;
            const pt = point(e);
            if (!pt) return;
            const dx = pt.clientX - sx;
            const dy = pt.clientY - sy;
            if (!moved && (Math.abs(dx) > THRESH || Math.abs(dy) > THRESH)) {
                moved = true;
                fab.classList.add('is-dragging');
                // 进入拖动态再锁坐标，避免点按被当成拖动
                fab.style.left = ox + 'px';
                fab.style.top = oy + 'px';
                fab.style.right = 'auto';
                fab.style.bottom = 'auto';
            }
            if (!moved) return;
            const p = clampFab(fab, ox + dx, oy + dy);
            fab.style.left = p.left + 'px';
            fab.style.top = p.top + 'px';
            if (e.cancelable) e.preventDefault();
        };

        const end = (e) => {
            if (!active) return;
            active = false;
            fab.classList.remove('is-dragging');
            if (moved) {
                saveFabPos(fab);
                ignoreClick = true;
                setTimeout(() => { ignoreClick = false; moved = false; }, 80);
                return;
            }
            // 触屏：touchend 直接打开（不依赖 click）
            if (e && e.type === 'touchend') {
                ignoreClick = true;
                setTimeout(() => { ignoreClick = false; }, 400);
                if (typeof onTap === 'function') onTap();
            }
            // 鼠标：mouseup 后走 click
        };

        fab.addEventListener('mousedown', start);
        fab.addEventListener('touchstart', start, { passive: true });
        document.addEventListener('mousemove', move, { passive: false });
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('mouseup', end);
        document.addEventListener('touchend', end);
        fab.addEventListener('click', (e) => {
            if (ignoreClick || moved) {
                e.preventDefault();
                e.stopImmediatePropagation();
                moved = false;
                return;
            }
            if (typeof onTap === 'function') onTap();
        });
    }

    /** 选源菜单锚定在面板 chip 时，禁止重建列表以免锚点 DOM 被销毁 */
    function getPanelEl() {
        return document.getElementById(NS + '-panel');
    }

    /** 始终取面板内列表，缺失则重建，避免站点同名 id / 空壳节点 */
    function getPanelListEl() {
        const panel = getPanelEl();
        if (!panel) return null;
        let list = null;
        try {
            list = panel.querySelector('#' + NS + '-list') || panel.querySelector('.jcs-list');
        } catch (e) { list = null; }
        if (!list) {
            list = document.createElement('div');
            list.id = NS + '-list';
            list.className = 'jcs-list';
            const foot = panel.querySelector('#' + NS + '-foot');
            if (foot && foot.parentNode === panel) panel.insertBefore(list, foot);
            else panel.appendChild(list);
        } else {
            if (!list.id) list.id = NS + '-list';
            if (!list.classList.contains('jcs-list')) list.classList.add('jcs-list');
        }
        return list;
    }

    function pickerAnchoredInPanelList() {
        if (!isPickerOpen() || !state.pickAnchor) return false;
        try {
            const list = getPanelListEl();
            if (!list) return false;
            const a = state.pickAnchor;
            return !!(a === list || (list.contains && list.contains(a)));
        } catch (e) {
            return false;
        }
    }

    function renderPanelMeta() {
        const badge = document.getElementById(NS + '-badge');
        const fab = document.getElementById(NS + '-fab');
        const sub = document.getElementById(NS + '-panel-sub');
        const foot = document.getElementById(NS + '-foot');
        const n = state.codes.length;
        if (badge) {
            badge.textContent = n > 99 ? '99+' : String(n);
            badge.classList.toggle('is-zero', n === 0);
            badge.hidden = false;
            badge.style.display = '';
        }
        if (fab) {
            fab.classList.toggle('has-codes', n > 0);
            fab.title = n ? ('番号扫描 · ' + n + ' 个') : '番号扫描';
            fab.setAttribute('aria-label', n ? ('番号扫描，识别到 ' + n + ' 个') : '番号扫描');
        }
        if (sub) sub.textContent = n ? ('识别到 ' + n + ' 个') : '未识别到番号';
        if (foot) {
            if (preferExternalSearch()) {
                foot.textContent = n
                    ? '点击番号 → 选网站，新标签打开 · Alt 复制'
                    : '输入番号后搜索 · 将在新标签打开';
            } else {
                foot.textContent = n
                    ? '点击复制 · 双击在本页搜索 · 可改「外/内」打开方式'
                    : '可手动输入 · 点「外/内」切换打开方式';
            }
        }
        applyExtModeUi();
    }

    function renderPanelList(opts) {
        if (state.embedLite) return;
        const o = opts || {};
        injectStyles();
        ensurePanel();
        const list = getPanelListEl();
        if (!list) return;
        renderPanelMeta();
        const codes = (state.codes || []).map((c) => String(c || '').trim()).filter(Boolean);
        const n = codes.length;
        let chips = [];
        try { chips = Array.prototype.slice.call(list.querySelectorAll('button.jcs-chip, .jcs-chip')); } catch (e) { chips = []; }

        // 旁出选源锚定 chip 时尽量不拆 DOM；列表空/数量不一致/强制刷新时必须重建
        const anchored = !o.force && !!(o.skipList || pickerAnchoredInPanelList());
        const listStale = o.force ||
            (n > 0 && chips.length === 0) ||
            (n === 0 && !list.querySelector('.jcs-empty')) ||
            (n > 0 && chips.length > 0 && chips.length !== n);
        if (anchored && !listStale) {
            try {
                chips.forEach((btn) => {
                    const c = btn.getAttribute('data-code') || '';
                    btn.classList.toggle('is-active', !!(c && c === state.active));
                    btn.title = chipTitleText();
                });
            } catch (e) { /* ignore */ }
            return;
        }

        const prevScroll = list.scrollTop || 0;
        // 用 DOM API 构建，避免站点过滤 innerHTML / 隐藏 button
        while (list.firstChild) list.removeChild(list.firstChild);

        if (!n) {
            const empty = document.createElement('div');
            empty.className = 'jcs-empty';
            empty.textContent = '本页暂无番号';
            list.appendChild(empty);
            return;
        }

        const frag = document.createDocumentFragment();
        for (let i = 0; i < n; i++) {
            const c = codes[i];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'jcs-chip' + (c === state.active ? ' is-active' : '');
            btn.setAttribute('data-code', c);
            btn.textContent = c;
            btn.title = chipTitleText();
            frag.appendChild(btn);
        }
        list.appendChild(frag);
        list.querySelectorAll('.jcs-chip').forEach((btn) => bindChipCopy(btn));
        if (prevScroll > 0) {
            try { list.scrollTop = prevScroll; } catch (e) { /* ignore */ }
        }
    }

    function ensurePopup() {
        injectStyles();
        let root = document.getElementById(NS + '-popup');
        // 脚本升级后旧 DOM 缺新控件（点选/备份区等），按版本重建
        if (root && root.getAttribute('data-ver') !== SCRIPT_VER) {
            try {
                if (root.parentNode) root.parentNode.removeChild(root);
            } catch (e) { /* ignore */ }
            root = null;
            try {
                const oldPick = document.getElementById(NS + '-selpick');
                if (oldPick && oldPick.parentNode) oldPick.parentNode.removeChild(oldPick);
            } catch (e2) { /* ignore */ }
            try {
                const oldInp = document.getElementById(NS + '-cfg-import-input');
                if (oldInp && oldInp.parentNode) oldInp.parentNode.removeChild(oldInp);
            } catch (e3) { /* ignore */ }
        }
        if (root) return root;

        root = document.createElement('div');
        root.id = NS + '-popup';
        root.setAttribute('data-ver', SCRIPT_VER);
        root.innerHTML = `
  <div id="${NS}-win" role="dialog" aria-modal="true">
    <div class="jcs-head">
      <div class="jcs-brand">
        <div class="jcs-mark">S</div>
        <div>
          <strong>番号搜索</strong>
          <div class="jcs-title" id="${NS}-ptitle"></div>
        </div>
      </div>
      <div class="jcs-actions">
        <button type="button" class="jcs-icon" id="${NS}-pprev" title="上一个" aria-label="上一个">‹</button>
        <button type="button" class="jcs-icon" id="${NS}-pnext" title="下一个" aria-label="下一个">›</button>
        <button type="button" class="jcs-btn" id="${NS}-psub" title="字幕搜索">字幕</button>
        <button type="button" class="jcs-btn" id="${NS}-pext" title="用浏览器新标签打开当前搜索">外链</button>
        <button type="button" class="jcs-btn" id="${NS}-pext-mode" title="打开方式：新标签 / 本页预览">新标签</button>
        <button type="button" class="jcs-icon" id="${NS}-ptheme" title="切换主题" aria-label="切换主题">☀</button>
        <button type="button" class="jcs-icon" id="${NS}-pcfg" title="设置" aria-label="设置">⚙</button>
        <button type="button" class="jcs-icon" id="${NS}-pclose" title="关闭" aria-label="关闭">×</button>
      </div>
    </div>
    <div class="jcs-main">
      <aside class="jcs-side">
        <div class="jcs-side-h"><span>本页番号</span></div>
        <div class="jcs-side-list" id="${NS}-page-list"></div>
        <div class="jcs-side-h"><span>最近</span><button type="button" id="${NS}-clear-hist">清空</button></div>
        <div class="jcs-side-list" id="${NS}-hist-list"></div>
      </aside>
      <div class="jcs-content">
        <div id="${NS}-mobi-codes" aria-label="本页番号"></div>
        <div class="jcs-tools">
          <div class="jcs-segbox" id="${NS}-providers"></div>
          <div class="jcs-tools-search">
            <input id="${NS}-pinput" type="search" inputmode="search" enterkeyhint="search" placeholder="输入番号" autocomplete="off" spellcheck="false" />
            <button type="button" class="jcs-btn solid" id="${NS}-pgo">搜索</button>
          </div>
        </div>
        <div class="jcs-body">
          <div class="jcs-tip" id="${NS}-ptip">选择番号或输入后搜索</div>
          <iframe id="${NS}-frame" title="search"
            referrerpolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"></iframe>
          <div id="${NS}-fetch" class="jcs-fetch" hidden></div>
          <div id="${NS}-frame-fallback" aria-live="polite">
            <div class="jcs-fb-ico" aria-hidden="true">!</div>
            <strong id="${NS}-fb-title">无法在本页预览</strong>
            <p id="${NS}-fb-desc">当前网站不允许在页面里嵌套显示搜索结果。请点下方网站，用新标签打开。</p>
            <div class="jcs-fb-url" id="${NS}-fb-url"></div>
            <div class="jcs-fb-actions" id="${NS}-fb-providers"></div>
            <div class="jcs-fb-actions">
              <button type="button" class="jcs-btn" id="${NS}-fb-copy">复制链接</button>
              <button type="button" class="jcs-btn" id="${NS}-fb-retry">再试本页预览</button>
              <button type="button" class="jcs-btn" id="${NS}-fb-pick">选网站</button>
            </div>
          </div>
        </div>
      </div>
      <div id="${NS}-cfg" aria-label="设置">
        <div class="jcs-cfg-top">
          <div class="jcs-cfg-brand">
            <strong>设置</strong>
            <span class="jcs-cfg-host" id="${NS}-cfg-host"></span>
          </div>
          <button type="button" class="jcs-icon" id="${NS}-cfg-close" title="关闭" aria-label="关闭">×</button>
        </div>
        <div class="jcs-cfg-tabs" role="tablist" aria-label="设置分类">
          <button type="button" class="jcs-cfg-tab is-on" data-tab="general" role="tab" aria-selected="true">常规</button>
          <button type="button" class="jcs-cfg-tab" data-tab="highlight" role="tab" aria-selected="false">高亮</button>
          <button type="button" class="jcs-cfg-tab" data-tab="sources" role="tab" aria-selected="false">搜索源</button>
          <button type="button" class="jcs-cfg-tab" data-tab="backup" role="tab" aria-selected="false">备份</button>
        </div>
        <div class="jcs-cfg-body">
          <div class="jcs-cfg-pane is-on" data-pane="general" role="tabpanel">
            <div class="jcs-card jcs-site-card">
              <div class="jcs-site-row">
                <div>
                  <strong id="${NS}-cfg-host-name">当前站点</strong>
                  <p id="${NS}-cfg-host-meta">读取中…</p>
                </div>
                <div class="jcs-badge-row" id="${NS}-cfg-open-status"></div>
              </div>
            </div>
            <div class="jcs-card">
              <div class="jcs-card-hd">
                <div>
                  <strong>点番号时</strong>
                  <p>选择默认打开方式。可随时改，立即生效。</p>
                </div>
              </div>
              <div class="jcs-seg-mode" id="${NS}-cfg-open-mode" role="group" aria-label="打开方式">
                <button type="button" data-mode="embed" id="${NS}-cfg-mode-embed">本页预览</button>
                <button type="button" data-mode="external" id="${NS}-cfg-mode-ext">新标签打开</button>
              </div>
              <p class="jcs-mode-hint" id="${NS}-cfg-open-hint"></p>
              <p class="jcs-callout" id="${NS}-cfg-open-callout"></p>
              <input type="checkbox" id="${NS}-cfg-ext" hidden />
            </div>
            <div class="jcs-card">
              <div class="jcs-card-hd">
                <div>
                  <strong>框架（iframe）</strong>
                  <p>正文若在子页面里，需允许脚本在框架内运行。</p>
                </div>
              </div>
              <label class="jcs-switch-row" for="${NS}-cfg-frame-allow">
                <div>
                  <b>允许本站在 iframe 内运行</b>
                  <em>仅影响当前域名。修改后需要刷新页面。</em>
                </div>
                <span class="jcs-switch"><input type="checkbox" id="${NS}-cfg-frame-allow" /><i></i></span>
              </label>
              <p class="jcs-callout is-warn" id="${NS}-cfg-frame-callout">已更改，请刷新页面后生效。</p>
              <div class="jcs-inline-actions" id="${NS}-cfg-frame-actions" hidden>
                <button type="button" class="jcs-btn solid" id="${NS}-cfg-frame-reload">刷新页面</button>
                <button type="button" class="jcs-btn" id="${NS}-cfg-frame-undo">撤销更改</button>
              </div>
            </div>
            <div class="jcs-card">
              <div class="jcs-card-hd">
                <div>
                  <strong>外观</strong>
                  <p>深色 / 浅色，会记住你的选择。</p>
                </div>
              </div>
              <div class="jcs-seg-mode" id="${NS}-cfg-theme-mode" role="group" aria-label="主题">
                <button type="button" data-theme="dark" id="${NS}-cfg-theme-dark">深色</button>
                <button type="button" data-theme="light" id="${NS}-cfg-theme-light">浅色</button>
              </div>
            </div>
          </div>
          <div class="jcs-cfg-pane" data-pane="backup" role="tabpanel">
            <div class="jcs-card" id="${NS}-cfg-backup">
              <div class="jcs-card-hd">
                <div>
                  <strong>本地文件</strong>
                  <p class="jcs-card-desc">导出/导入<strong>所有网站</strong>配置（搜索源/高亮/主题 + 各站打开方式等）。不含搜索历史与 WebDAV 密码。</p>
                </div>
              </div>
              <div class="jcs-badge-row" id="${NS}-cfg-store-badge"></div>
              <p class="jcs-mode-hint" id="${NS}-cfg-backup-summary" style="margin:0"></p>

              <div class="jcs-backup-section">
                <div class="jcs-backup-kicker">导出</div>
                <div class="jcs-inline-actions">
                  <button type="button" class="jcs-btn solid" id="${NS}-cfg-export" title="下载全部站点配置 JSON">导出文件</button>
                  <button type="button" class="jcs-btn" id="${NS}-cfg-export-copy" title="复制全部站点配置到剪贴板">复制 JSON</button>
                </div>
              </div>

              <div class="jcs-backup-section">
                <div class="jcs-backup-kicker">导入</div>
                <label class="jcs-switch-row" for="${NS}-cfg-import-merge">
                  <div>
                    <b>合并导入</b>
                    <em>保留现有配置并更新同名项；关闭则整包覆盖（搜索源/站点规则等）。</em>
                  </div>
                  <span class="jcs-switch"><input type="checkbox" id="${NS}-cfg-import-merge" checked /><i></i></span>
                </label>
                <div class="jcs-dropzone" id="${NS}-cfg-dropzone" tabindex="0" role="button"
                  aria-label="拖放或选择配置 JSON 文件导入" title="拖放 JSON，或点击选择文件">
                  <div class="jcs-dropzone-inner">
                    <strong>拖放 JSON 到此处</strong>
                    <span>或点击选择文件 · 支持加密备份</span>
                  </div>
                  <p class="jcs-dropzone-meta" id="${NS}-cfg-drop-meta" hidden></p>
                </div>
                <div class="jcs-inline-actions">
                  <button type="button" class="jcs-btn" id="${NS}-cfg-backup-more" aria-expanded="false">粘贴导入 ▾</button>
                </div>
                <div class="jcs-backup-detail" id="${NS}-cfg-backup-detail" hidden>
                  <label class="jcs-hl-label">粘贴全部站点配置 JSON
                    <textarea id="${NS}-cfg-import-ta" spellcheck="false" placeholder="粘贴 jcs-all-sites-*.json 或加密备份内容后点导入"></textarea>
                  </label>
                  <div class="jcs-cfg-actions">
                    <button type="button" class="jcs-btn solid" id="${NS}-cfg-import-paste">导入粘贴内容</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="jcs-card" id="${NS}-cfg-webdav">
              <div class="jcs-card-hd">
                <div>
                  <strong>WebDAV 云端备份</strong>
                  <p class="jcs-card-desc">上传/下载到坚果云、Nextcloud、群晖等 WebDAV。账号密码仅保存在本机脚本存储，不会写进导出文件。</p>
                </div>
              </div>
              <div class="jcs-dav-form">
                <label class="full">服务器地址（目录或完整文件 URL）
                  <input type="url" id="${NS}-dav-url" autocomplete="off" spellcheck="false"
                    placeholder="https://dav.example.com/dav/jcs/" />
                </label>
                <label>用户名
                  <input type="text" id="${NS}-dav-user" autocomplete="username" spellcheck="false" placeholder="可选" />
                </label>
                <label>密码 / 应用密码
                  <input type="password" id="${NS}-dav-pass" autocomplete="current-password" placeholder="可选" />
                </label>
                <label class="full">文件名
                  <input type="text" id="${NS}-dav-file" autocomplete="off" spellcheck="false"
                    placeholder="${WEBDAV_DEFAULT_FILE}" />
                </label>
                <label class="full jcs-switch-row" for="${NS}-dav-encrypt" style="border-top:0;padding:4px 0">
                  <div>
                    <b>加密上传</b>
                    <em>AES-256-GCM。云端只存密文；恢复时用同一加密密码解密。</em>
                  </div>
                  <span class="jcs-switch"><input type="checkbox" id="${NS}-dav-encrypt" /><i></i></span>
                </label>
                <label class="full">加密密码（与 WebDAV 密码不同）
                  <input type="password" id="${NS}-dav-secret" autocomplete="new-password"
                    placeholder="开启加密后必填，请自行牢记" />
                </label>
              </div>
              <div class="jcs-inline-actions">
                <button type="button" class="jcs-btn" id="${NS}-dav-save">保存设置</button>
                <button type="button" class="jcs-btn" id="${NS}-dav-test">测试连接</button>
                <button type="button" class="jcs-btn solid" id="${NS}-dav-upload">上传备份</button>
                <button type="button" class="jcs-btn solid" id="${NS}-dav-download">从云端恢复</button>
              </div>
              <p class="jcs-mode-hint" id="${NS}-dav-hint" style="margin:0">坚果云请用「应用密码」。加密密码仅存本机，丢失将无法解密云端备份。</p>
            </div>
            <p class="jcs-backup-status" id="${NS}-cfg-backup-status" role="status"></p>
          </div>
          <div class="jcs-cfg-pane" data-pane="highlight" role="tabpanel">
            <div class="jcs-card" id="${NS}-hl-box">
              <div class="jcs-card-hd">
                <div>
                  <strong>页面番号高亮</strong>
                  <p class="jcs-card-desc">自定义选择器 = 指定扫描范围 → 在范围内找番号 → 只给番号加高亮/点击。</p>
                </div>
              </div>
              <label class="jcs-switch-row" for="${NS}-hl-on">
                <div><b>启用页面高亮</b><em>总开关。关闭后不再改动网页。</em></div>
                <span class="jcs-switch"><input type="checkbox" id="${NS}-hl-on" /><i></i></span>
              </label>
              <label class="jcs-switch-row" for="${NS}-hl-text">
                <div><b>全文正文番号</b><em>全页普通文字里的番号（自定义 only 模式下不跑）。</em></div>
                <span class="jcs-switch"><input type="checkbox" id="${NS}-hl-text" /><i></i></span>
              </label>
              <label class="jcs-switch-row" for="${NS}-hl-native">
                <div><b>内置链接/卡片</b><em>在卡片/标题链里只高亮番号，点番号搜索、其余区域仍进原站（only 模式下不跑）。</em></div>
                <span class="jcs-switch"><input type="checkbox" id="${NS}-hl-native" /><i></i></span>
              </label>
              <label class="jcs-switch-row" for="${NS}-hl-auto">
                <div><b>扫描后自动高亮</b><em>打开面板或页面变化时自动处理。</em></div>
                <span class="jcs-switch"><input type="checkbox" id="${NS}-hl-auto" /><i></i></span>
              </label>
              <label class="jcs-hl-label">自定义选择器（仅当前站）
                <textarea id="${NS}-hl-sel" spellcheck="false" placeholder="仅本站生效。在匹配元素里扫文字，只高亮番号。&#10;例如：&#10;only&#10;.photo-info&#10;a.movie-box&#10;&#10;第一行 only = 本站只用自定义，不跑全文/内置"></textarea>
              </label>
              <p class="jcs-mode-hint" id="${NS}-hl-sel-scope" style="margin:0"></p>
              <div class="jcs-inline-actions">
                <button type="button" class="jcs-btn solid" id="${NS}-hl-pick" title="在页面上点选元素，自动生成选择器">鼠标点选</button>
                <span class="jcs-mode-hint" style="margin:0;flex:1;min-width:140px">点后移到目标区域单击，确认选择器再写入本站。</span>
              </div>
              <div class="jcs-cfg-actions">
                <button type="button" class="jcs-btn" id="${NS}-hl-clear">清除本页高亮</button>
                <button type="button" class="jcs-btn" id="${NS}-hl-reset">恢复默认</button>
                <button type="button" class="jcs-btn solid" id="${NS}-hl-apply">应用并重新高亮</button>
              </div>
            </div>
          </div>
          <div class="jcs-cfg-pane" data-pane="sources" role="tabpanel">
            <div class="jcs-card">
              <div class="jcs-src-toolbar">
                <p>点名称设为当前源；✎ 编辑；× 删除。网址可用 <code>{code}</code> / <code>{CODE}</code> / <code>{code_lower}</code>。</p>
                <div class="jcs-src-toolbar-btns">
                  <button type="button" class="jcs-btn" id="${NS}-cfg-reset" title="恢复内置搜索源">恢复默认</button>
                  <button type="button" class="jcs-btn solid" id="${NS}-fadd" title="在下方表单添加新搜索源">＋ 添加</button>
                </div>
              </div>
              <div class="jcs-plist" id="${NS}-plist" role="list"></div>
            </div>
            <div class="jcs-form-card" id="${NS}-form-card">
              <div class="jcs-form-hd">
                <div>
                  <strong id="${NS}-form-title">添加搜索源</strong>
                  <span id="${NS}-form-sub">填写名称与网址模板后保存</span>
                </div>
              </div>
              <div class="jcs-form">
                <label>显示名称<input id="${NS}-fname" type="text" placeholder="例如 Jable" autocomplete="off" spellcheck="false" /></label>
                <label>ID（可选）<input id="${NS}-fid" type="text" placeholder="自动生成" autocomplete="off" spellcheck="false" /></label>
                <label class="full">网址模板<input id="${NS}-furl" type="url" inputmode="url" placeholder="https://example.com/search?q={code}" autocomplete="off" spellcheck="false" /></label>
                <label class="full">备注（可选）<input id="${NS}-fhint" type="text" placeholder="例如：磁力 / 在线播放" autocomplete="off" spellcheck="false" /></label>
              </div>
              <p class="jcs-form-tip" id="${NS}-form-tip">提示：保存可用 <kbd>Enter</kbd>，取消编辑可用 <kbd>Esc</kbd></p>
              <div class="jcs-form-foot">
                <button type="button" class="jcs-btn" id="${NS}-fcancel" hidden>取消</button>
                <button type="button" class="jcs-btn" id="${NS}-fnew">清空</button>
                <button type="button" class="jcs-btn solid" id="${NS}-fsave">保存</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
        mountUI(root);
        syncHostToViewport();

        const win = root.querySelector('#' + NS + '-win');
        const close = () => closeSearchPopup();
        root.querySelector('#' + NS + '-pclose').onclick = close;
        root.addEventListener('click', (e) => { if (e.target === root && !isMobile()) close(); });
        // Esc 统一由 bindGlobalHotkeys 处理

        root.querySelector('#' + NS + '-pgo').onclick = () => {
            const q = (root.querySelector('#' + NS + '-pinput').value || '').trim();
            runPopupSearch(q);
        };
        root.querySelector('#' + NS + '-pinput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = (e.target.value || '').trim();
                runPopupSearch(q);
            }
        });
        root.querySelector('#' + NS + '-psub').onclick = () => {
            const code = state.active || (root.querySelector('#' + NS + '-pinput').value || '').trim();
            openSubtitleSearch(code);
        };
        root.querySelector('#' + NS + '-pext').onclick = () => {
            const code = state.active || (root.querySelector('#' + NS + '-pinput').value || '').trim();
            window.open(buildProviderUrl(code, state.provider), '_blank', 'noopener,noreferrer');
        };
        root.querySelector('#' + NS + '-fb-copy').onclick = () => {
            const url = state.frameUrl || buildProviderUrl(state.active, state.provider);
            if (url) copyText(url).then((ok) => showToast(ok ? '已复制链接' : '复制失败'));
        };
        root.querySelector('#' + NS + '-fb-retry').onclick = () => {
            setUserPreferExternal(false);
            clearHostFrameBlocked();
            applyExtModeUi();
            if (state.active) loadFrame(state.active, { forceEmbed: true });
        };
        bindConfigUi(root);
        root.querySelector('#' + NS + '-fb-pick').onclick = (e) => {
            const code = state.active || (root.querySelector('#' + NS + '-pinput').value || '').trim();
            if (code) openProviderPicker(code, e.currentTarget);
        };
        const pextMode = root.querySelector('#' + NS + '-pext-mode');
        if (pextMode) pextMode.onclick = () => togglePreferExternal();
        root.querySelector('#' + NS + '-pprev').onclick = () => stepCode(-1);
        root.querySelector('#' + NS + '-pnext').onclick = () => stepCode(1);
        root.querySelector('#' + NS + '-ptheme').onclick = () => toggleTheme();
        root.querySelector('#' + NS + '-pcfg').onclick = () => toggleConfig(true);
        applyTheme(state.theme || loadTheme());
        bindFrameGuard(root);
        root.querySelector('#' + NS + '-clear-hist').onclick = () => {
            clearHist();
            renderSideLists();
        };

        bindDrag(win, root.querySelector('.jcs-head'), {
            fixedMode: true,
            setSize: true,
            disableOnMobile: true,
            onEnd: (moved) => {
                // 仅真正拖动后改为自由定位；单击标题栏不改变居中
                if (!isMobile() && moved) {
                    root.style.alignItems = 'flex-start';
                    root.style.justifyContent = 'flex-start';
                }
            }
        });

        // 移动端：外链优先按钮文案
        const ext = root.querySelector('#' + NS + '-pext');
        if (ext && isMobile()) ext.textContent = '浏览器打开';

        return root;
    }

    function renderMobiCodes() {
        const box = document.getElementById(NS + '-mobi-codes');
        if (!box) return;
        if (!state.codes.length) {
            box.innerHTML = '';
            return;
        }
        box.innerHTML = state.codes.map((c) =>
            '<button type="button" class="jcs-chip' + (c === state.active ? ' is-active' : '') +
            '" data-code="' + c.replace(/"/g, '') + '">' + c + '</button>'
        ).join('');
        // 弹窗内：始终在大窗内搜索，不降级旁出选源
        box.querySelectorAll('.jcs-chip').forEach((btn) => {
            btn.title = '点击搜索 · Alt+点击复制';
            btn.onclick = (e) => {
                const code = btn.getAttribute('data-code') || '';
                if (!code) return;
                if (e.altKey || e.metaKey) copyCode(code);
                else runPopupSearch(code);
            };
        });
    }

    function renderProviders() {
        const box = document.getElementById(NS + '-providers');
        if (!box) return;
        const list = getProviders();
        if (!list.some((p) => p.id === state.provider)) state.provider = list[0] ? list[0].id : '';
        box.innerHTML = list.map((p) =>
            '<button type="button" class="jcs-seg' + (p.id === state.provider ? ' is-active' : '') +
            '" data-id="' + p.id.replace(/"/g, '') + '" title="' + (p.hint || p.url).replace(/"/g, '') + '">' +
            p.name.replace(/</g, '') + '</button>'
        ).join('');
        box.querySelectorAll('.jcs-seg').forEach((btn) => {
            btn.onclick = () => {
                state.provider = btn.getAttribute('data-id') || '';
                saveProviderId(state.provider);
                renderProviders();
                if (state.active) loadFrame(state.active);
            };
        });
    }

    function renderSideLists() {
        const pageBox = document.getElementById(NS + '-page-list');
        const histBox = document.getElementById(NS + '-hist-list');
        if (!pageBox || !histBox) return;
        const item = (c) =>
            '<button type="button" class="jcs-item' + (c === state.active ? ' is-active' : '') +
            '" data-code="' + c.replace(/"/g, '') + '" title="点击搜索 · Alt+点击复制">' + c + '</button>';
        pageBox.innerHTML = state.codes.length
            ? state.codes.map(item).join('')
            : '<div class="jcs-empty" style="padding:8px;color:#666">暂无</div>';
        const hist = uniqCodes(loadHist());
        histBox.innerHTML = hist.length
            ? hist.map(item).join('')
            : '<div class="jcs-empty" style="padding:8px;color:#666">暂无</div>';
        [pageBox, histBox].forEach((box) => {
            box.querySelectorAll('.jcs-item').forEach((btn) => {
                btn.onclick = (e) => {
                    const code = btn.getAttribute('data-code') || '';
                    if (!code) return;
                    if (e.altKey || e.metaKey) copyCode(code);
                    else runPopupSearch(code);
                };
            });
        });
    }

    function loadExtModeHosts() {
        try {
            const arr = storeGetJson(EXT_MODE_KEY, []);
            return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
        } catch (e) {
            return [];
        }
    }

    function currentHostKey() {
        return String(location.hostname || '').toLowerCase();
    }

    /** 用户为本站手动开启的旁出选源（即使可嵌入也走小菜单） */
    function isUserPreferExternal() {
        const host = currentHostKey();
        if (!host) return false;
        return loadExtModeHosts().indexOf(host) >= 0;
    }

    function setUserPreferExternal(on) {
        const host = currentHostKey();
        if (!host) return;
        let list = loadExtModeHosts();
        const has = list.indexOf(host) >= 0;
        if (on && !has) {
            list.push(host);
            if (list.length > 80) list = list.slice(list.length - 80);
        } else if (!on && has) {
            list = list.filter((h) => h !== host);
        } else {
            return;
        }
        if (list.length) storeSetJson(EXT_MODE_KEY, list);
        else storeRemove(EXT_MODE_KEY);
        try {
            const map = loadSitesMap();
            const row = map[host] || { host: host };
            row.host = host;
            row.preferExternal = !!on;
            row.updatedAt = new Date().toISOString();
            map[host] = row;
            saveSitesMap(map);
        } catch (e) { /* ignore */ }
    }

    /** 禁嵌探测 / 用户旁出模式 / 页面 CSP */
    function preferExternalSearch() {
        return isUserPreferExternal() || isHostFrameBlocked() || pageMetaBlocksFrames();
    }

    function applyExtModeUi() {
        const on = isUserPreferExternal();
        const auto = !on && (isHostFrameBlocked() || pageMetaBlocksFrames());
        const active = on || auto;
        let title;
        if (on) {
            title = '当前：新标签打开。点击改为本页预览';
        } else if (auto) {
            title = '本站限制页内预览，已用新标签。点击可再试本页预览';
        } else {
            title = '当前：本页预览。点击改为新标签打开';
        }
        document.querySelectorAll('#' + NS + '-ext-mode-btn, #' + NS + '-pext-mode').forEach((btn) => {
            btn.classList.toggle('is-on', active);
            btn.title = title;
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            btn.setAttribute('aria-label', title);
            if (btn.id === NS + '-ext-mode-btn') btn.textContent = active ? '外' : '内';
            if (btn.id === NS + '-pext-mode') btn.textContent = active ? '新标签' : '本页';
        });
        const cfg = document.getElementById(NS + '-cfg-ext');
        if (cfg) cfg.checked = on;
    }

    function syncChipTitles() {
        try {
            const list = getPanelListEl();
            if (!list) return;
            list.querySelectorAll('.jcs-chip').forEach((btn) => {
                btn.title = chipTitleText();
            });
        } catch (e) { /* ignore */ }
    }

    function setPreferExternalSearch(on, opts) {
        const o = opts || {};
        const next = !!on;
        setUserPreferExternal(next);
        if (!next) clearHostFrameBlocked();
        applyExtModeUi();
        renderPanelMeta();
        syncChipTitles();
        if (!o.silent) {
            if (next) {
                showToast('已改为：新标签打开搜索');
            } else if (pageMetaBlocksFrames()) {
                showToast('已改回本页预览，但本站可能仍不允许嵌套显示');
            } else {
                showToast('已改为：本页预览搜索');
            }
        }
        if (isSearchPopupOpen() && state.active) {
            loadFrame(state.active, next ? {} : { forceEmbed: true });
        }
    }

    function togglePreferExternal() {
        // 当前已是旁出（手动或自动禁嵌）→ 尝试关闭；否则开启手动旁出
        if (preferExternalSearch()) setPreferExternalSearch(false);
        else setPreferExternalSearch(true);
    }

    function normalizeSearchCode(code) {
        const raw = String(code || '').trim();
        return extractJavCode(raw) || raw.toUpperCase();
    }

    function rememberCode(code, opts) {
        const o = opts || {};
        const normalized = normalizeSearchCode(code);
        if (!normalized) return '';
        state.active = normalized;
        state.viewed[normalized] = 1;
        saveHist(normalized);
        if (state.codes.indexOf(normalized) < 0) {
            state.codes = uniqCodes([normalized].concat(state.codes));
        }
        // 打开旁出菜单时禁止重绘 chip，否则锚点 DOM 被销毁导致定位归零
        if (!o.silent) renderPanelList({ skipList: pickerAnchoredInPanelList() });
        return normalized;
    }

    function openExternalProvider(code, providerId) {
        const c = rememberCode(code, { silent: true });
        if (!c) return;
        const id = providerId || loadProviderId();
        state.provider = id;
        saveProviderId(id);
        const url = buildProviderUrl(c, id);
        window.open(url, '_blank', 'noopener,noreferrer');
        showToast((getProvider(id).name || id) + ' · ' + c);
        // 延迟刷新列表，避免打断点击反馈
        setTimeout(() => {
            try { renderPanelList(); } catch (e) { /* ignore */ }
        }, 120);
    }

    function clearPickAnchorHighlight() {
        try {
            document.querySelectorAll('.is-pick-on').forEach((el) => el.classList.remove('is-pick-on'));
        } catch (e) { /* ignore */ }
    }

    function isPickerOpen() {
        const pick = document.getElementById(NS + '-pick');
        return !!(pick && pick.classList.contains('show'));
    }

    function closeProviderPicker() {
        const pick = document.getElementById(NS + '-pick');
        if (!pick) return;
        const wasOpen = pick.classList.contains('show');
        clearTimeout(state.pickCloseTimer);
        clearPickAnchorHighlight();
        pick.classList.remove('show');
        state.pickAnchor = null;
        state.pickRect = null;
        // 等离场动画结束再清 place，避免闪一下
        clearTimeout(state.pickCloseTimer);
        state.pickCloseTimer = setTimeout(() => {
            if (!isPickerOpen()) pick.removeAttribute('data-place');
        }, 180);
        // 延后补刷列表：避免 pointerdown 关菜单时同步 innerHTML 拆掉 chip，导致 click 丢失
        if (wasOpen) {
            setTimeout(() => {
                if (isPickerOpen()) return;
                try { renderPanelList(); } catch (e) { /* ignore */ }
            }, 0);
        }
    }

    function captureAnchorRect(anchor) {
        if (!anchor || !anchor.getBoundingClientRect) return null;
        try {
            if (anchor.isConnected === false) return state.pickRect;
            const r = anchor.getBoundingClientRect();
            if (!r || (r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0)) {
                return state.pickRect;
            }
            return {
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height
            };
        } catch (e) {
            return state.pickRect;
        }
    }

    function positionPickerNear(anchor) {
        const pick = document.getElementById(NS + '-pick');
        const card = pick && pick.querySelector('.jcs-pick-card');
        const arrow = pick && pick.querySelector('.jcs-pick-arrow');
        if (!pick || !card) return;

        const host = ensureHost();
        const hr = host.getBoundingClientRect();
        const pad = 8;
        const gap = 8;
        // 先取消 transform 影响测量（show 前 opacity 0 仍可测）
        const cw = Math.max(card.offsetWidth || 0, 160);
        const ch = Math.max(card.offsetHeight || 0, 68);

        let ar = captureAnchorRect(anchor);
        if (ar) state.pickRect = ar;
        else ar = state.pickRect;

        let place = 'below';
        let left;
        let top;

        if (ar) {
            const aLeft = ar.left - hr.left;
            const aTop = ar.top - hr.top;
            const aRight = ar.right - hr.left;
            const aBottom = ar.bottom - hr.top;
            const aMidY = aTop + ar.height / 2;
            const spaceRight = hr.width - aRight - pad;
            const spaceLeft = aLeft - pad;
            const spaceBelow = hr.height - aBottom - pad;
            const spaceAbove = aTop - pad;

            // 优先右侧「边上」；否则下/上
            if (spaceRight >= cw + gap && ar.height <= 64) {
                place = 'right';
                left = aRight + gap;
                top = aMidY - ch / 2;
            } else if (spaceLeft >= cw + gap && ar.height <= 64) {
                place = 'left';
                left = aLeft - cw - gap;
                top = aMidY - ch / 2;
            } else if (spaceBelow >= ch + gap || spaceBelow >= spaceAbove) {
                place = 'below';
                left = aLeft;
                top = aBottom + gap;
                if (left + cw > hr.width - pad) left = Math.max(pad, aRight - cw);
            } else {
                place = 'above';
                left = aLeft;
                top = aTop - ch - gap;
                if (left + cw > hr.width - pad) left = Math.max(pad, aRight - cw);
            }
        } else {
            place = 'below';
            left = Math.max(pad, (hr.width - cw) / 2);
            top = Math.max(pad, Math.min(hr.height - ch - pad, hr.height * 0.32));
        }

        left = Math.max(pad, Math.min(hr.width - cw - pad, left));
        top = Math.max(pad, Math.min(hr.height - ch - pad, top));
        pick.setAttribute('data-place', place);
        card.style.left = Math.round(left) + 'px';
        card.style.top = Math.round(top) + 'px';
        card.style.right = 'auto';
        card.style.bottom = 'auto';

        // 箭头对准番号中心
        if (arrow && ar) {
            const aMidX = (ar.left + ar.right) / 2 - hr.left;
            const aMidY = (ar.top + ar.bottom) / 2 - hr.top;
            arrow.style.left = '';
            arrow.style.right = '';
            arrow.style.top = '';
            arrow.style.bottom = '';
            arrow.style.marginTop = '';
            if (place === 'below' || place === 'above') {
                const ax = Math.max(12, Math.min(cw - 12, aMidX - left));
                arrow.style.left = Math.round(ax - 5) + 'px';
            } else {
                const ay = Math.max(12, Math.min(ch - 12, aMidY - top));
                arrow.style.top = Math.round(ay - 5) + 'px';
                arrow.style.marginTop = '0';
            }
        }
    }

    function schedulePickerReposition() {
        if (state.pickPosRaf) cancelAnimationFrame(state.pickPosRaf);
        state.pickPosRaf = requestAnimationFrame(() => {
            state.pickPosRaf = 0;
            if (!isPickerOpen()) return;
            if (state.pickAnchor && state.pickAnchor.isConnected !== false) {
                state.pickRect = captureAnchorRect(state.pickAnchor) || state.pickRect;
            }
            positionPickerNear(state.pickAnchor);
        });
    }

    function ensurePicker() {
        injectStyles();
        let pick = document.getElementById(NS + '-pick');
        if (pick) {
            pick.style.pointerEvents = 'none';
            return pick;
        }
        pick = document.createElement('div');
        pick.id = NS + '-pick';
        pick.setAttribute('aria-hidden', 'true');
        pick.innerHTML =
            '<div class="jcs-pick-card" role="dialog" aria-label="搜索源">' +
            '<i class="jcs-pick-arrow" aria-hidden="true"></i>' +
            '<div class="jcs-pick-head">' +
            '<strong id="' + NS + '-pick-code"></strong>' +
            '<button type="button" class="jcs-pick-x" id="' + NS + '-pick-close" title="关闭" aria-label="关闭">×</button>' +
            '</div>' +
            '<div class="jcs-pick-btns" id="' + NS + '-pick-list"></div>' +
            '</div>';
        mountUI(pick);
        // 全屏层只负责定位；事件穿透页面，仅 card 可点（覆盖 mountUI 的 auto）
        pick.style.pointerEvents = 'none';
        pick.querySelector('#' + NS + '-pick-close').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeProviderPicker();
        };
        if (!ensurePicker._docBound) {
            ensurePicker._docBound = true;
            const onOutside = (e) => {
                const el = document.getElementById(NS + '-pick');
                if (!el || !el.classList.contains('show')) return;
                const t = e.target;
                if (!t) return;
                if (el.contains(t)) return;
                if (state.pickAnchor && (t === state.pickAnchor || (state.pickAnchor.contains && state.pickAnchor.contains(t)))) {
                    return; // 交给 click 做 toggle
                }
                // 面板 chip / 工具按钮 / 页内番号链：交给各自 click 切换选源，
                // 避免此处 pointerdown 先关菜单并拆 jcs-list DOM，吞掉后续 click
                if (t.closest) {
                    if (t.closest('#' + NS + '-list .jcs-chip, #' + NS + '-panel .jcs-tools, #' + NS + '-panel .jcs-chip')) {
                        return;
                    }
                    if (t.closest('a.' + NS + '-link, .' + NS + '-link')) return;
                }
                // 不 preventDefault / stopPropagation：关闭同时放行页面点击
                closeProviderPicker();
            };
            document.addEventListener('pointerdown', onOutside, true);
            // Esc 统一由 bindGlobalHotkeys 处理
            window.addEventListener('scroll', schedulePickerReposition, true);
            window.addEventListener('resize', schedulePickerReposition, { passive: true });
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', schedulePickerReposition, { passive: true });
                window.visualViewport.addEventListener('scroll', schedulePickerReposition, { passive: true });
            }
        }
        return pick;
    }

    function openProviderPicker(code, anchor) {
        // 同一锚点再点 → 关闭（toggle）
        if (
            isPickerOpen() &&
            anchor &&
            state.pickAnchor &&
            (anchor === state.pickAnchor ||
                (state.pickAnchor.contains && state.pickAnchor.contains(anchor)) ||
                (anchor.contains && anchor.contains(state.pickAnchor)))
        ) {
            closeProviderPicker();
            return;
        }

        // 先抓锚点矩形，再 silent 记番号（避免 chip 重绘丢锚点）
        const liveAnchor = anchor && anchor.nodeType === 1 ? anchor : null;
        state.pickRect = captureAnchorRect(liveAnchor);
        state.pickAnchor = liveAnchor;

        const c = rememberCode(code, { silent: true });
        if (!c) {
            showToast('请输入番号');
            closeProviderPicker();
            return;
        }

        ensurePanel();
        const pick = ensurePicker();
        applyTheme(state.theme || loadTheme());
        clearPickAnchorHighlight();
        if (liveAnchor && liveAnchor.classList) liveAnchor.classList.add('is-pick-on');

        const codeEl = pick.querySelector('#' + NS + '-pick-code');
        if (codeEl) {
            codeEl.textContent = c;
            codeEl.title = c;
        }
        const list = pick.querySelector('#' + NS + '-pick-list');
        const providers = getProviders();
        list.innerHTML = providers.map((p) =>
            '<button type="button" class="jcs-pick-btn" data-id="' + String(p.id).replace(/"/g, '') +
            '" title="' + String(p.hint || '新窗口打开').replace(/"/g, '') + '">' +
            String(p.name || p.id).replace(/</g, '') + '</button>'
        ).join('') +
            '<button type="button" class="jcs-pick-btn is-sub" data-act="sub" title="搜索字幕">字幕</button>' +
            '<button type="button" class="jcs-pick-btn is-copy" data-act="copy" title="复制番号">复制</button>';

        list.querySelectorAll('.jcs-pick-btn').forEach((btn) => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const act = btn.getAttribute('data-act') || '';
                if (act === 'copy') {
                    copyCode(c);
                    btn.classList.add('is-copied');
                    const old = btn.textContent;
                    btn.textContent = '已复制';
                    setTimeout(() => {
                        btn.textContent = old;
                        btn.classList.remove('is-copied');
                    }, 900);
                    return;
                }
                if (act === 'sub') {
                    closeProviderPicker();
                    openSubtitleSearch(c);
                    return;
                }
                btn.style.transform = 'scale(.94)';
                openExternalProvider(c, btn.getAttribute('data-id') || '');
                closeProviderPicker();
            };
        });

        // 重启动画：卸 show → 强制 reflow → 预定位 → 再 show
        pick.classList.remove('show');
        pick.setAttribute('aria-hidden', 'false');
        void pick.offsetWidth;
        positionPickerNear(liveAnchor);
        requestAnimationFrame(() => {
            if (state.pickAnchor !== liveAnchor && liveAnchor) {
                // 被快速连点打断则放弃
            }
            positionPickerNear(state.pickAnchor);
            pick.classList.add('show');
            requestAnimationFrame(() => schedulePickerReposition());
        });
    }

    function loadFrameBlockHosts() {
        try {
            const arr = storeGetJson(FRAME_BLOCK_KEY, []);
            return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
        } catch (e) {
            return [];
        }
    }

    function isHostFrameBlocked() {
        const host = (location.hostname || '').toLowerCase();
        if (!host) return false;
        return loadFrameBlockHosts().indexOf(host) >= 0;
    }

    function markHostFrameBlocked() {
        const host = (location.hostname || '').toLowerCase();
        if (!host) return;
        const list = loadFrameBlockHosts();
        if (list.indexOf(host) >= 0) return;
        list.push(host);
        if (list.length > 80) list.splice(0, list.length - 80);
        storeSetJson(FRAME_BLOCK_KEY, list);
        try {
            const map = loadSitesMap();
            const row = map[host] || { host: host };
            row.host = host;
            row.frameBlock = true;
            row.updatedAt = new Date().toISOString();
            map[host] = row;
            saveSitesMap(map);
        } catch (e) { /* ignore */ }
    }

    function clearHostFrameBlocked() {
        const host = (location.hostname || '').toLowerCase();
        if (!host) return;
        const list = loadFrameBlockHosts().filter((h) => h !== host);
        if (list.length) storeSetJson(FRAME_BLOCK_KEY, list);
        else storeRemove(FRAME_BLOCK_KEY);
        try {
            const map = loadSitesMap();
            if (map[host]) {
                map[host].frameBlock = false;
                map[host].updatedAt = new Date().toISOString();
                saveSitesMap(map);
            }
        } catch (e) { /* ignore */ }
    }

    /** 页面 meta CSP 是否明显禁止第三方 frame（响应头 CSP 仍靠 securitypolicyviolation） */
    function pageMetaBlocksFrames() {
        try {
            const metas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]');
            for (let i = 0; i < metas.length; i++) {
                const csp = String(metas[i].getAttribute('content') || '').toLowerCase();
                if (!csp) continue;
                const m = csp.match(/(?:^|;)\s*(?:frame-src|child-src|default-src)\s+([^;]+)/g);
                if (!m) continue;
                for (let j = 0; j < m.length; j++) {
                    const part = m[j];
                    if (/frame-src|child-src/.test(part) || /default-src/.test(part)) {
                        // 仅 self/none 且无 https: / * 时，外链 iframe 基本必挂
                        if (/\*|https:|http:|data:|blob:/.test(part)) continue;
                        if (/'none'/.test(part) || /'self'/.test(part)) return true;
                    }
                }
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function showFrameFallback(url, reason) {
        const box = document.getElementById(NS + '-frame-fallback');
        const frame = document.getElementById(NS + '-frame');
        const fetchBox = document.getElementById(NS + '-fetch');
        const title = document.getElementById(NS + '-fb-title');
        const desc = document.getElementById(NS + '-fb-desc');
        const urlEl = document.getElementById(NS + '-fb-url');
        const provBox = document.getElementById(NS + '-fb-providers');
        const tip = document.getElementById(NS + '-ptip');
        if (urlEl) urlEl.textContent = url || '';
        if (title) title.textContent = '无法在本页预览';
        if (desc) {
            desc.textContent = reason
                || '当前网站不允许在页面里嵌套显示搜索结果。请点下方网站，用新标签打开。';
        }
        if (provBox) {
            const code = state.active || '';
            provBox.innerHTML = getProviders().map((p) =>
                '<button type="button" class="jcs-btn solid" data-id="' + String(p.id).replace(/"/g, '') + '">' +
                String(p.name || p.id).replace(/</g, '') + '</button>'
            ).join('');
            provBox.querySelectorAll('button[data-id]').forEach((btn) => {
                btn.onclick = () => {
                    if (!code) return;
                    openExternalProvider(code, btn.getAttribute('data-id') || '');
                };
            });
        }
        if (box) box.classList.add('show');
        if (frame) {
            try { frame.style.visibility = 'hidden'; } catch (e) { /* ignore */ }
        }
        if (fetchBox) fetchBox.hidden = true;
        if (tip) tip.textContent = (url || '') + ' · 点网站名称用新标签打开';
    }

    function hideFrameFallback() {
        const box = document.getElementById(NS + '-frame-fallback');
        const frame = document.getElementById(NS + '-frame');
        const fetchBox = document.getElementById(NS + '-fetch');
        const p = getProvider(state.provider);
        const isFetch = !!(p && p.mode === 'fetch');
        if (box) box.classList.remove('show');
        if (frame) {
            try { frame.style.visibility = isFetch ? 'hidden' : ''; } catch (e) { /* ignore */ }
        }
        if (fetchBox) fetchBox.hidden = !isFetch;
    }

    function bindFrameGuard(root) {
        if (!root || bindFrameGuard._bound) return;
        bindFrameGuard._bound = true;
        const frame = root.querySelector('#' + NS + '-frame');
        if (frame) {
            frame.addEventListener('error', () => {
                if (!state.frameUrl) return;
                markHostFrameBlocked();
                showFrameFallback(state.frameUrl, '本页预览加载失败。可能是本站或搜索站不允许嵌套显示，请用新标签打开。');
            });
            frame.addEventListener('load', () => {
                if (!state.frameUrl || !frame.src || frame.src === 'about:blank') return;
                // 同源可读时若是浏览器错误页，切回退；跨域成功则保持嵌入
                try {
                    const doc = frame.contentDocument;
                    if (!doc) return;
                    const t = String((doc.title || '') + ' ' + (doc.body && doc.body.innerText || '')).slice(0, 500);
                    if (/该内容被屏蔽|拒绝连接|refused to connect|blocked by|ERR_BLOCKED|X-Frame-Options|frame-ancestors/i.test(t)) {
                        markHostFrameBlocked();
                        showFrameFallback(state.frameUrl, '搜索站拒绝在页面里显示，请用新标签打开。');
                    }
                } catch (e) {
                    // 跨域：能 load 且无 CSP 报错，视为嵌入成功
                    hideFrameFallback();
                }
            });
        }
        document.addEventListener('securitypolicyviolation', (e) => {
            if (!state.frameUrl) return;
            const dir = String((e && (e.effectiveDirective || e.violatedDirective)) || '').toLowerCase();
            if (!/frame-src|child-src|default-src|frame-ancestors/.test(dir)) return;
            const blocked = String((e && (e.blockedURI || e.documentURI)) || '');
            if (blocked && state.frameUrl && blocked.indexOf(state.frameUrl.slice(0, 48)) < 0
                && state.frameUrl.indexOf(blocked.slice(0, 32)) < 0
                && blocked !== 'inline' && !/\.html?$/i.test(blocked)) {
                // 仍可能是 frame-src 拦截本次 src
            }
            markHostFrameBlocked();
            showFrameFallback(state.frameUrl, '本站安全策略不允许嵌套显示该搜索页，已改为请用新标签打开。');
        });
    }

    // ─── fetch 型搜索源（GM 请求 + 自渲染，用于 X-Frame-Options 拒绝 iframe 的站）───

    /** 预览代次：每次 loadFrame 递增，使在途 fetch 结果失效（切源/重搜时丢弃过期回调） */
    let fetchGen = 0;

    function fetchSearchHtml(url) {
        return gmRequest({
            url: url,
            method: 'GET',
            timeout: 20000,
            acceptStatuses: [200],
            headers: {
                'Referer': 'https://javdb.com/',
                'Accept': 'text/html,application/xhtml+xml',
                'User-Agent': navigator.userAgent
            }
        }).then((res) => (res && res.responseText) || '');
    }

    function renderFetchResults(html, code, provider) {
        const fetchBox = document.getElementById(NS + '-fetch');
        const items = [];
        try {
            const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
            doc.querySelectorAll('.movie-list .item, .movie-item').forEach((el) => {
                const a = el.querySelector('a[href^="/v/"]') || el.querySelector('a[href]');
                if (!a) return;
                const titleEl = el.querySelector('.video-title') || el.querySelector('.uid') || a;
                const title = String((titleEl && titleEl.textContent) || (el.getAttribute('title')) || a.textContent || '').trim();
                const img = el.querySelector('img');
                const uidEl = el.querySelector('.uid');
                const href = String(a.getAttribute('href') || '').trim();
                if (!href) return;
                const abs = /^https?:/i.test(href) ? href : (String(provider.url || '').match(/^https?:\/\/[^/]+/i) || ['https://javdb.com'])[0] + (href.charAt(0) === '/' ? '' : '/') + href;
                if (!/^https?:/i.test(abs)) return; // 只渲染 http(s) 链接，防 javascript: 等伪协议
                items.push({
                    title: title || code || '',
                    uid: String((uidEl && uidEl.textContent) || '').trim(),
                    href: abs,
                    img: img
                        ? String(img.getAttribute('data-src') || img.getAttribute('src') || '').trim()
                        : ''
                });
            });
        } catch (e) { /* ignore */ }
        if (!items.length) {
            if (fetchBox) fetchBox.hidden = true;
            showFrameFallback(state.frameUrl || buildProviderUrl(code, provider.id), '搜索没有返回结果，请点下方网站，用新标签打开。');
            return;
        }
        if (fetchBox) {
            fetchBox.hidden = false;
            fetchBox.innerHTML = '<div class="jcs-fetch-grid">' + items.map((it) =>
                '<a class="jcs-fetch-card" href="' + escapeHtml(it.href) + '" target="_blank" rel="noopener noreferrer">' +
                (it.img ? '<span class="jcs-fetch-thumb"><img loading="lazy" alt="" src="' + escapeHtml(it.img) + '" /></span>' : '') +
                '<strong>' + escapeHtml(it.title) + '</strong>' +
                (it.uid ? '<code>' + escapeHtml(it.uid) + '</code>' : '') +
                '</a>'
            ).join('') + '</div>';
        }
    }

    function loadFetchPreview(code, provider) {
        const frame = document.getElementById(NS + '-frame');
        const fetchBox = document.getElementById(NS + '-fetch');
        const tip = document.getElementById(NS + '-ptip');
        const title = document.getElementById(NS + '-ptitle');
        const gen = fetchGen;
        const url = buildProviderUrl(code, provider.id);
        state.frameUrl = url;
        if (title) title.textContent = code + ' · ' + provider.name;
        if (tip) tip.textContent = url;
        clearTimeout(state.frameWatch);
        hideFrameFallback();
        if (frame) {
            try { frame.src = 'about:blank'; } catch (e) { /* ignore */ }
            try { frame.style.visibility = 'hidden'; } catch (e) { /* ignore */ }
        }
        if (fetchBox) {
            fetchBox.hidden = false;
            fetchBox.innerHTML = '<div class="jcs-fetch-loading">正在请求 ' + escapeHtml(provider.name) + '，请稍候…</div>';
        }
        fetchSearchHtml(url).then((html) => {
            if (gen !== fetchGen) return; // 已切源/重搜，丢弃过期结果
            renderFetchResults(html, code, provider);
        }).catch(() => {
            if (gen !== fetchGen) return; // 已切源/重搜，过期失败不再降级覆盖新预览
            if (fetchBox) fetchBox.hidden = true;
            markHostFrameBlocked();
            showFrameFallback(url, 'javdb 需要登录会话或反爬校验，请用新标签打开。');
        });
    }

    function loadFrame(code, opts) {
        fetchGen++; // 任何重新加载预览（切源/重搜/重试）都使在途 fetch 过期
        const o = opts || {};
        const frame = document.getElementById(NS + '-frame');
        const tip = document.getElementById(NS + '-ptip');
        const title = document.getElementById(NS + '-ptitle');
        const p = getProvider(state.provider);
        // fetch 型源：GM 抓 HTML 自渲染，不走 iframe（X-Frame-Options 无法加请求头规避）
        if (p && p.mode === 'fetch') {
            loadFetchPreview(code, p);
            return;
        }
        const url = buildProviderUrl(code, p.id);
        state.frameUrl = url;
        if (title) title.textContent = code + ' · ' + p.name;
        if (tip) tip.textContent = url;

        const userExt = isUserPreferExternal();
        const autoBlock = isHostFrameBlocked() || pageMetaBlocksFrames();
        const skipEmbed = !o.forceEmbed && (userExt || autoBlock);
        if (skipEmbed) {
            if (frame) {
                try { frame.src = 'about:blank'; } catch (e) { /* ignore */ }
            }
            if (autoBlock) markHostFrameBlocked();
            showFrameFallback(
                url,
                userExt && !autoBlock
                    ? '你选择了「新标签打开」。点下方网站即可；若想在本页预览，先点「本页预览/内」，再点「再试本页预览」。'
                    : '本站不允许在页面里嵌套显示搜索结果。请点下方网站，用新标签打开。'
            );
            return;
        }

        hideFrameFallback();
        if (frame) {
            // 先 blank 再赋 src，确保重复搜索同一 URL 也会触发 load
            try {
                if (frame.getAttribute('src') === url) frame.src = 'about:blank';
            } catch (e) { /* ignore */ }
            frame.src = url;
        }
        // 部分浏览器 CSP 拦截不派发 error，短延时后若已记入黑名单则展示回退
        clearTimeout(state.frameWatch);
        state.frameWatch = setTimeout(() => {
            if (isHostFrameBlocked() && state.frameUrl === url) {
                showFrameFallback(url, '本站安全策略不允许嵌套显示，已改为请用新标签打开。');
            }
        }, 900);
    }

    function stepCode(delta) {
        const idx = state.codes.indexOf(state.active);
        if (idx < 0) return;
        const n = idx + delta;
        if (n < 0 || n >= state.codes.length) return;
        openSearch(state.codes[n]);
    }

    function collectConfigBundle() {
        loadHlOpts();
        loadSubOpts();
        try { mergeLegacyLocalIntoGlobalStore(); } catch (e) { /* ignore */ }
        const sites = buildAllSitesSnapshot();
        const siteCount = countSitesInSnapshot(sites);
        const global = {
            providers: getProviders().map((p) => ({
                id: p.id,
                name: p.name,
                url: p.url,
                hint: p.hint || '',
                mode: p.mode === 'fetch' ? 'fetch' : 'iframe'
            })),
            providerActive: loadProviderId(),
            theme: state.theme || loadTheme(),
            // 选择器按站存在 sites[].hlSelectors；全局 hl 不含选择器
            hl: hlOptsForGlobalStore(state.hl),
            sub: { useOriginalName: !!state.subUseOriginalName },
            panelLayout: storeGetJson(PANEL_KEY, null),
            fabPos: storeGetJson(FAB_POS_KEY, null)
        };
        return {
            app: 'jav-code-scanner',
            scope: 'all-sites',
            storage: HAS_GM_STORE ? 'gm-script' : 'localStorage-fallback',
            bundleVersion: CONFIG_BUNDLE_VER,
            scriptVersion: SCRIPT_VER,
            exportedAt: new Date().toISOString(),
            siteCount: siteCount,
            // 新结构：全局 + 全部站点
            global: global,
            sites: sites,
            // 兼容旧导入：扁平 data
            data: Object.assign({}, global, {
                frameAllowHosts: normalizeHostList(storeGetJson(FRAME_ALLOW_KEY, [])),
                frameBlockHosts: normalizeHostList(storeGetJson(FRAME_BLOCK_KEY, [])),
                preferExtHosts: normalizeHostList(storeGetJson(EXT_MODE_KEY, [])),
                sites: sites
            })
        };
    }

    function exportConfigJson() {
        return JSON.stringify(collectConfigBundle(), null, 2);
    }

    function downloadConfigFile() {
        const bundle = collectConfigBundle();
        const json = JSON.stringify(bundle, null, 2);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const n = bundle.siteCount || 0;
        const name = 'jcs-all-sites-' + n + 'hosts-' + stamp + '.json';
        try {
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.rel = 'noopener';
            a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            (document.body || document.documentElement).appendChild(a);
            a.click();
            setTimeout(() => {
                try { if (a.parentNode) a.parentNode.removeChild(a); } catch (e) { /* ignore */ }
                URL.revokeObjectURL(url);
            }, 400);
            showToast('已导出全部站点配置（' + n + ' 个站）');
        } catch (e) {
            copyText(json).then((ok) => showToast(ok ? '导出失败，已复制到剪贴板' : '导出失败'));
        }
    }

    function copyConfigToClipboard() {
        const bundle = collectConfigBundle();
        const json = JSON.stringify(bundle, null, 2);
        const n = bundle.siteCount || 0;
        copyText(json).then((ok) => showToast(ok ? '已复制全部站点配置（' + n + ' 个站）' : '复制失败'));
    }

    /**
     * 导入配置
     * @param {string|object} raw JSON 字符串或对象
     * @param {{ mergeProviders?: boolean, silent?: boolean }} opts
     */
    function importConfigBundle(raw, opts) {
        const o = opts || {};
        const mergeProviders = o.mergeProviders !== false;
        let bundle = raw;
        if (typeof raw === 'string') {
            const t = raw.trim();
            if (!t) throw new Error('内容为空');
            try {
                bundle = JSON.parse(t);
            } catch (e) {
                throw new Error('JSON 无法解析');
            }
        }
        if (!bundle || typeof bundle !== 'object') throw new Error('配置格式无效');
        // 新格式 global + sites；兼容 data / 扁平旧包
        const data = (bundle.global && typeof bundle.global === 'object')
            ? Object.assign({}, bundle.global, {
                frameAllowHosts: (bundle.data && bundle.data.frameAllowHosts) || bundle.frameAllowHosts,
                frameBlockHosts: (bundle.data && bundle.data.frameBlockHosts) || bundle.frameBlockHosts,
                preferExtHosts: (bundle.data && bundle.data.preferExtHosts) || bundle.preferExtHosts,
                sites: bundle.sites || (bundle.data && bundle.data.sites) || null
            })
            : (bundle.data && typeof bundle.data === 'object')
                ? bundle.data
                : (bundle.providers || bundle.hl || bundle.theme != null || bundle.sites ? bundle : null);
        if (!data || typeof data !== 'object') throw new Error('缺少配置数据');

        // 搜索源
        if (Array.isArray(data.providers)) {
            const incoming = data.providers.map((p, i) => normalizeProvider(p, i)).filter(Boolean);
            if (incoming.length) {
                if (mergeProviders) {
                    const cur = getProviders().slice();
                    const byId = Object.create(null);
                    cur.forEach((p, i) => { byId[p.id] = i; });
                    incoming.forEach((p) => {
                        if (byId[p.id] != null) cur[byId[p.id]] = p;
                        else cur.push(p);
                    });
                    saveProviders(cur);
                } else {
                    saveProviders(incoming);
                }
                const active = String(data.providerActive || '').trim();
                const list = getProviders();
                if (active && list.some((p) => p.id === active)) {
                    state.provider = active;
                    saveProviderId(active);
                } else if (list[0]) {
                    state.provider = list[0].id;
                    saveProviderId(list[0].id);
                }
            }
        }

        // 主题
        if (data.theme === 'light' || data.theme === 'dark') {
            setTheme(data.theme);
        }

        // 字幕选项
        if (data.sub && typeof data.sub === 'object' && typeof data.sub.useOriginalName === 'boolean') {
            state.subUseOriginalName = !!data.sub.useOriginalName;
            saveSubOpts();
        }

        // 历史不备份、不导入（仅本机保留）

        // 域名列表类（全部站点）
        try {
            const fa = mergeHostLists(storeGetJson(FRAME_ALLOW_KEY, []), data.frameAllowHosts, !mergeProviders);
            if (fa.length) storeSetJson(FRAME_ALLOW_KEY, fa);
            else if (!mergeProviders) storeRemove(FRAME_ALLOW_KEY);
        } catch (e) { /* ignore */ }
        try {
            const fb = mergeHostLists(storeGetJson(FRAME_BLOCK_KEY, []), data.frameBlockHosts, !mergeProviders);
            if (fb.length) storeSetJson(FRAME_BLOCK_KEY, fb);
            else if (!mergeProviders) storeRemove(FRAME_BLOCK_KEY);
        } catch (e) { /* ignore */ }
        try {
            const pe = mergeHostLists(storeGetJson(EXT_MODE_KEY, []), data.preferExtHosts, !mergeProviders);
            if (pe.length) storeSetJson(EXT_MODE_KEY, pe);
            else if (!mergeProviders) storeRemove(EXT_MODE_KEY);
        } catch (e) { /* ignore */ }

        // 站点总表（含各站 hlSelectors）须先于高亮合成
        const sitesIn = data.sites || bundle.sites || null;
        let siteN = 0;
        if (sitesIn && typeof sitesIn === 'object') {
            try {
                applySitesSnapshot(sitesIn, !mergeProviders);
                siteN = countSitesInSnapshot(sitesIn);
            } catch (e) { /* ignore */ }
        } else {
            try { buildAllSitesSnapshot(); } catch (e) { /* ignore */ }
        }

        // 高亮：全局开关 + 按站选择器（sites[].hlSelectors）
        if (data.hl && typeof data.hl === 'object') {
            const incoming = normalizeHlOpts(data.hl);
            const legacySel = String(incoming.nativeSelectors || '');
            storeSetJson(HL_OPT_KEY, hlOptsForGlobalStore(incoming));
            // 旧备份全局带选择器：仅落到当前站，且不覆盖站点表里已有的
            if (legacySel && getSiteHlSelectors(currentHostname()) == null) {
                setSiteHlSelectors(legacySel);
            }
        }
        loadHlOpts();

        // 布局（仅在有值时写入）
        if (data.panelLayout && typeof data.panelLayout === 'object') {
            storeSetJson(PANEL_KEY, data.panelLayout);
        }
        if (data.fabPos && typeof data.fabPos === 'object') {
            storeSetJson(FAB_POS_KEY, data.fabPos);
        }

        // 刷新内存与 UI
        providersCache = null;
        state.provider = loadProviderId();
        loadHlOpts();
        loadSubOpts();
        applyTheme(state.theme || loadTheme());
        applyExtModeUi();
        try { renderProviders(); } catch (e) { /* ignore */ }
        try { renderConfigList(); } catch (e) { /* ignore */ }
        try { syncHlOptsUi(); } catch (e) { /* ignore */ }
        try { syncConfigGeneralUi(); } catch (e) { /* ignore */ }
        try {
            const orig = document.getElementById(NS + '-sub-orig');
            if (orig) orig.checked = !!state.subUseOriginalName;
        } catch (e) { /* ignore */ }

        if (!o.silent) {
            const tail = siteN ? '，含 ' + siteN + ' 个站点规则' : '';
            showToast(mergeProviders
                ? '已合并导入全部配置' + tail
                : '已覆盖导入全部配置' + tail);
        }
        return true;
    }

    function getImportMergeMode() {
        const mergeEl = document.getElementById(NS + '-cfg-import-merge');
        return mergeEl ? !!mergeEl.checked : true;
    }

    function peekConfigImportMeta(text) {
        const raw = String(text || '').trim();
        if (!raw) return { empty: true };
        if (isEncryptedConfigPayload(raw)) {
            return { encrypted: true, label: '加密备份' };
        }
        let bundle;
        try {
            bundle = JSON.parse(raw);
        } catch (e) {
            return { invalid: true, label: '无法解析的 JSON' };
        }
        if (!bundle || typeof bundle !== 'object') {
            return { invalid: true, label: '配置格式无效' };
        }
        let siteN = 0;
        try {
            const sites = bundle.sites || (bundle.data && bundle.data.sites) || null;
            if (sites) siteN = countSitesInSnapshot(sites);
            else if (typeof bundle.siteCount === 'number') siteN = bundle.siteCount | 0;
        } catch (e) { siteN = 0; }
        const prov = (bundle.global && bundle.global.providers)
            || (bundle.data && bundle.data.providers)
            || bundle.providers;
        const provN = Array.isArray(prov) ? prov.length : 0;
        const ver = bundle.scriptVersion || bundle.bundleVersion || '';
        const when = bundle.exportedAt ? String(bundle.exportedAt).slice(0, 19).replace('T', ' ') : '';
        const bits = [];
        if (siteN) bits.push(siteN + ' 个站');
        if (provN) bits.push(provN + ' 个搜索源');
        if (ver) bits.push('v' + ver);
        if (when) bits.push(when);
        return {
            ok: true,
            siteN: siteN,
            provN: provN,
            label: bits.length ? bits.join(' · ') : '有效配置包'
        };
    }

    function confirmConfigImport(merge, sourceLabel) {
        const src = sourceLabel || '备份';
        const msg = merge
            ? '从' + src + '合并导入全部配置？\n（保留现有，更新同名项）'
            : '从' + src + '以覆盖模式导入全部配置？\n（搜索源 / 站点规则等将被替换）';
        return typeof window.confirm !== 'function' || window.confirm(msg);
    }

    function setLocalImportBusy(busy) {
        const zone = document.getElementById(NS + '-cfg-dropzone');
        if (zone) zone.classList.toggle('is-busy', !!busy);
        ['cfg-export', 'cfg-export-copy', 'cfg-import-paste', 'cfg-backup-more'].forEach((id) => {
            const el = document.getElementById(NS + '-' + id);
            if (el) el.disabled = !!busy;
        });
        const mergeEl = document.getElementById(NS + '-cfg-import-merge');
        if (mergeEl) mergeEl.disabled = !!busy;
    }

    function setDropzoneMeta(html, show) {
        const meta = document.getElementById(NS + '-cfg-drop-meta');
        if (!meta) return;
        if (!show) {
            meta.innerHTML = '';
            meta.setAttribute('hidden', '');
            return;
        }
        meta.innerHTML = html || '';
        meta.removeAttribute('hidden');
    }

    function importConfigFromText(text, opts) {
        const mergeProviders = opts && opts.mergeProviders != null
            ? !!opts.mergeProviders
            : getImportMergeMode();
        const raw = String(text || '');
        if (isEncryptedConfigPayload(raw)) {
            let pwd = (opts && opts.password) || '';
            if (!pwd) {
                const dav = loadWebdavOpts();
                if (dav.secret) pwd = dav.secret;
            }
            if (!pwd && typeof window.prompt === 'function') {
                pwd = window.prompt('这是加密备份，请输入加密密码：', '') || '';
            }
            if (!pwd) throw new Error('加密备份需要密码');
            return decryptConfigPayload(raw, pwd).then((plain) => {
                importConfigBundle(plain, { mergeProviders: mergeProviders });
            });
        }
        importConfigBundle(raw, { mergeProviders: mergeProviders });
        return Promise.resolve();
    }

    function runLocalConfigImport(text, opts) {
        const o = opts || {};
        const merge = o.mergeProviders != null ? !!o.mergeProviders : getImportMergeMode();
        const sourceLabel = o.sourceLabel || '本地备份';
        const fileName = o.fileName || '';
        const raw = String(text || '');
        if (!raw.trim()) {
            return Promise.reject(new Error('内容为空'));
        }
        const meta = peekConfigImportMeta(raw);
        if (meta.invalid) {
            return Promise.reject(new Error(meta.label || '配置格式无效'));
        }
        if (fileName || meta.encrypted || meta.ok) {
            const bits = [];
            if (fileName) bits.push('<b>' + escapeHtml(fileName) + '</b>');
            if (meta.encrypted) bits.push('加密备份');
            else if (meta.label) bits.push(escapeHtml(meta.label));
            bits.push(merge ? '合并导入' : '覆盖导入');
            setDropzoneMeta(bits.join(' · '), true);
        }
        if (o.confirm !== false && !confirmConfigImport(merge, sourceLabel)) {
            return Promise.reject(new Error('已取消导入'));
        }
        setLocalImportBusy(true);
        setBackupStatus('正在导入…', '');
        return importConfigFromText(raw, { mergeProviders: merge, password: o.password })
            .then(() => {
                const ta = document.getElementById(NS + '-cfg-import-ta');
                if (ta && o.clearPaste !== false) ta.value = '';
                let n = 0;
                try { n = countSitesInSnapshot(buildAllSitesSnapshot()); } catch (e2) { /* ignore */ }
                const head = fileName
                    ? ('已导入：' + fileName)
                    : ('已从' + sourceLabel + '导入');
                const msg = head + '（现 ' + n + ' 个站 · ' + (merge ? '合并' : '覆盖') + '）';
                setBackupStatus(msg, 'ok');
                setDropzoneMeta('<b>导入完成</b> · 现 ' + n + ' 个站 · ' + (merge ? '合并' : '覆盖'), true);
                syncConfigGeneralUi();
                return true;
            })
            .catch((e) => {
                const msg = (e && e.message) ? e.message : '导入失败';
                if (msg !== '已取消导入') {
                    showToast(msg);
                    setBackupStatus(msg, 'err');
                } else {
                    setBackupStatus('已取消导入', '');
                }
                throw e;
            })
            .then(
                (v) => { setLocalImportBusy(false); return v; },
                (e) => { setLocalImportBusy(false); throw e; }
            );
    }

    function importConfigFromFile(file) {
        if (!file) {
            const msg = '未选择文件';
            showToast(msg);
            setBackupStatus(msg, 'err');
            return Promise.reject(new Error(msg));
        }
        const name = file.name || 'config.json';
        const lower = name.toLowerCase();
        const type = String(file.type || '');
        const extOk = /\.(json|txt|jcs)$/i.test(lower);
        const typeOk = !type || type === 'application/json' || type.indexOf('text/') === 0
            || type === 'application/octet-stream';
        if (lower && !extOk && !typeOk) {
            const msg = '请选择 JSON 配置文件';
            showToast(msg);
            setBackupStatus(msg, 'err');
            setDropzoneMeta(escapeHtml(name) + ' · 不是 JSON', true);
            return Promise.reject(new Error(msg));
        }
        setDropzoneMeta('读取 <b>' + escapeHtml(name) + '</b>…', true);
        setBackupStatus('正在读取 ' + name + '…', '');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsText(file, 'utf-8');
        }).then((text) => runLocalConfigImport(text, {
            sourceLabel: '文件「' + name + '」',
            fileName: name
        })).catch((e) => {
            const msg = (e && e.message) ? e.message : '导入失败';
            if (msg === '读取文件失败') {
                showToast(msg);
                setBackupStatus(msg, 'err');
            }
            throw e;
        });
    }

    function bindConfigUi(root) {
        if (!root || root._jcsCfgBound) return;
        root._jcsCfgBound = true;

        root.querySelectorAll('.jcs-cfg-tab').forEach((tab) => {
            tab.onclick = () => setConfigTab(tab.getAttribute('data-tab') || 'general');
        });
        const closeBtn = root.querySelector('#' + NS + '-cfg-close');
        if (closeBtn) closeBtn.onclick = () => toggleConfig(false);

        // 打开方式：分段按钮
        const modeEmbed = root.querySelector('#' + NS + '-cfg-mode-embed');
        const modeExt = root.querySelector('#' + NS + '-cfg-mode-ext');
        if (modeEmbed) modeEmbed.onclick = () => setOpenModeFromUi('embed');
        if (modeExt) modeExt.onclick = () => setOpenModeFromUi('external');
        // 兼容隐藏 checkbox（导入配置后可同步）
        const cfgExt = root.querySelector('#' + NS + '-cfg-ext');
        if (cfgExt) {
            cfgExt.addEventListener('change', () => {
                setOpenModeFromUi(cfgExt.checked ? 'external' : 'embed');
            });
        }

        // iframe 开关：标记待刷新，可撤销
        const cfgFrame = root.querySelector('#' + NS + '-cfg-frame-allow');
        if (cfgFrame) {
            cfgFrame.addEventListener('change', () => {
                if (state.cfgFramePrev == null) state.cfgFramePrev = isFrameAllowHost();
                setFrameAllowHost(!!cfgFrame.checked);
                state.cfgFrameDirty = (state.cfgFramePrev !== !!cfgFrame.checked);
                syncConfigGeneralUi();
                if (state.cfgFrameDirty) {
                    showToast(cfgFrame.checked ? '已允许 iframe，请刷新页面' : '已取消 iframe，请刷新页面');
                    setBackupStatus('框架设置已改，刷新后生效', 'ok');
                } else {
                    setBackupStatus('');
                }
            });
        }
        const frReload = root.querySelector('#' + NS + '-cfg-frame-reload');
        if (frReload) {
            frReload.onclick = () => {
                try { location.reload(); } catch (e) { showToast('请手动刷新页面'); }
            };
        }
        const frUndo = root.querySelector('#' + NS + '-cfg-frame-undo');
        if (frUndo) {
            frUndo.onclick = () => {
                if (state.cfgFramePrev == null) return;
                setFrameAllowHost(!!state.cfgFramePrev);
                state.cfgFrameDirty = false;
                state.cfgFramePrev = null;
                const fr = document.getElementById(NS + '-cfg-frame-allow');
                if (fr) fr.checked = isFrameAllowHost();
                syncConfigGeneralUi();
                showToast('已撤销框架设置更改');
                setBackupStatus('');
            };
        }

        // 主题分段
        const themeDark = root.querySelector('#' + NS + '-cfg-theme-dark');
        const themeLight = root.querySelector('#' + NS + '-cfg-theme-light');
        if (themeDark) themeDark.onclick = () => { setTheme('dark'); syncConfigGeneralUi(); showToast('已切换为深色'); };
        if (themeLight) themeLight.onclick = () => { setTheme('light'); syncConfigGeneralUi(); showToast('已切换为浅色'); };

        // 备份 · 本地文件
        const expBtn = root.querySelector('#' + NS + '-cfg-export');
        if (expBtn) {
            expBtn.onclick = () => {
                downloadConfigFile();
                let n = 0;
                try { n = countSitesInSnapshot(buildAllSitesSnapshot()); } catch (e) { /* ignore */ }
                setBackupStatus('已下载全部站点配置（' + n + ' 个站）', 'ok');
                setDropzoneMeta('<b>已导出</b> · ' + n + ' 个站', true);
                syncConfigGeneralUi();
            };
        }
        const expCopy = root.querySelector('#' + NS + '-cfg-export-copy');
        if (expCopy) {
            expCopy.onclick = () => {
                copyConfigToClipboard();
                let n = 0;
                try { n = countSitesInSnapshot(buildAllSitesSnapshot()); } catch (e) { /* ignore */ }
                setBackupStatus('已复制全部站点配置（' + n + ' 个站）', 'ok');
                syncConfigGeneralUi();
            };
        }
        const backupMore = root.querySelector('#' + NS + '-cfg-backup-more');
        const backupDetail = root.querySelector('#' + NS + '-cfg-backup-detail');
        if (backupMore && backupDetail) {
            backupMore.onclick = () => {
                const open = backupDetail.hasAttribute('hidden');
                if (open) {
                    backupDetail.removeAttribute('hidden');
                    backupMore.textContent = '粘贴导入 ▴';
                    backupMore.setAttribute('aria-expanded', 'true');
                    const ta = document.getElementById(NS + '-cfg-import-ta');
                    if (ta) setTimeout(() => { try { ta.focus(); } catch (e) { /* ignore */ } }, 30);
                } else {
                    backupDetail.setAttribute('hidden', '');
                    backupMore.textContent = '粘贴导入 ▾';
                    backupMore.setAttribute('aria-expanded', 'false');
                }
            };
        }
        const impInput = ensureImportFileInput();
        const dropzone = root.querySelector('#' + NS + '-cfg-dropzone');
        const openImportPicker = () => {
            const input = ensureImportFileInput();
            if (!input) return;
            try { input.value = ''; } catch (e) { /* ignore */ }
            try { input.click(); } catch (e2) { showToast('无法打开文件选择'); }
        };
        if (dropzone) {
            dropzone.addEventListener('click', () => openImportPicker());
            dropzone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openImportPicker();
                }
            });
            let dragDepth = 0;
            const setDrag = (on) => {
                dropzone.classList.toggle('is-drag', !!on);
            };
            dropzone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth += 1;
                setDrag(true);
            });
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                } catch (err) { /* ignore */ }
                setDrag(true);
            });
            dropzone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth = Math.max(0, dragDepth - 1);
                if (!dragDepth) setDrag(false);
            });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragDepth = 0;
                setDrag(false);
                const files = e.dataTransfer && e.dataTransfer.files;
                const file = files && files[0];
                if (!file) {
                    showToast('未检测到文件');
                    return;
                }
                importConfigFromFile(file).catch(() => { /* status already set */ });
            });
        }
        if (impInput && !impInput._jcsBoundChange) {
            impInput._jcsBoundChange = true;
            impInput.addEventListener('change', () => {
                const file = impInput.files && impInput.files[0];
                if (!file) return;
                importConfigFromFile(file).catch(() => { /* status already set */ });
            });
        }
        const impPaste = root.querySelector('#' + NS + '-cfg-import-paste');
        if (impPaste) {
            impPaste.onclick = () => {
                const ta = document.getElementById(NS + '-cfg-import-ta');
                const text = ta ? String(ta.value || '') : '';
                runLocalConfigImport(text, { sourceLabel: '粘贴内容', clearPaste: true })
                    .catch(() => { /* status already set */ });
            };
        }
        const mergeToggle = root.querySelector('#' + NS + '-cfg-import-merge');
        if (mergeToggle) {
            mergeToggle.addEventListener('change', () => {
                showToast(mergeToggle.checked ? '导入模式：合并' : '导入模式：覆盖');
            });
        }

        // WebDAV
        const davEnc = root.querySelector('#' + NS + '-dav-encrypt');
        if (davEnc) {
            davEnc.addEventListener('change', () => {
                // 不要在此调用 syncWebdavUi：会把未「保存设置」的勾选立刻刷回存储值
                const secret = document.getElementById(NS + '-dav-secret');
                const on = !!davEnc.checked;
                if (secret) {
                    secret.disabled = !on;
                    if (on) {
                        try { secret.focus(); } catch (e) { /* ignore */ }
                    }
                }
                const hint = document.getElementById(NS + '-dav-hint');
                const urlEl = document.getElementById(NS + '-dav-url');
                const fileEl = document.getElementById(NS + '-dav-file');
                if (hint) {
                    const base = (urlEl && urlEl.value) || '';
                    const file = (fileEl && fileEl.value) || WEBDAV_DEFAULT_FILE;
                    const target = base ? joinWebdavUrl(base, file) : '';
                    const encTip = on ? ' · <b>AES 加密</b>' : '';
                    hint.innerHTML = target
                        ? '当前目标：<code style="color:var(--jcs-accent2);word-break:break-all">' +
                            escapeHtml(target) + '</code>' + encTip
                        : (on
                            ? '已开启加密上传，请填写加密密码后点「保存设置」或直接「上传备份」。'
                            : '坚果云请用「应用密码」。开启加密后云端为密文，加密密码丢失将无法恢复。');
                }
                showToast(on ? '已开启加密上传' : '已关闭加密上传');
            });
        }
        const davSave = root.querySelector('#' + NS + '-dav-save');
        if (davSave) {
            davSave.onclick = () => {
                const o = readWebdavForm();
                if (o.encrypt && o.secret.length < 4) {
                    showToast('开启加密时，加密密码至少 4 位');
                    setBackupStatus('加密密码至少 4 位', 'err');
                    return;
                }
                saveWebdavOpts(o);
                syncWebdavUi();
                showToast('WebDAV 设置已保存' + (o.encrypt ? '（含加密）' : ''));
                setBackupStatus(
                    o.url
                        ? ('WebDAV 已保存 · ' + joinWebdavUrl(o.url, o.file) + (o.encrypt ? ' · 加密' : ''))
                        : '已清空 WebDAV 地址',
                    'ok'
                );
            };
        }
        const davTest = root.querySelector('#' + NS + '-dav-test');
        if (davTest) {
            davTest.onclick = () => {
                const o = readWebdavForm();
                setDavBusy(true);
                setBackupStatus('正在测试 WebDAV…', '');
                webdavTestConnection(o).then((r) => {
                    saveWebdavOpts(o);
                    syncWebdavUi();
                    const exists = r.exists === false ? '（文件尚不存在，可先上传）'
                        : r.exists ? '（文件已存在）' : '';
                    const msg = '连接成功 · HTTP ' + (r.status || '?') + ' · ' + (r.mode || '') + exists;
                    showToast('WebDAV 连接成功');
                    setBackupStatus(msg, 'ok');
                }).catch((e) => {
                    const msg = 'WebDAV 测试失败：' + ((e && e.message) || '未知错误');
                    showToast(msg);
                    setBackupStatus(msg, 'err');
                }).then(() => setDavBusy(false));
            };
        }
        const davUp = root.querySelector('#' + NS + '-dav-upload');
        if (davUp) {
            davUp.onclick = () => {
                const o = readWebdavForm();
                if (!o.url) {
                    showToast('请先填写 WebDAV 地址');
                    setBackupStatus('请先填写 WebDAV 地址', 'err');
                    return;
                }
                if (o.encrypt && o.secret.length < 4) {
                    showToast('加密上传需设置至少 4 位加密密码');
                    setBackupStatus('请填写加密密码', 'err');
                    return;
                }
                setDavBusy(true);
                setBackupStatus(o.encrypt ? '正在加密并上传…' : '正在上传到 WebDAV…', '');
                saveWebdavOpts(o);
                webdavUploadConfig(o).then((r) => {
                    syncWebdavUi();
                    const msg = (r.encrypted ? '已加密上传' : '已上传') +
                        '（' + (r.bytes || 0) + ' 字节）';
                    showToast(r.encrypted ? '加密备份已上传' : 'WebDAV 上传成功');
                    setBackupStatus(msg + ' · ' + r.url, 'ok');
                }).catch((e) => {
                    const msg = 'WebDAV 上传失败：' + ((e && e.message) || '未知错误');
                    showToast(msg);
                    setBackupStatus(msg, 'err');
                }).then(() => setDavBusy(false));
            };
        }
        const davDown = root.querySelector('#' + NS + '-dav-download');
        if (davDown) {
            davDown.onclick = () => {
                const o = readWebdavForm();
                if (!o.url) {
                    showToast('请先填写 WebDAV 地址');
                    setBackupStatus('请先填写 WebDAV 地址', 'err');
                    return;
                }
                const merge = getImportMergeMode();
                if (!confirmConfigImport(merge, 'WebDAV')) return;
                setDavBusy(true);
                setBackupStatus('正在从 WebDAV 下载…', '');
                saveWebdavOpts(o);
                webdavDownloadConfig(o).then((pack) => {
                    const text = pack && pack.text != null ? pack.text : pack;
                    importConfigBundle(text, { mergeProviders: merge });
                    let n = 0;
                    try { n = countSitesInSnapshot(buildAllSitesSnapshot()); } catch (e2) { /* ignore */ }
                    syncWebdavUi();
                    syncConfigGeneralUi();
                    const msg = (pack && pack.encrypted ? '已解密并恢复' : '已从 WebDAV 恢复') +
                        '（现 ' + n + ' 个站）';
                    showToast(msg);
                    setBackupStatus(msg, 'ok');
                }).catch((e) => {
                    const msg = 'WebDAV 恢复失败：' + ((e && e.message) || '未知错误');
                    showToast(msg);
                    setBackupStatus(msg, 'err');
                }).then(() => setDavBusy(false));
            };
        }
        syncWebdavUi();

        const hlOn = root.querySelector('#' + NS + '-hl-on');
        if (hlOn) {
            hlOn.addEventListener('change', () => {
                applyHlOptsFromUi(false);
                syncHlOptsUi();
            });
        }
        ['hl-text', 'hl-native', 'hl-auto'].forEach((id) => {
            const el = root.querySelector('#' + NS + '-' + id);
            if (el) el.addEventListener('change', () => applyHlOptsFromUi(false));
        });
        const hlApply = root.querySelector('#' + NS + '-hl-apply');
        if (hlApply) hlApply.onclick = () => applyHlOptsFromUi(true);
        const hlPick = root.querySelector('#' + NS + '-hl-pick');
        if (hlPick) {
            hlPick.onclick = () => {
                // 先把 textarea 里未保存的内容写入本站，避免点选回来被旧值覆盖
                try { applyHlOptsFromUi(false); } catch (e) { /* ignore */ }
                startSelectorPick();
            };
        }
        const hlClear = root.querySelector('#' + NS + '-hl-clear');
        if (hlClear) {
            hlClear.onclick = () => {
                const n = clearPageHighlight();
                showToast(n ? ('已清除 ' + n + ' 处高亮') : '本页没有可清除的高亮');
            };
        }
        const hlReset = root.querySelector('#' + NS + '-hl-reset');
        if (hlReset) {
            hlReset.onclick = () => {
                const host = currentHostname() || '本站';
                // 全局开关恢复默认，并清空「当前站」自定义选择器
                state.hl = Object.assign({}, DEFAULT_HL_OPTS);
                storeSetJson(HL_OPT_KEY, hlOptsForGlobalStore(state.hl));
                setSiteHlSelectors('', host);
                state.hl.nativeSelectors = '';
                syncHlOptsUi();
                clearPageHighlight();
                if (state.hl.enabled) linkifyPage();
                showToast('已恢复默认（已清空 ' + host + ' 的选择器）');
            };
        }
        const cfgReset = root.querySelector('#' + NS + '-cfg-reset');
        if (cfgReset) {
            cfgReset.onclick = () => {
                if (!window.confirm('恢复为内置默认搜索源？当前自定义源会被覆盖。')) return;
                resetProviders();
                state.provider = loadProviderId();
                state.cfgEditId = '';
                state.cfgDeleteId = '';
                renderProviders();
                renderConfigList();
                clearConfigForm({ focus: false });
                showToast('已恢复默认搜索源');
                if (state.active) loadFrame(state.active);
            };
        }
        const fadd = root.querySelector('#' + NS + '-fadd');
        if (fadd) fadd.onclick = () => startAddProvider();
        const fnew = root.querySelector('#' + NS + '-fnew');
        if (fnew) fnew.onclick = () => clearConfigForm({ focus: true });
        const fcancel = root.querySelector('#' + NS + '-fcancel');
        if (fcancel) fcancel.onclick = () => clearConfigForm({ focus: false, toast: '已取消编辑' });
        const fsave = root.querySelector('#' + NS + '-fsave');
        if (fsave) fsave.onclick = () => saveConfigForm();
        // 表单 Enter 保存 / Esc 取消
        ['fname', 'fid', 'furl', 'fhint'].forEach((k) => {
            const el = root.querySelector('#' + NS + '-' + k);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveConfigForm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    if (state.cfgEditId) clearConfigForm({ focus: false, toast: '已取消编辑' });
                    else clearConfigForm({ focus: false });
                }
            });
            el.addEventListener('input', () => {
                el.classList.remove('is-invalid');
            });
        });
    }

    function setConfigTab(tab) {
        const id = ['general', 'highlight', 'sources', 'backup'].indexOf(tab) >= 0 ? tab : 'general';
        state.cfgTab = id;
        const cfg = document.getElementById(NS + '-cfg');
        if (!cfg) return;
        cfg.querySelectorAll('.jcs-cfg-tab').forEach((el) => {
            const on = el.getAttribute('data-tab') === id;
            el.classList.toggle('is-on', on);
            el.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        cfg.querySelectorAll('.jcs-cfg-pane').forEach((pane) => {
            const on = pane.getAttribute('data-pane') === id;
            pane.classList.toggle('is-on', on);
            // 仅用 class 控制显示，避免 [hidden]{display:none!important} 盖住布局
            pane.removeAttribute('hidden');
            pane.setAttribute('aria-hidden', on ? 'false' : 'true');
        });
        if (id === 'sources') renderConfigList();
        if (id === 'highlight') syncHlOptsUi();
        if (id === 'general' || id === 'backup') syncConfigGeneralUi();
        if (id === 'backup') syncWebdavUi();
        // 切换到搜索源/备份时滚回顶部
        if (id === 'sources' || id === 'backup') {
            const body = cfg.querySelector('.jcs-cfg-body');
            if (body) try { body.scrollTop = 0; } catch (e) { /* ignore */ }
        }
    }

    function readWebdavForm() {
        const encEl = document.getElementById(NS + '-dav-encrypt');
        return normalizeWebdavOpts({
            url: (document.getElementById(NS + '-dav-url') || {}).value,
            user: (document.getElementById(NS + '-dav-user') || {}).value,
            pass: (document.getElementById(NS + '-dav-pass') || {}).value,
            file: (document.getElementById(NS + '-dav-file') || {}).value,
            encrypt: encEl ? !!encEl.checked : false,
            secret: (document.getElementById(NS + '-dav-secret') || {}).value
        });
    }

    function syncWebdavUi() {
        const o = loadWebdavOpts();
        const url = document.getElementById(NS + '-dav-url');
        const user = document.getElementById(NS + '-dav-user');
        const pass = document.getElementById(NS + '-dav-pass');
        const file = document.getElementById(NS + '-dav-file');
        const enc = document.getElementById(NS + '-dav-encrypt');
        const secret = document.getElementById(NS + '-dav-secret');
        const hint = document.getElementById(NS + '-dav-hint');
        if (url && document.activeElement !== url) url.value = o.url || '';
        if (user && document.activeElement !== user) user.value = o.user || '';
        if (pass && document.activeElement !== pass) pass.value = o.pass || '';
        if (file && document.activeElement !== file) file.value = o.file || WEBDAV_DEFAULT_FILE;
        if (enc) enc.checked = !!o.encrypt;
        if (secret && document.activeElement !== secret) secret.value = o.secret || '';
        if (secret) secret.disabled = !(enc && enc.checked);
        if (hint) {
            const target = o.url ? joinWebdavUrl(o.url, o.file) : '';
            const encTip = o.encrypt ? ' · <b>AES 加密</b>' : '';
            hint.innerHTML = target
                ? '当前目标：<code style="color:var(--jcs-accent2);word-break:break-all">' + escapeHtml(target) + '</code>' + encTip
                : '坚果云请用「应用密码」。开启加密后云端为密文，加密密码丢失将无法恢复。';
        }
    }

    function setDavBusy(busy) {
        ['dav-save', 'dav-test', 'dav-upload', 'dav-download'].forEach((id) => {
            const el = document.getElementById(NS + '-' + id);
            if (el) el.disabled = !!busy;
        });
    }

    function setBackupStatus(msg, kind) {
        const el = document.getElementById(NS + '-cfg-backup-status');
        if (!el) return;
        el.textContent = msg || '';
        el.classList.remove('is-ok', 'is-err');
        if (kind === 'ok') el.classList.add('is-ok');
        if (kind === 'err') el.classList.add('is-err');
    }

    function syncConfigGeneralUi() {
        const host = location.hostname || '当前站点';
        const hostEl = document.getElementById(NS + '-cfg-host');
        if (hostEl) {
            hostEl.textContent = host + (state.inFrame ? ' · 框架内' : '');
            hostEl.title = location.href || host;
        }
        const hostName = document.getElementById(NS + '-cfg-host-name');
        if (hostName) hostName.textContent = host;
        const hostMeta = document.getElementById(NS + '-cfg-host-meta');
        const userExt = isUserPreferExternal();
        const autoBlock = isHostFrameBlocked() || pageMetaBlocksFrames();
        const external = preferExternalSearch();
        const frameOn = isFrameAllowHost();
        if (hostMeta) {
            const parts = [];
            parts.push(state.inFrame ? (state.embedLite ? '框架内（精简）' : '框架内') : '顶层页面');
            parts.push(external ? '新标签打开' : '本页预览');
            if (frameOn) parts.push('iframe 已允许');
            hostMeta.textContent = parts.join(' · ');
        }

        const ext = document.getElementById(NS + '-cfg-ext');
        if (ext) ext.checked = userExt;

        const btnEmbed = document.getElementById(NS + '-cfg-mode-embed');
        const btnExt = document.getElementById(NS + '-cfg-mode-ext');
        // 有效模式：用户选新标签 或 自动禁嵌 → external
        const effectiveExternal = external;
        if (btnEmbed) {
            btnEmbed.classList.toggle('is-on', !effectiveExternal);
            btnEmbed.setAttribute('aria-pressed', !effectiveExternal ? 'true' : 'false');
        }
        if (btnExt) {
            btnExt.classList.toggle('is-on', effectiveExternal);
            btnExt.setAttribute('aria-pressed', effectiveExternal ? 'true' : 'false');
        }

        const hint = document.getElementById(NS + '-cfg-open-hint');
        if (hint) {
            if (userExt) {
                hint.innerHTML = '当前选择：<b>新标签打开</b>。点番号会弹出网站菜单，在新标签页打开。';
            } else if (autoBlock) {
                hint.innerHTML = '你选了本页预览，但<strong>本站限制了嵌入</strong>，实际仍会用新标签打开。';
            } else {
                hint.innerHTML = '当前选择：<b>本页预览</b>。点番号在弹窗里打开搜索页。';
            }
        }
        const callout = document.getElementById(NS + '-cfg-open-callout');
        if (callout) {
            if (autoBlock && !userExt) {
                callout.className = 'jcs-callout is-on is-warn';
                callout.textContent = '本站禁止页内嵌套第三方页面。若预览失败，请改用「新标签打开」。';
            } else if (userExt) {
                callout.className = 'jcs-callout is-on';
                callout.textContent = '已对本站记住「新标签打开」。点「本页预览」可改回。';
            } else {
                callout.className = 'jcs-callout';
                callout.textContent = '';
            }
        }

        const status = document.getElementById(NS + '-cfg-open-status');
        if (status) {
            status.innerHTML =
                '<span class="jcs-pill is-on">' + (effectiveExternal ? '新标签' : '本页预览') + '</span>' +
                (userExt ? '<span class="jcs-pill is-on">手动</span>' : '') +
                (autoBlock && !userExt ? '<span class="jcs-pill is-on">站点限制</span>' : '') +
                (frameOn ? '<span class="jcs-pill">iframe</span>' : '');
        }

        const fr = document.getElementById(NS + '-cfg-frame-allow');
        if (fr && !state.cfgFrameDirty) fr.checked = frameOn;
        const frCallout = document.getElementById(NS + '-cfg-frame-callout');
        const frActions = document.getElementById(NS + '-cfg-frame-actions');
        if (frCallout) frCallout.classList.toggle('is-on', !!state.cfgFrameDirty);
        if (frActions) {
            if (state.cfgFrameDirty) frActions.removeAttribute('hidden');
            else frActions.setAttribute('hidden', '');
        }

        const t = state.theme === 'light' ? 'light' : 'dark';
        const td = document.getElementById(NS + '-cfg-theme-dark');
        const tl = document.getElementById(NS + '-cfg-theme-light');
        if (td) {
            td.classList.toggle('is-on', t === 'dark');
            td.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
        }
        if (tl) {
            tl.classList.toggle('is-on', t === 'light');
            tl.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
        }

        const badge = document.getElementById(NS + '-cfg-store-badge');
        let siteN = 0;
        try {
            siteN = countSitesInSnapshot(buildAllSitesSnapshot());
        } catch (e) { siteN = 0; }
        if (badge) {
            badge.innerHTML = HAS_GM_STORE
                ? '<span class="jcs-pill is-on">全部站点存储</span><span class="jcs-pill is-on">' + siteN + ' 个站</span><span class="jcs-pill">v' + SCRIPT_VER + '</span>'
                : '<span class="jcs-pill is-on">仅本站（无 GM）</span><span class="jcs-pill">请用 Tampermonkey</span>';
        }
        const sum = document.getElementById(NS + '-cfg-backup-summary');
        if (sum) {
            if (!HAS_GM_STORE) {
                sum.innerHTML = '当前环境无法跨站汇总。请用 Tampermonkey/Violentmonkey 安装本脚本，配置会自动记入<strong>全部站点</strong>总库。';
            } else if (siteN <= 1) {
                sum.innerHTML = '已记录 <b>' + siteN + '</b> 个站点规则。可导出文件 / 复制 JSON；导入支持<strong>拖放、选文件、粘贴</strong>。到其它站改过设置后再导出即可带上那些站。';
            } else {
                sum.innerHTML = '将导出：<b>全局设置</b> + <b>' + siteN + ' 个站点</b>的专属规则。导入可拖放 JSON，或点选文件 / 粘贴。';
            }
        }
    }

    function setOpenModeFromUi(mode) {
        const wantExt = mode === 'external';
        // 与当前有效状态相同且用户意图一致时给提示
        if (wantExt && isUserPreferExternal()) {
            showToast('已是新标签打开');
            syncConfigGeneralUi();
            return;
        }
        if (!wantExt && !isUserPreferExternal() && !preferExternalSearch()) {
            showToast('已是本页预览');
            syncConfigGeneralUi();
            return;
        }
        setPreferExternalSearch(wantExt, { silent: true });
        syncConfigGeneralUi();
        showToast(wantExt ? '已改为：新标签打开搜索' : '已改为：本页预览搜索');
    }

    function toggleConfig(show) {
        if (show) ensurePopup();
        const cfg = document.getElementById(NS + '-cfg');
        if (!cfg) return;
        if (show) {
            cfg.classList.add('show');
            state.cfgDeleteId = '';
            if (!state.cfgFrameDirty) {
                state.cfgFramePrev = isFrameAllowHost();
                const fr = document.getElementById(NS + '-cfg-frame-allow');
                if (fr) fr.checked = !!state.cfgFramePrev;
            }
            applyExtModeUi();
            setConfigTab(state.cfgTab || 'general');
            syncConfigGeneralUi();
            syncHlOptsUi();
            renderConfigList();
            updateConfigFormMode();
            setBackupStatus('');
        } else {
            cfg.classList.remove('show');
            state.cfgDeleteId = '';
        }
    }

    function markFormInvalid(el) {
        if (!el) return;
        el.classList.add('is-invalid');
        try { el.focus(); } catch (e) { /* ignore */ }
    }

    function clearFormInvalid() {
        ['fname', 'fid', 'furl', 'fhint'].forEach((k) => {
            const el = document.getElementById(NS + '-' + k);
            if (el) el.classList.remove('is-invalid');
        });
    }

    function renderConfigList() {
        const box = document.getElementById(NS + '-plist');
        if (!box) return;
        const list = getProviders();
        const activeId = state.provider || loadProviderId();
        if (!list.length) {
            box.innerHTML = '<div class="jcs-empty-src">暂无搜索源，点右上角「＋ 添加」开始</div>';
            return;
        }
        box.innerHTML = list.map((p, i) => {
            const active = p.id === activeId;
            const editing = !!(state.cfgEditId && state.cfgEditId === p.id);
            const deleting = !!(state.cfgDeleteId && state.cfgDeleteId === p.id);
            const flash = !!(state.cfgFlashId && state.cfgFlashId === p.id);
            const name = escapeHtml(p.name || p.id);
            const url = escapeHtml(p.url || '');
            const hint = escapeHtml(p.hint || '');
            const cls = 'jcs-prow'
                + (active ? ' is-active' : '')
                + (editing ? ' is-editing' : '')
                + (deleting ? ' is-deleting' : '')
                + (flash ? ' is-flash' : '');
            let ops = '';
            if (deleting) {
                ops = '';
            } else {
                ops = '<div class="jcs-prow-ops">' +
                    '<button type="button" class="jcs-icon jcs-up" data-id="' + escapeHtml(p.id) + '" title="上移"' +
                    (i === 0 ? ' disabled' : '') + '>↑</button>' +
                    '<button type="button" class="jcs-icon jcs-dn" data-id="' + escapeHtml(p.id) + '" title="下移"' +
                    (i >= list.length - 1 ? ' disabled' : '') + '>↓</button>' +
                    '<button type="button" class="jcs-icon jcs-ed" data-id="' + escapeHtml(p.id) + '" title="编辑">✎</button>' +
                    '<button type="button" class="jcs-icon jcs-rm is-danger" data-id="' + escapeHtml(p.id) +
                    '" title="删除"' + (list.length <= 1 ? ' disabled' : '') + '>×</button>' +
                    '</div>';
            }
            const delBar = deleting
                ? ('<div class="jcs-prow-del">' +
                    '<b>删除「' + name + '」？</b>' +
                    '<div class="jcs-prow-del-actions">' +
                    '<button type="button" class="jcs-btn jcs-del-no" data-id="' + escapeHtml(p.id) + '">取消</button>' +
                    '<button type="button" class="jcs-btn solid is-danger jcs-del-yes" data-id="' + escapeHtml(p.id) + '">确认删除</button>' +
                    '</div></div>')
                : '';
            return '<div class="' + cls + '" data-id="' + escapeHtml(p.id) + '" data-i="' + i + '">' +
                '<button type="button" class="jcs-prow-main" data-id="' + escapeHtml(p.id) + '" title="单击设为当前源 · 双击编辑">' +
                '<strong><i class="jcs-dot" aria-hidden="true"></i><span>' + name + '</span>' +
                (active ? '<span class="jcs-prow-tag">使用中</span>' : '') +
                (editing ? '<span class="jcs-prow-tag">编辑中</span>' : '') +
                '</strong>' +
                '<code>' + url + '</code>' +
                (hint ? '<small>' + hint + '</small>' : '') +
                '</button>' + ops + delBar + '</div>';
        }).join('');

        box.querySelectorAll('.jcs-prow-main').forEach((b) => {
            b.onclick = (e) => {
                if (e.detail > 1) return; // 双击交给 dblclick
                const id = b.getAttribute('data-id') || '';
                if (state.cfgDeleteId === id) return;
                setActiveProviderFromConfig(id);
            };
            b.ondblclick = (e) => {
                e.preventDefault();
                const id = b.getAttribute('data-id') || '';
                startEditProvider(id);
            };
        });
        box.querySelectorAll('.jcs-up').forEach((b) => {
            b.onclick = (e) => {
                e.stopPropagation();
                moveProvById(b.getAttribute('data-id') || '', -1);
            };
        });
        box.querySelectorAll('.jcs-dn').forEach((b) => {
            b.onclick = (e) => {
                e.stopPropagation();
                moveProvById(b.getAttribute('data-id') || '', 1);
            };
        });
        box.querySelectorAll('.jcs-ed').forEach((b) => {
            b.onclick = (e) => {
                e.stopPropagation();
                startEditProvider(b.getAttribute('data-id') || '');
            };
        });
        box.querySelectorAll('.jcs-rm').forEach((b) => {
            b.onclick = (e) => {
                e.stopPropagation();
                askRemoveProvider(b.getAttribute('data-id') || '');
            };
        });
        box.querySelectorAll('.jcs-del-no').forEach((b) => {
            b.onclick = (e) => {
                e.stopPropagation();
                state.cfgDeleteId = '';
                renderConfigList();
            };
        });
        box.querySelectorAll('.jcs-del-yes').forEach((b) => {
            b.onclick = (e) => {
                e.stopPropagation();
                confirmRemoveProvider(b.getAttribute('data-id') || '');
            };
        });

        if (state.cfgFlashId) {
            const fid = state.cfgFlashId;
            setTimeout(() => {
                if (state.cfgFlashId === fid) {
                    state.cfgFlashId = '';
                    const row = document.querySelector('#' + NS + '-plist .jcs-prow[data-id="' +
                        String(fid).replace(/"/g, '\\"') + '"]');
                    if (row) row.classList.remove('is-flash');
                }
            }, 800);
        }
    }

    function setActiveProviderFromConfig(id) {
        const list = getProviders();
        const p = list.find((x) => x.id === id);
        if (!p) return;
        if (state.cfgDeleteId) {
            state.cfgDeleteId = '';
        }
        state.provider = p.id;
        saveProviderId(p.id);
        renderProviders();
        renderConfigList();
        showToast('当前源：' + (p.name || p.id));
        if (state.active && isSearchPopupOpen()) loadFrame(state.active);
    }

    function moveProvById(id, d) {
        const list = getProviders().slice();
        const i = list.findIndex((p) => p.id === id);
        const j = i + d;
        if (i < 0 || j < 0 || j >= list.length) return;
        const t = list[i]; list[i] = list[j]; list[j] = t;
        saveProviders(list);
        state.cfgDeleteId = '';
        renderConfigList();
        renderProviders();
    }

    function askRemoveProvider(id) {
        const list = getProviders();
        if (list.length <= 1) {
            showToast('至少保留一个搜索源');
            return;
        }
        const p = list.find((x) => x.id === id);
        if (!p) return;
        // 二次确认：再点同一删除或点「确认删除」
        if (state.cfgDeleteId === id) {
            confirmRemoveProvider(id);
            return;
        }
        state.cfgDeleteId = id;
        // 若正在编辑该项，保持编辑；删除确认优先展示
        renderConfigList();
    }

    function confirmRemoveProvider(id) {
        const list = getProviders().slice();
        if (list.length <= 1) {
            showToast('至少保留一个搜索源');
            state.cfgDeleteId = '';
            renderConfigList();
            return;
        }
        const idx = list.findIndex((p) => p.id === id);
        if (idx < 0) {
            state.cfgDeleteId = '';
            renderConfigList();
            return;
        }
        const rm = list.splice(idx, 1)[0];
        saveProviders(list);
        if (rm && state.provider === rm.id) {
            state.provider = list[0].id;
            saveProviderId(state.provider);
        }
        if (state.cfgEditId === id) clearConfigForm({ focus: false });
        state.cfgDeleteId = '';
        renderConfigList();
        renderProviders();
        showToast('已删除「' + (rm.name || rm.id) + '」');
        if (state.active && isSearchPopupOpen()) loadFrame(state.active);
    }

    function updateConfigFormMode() {
        const card = document.getElementById(NS + '-form-card');
        const title = document.getElementById(NS + '-form-title');
        const sub = document.getElementById(NS + '-form-sub');
        const cancel = document.getElementById(NS + '-fcancel');
        const saveBtn = document.getElementById(NS + '-fsave');
        const editing = !!state.cfgEditId;
        const p = editing ? getProviders().find((x) => x.id === state.cfgEditId) : null;
        if (card) card.classList.toggle('is-edit', editing);
        if (title) title.textContent = editing ? '编辑搜索源' : '添加搜索源';
        if (sub) {
            sub.textContent = editing
                ? (p ? ('正在修改「' + (p.name || p.id) + '」，保存后生效') : '修改后点保存')
                : '填写名称与网址，点保存即可添加';
        }
        if (cancel) {
            if (editing) cancel.removeAttribute('hidden');
            else cancel.setAttribute('hidden', '');
        }
        if (saveBtn) saveBtn.textContent = editing ? '保存修改' : '添加源';
    }

    function scrollFormIntoView() {
        const card = document.getElementById(NS + '-form-card');
        if (!card || !card.scrollIntoView) return;
        try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {
            try { card.scrollIntoView(true); } catch (e2) { /* ignore */ }
        }
    }

    function startAddProvider() {
        setConfigTab('sources');
        state.cfgDeleteId = '';
        clearConfigForm({ focus: true, toast: '' });
        scrollFormIntoView();
        showToast('请填写新搜索源');
    }

    function startEditProvider(id) {
        const list = getProviders();
        const p = list.find((x) => x.id === id);
        if (!p) return;
        setConfigTab('sources');
        state.cfgDeleteId = '';
        state.cfgEditId = p.id;
        clearFormInvalid();
        const idEl = document.getElementById(NS + '-fid');
        const name = document.getElementById(NS + '-fname');
        const url = document.getElementById(NS + '-furl');
        const hint = document.getElementById(NS + '-fhint');
        if (idEl) {
            idEl.value = p.id;
            idEl.dataset.editId = p.id;
        }
        if (name) name.value = p.name || '';
        if (url) url.value = p.url || '';
        if (hint) hint.value = p.hint || '';
        updateConfigFormMode();
        renderConfigList();
        scrollFormIntoView();
        setTimeout(() => {
            try {
                if (name) {
                    name.focus();
                    if (name.select) name.select();
                }
            } catch (e) { /* ignore */ }
        }, 40);
    }

    function clearConfigForm(opts) {
        const o = opts || {};
        state.cfgEditId = '';
        clearFormInvalid();
        ['fid', 'fname', 'furl', 'fhint'].forEach((k) => {
            const el = document.getElementById(NS + '-' + k);
            if (!el) return;
            el.value = '';
            if (k === 'fid') delete el.dataset.editId;
        });
        updateConfigFormMode();
        renderConfigList();
        if (o.toast) showToast(o.toast);
        if (o.focus) {
            const name = document.getElementById(NS + '-fname');
            setTimeout(() => {
                try { if (name) name.focus(); } catch (e) { /* ignore */ }
            }, 30);
        }
    }

    function saveConfigForm() {
        clearFormInvalid();
        const idEl = document.getElementById(NS + '-fid');
        const nameEl = document.getElementById(NS + '-fname');
        const urlEl = document.getElementById(NS + '-furl');
        const hintEl = document.getElementById(NS + '-fhint');
        const name = (nameEl && nameEl.value || '').trim();
        const url = (urlEl && urlEl.value || '').trim();
        if (!name) {
            showToast('请填写显示名称');
            markFormInvalid(nameEl);
            return;
        }
        if (!url) {
            showToast('请填写网址模板');
            markFormInvalid(urlEl);
            return;
        }
        if (!/\{code(_lower)?\}|\{CODE\}/i.test(url)) {
            showToast('网址需包含 {code} / {CODE} / {code_lower}');
            markFormInvalid(urlEl);
            return;
        }
        let id = (idEl && idEl.value || '').trim();
        if (!id) id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('p' + Date.now());
        const editId = (idEl && idEl.dataset.editId) || state.cfgEditId || '';
        const prevMode = editId ? getProviders().find((x) => x.id === editId) : null;
        const item = normalizeProvider({
            id, name, url,
            hint: (hintEl && hintEl.value) || '',
            mode: (prevMode && prevMode.mode) || undefined
        });
        if (!item) {
            showToast('保存失败，请检查填写内容');
            return;
        }
        const list = getProviders().slice();
        let savedId = item.id;
        if (editId) {
            const idx = list.findIndex((p) => p.id === editId);
            if (idx >= 0) {
                // 改 ID 时避免与其它项冲突
                if (item.id !== editId && list.some((p, i) => i !== idx && p.id === item.id)) {
                    item.id = editId;
                }
                list[idx] = item;
                savedId = item.id;
                if (state.provider === editId) {
                    state.provider = item.id;
                    saveProviderId(item.id);
                }
            } else {
                if (list.some((p) => p.id === item.id)) item.id = item.id + '_' + Date.now();
                list.push(item);
                savedId = item.id;
            }
        } else {
            if (list.some((p) => p.id === item.id)) item.id = item.id + '_' + Date.now();
            list.push(item);
            savedId = item.id;
        }
        saveProviders(list);
        state.cfgFlashId = savedId;
        state.cfgDeleteId = '';
        clearConfigForm({ focus: false });
        renderConfigList();
        renderProviders();
        showToast(editId ? ('已更新「' + name + '」') : ('已添加「' + name + '」'));
        // 滚到刚保存的项
        setTimeout(() => {
            try {
                const el = document.querySelector('#' + NS + '-plist .jcs-prow.is-flash');
                if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (e) { /* ignore */ }
        }, 30);
    }

    /** 大窗内搜索：始终 loadFrame，不降级旁出选源 */
    function runPopupSearch(code) {
        const q = String(code || '').trim();
        if (!q) {
            showToast('请输入番号');
            return '';
        }
        closeProviderPicker();
        const root = ensurePopup();
        state.provider = state.provider || loadProviderId();
        const c = rememberCode(q);
        if (!c) {
            showToast('请输入番号');
            return '';
        }
        const input = root.querySelector('#' + NS + '-pinput');
        if (input) input.value = c;
        const title = document.getElementById(NS + '-ptitle');
        if (title) {
            const p = getProvider(state.provider);
            title.textContent = c + ' · ' + (p && p.name ? p.name : '');
        }
        renderProviders();
        renderSideLists();
        renderMobiCodes();
        renderPanelList();
        loadFrame(c);
        // 每次打开/再次搜索：桌面端恢复居中（除非用户本会话已拖过且窗口仍开着）
        if (!root.classList.contains('show')) {
            resetSearchWinLayout();
            root.classList.add('show');
            document.documentElement.classList.add(NS + '-popup-open');
            lockBodyScroll(true);
        } else if (isMobile()) {
            resetSearchWinLayout();
        }
        if (isMobile()) {
            const tip = document.getElementById(NS + '-ptip');
            if (tip) {
                tip.textContent = buildProviderUrl(c, state.provider) + ' · 打不开可点「浏览器打开」';
            }
        }
        return c;
    }

    function isSearchPopupOpen() {
        const popup = document.getElementById(NS + '-popup');
        return !!(popup && popup.classList.contains('show'));
    }

    function openSearch(code, opts) {
        const o = opts || {};
        const normalized = normalizeSearchCode(code);
        // 大窗已开：只在窗内换源/换番号，绝不改走旁出菜单
        if (isSearchPopupOpen() || o.forceFull) {
            if (normalized || String(code || '').trim()) runPopupSearch(normalized || code);
            else {
                ensurePanel();
                closeProviderPicker();
                const root = ensurePopup();
                state.provider = loadProviderId();
                renderProviders();
                renderSideLists();
                renderMobiCodes();
                if (!root.classList.contains('show')) resetSearchWinLayout();
                root.classList.add('show');
                document.documentElement.classList.add(NS + '-popup-open');
                lockBodyScroll(true);
            }
            return;
        }
        // 禁嵌站且未开大窗：番号边上弹出小按钮，点源新窗口打开
        if (preferExternalSearch()) {
            let anchor = o.anchor || null;
            if (!anchor && o.event && o.event.currentTarget) anchor = o.event.currentTarget;
            openProviderPicker(normalized || code, anchor);
            return;
        }
        ensurePanel();
        closeProviderPicker();
        runPopupSearch(normalized || code);
    }

    function refreshScan(forceLinkify) {
        try {
            state.codes = scanPageCodes();
        } catch (e) {
            state.codes = state.codes || [];
        }
        const pickOpen = isPickerOpen();
        // 先保证面板列表有内容，再异步做页内高亮（javgg featured 等大页 linkify 很重）
        try {
            ensurePanel();
            renderPanelList(pickOpen ? { skipList: pickerAnchoredInPanelList() } : { force: true });
            if (!pickOpen && document.getElementById(NS + '-popup')) renderSideLists();
        } catch (e) { /* ignore */ }

        // forceLinkify===true：手动重扫也高亮；autoOnScan：扫描后自动高亮
        const hlOn = !state.hl || state.hl.enabled !== false;
        const hlAuto = !state.hl || state.hl.autoOnScan !== false;
        const wantLinkify = !pickOpen && hlOn && (
            forceLinkify === true || (forceLinkify !== false && hlAuto)
        );
        if (wantLinkify) {
            const runLinkify = () => {
                try { linkifyPage(); } catch (e) { /* ignore */ }
            };
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => setTimeout(runLinkify, 0));
            } else {
                setTimeout(runLinkify, 0);
            }
        }
        return state.codes;
    }

    // ─── 启动 ───────────────────────────────────────────────

    /** 静默探测本页是否禁止第三方 frame（响应头 CSP 在首次 open 前即可感知） */
    function probeHostFramePolicy() {
        if (isHostFrameBlocked() || pageMetaBlocksFrames()) {
            if (pageMetaBlocksFrames()) markHostFrameBlocked();
            return;
        }
        if (probeHostFramePolicy._done) return;
        probeHostFramePolicy._done = true;
        let settled = false;
        const finish = (blocked) => {
            if (settled) return;
            settled = true;
            try { document.removeEventListener('securitypolicyviolation', onViol); } catch (e) { /* ignore */ }
            try { if (probe && probe.parentNode) probe.parentNode.removeChild(probe); } catch (e) { /* ignore */ }
            if (blocked) {
                markHostFrameBlocked();
                try { renderPanelList(); } catch (e) { /* ignore */ }
            }
        };
        const onViol = (e) => {
            const dir = String((e && (e.effectiveDirective || e.violatedDirective)) || '').toLowerCase();
            if (/frame-src|child-src|default-src/.test(dir)) finish(true);
        };
        let probe = null;
        try {
            document.addEventListener('securitypolicyviolation', onViol);
            probe = document.createElement('iframe');
            probe.setAttribute('aria-hidden', 'true');
            probe.tabIndex = -1;
            probe.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;border:0;left:-9999px;top:0';
            probe.referrerPolicy = 'no-referrer';
            // 用稳定外域探测 frame-src；失败/拦截都只记策略，不展示 UI
            probe.src = 'https://example.com/';
            probe.addEventListener('error', () => finish(true));
            (document.documentElement || document.body).appendChild(probe);
            setTimeout(() => finish(false), 1200);
        } catch (e) {
            finish(false);
        }
    }

    // ─── CBox 轻量路径（参考 MaxJAV助手：框内只做高亮 + 通知父页）───

    function cboxPost(type, payload) {
        try {
            window.parent.postMessage(Object.assign({
                source: CBOX_MSG_SOURCE,
                type: type
            }, payload || {}), '*');
        } catch (e) { /* ignore */ }
    }

    function cboxNotifyOpen(code) {
        const c = String(code || '').trim();
        if (!c) return;
        cboxPost('open', { code: c });
        // 无父页（单独打开 cbox）时直接新标签
        try {
            if (window.top === window) {
                window.open(buildProviderUrl(c, loadProviderId()), '_blank', 'noopener,noreferrer');
            }
        } catch (e) {
            try {
                window.open(buildProviderUrl(c, loadProviderId()), '_blank', 'noopener,noreferrer');
            } catch (e2) { /* ignore */ }
        }
    }

    /** 拦截 CBox 内部垃圾跳转（与助手脚本同思路，极轻） */
    function installCboxNavGuard() {
        const block = (url) => {
            const s = String(url || '');
            return /cbox\.ws/i.test(s) && (/[?&]n=\d+-\d+-/i.test(s) || /\/~\d+-\d+-/i.test(s));
        };
        try {
            const d = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
            if (d && d.set) {
                Object.defineProperty(Location.prototype, 'href', {
                    configurable: true,
                    enumerable: true,
                    get: d.get,
                    set(v) {
                        if (!block(v)) d.set.call(this, v);
                    }
                });
            }
        } catch (e) { /* ignore */ }
        ['replace', 'assign'].forEach((k) => {
            try {
                const o = Location.prototype[k];
                if (typeof o !== 'function') return;
                Location.prototype[k] = function (url) {
                    if (block(url)) return;
                    return o.apply(this, arguments);
                };
            } catch (e) { /* ignore */ }
        });
    }

    function injectCboxLiteStyles() {
        if (document.getElementById(NS + '-cbox-style')) return;
        const css = document.createElement('style');
        css.id = NS + '-cbox-style';
        css.textContent =
            'a.' + NS + '-link,.' + NS + '-code-mark{' +
            'color:#d4534a!important;font-weight:700!important;cursor:pointer!important;' +
            'text-decoration:underline dotted!important;background:rgba(212,83,74,.14)!important;' +
            'border-radius:4px;padding:0 3px}' +
            'a.' + NS + '-link:hover,.' + NS + '-code-mark:hover{' +
            'background:#d4534a!important;color:#fff!important;text-decoration:none!important}';
        (document.head || document.documentElement).appendChild(css);
    }

    function processCboxTextNode(textNode) {
        const text = textNode.nodeValue;
        if (!text || !/[A-Za-z]/.test(text)) return;
        if (textNode.parentElement &&
            textNode.parentElement.closest('a,.' + NS + '-link,.' + NS + '-code-mark')) return;
        CODE_FIND_RE.lastIndex = 0;
        if (!CODE_FIND_RE.test(text)) return;
        CODE_FIND_RE.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let last = 0;
        let m;
        let hit = false;
        while ((m = CODE_FIND_RE.exec(text))) {
            const raw = m[0];
            const code = extractJavCode(raw);
            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            if (!code) {
                frag.appendChild(document.createTextNode(raw));
            } else {
                hit = true;
                const a = document.createElement('a');
                a.className = NS + '-link';
                a.href = buildProviderUrl(code, loadProviderId());
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = raw;
                a.dataset.code = code;
                a.title = '搜索 ' + code;
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cboxNotifyOpen(code);
                }, true);
                frag.appendChild(a);
            }
            last = m.index + raw.length;
        }
        if (!hit) return;
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
    }

    /** CBox 框内：只扫文字高亮，不做全站配置/浮钮 */
    function linkifyCbox(root) {
        const scope = root || document.body;
        if (!scope || !scope.querySelectorAll) return;
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                // #frmSend = 发帖框，勿动
                if (p.closest('a,script,style,textarea,input,.' + NS + '-link,.' + NS + '-code-mark,#frmSend')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (let i = 0; i < nodes.length; i++) processCboxTextNode(nodes[i]);
    }

    function syncCboxCodesToParent() {
        try {
            const text = document.body ? (document.body.innerText || document.body.textContent || '') : '';
            const codes = extractAllJavCodes(text);
            if (codes.length) cboxPost('codes', { codes: codes });
        } catch (e) { /* ignore */ }
    }

    function bootCboxLite() {
        installCboxNavGuard();
        const start = () => {
            if (!document.body) return;
            injectCboxLiteStyles();
            linkifyCbox(document.body);
            syncCboxCodesToParent();
            let t = null;
            const run = () => {
                clearTimeout(t);
                t = setTimeout(() => {
                    linkifyCbox(document.body);
                    syncCboxCodesToParent();
                }, 120);
            };
            try {
                new MutationObserver(run).observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            } catch (e) { /* ignore */ }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
        // 最小 API，避免其它脚本误判未就绪
        try {
            const lite = {
                __ready: true,
                __cboxLite: true,
                extract: extractJavCode,
                extractAll: extractAllJavCodes,
                linkify: () => linkifyCbox(document.body)
            };
            window.JavCodeKit = lite;
            _pageWin.JavCodeKit = lite;
        } catch (e) { /* ignore */ }
    }

    /** 父页接收 CBox iframe 的番号列表 / 打开搜索 */
    function bindCboxParentBridge() {
        if (IS_CBOX || bindCboxParentBridge._on) return;
        bindCboxParentBridge._on = true;
        window.addEventListener('message', (e) => {
            const d = e && e.data;
            if (!d || d.source !== CBOX_MSG_SOURCE) return;
            if (d.type === 'codes' && Array.isArray(d.codes)) {
                try {
                    const extra = [];
                    d.codes.forEach((raw) => {
                        const c = extractJavCode(raw) || String(raw || '').trim().toUpperCase();
                        if (c) extra.push(c);
                    });
                    if (!extra.length) return;
                    const seen = Object.create(null);
                    state.codes.forEach((c) => { seen[c] = 1; });
                    let n = 0;
                    extra.forEach((c) => {
                        if (seen[c]) return;
                        seen[c] = 1;
                        state.codes.push(c);
                        n++;
                    });
                    if (n) {
                        try { renderPanelList({ force: true }); } catch (err) { /* ignore */ }
                        try {
                            if (document.getElementById(NS + '-popup')) renderSideLists();
                        } catch (err2) { /* ignore */ }
                    }
                } catch (err) { /* ignore */ }
            } else if (d.type === 'open' && d.code) {
                try {
                    openSearch(String(d.code), { forceFull: true });
                } catch (err) { /* ignore */ }
            }
        });
    }

    function boot() {
        // CBox：独立轻量路径，不进全站 UI / 配置 / 扫描管线
        if (IS_CBOX) {
            bootCboxLite();
            return;
        }

        if (!document.body) {
            document.addEventListener('DOMContentLoaded', boot, { once: true });
            return;
        }
        state.theme = loadTheme();
        loadSubOpts();
        loadHlOpts();
        applyTheme(state.theme);
        bindCboxParentBridge();

        // iframe 精简模式：只高亮 + 导出 API，不挂浮钮（顶层已有完整 UI）
        if (state.embedLite) {
            injectStyles();
            refreshScan(true);
            let tLite = null;
            const scheduleLite = () => {
                clearTimeout(tLite);
                tLite = setTimeout(() => refreshScan(true), 800);
            };
            try {
                new MutationObserver(scheduleLite).observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            } catch (e) { /* ignore */ }
            return;
        }

        ensurePanel();
        applyExtModeUi();
        refreshScan(true);
        bindGlobalHotkeys();
        // 自身已在 iframe 内时不必再探测「能否嵌第三方」
        if (!state.inFrame) probeHostFramePolicy();

        let t = null;
        const schedule = () => {
            clearTimeout(t);
            t = setTimeout(() => refreshScan(true), 600);
        };
        try {
            new MutationObserver(schedule).observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        } catch (e) { /* ignore */ }
    }

    // ─── 公共 API（其他油猴脚本可复用） ─────────────────────

    const kit = {
        __ready: true,
        version: SCRIPT_VER,
        isMobile: isMobile,
        isInIframe: () => !!state.inFrame,
        isEmbedLite: () => !!state.embedLite,
        isFrameAllowHost: isFrameAllowHost,
        setFrameAllowHost: (on, host) => setFrameAllowHost(!!on, host),
        getFrameAllowHosts: loadFrameAllowHosts,
        exportConfig: exportConfigJson,
        importConfig: (raw, opts) => importConfigBundle(raw, opts || {}),
        downloadConfig: downloadConfigFile,
        hasGlobalStore: () => HAS_GM_STORE,
        getStoreKeys: () => STORE_KEYS.slice(),
        getWebdavOpts: () => {
            const o = loadWebdavOpts();
            return {
                url: o.url,
                user: o.user,
                file: o.file,
                hasPass: !!o.pass,
                encrypt: !!o.encrypt,
                hasSecret: !!o.secret
            };
        },
        saveWebdavOpts: (partial) => saveWebdavOpts(partial),
        webdavUpload: (opts) => webdavUploadConfig(opts),
        webdavDownload: (opts) => webdavDownloadConfig(opts),
        encryptConfig: (text, password) => encryptConfigPayload(text, password),
        decryptConfig: (text, password) => decryptConfigPayload(text, password),
        extract: extractJavCode,
        extractAll: extractAllJavCodes,
        fromDmmCid: fromDmmCid,
        scanPage: scanPageCodes,
        refresh: refreshScan,
        openSearch: openSearch,
        openProviderPicker: openProviderPicker,
        openSubtitleSearch: openSubtitleSearch,
        searchSubtitles: searchSubtitles,
        closeSubtitleSearch: closeSubtitleModal,
        preferExternalSearch: preferExternalSearch,
        isUserPreferExternal: isUserPreferExternal,
        setPreferExternalSearch: (on) => setPreferExternalSearch(!!on),
        togglePreferExternal: togglePreferExternal,
        getHlOpts: () => normalizeHlOpts(state.hl),
        setHlOpts: (partial, opts) => setHlOpts(partial, opts),
        linkify: linkifyPage,
        clearHighlight: clearPageHighlight,
        buildUrl: buildProviderUrl,
        getProviders: getProviders,
        saveProviders: saveProviders,
        resetProviders: resetProviders,
        getActiveProvider: () => state.provider || loadProviderId(),
        setActiveProvider: (id) => {
            state.provider = id;
            saveProviderId(id);
            renderProviders();
        },
        getCodes: () => state.codes.slice(),
        copyCode: copyCode,
        getTheme: () => state.theme || loadTheme(),
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        getSubUseOriginalName: () => !!state.subUseOriginalName,
        setSubUseOriginalName: (on) => {
            state.subUseOriginalName = !!on;
            saveSubOpts();
            const el = document.getElementById(NS + '-sub-orig');
            if (el) el.checked = !!state.subUseOriginalName;
            refreshSubtitleListView();
        },
        DEFAULT_PROVIDERS: DEFAULT_PROVIDERS.map((p) => Object.assign({}, p))
    };
    // CBox 轻量路径自管 API；主站再挂完整 kit
    if (!IS_CBOX) {
        try { window.JavCodeKit = kit; } catch (e) { /* ignore */ }
        try { _pageWin.JavCodeKit = kit; } catch (e) { /* ignore */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
